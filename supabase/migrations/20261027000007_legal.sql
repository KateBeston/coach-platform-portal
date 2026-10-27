-- Legal register for the internal portal, modelled on the TGS portal's Legal section.
-- Documents, versioned wording (never edited once accepted), files with an access log,
-- an automatic change log with reasons, acceptances with integrity checks,
-- archive-then-delete with the reason kept, and a compliance archive record.

-- ── access ────────────────────────────────────────────────────────────────
create or replace function public.staff_areas()
returns text[] language sql stable security definer set search_path = '' as $$
  select case public.staff_role()
    when 'owner'   then array['overview','coaches','accounts','notes','people','access','coach_access','legal']
    when 'admin'   then array['overview','coaches','accounts','notes','people','access','coach_access','legal']
    when 'support' then array['overview','coaches','notes','coach_access']
    when 'finance' then array['overview','coaches','accounts']
    else array[]::text[] end;
$$;

create or replace function public.is_portal_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.staff_role() = 'owner', false);
$$;
revoke execute on function public.is_portal_owner() from public, anon;
grant execute on function public.is_portal_owner() to authenticated;

create or replace function public.staff_display_name()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(name, ''), email) from public.staff where user_id = auth.uid();
$$;

-- ── settings (legal entity) ───────────────────────────────────────────────
create table public.platform_settings (
  setting_group text not null,
  setting_key text not null,
  setting_value text,
  updated_at timestamptz not null default now(),
  primary key (setting_group, setting_key)
);
alter table public.platform_settings enable row level security;
create policy platform_settings_read on public.platform_settings for select to authenticated using ((select public.is_staff()));
create policy platform_settings_write on public.platform_settings for all to authenticated
  using ((select public.has_area('legal'))) with check ((select public.has_area('legal')));

-- ── documents ─────────────────────────────────────────────────────────────
create table public.legal_documents (
  id bigint generated always as identity primary key,
  name text not null,
  slug text not null unique,
  document_type text not null default 'Public',
  category text,
  summary text,
  requires_acceptance boolean not null default false,
  meta_title text,
  meta_description text,
  is_published boolean not null default false,
  display_order int not null default 0,
  jurisdiction text default 'Queensland, Australia',
  owner_note text,
  review_due date,
  reviewed_by text,
  reviewed_at timestamptz,
  used_on text[],
  doc_status text not null default 'In draft' check (doc_status in ('In draft','Under review','With adviser','Current','Superseded','Retired')),
  sensitivity text not null default 'Internal' check (sensitivity in ('Public','Internal','Restricted','Privileged')),
  needs_attention text,
  archived_at timestamptz,
  archived_by text,
  archive_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.legal_document_versions (
  id bigint generated always as identity primary key,
  legal_document_id bigint not null references public.legal_documents(id) on delete cascade,
  version_label text,
  body text,
  effective_from date,
  effective_to date,
  is_current boolean not null default false,
  change_summary text,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.legal_document_versions (legal_document_id);

create table public.legal_files (
  id bigint generated always as identity primary key,
  legal_document_id bigint not null references public.legal_documents(id) on delete cascade,
  file_name text not null,
  storage_path text,
  external_url text,
  mime_type text,
  file_size_bytes bigint,
  file_kind text not null default 'Reference',
  file_format text,
  signed_by text,
  signed_at date,
  counterparty text,
  expires_at date,
  notes text,
  archive_contents text,
  uploaded_by text default public.staff_display_name(),
  uploaded_at timestamptz not null default now()
);
create index on public.legal_files (legal_document_id);

create table public.legal_file_access (
  id bigint generated always as identity primary key,
  legal_file_id bigint,
  legal_document_id bigint,
  file_name text,
  document_name text,
  accessed_by text,
  accessed_by_id uuid default auth.uid(),
  access_type text not null default 'Download',
  accessed_at timestamptz not null default now()
);
create index on public.legal_file_access (legal_document_id, accessed_at desc);

create table public.legal_change_log (
  id bigint generated always as identity primary key,
  legal_document_id bigint references public.legal_documents(id) on delete cascade,
  change_type text not null,
  summary text,
  field_name text,
  old_value text,
  new_value text,
  reason text,
  prompted_by text,
  reference text,
  changed_by text default public.staff_display_name(),
  changed_at timestamptz not null default now()
);
create index on public.legal_change_log (legal_document_id, changed_at desc);

create table public.legal_acceptances (
  id bigint generated always as identity primary key,
  legal_document_id bigint not null references public.legal_documents(id) on delete restrict,
  version_id bigint not null references public.legal_document_versions(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  coach_id uuid references public.coaches(id) on delete set null,
  accepted_by_name text,
  accepted_by_email text,
  accepted_at timestamptz not null default now(),
  ip_address text,
  source text not null default 'Portal',
  reference text,
  fingerprint text not null,
  characters_agreed_to int
);
create index on public.legal_acceptances (legal_document_id, accepted_at desc);

create table public.legal_document_deletions (
  id bigint generated always as identity primary key,
  document_id bigint,
  name text, slug text, document_type text, category text,
  versions_removed int, files_removed int, acceptances_at_deletion int,
  archived_at timestamptz, archive_reason text,
  reason text not null,
  deleted_by text default public.staff_display_name(),
  deleted_at timestamptz not null default now()
);

create table public.compliance_exports (
  id bigint generated always as identity primary key,
  export_kind text not null default 'Legal',
  exported_at timestamptz not null default now(),
  exported_by text default public.staff_display_name(),
  documents_count int, versions_count int, files_count int, acceptances_count int,
  size_bytes bigint,
  notes text
);

-- ── row-level security ────────────────────────────────────────────────────
do $$ declare t text; begin
  foreach t in array array['legal_documents','legal_document_versions','legal_files','legal_change_log',
                           'legal_acceptances','legal_document_deletions','compliance_exports','legal_file_access'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create policy legal_documents_read on public.legal_documents for select to authenticated using ((select public.has_area('legal')));
create policy legal_documents_insert on public.legal_documents for insert to authenticated with check ((select public.has_area('legal')));
create policy legal_documents_update on public.legal_documents for update to authenticated using ((select public.has_area('legal'))) with check ((select public.has_area('legal')));
create policy legal_documents_delete on public.legal_documents for delete to authenticated using ((select public.is_portal_owner()));

create policy legal_versions_read on public.legal_document_versions for select to authenticated using ((select public.has_area('legal')));
create policy legal_versions_insert on public.legal_document_versions for insert to authenticated with check ((select public.has_area('legal')));
create policy legal_versions_update on public.legal_document_versions for update to authenticated using ((select public.has_area('legal'))) with check ((select public.has_area('legal')));
create policy legal_versions_delete on public.legal_document_versions for delete to authenticated using ((select public.is_portal_owner()));

-- Privileged documents' files (legal advice) are owner-only.
create policy legal_files_read on public.legal_files for select to authenticated using (
  (select public.has_area('legal')) and (
    (select public.is_portal_owner())
    or (select sensitivity from public.legal_documents d where d.id = legal_document_id) <> 'Privileged'));
create policy legal_files_insert on public.legal_files for insert to authenticated with check ((select public.has_area('legal')));
create policy legal_files_update on public.legal_files for update to authenticated using ((select public.has_area('legal'))) with check ((select public.has_area('legal')));
create policy legal_files_delete on public.legal_files for delete to authenticated using ((select public.has_area('legal')));

-- Access log: written, read, never edited or deleted.
create policy legal_file_access_read on public.legal_file_access for select to authenticated using ((select public.has_area('legal')));
create policy legal_file_access_insert on public.legal_file_access for insert to authenticated with check ((select public.has_area('legal')));

create policy legal_change_log_read on public.legal_change_log for select to authenticated using ((select public.has_area('legal')));
create policy legal_change_log_insert on public.legal_change_log for insert to authenticated with check ((select public.has_area('legal')));
-- Only the explanation can be added afterwards (enforced by trigger below).
create policy legal_change_log_update on public.legal_change_log for update to authenticated using ((select public.has_area('legal'))) with check ((select public.has_area('legal')));

create policy legal_acceptances_read on public.legal_acceptances for select to authenticated using ((select public.has_area('legal')));
create policy legal_acceptances_insert on public.legal_acceptances for insert to authenticated with check ((select public.has_area('legal')));

create policy legal_deletions_read on public.legal_document_deletions for select to authenticated using ((select public.has_area('legal')));
create policy legal_deletions_insert on public.legal_document_deletions for insert to authenticated with check ((select public.is_portal_owner()));

create policy compliance_exports_read on public.compliance_exports for select to authenticated using ((select public.has_area('legal')));
create policy compliance_exports_insert on public.compliance_exports for insert to authenticated with check ((select public.has_area('legal')));

-- ── guards ────────────────────────────────────────────────────────────────
-- Wording someone has accepted can never be edited: revise by making a new version.
create or replace function public.legal_protect_accepted_wording()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.body is distinct from old.body
     and exists (select 1 from public.legal_acceptances a where a.version_id = old.id) then
    raise exception 'People have accepted this exact wording, so it can''t be edited. Create a new version instead.';
  end if;
  return new;
end $$;
create trigger legal_versions_protect before update on public.legal_document_versions
  for each row execute function public.legal_protect_accepted_wording();

-- The slug is the public address; it can't change while published.
create or replace function public.legal_protect_published_slug()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.slug is distinct from old.slug and old.is_published then
    raise exception 'protect_published_slug: the slug cannot change while the document is published';
  end if;
  if new.is_published and not old.is_published and new.doc_status = 'In draft' then
    raise exception 'A document in draft can''t be published. Set its status first.';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger legal_documents_guard before update on public.legal_documents
  for each row execute function public.legal_protect_published_slug();

-- Change log rows: only reason, prompted_by, reference and summary can be added later.
create or replace function public.legal_change_log_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.change_type, new.field_name, new.old_value, new.new_value, new.changed_by, new.changed_at, new.legal_document_id)
     is distinct from (old.change_type, old.field_name, old.old_value, old.new_value, old.changed_by, old.changed_at, old.legal_document_id) then
    raise exception 'The record of what changed can''t be edited — only why.';
  end if;
  return new;
end $$;
create trigger legal_change_log_guard before update on public.legal_change_log
  for each row execute function public.legal_change_log_guard();

-- ── automatic change log ──────────────────────────────────────────────────
create or replace function public.legal_log_document()
returns trigger language plpgsql security definer set search_path = '' as $$
declare col text; o jsonb; n jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.legal_change_log (legal_document_id, change_type, summary, changed_by)
    values (new.id, 'Created', 'Document created', public.staff_display_name());
    return new;
  end if;
  o := to_jsonb(old); n := to_jsonb(new);
  if new.is_published is distinct from old.is_published then
    insert into public.legal_change_log (legal_document_id, change_type, summary, changed_by)
    values (new.id, case when new.is_published then 'Published' else 'Unpublished' end,
            case when new.is_published then 'Published' else 'Taken down' end, public.staff_display_name());
  end if;
  foreach col in array array['name','slug','document_type','category','summary','requires_acceptance','jurisdiction',
                             'review_due','doc_status','sensitivity','used_on','archive_reason','meta_title','meta_description'] loop
    if (o->col) is distinct from (n->col) then
      insert into public.legal_change_log (legal_document_id, change_type, summary, field_name, old_value, new_value, changed_by)
      values (new.id, 'Field', initcap(replace(col, '_', ' ')) || ' changed', col, o->>col, n->>col, public.staff_display_name());
    end if;
  end loop;
  return new;
end $$;
create trigger legal_documents_log after insert or update on public.legal_documents
  for each row execute function public.legal_log_document();

create or replace function public.legal_log_version()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.legal_change_log (legal_document_id, change_type, summary, changed_by)
    values (new.legal_document_id, 'Version created', coalesce(new.version_label, 'New version') || ' started', public.staff_display_name());
  elsif tg_op = 'UPDATE' then
    if new.body is distinct from old.body then
      insert into public.legal_change_log (legal_document_id, change_type, summary, old_value, new_value, changed_by)
      values (new.legal_document_id, 'Wording', 'Wording of ' || coalesce(new.version_label, 'a version') || ' edited',
              length(coalesce(old.body,''))::text || ' characters', length(coalesce(new.body,''))::text || ' characters',
              public.staff_display_name());
    end if;
    if new.is_current and not old.is_current then
      insert into public.legal_change_log (legal_document_id, change_type, summary, changed_by)
      values (new.legal_document_id, 'Put in force', coalesce(new.version_label, 'A version') || ' put in force', public.staff_display_name());
    end if;
  elsif tg_op = 'DELETE' then
    insert into public.legal_change_log (legal_document_id, change_type, summary, changed_by)
    select old.legal_document_id, 'Version deleted', coalesce(old.version_label, 'A version') || ' deleted', public.staff_display_name()
    where exists (select 1 from public.legal_documents where id = old.legal_document_id);
    return old;
  end if;
  return new;
end $$;
create trigger legal_versions_log after insert or update or delete on public.legal_document_versions
  for each row execute function public.legal_log_version();

create or replace function public.legal_log_file()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.legal_change_log (legal_document_id, change_type, summary, changed_by)
    values (new.legal_document_id, 'File added', new.file_name, public.staff_display_name());
    return new;
  end if;
  insert into public.legal_change_log (legal_document_id, change_type, summary, changed_by)
  select old.legal_document_id, 'File removed', old.file_name, public.staff_display_name()
  where exists (select 1 from public.legal_documents where id = old.legal_document_id);
  return old;
end $$;
create trigger legal_files_log after insert or delete on public.legal_files
  for each row execute function public.legal_log_file();

revoke execute on function public.legal_log_document(), public.legal_log_version(), public.legal_log_file(),
  public.legal_protect_accepted_wording() from public, anon, authenticated;

-- ── acceptances ───────────────────────────────────────────────────────────
-- What someone agreed to is fingerprinted; "Intact" means the wording still matches.
create or replace view public.acceptance_record with (security_invoker = true) as
select a.id, a.accepted_at, a.accepted_by_name as signatory_name, a.accepted_by_email as signatory_email,
       a.source, a.reference, a.ip_address, a.characters_agreed_to, a.fingerprint,
       d.id as document_id, d.name as document, d.slug as document_slug,
       v.version_label as version, v.effective_from,
       c.business_name as coach_business,
       case when encode(extensions.digest(coalesce(v.body, ''), 'sha256'), 'hex') = a.fingerprint
            then 'Intact' else 'Changed since accepted' end as integrity
  from public.legal_acceptances a
  join public.legal_documents d on d.id = a.legal_document_id
  join public.legal_document_versions v on v.id = a.version_id
  left join public.coaches c on c.id = a.coach_id;

create or replace view public.unexplained_legal_changes with (security_invoker = true) as
select * from public.legal_change_log
 where reason is null and change_type in ('Wording','Put in force','Published','Unpublished');

-- Coaches accept the published coach documents when they sign up.
create or replace function public.record_signup_acceptances()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.raw_user_meta_data->>'agreed_terms_at', '') = '' then return new; end if;
  insert into public.legal_acceptances (legal_document_id, version_id, user_id, coach_id, accepted_by_name, accepted_by_email,
                                        accepted_at, source, fingerprint, characters_agreed_to)
  select d.id, v.id, new.id, (select c.id from public.coaches c where c.id = new.id),
         nullif(new.raw_user_meta_data->>'display_name', ''), new.email,
         coalesce((new.raw_user_meta_data->>'agreed_terms_at')::timestamptz, now()), 'Coach sign-up',
         encode(extensions.digest(coalesce(v.body, ''), 'sha256'), 'hex'), length(coalesce(v.body, ''))
    from public.legal_documents d
    join public.legal_document_versions v on v.legal_document_id = d.id and v.is_current
   where d.is_published and d.requires_acceptance and d.document_type = 'Coach' and d.archived_at is null;
  return new;
end $$;
revoke execute on function public.record_signup_acceptances() from public, anon, authenticated;
-- Runs after handle_new_coach (alphabetical trigger order: on_auth_user_created < on_auth_user_z_accept).
create trigger on_auth_user_z_accept after insert on auth.users
  for each row execute function public.record_signup_acceptances();

-- ── public reading ────────────────────────────────────────────────────────
-- The website and the coach app read published wording through this; drafts stay private.
create or replace function public.public_legal_document(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'slug', d.slug, 'name', d.name, 'summary', d.summary, 'category', d.category, 'audience', d.document_type,
    'meta_title', d.meta_title, 'meta_description', d.meta_description,
    'version_id', v.id, 'version_label', v.version_label, 'effective_from', v.effective_from,
    'change_summary', v.change_summary, 'body', v.body)
  from public.legal_documents d
  join public.legal_document_versions v on v.legal_document_id = d.id and v.is_current
  where d.slug = p_slug and d.is_published and d.archived_at is null and v.body is not null
  limit 1;
$$;
revoke execute on function public.public_legal_document(text) from public;
grant execute on function public.public_legal_document(text) to anon, authenticated;

-- ── file storage ──────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('legal', 'legal', false, 26214400)
on conflict (id) do nothing;

create policy legal_storage_read on storage.objects for select to authenticated
  using (bucket_id = 'legal' and (select public.has_area('legal')));
create policy legal_storage_write on storage.objects for insert to authenticated
  with check (bucket_id = 'legal' and (select public.has_area('legal')));
create policy legal_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'legal' and (select public.has_area('legal')));
