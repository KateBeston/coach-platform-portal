-- Internal portal: staff access, coach account records, internal notes and admin summaries.
-- Applied to the shared Supabase project (coach-platform). The portal can see counts only,
-- never a coach's clients, notes or session content.

create table public.staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','admin','support')),
  created_at timestamptz not null default now()
);
alter table public.staff enable row level security;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;
revoke execute on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;

create policy staff_read_self on public.staff for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));

create table public.coach_accounts (
  coach_id uuid primary key references public.coaches(id) on delete cascade,
  plan text not null default 'trial' check (plan in ('trial','founding','standard','pro','comp')),
  status text not null default 'trial' check (status in ('trial','active','past_due','paused','cancelled')),
  trial_ends_at date default (current_date + 30),
  monthly_price_cents int not null default 0,
  source text,
  updated_at timestamptz not null default now()
);
alter table public.coach_accounts enable row level security;
create policy coach_accounts_staff on public.coach_accounts for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy coach_accounts_own_read on public.coach_accounts for select to authenticated
  using (coach_id = (select auth.uid()));

create table public.admin_notes (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  kind text not null default 'note' check (kind in ('note','support','feedback','call','billing')),
  body text not null,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.admin_notes(coach_id, created_at desc);
alter table public.admin_notes enable row level security;
create policy admin_notes_staff on public.admin_notes for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

create or replace function public.handle_new_coach_account()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.coach_accounts (coach_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger coaches_account after insert on public.coaches for each row execute function public.handle_new_coach_account();
revoke execute on function public.handle_new_coach_account() from public, anon, authenticated;
insert into public.coach_accounts (coach_id) select id from public.coaches on conflict do nothing;

create function public.admin_coaches()
returns table (
  id uuid, email text, display_name text, business_name text, booking_slug text, timezone text,
  created_at timestamptz, last_sign_in_at timestamptz,
  plan text, status text, trial_ends_at date, monthly_price_cents int,
  clients_total bigint, clients_active bigint, arrangements_active bigint,
  sessions_30d bigint, sessions_upcoming bigint, invoices_total bigint, offers_total bigint,
  last_activity_at timestamptz, is_internal boolean
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'Not authorised'; end if;
  return query
  select c.id, c.email, c.display_name, c.business_name, c.booking_slug, c.timezone,
    c.created_at, u.last_sign_in_at,
    a.plan, a.status, a.trial_ends_at, a.monthly_price_cents,
    (select count(*) from public.clients x where x.coach_id = c.id),
    (select count(*) from public.clients x where x.coach_id = c.id and x.status = 'active'),
    (select count(*) from public.arrangements x where x.coach_id = c.id and x.status = 'active'),
    (select count(*) from public.sessions x where x.coach_id = c.id and x.status = 'completed' and x.starts_at > now() - interval '30 days'),
    (select count(*) from public.sessions x where x.coach_id = c.id and x.status = 'scheduled' and x.starts_at > now()),
    (select count(*) from public.invoices x where x.coach_id = c.id),
    (select count(*) from public.offers x where x.coach_id = c.id),
    (select max(x.created_at) from public.activity x where x.coach_id = c.id),
    exists (select 1 from public.staff s where s.user_id = c.id)
  from public.coaches c
  join auth.users u on u.id = c.id
  left join public.coach_accounts a on a.coach_id = c.id
  order by c.created_at desc;
end $$;
revoke execute on function public.admin_coaches() from public, anon;
grant execute on function public.admin_coaches() to authenticated;

create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  if not public.is_staff() then raise exception 'Not authorised'; end if;
  with c as (
    select c.id, c.created_at, u.last_sign_in_at, a.status, a.plan, a.monthly_price_cents, a.trial_ends_at
    from public.coaches c join auth.users u on u.id = c.id
    left join public.coach_accounts a on a.coach_id = c.id
    where not exists (select 1 from public.staff s where s.user_id = c.id)
  )
  select jsonb_build_object(
    'coaches_total', (select count(*) from c),
    'signups_7d', (select count(*) from c where created_at > now() - interval '7 days'),
    'signups_30d', (select count(*) from c where created_at > now() - interval '30 days'),
    'active_7d', (select count(*) from c where last_sign_in_at > now() - interval '7 days'),
    'on_trial', (select count(*) from c where status = 'trial'),
    'trials_ending_7d', (select count(*) from c where status = 'trial' and trial_ends_at between current_date and current_date + 7),
    'paying', (select count(*) from c where status = 'active'),
    'mrr_cents', (select coalesce(sum(monthly_price_cents),0) from c where status = 'active'),
    'cancelled', (select count(*) from c where status = 'cancelled'),
    'sessions_30d', (select count(*) from public.sessions x where x.status = 'completed' and x.starts_at > now() - interval '30 days'
                      and x.coach_id in (select id from c)),
    'clients_total', (select count(*) from public.clients x where x.coach_id in (select id from c)),
    'signups_by_week', coalesce((
      select jsonb_agg(jsonb_build_object('week', w::date, 'count', (select count(*) from c where created_at >= w and created_at < w + interval '7 days')) order by w)
      from generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '7 days') w), '[]'::jsonb)
  ) into r;
  return r;
end $$;
revoke execute on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;

-- Give someone portal access (run in the Supabase SQL editor):
-- insert into public.staff (user_id, role) select id, 'admin' from auth.users where email = 'name@example.com';
