-- Internal portal access, modelled on the TGS portal:
--   * staff roles map to areas; the sidebar greys out what a role can't enter,
--     and RLS enforces the same areas in the database
--   * staff can be invited by email, set inactive, and are refused at sign-in when inactive
--   * every sign-in, sign-out, time-out and failure is logged; repeated failures slow then block
-- Depends on 20261027000001_internal_portal.sql and the coach app's teams migration.

-- ── staff ────────────────────────────────────────────────────────────────
alter table public.staff drop constraint if exists staff_role_check;
alter table public.staff
  add column if not exists name text,
  add column if not exists email text,
  add column if not exists status text not null default 'active',
  add column if not exists invited_by uuid references auth.users(id) on delete set null;
alter table public.staff add constraint staff_role_check check (role in ('owner','admin','support','finance'));
alter table public.staff add constraint staff_status_check check (status in ('active','inactive'));
update public.staff s set email = u.email from auth.users u where u.id = s.user_id and s.email is null;

-- Inactive staff keep their password but lose the portal.
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff where user_id = auth.uid() and status = 'active');
$$;

create or replace function public.staff_role()
returns text language sql stable security definer set search_path = '' as $$
  select role from public.staff where user_id = auth.uid() and status = 'active';
$$;

-- Areas each role can enter. Owners and admins get everything.
create or replace function public.staff_areas()
returns text[] language sql stable security definer set search_path = '' as $$
  select case public.staff_role()
    when 'owner'   then array['overview','coaches','accounts','notes','people','access']
    when 'admin'   then array['overview','coaches','accounts','notes','people','access']
    when 'support' then array['overview','coaches','notes']
    when 'finance' then array['overview','coaches','accounts']
    else array[]::text[] end;
$$;

create or replace function public.has_area(p_area text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_area = any(public.staff_areas());
$$;

revoke execute on function public.staff_role(), public.staff_areas(), public.has_area(text) from public, anon;
grant execute on function public.staff_role(), public.staff_areas(), public.has_area(text) to authenticated;

drop policy if exists staff_read_self on public.staff;
create policy staff_read on public.staff for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));
create policy staff_manage on public.staff for update to authenticated
  using ((select public.has_area('people'))) with check ((select public.has_area('people')));

-- ── invitations ──────────────────────────────────────────────────────────
create table if not exists public.staff_invites (
  email text primary key,
  name text,
  role text not null default 'support' check (role in ('owner','admin','support','finance')),
  invited_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
alter table public.staff_invites enable row level security;
create policy staff_invites_manage on public.staff_invites for all to authenticated
  using ((select public.has_area('people'))) with check ((select public.has_area('people')));

-- Lets the /join page say whether an address has an open invitation. Returns a
-- yes/no only, never the role or who sent it.
create or replace function public.staff_invite_open(p_email text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff_invites where lower(email) = lower(trim(p_email)) and accepted_at is null);
$$;
revoke execute on function public.staff_invite_open(text) from public;
grant execute on function public.staff_invite_open(text) to anon, authenticated;

-- An invited address that already has a login (e.g. they also coach) is linked
-- the next time they sign in to the portal.
create or replace function public.claim_staff_invite()
returns boolean language plpgsql security definer set search_path = '' as $$
declare inv public.staff_invites; my_email text;
begin
  select email into my_email from auth.users where id = auth.uid();
  select * into inv from public.staff_invites where lower(email) = lower(my_email) and accepted_at is null;
  if inv.email is null then return false; end if;
  insert into public.staff (user_id, role, name, email, invited_by)
  values (auth.uid(), inv.role, inv.name, my_email, inv.invited_by)
  on conflict (user_id) do update set role = excluded.role, status = 'active';
  update public.staff_invites set accepted_at = now() where email = inv.email;
  return true;
end $$;
revoke execute on function public.claim_staff_invite() from public, anon;
grant execute on function public.claim_staff_invite() to authenticated;

-- New logins from an invited staff address become staff, not a coaching business.
create or replace function public.handle_new_coach()
returns trigger language plpgsql security definer set search_path = '' as $$
declare base text; slug text; invited uuid; owner_member uuid; inv public.staff_invites;
begin
  select * into inv from public.staff_invites where lower(email) = lower(new.email) and accepted_at is null;
  if inv.email is not null then
    insert into public.staff (user_id, role, name, email, invited_by)
    values (new.id, inv.role, inv.name, new.email, inv.invited_by) on conflict do nothing;
    update public.staff_invites set accepted_at = now() where email = inv.email;
    return new;
  end if;

  select id into invited from public.team_members
   where lower(email) = lower(new.email) and user_id is null and active
   order by created_at limit 1;
  if invited is not null then
    update public.team_members set user_id = new.id where id = invited;
    return new;
  end if;

  base := regexp_replace(lower(split_part(coalesce(new.email,'coach'), '@', 1)), '[^a-z0-9]+', '-', 'g');
  slug := base || '-' || substr(md5(new.id::text), 1, 4);
  insert into public.coaches (id, email, display_name, booking_slug)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', ''), slug);

  insert into public.team_members (coach_id, user_id, name, email, role, employment)
  values (new.id, new.id, coalesce(nullif(new.raw_user_meta_data->>'display_name',''), split_part(new.email,'@',1)), new.email, 'owner', 'owner')
  returning id into owner_member;

  insert into public.calendars (coach_id, member_id, name, kind, colour, blocks_availability, is_booking_destination)
  values (new.id, owner_member, 'Coaching', 'work', '#4F6D5C', true, true),
         (new.id, owner_member, 'Personal', 'personal', '#B07A5A', true, false);
  insert into public.availability_rules (coach_id, member_id, weekday, start_time, end_time)
  select new.id, owner_member, d, '09:00', '17:00' from generate_series(1,5) d;
  insert into public.offers (coach_id, name, kind, session_count, session_minutes, price_cents, billing, is_public)
  values (new.id, 'Discovery call', 'discovery', 1, 30, 0, 'free', true),
         (new.id, 'Single session', 'single', 1, 60, 20000, 'upfront', true);
  return new;
end $$;

-- Staff changes that only owners may make: nobody else can create, demote or
-- deactivate an owner, and nobody can deactivate themselves.
create or replace function public.guard_staff_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return new; end if;
  if new.user_id = auth.uid() and (new.status <> old.status or new.role <> old.role) then
    raise exception 'You can''t change your own role or status.';
  end if;
  if (old.role = 'owner' or new.role = 'owner') and public.staff_role() <> 'owner' then
    raise exception 'Only an owner can change an owner.';
  end if;
  return new;
end $$;
drop trigger if exists staff_guard on public.staff;
create trigger staff_guard before update on public.staff for each row execute function public.guard_staff_change();
revoke execute on function public.guard_staff_change() from public, anon, authenticated;

create or replace function public.guard_staff_invite()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role = 'owner' and public.staff_role() <> 'owner' then
    raise exception 'Only an owner can invite an owner.';
  end if;
  new.email := lower(trim(new.email));
  return new;
end $$;
drop trigger if exists staff_invite_guard on public.staff_invites;
create trigger staff_invite_guard before insert or update on public.staff_invites for each row execute function public.guard_staff_invite();
revoke execute on function public.guard_staff_invite() from public, anon, authenticated;

-- ── areas enforced on existing tables ────────────────────────────────────
drop policy if exists coach_accounts_staff on public.coach_accounts;
create policy coach_accounts_staff_read on public.coach_accounts for select to authenticated
  using ((select public.is_staff()));
create policy coach_accounts_staff_write on public.coach_accounts for insert to authenticated
  with check ((select public.has_area('accounts')));
create policy coach_accounts_staff_update on public.coach_accounts for update to authenticated
  using ((select public.has_area('accounts'))) with check ((select public.has_area('accounts')));

drop policy if exists admin_notes_staff on public.admin_notes;
create policy admin_notes_read on public.admin_notes for select to authenticated
  using ((select public.has_area('notes')));
create policy admin_notes_write on public.admin_notes for insert to authenticated
  with check ((select public.has_area('notes')));

-- ── access log and sign-in throttling ────────────────────────────────────
create table if not exists public.portal_access_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  event text not null check (event in ('Signed in','Signed out','Failed','Timed out','Session ended','Password changed','Joined')),
  reason text,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists portal_access_log_email on public.portal_access_log (lower(email), created_at desc);
alter table public.portal_access_log enable row level security;
create policy portal_access_log_read on public.portal_access_log for select to authenticated
  using ((select public.has_area('access')) or user_id = (select auth.uid()));

-- Written only through this function. Failures can be recorded without a
-- session (that's the point); anything else must be the signed-in person.
create or replace function public.portal_record_access(p_email text, p_event text, p_reason text default null, p_ip text default null, p_ua text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare me_email text;
begin
  if p_event <> 'Failed' then
    select email into me_email from auth.users where id = auth.uid();
    if me_email is null or lower(me_email) <> lower(trim(p_email)) then return; end if;
  end if;
  insert into public.portal_access_log (user_id, email, event, reason, ip, user_agent)
  values (case when p_event = 'Failed' then null else auth.uid() end, lower(trim(p_email)), p_event,
          left(p_reason, 300), left(p_ip, 64), left(p_ua, 400));
end $$;
revoke execute on function public.portal_record_access(text,text,text,text,text) from public;
grant execute on function public.portal_record_access(text,text,text,text,text) to anon, authenticated;

-- Four failures in 15 minutes slows sign-in; eight blocks it for 15 minutes.
-- Temporary on purpose: a permanent lock lets anyone lock out a known address.
create or replace function public.portal_login_blocked(p_email text)
returns jsonb language sql stable security definer set search_path = '' as $$
  with f as (
    select count(*) n, max(created_at) last_at from public.portal_access_log
     where lower(email) = lower(trim(p_email)) and event = 'Failed'
       and created_at > now() - interval '15 minutes'
       and created_at > coalesce((select max(created_at) from public.portal_access_log
                                   where lower(email) = lower(trim(p_email)) and event = 'Signed in'), '-infinity')
  )
  select jsonb_build_object(
    'blocked', n >= 8,
    'slow', n >= 4,
    'try_again_in', greatest(1, ceil(extract(epoch from (last_at + interval '15 minutes' - now())) / 60)::int))
  from f;
$$;
revoke execute on function public.portal_login_blocked(text) from public;
grant execute on function public.portal_login_blocked(text) to anon, authenticated;

-- ── coach detail: team size and roster (names and roles only) ───────────
create or replace function public.admin_coach_team(p_coach uuid)
returns table (name text, email text, role text, employment text, active boolean, signed_up boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'Not authorised'; end if;
  return query select t.name, t.email, t.role, t.employment, t.active, t.user_id is not null, t.created_at
    from public.team_members t where t.coach_id = p_coach order by t.active desc, t.created_at;
end $$;
revoke execute on function public.admin_coach_team(uuid) from public, anon;
grant execute on function public.admin_coach_team(uuid) to authenticated;

-- Staff can edit their own row (name); the guard trigger stops them changing their own role or status.
create policy staff_update_self on public.staff for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
