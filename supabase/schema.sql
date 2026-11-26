-- Schema applied to Supabase project "online-tech-office" (umvlpqiwjycmzxoabshn) as migration "initial_office_schema".
-- Visitors can only INSERT into the three intake tables and read published vacancies.
-- Everything else requires a signed-in user listed in public.admin_users.

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.vacancies (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 150),
  company text check (char_length(company) <= 150),
  location text check (char_length(location) <= 150),
  job_type text check (char_length(job_type) <= 60),
  description text check (char_length(description) <= 4000),
  requirements text check (char_length(requirements) <= 4000),
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.job_seekers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  qualification text not null check (char_length(qualification) between 2 and 200),
  experience text check (char_length(experience) <= 2000),
  desired_job text not null check (char_length(desired_job) between 2 and 150),
  residence text not null check (char_length(residence) between 2 and 120),
  phone text not null check (char_length(phone) between 6 and 30),
  status text not null default 'new' check (status in ('new','reviewed','contacted','archived')),
  created_at timestamptz not null default now()
);

create table public.employer_requests (
  id uuid primary key default gen_random_uuid(),
  org_name text not null check (char_length(org_name) between 2 and 150),
  positions text not null check (char_length(positions) between 2 and 1000),
  requirements text check (char_length(requirements) <= 2000),
  work_location text check (char_length(work_location) <= 150),
  phone text not null check (char_length(phone) between 6 and 30),
  status text not null default 'new' check (status in ('new','reviewed','contacted','archived')),
  created_at timestamptz not null default now()
);

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  service text not null check (char_length(service) between 2 and 80),
  full_name text not null check (char_length(full_name) between 2 and 120),
  phone text not null check (char_length(phone) between 6 and 30),
  message text not null check (char_length(message) between 2 and 3000),
  status text not null default 'new' check (status in ('new','reviewed','contacted','archived')),
  created_at timestamptz not null default now()
);

create index job_seekers_created_idx on public.job_seekers (created_at desc);
create index employer_requests_created_idx on public.employer_requests (created_at desc);
create index inquiries_created_idx on public.inquiries (created_at desc);
create index vacancies_published_idx on public.vacancies (is_published, created_at desc);

alter table public.admin_users enable row level security;
alter table public.vacancies enable row level security;
alter table public.job_seekers enable row level security;
alter table public.employer_requests enable row level security;
alter table public.inquiries enable row level security;

create policy admin_self_read on public.admin_users
  for select to authenticated using (user_id = (select auth.uid()));

create policy seekers_insert on public.job_seekers
  for insert to anon, authenticated with check (status = 'new');
create policy employers_insert on public.employer_requests
  for insert to anon, authenticated with check (status = 'new');
create policy inquiries_insert on public.inquiries
  for insert to anon, authenticated with check (status = 'new');

create policy seekers_admin_read on public.job_seekers for select to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));
create policy seekers_admin_update on public.job_seekers for update to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));
create policy seekers_admin_delete on public.job_seekers for delete to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

create policy employers_admin_read on public.employer_requests for select to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));
create policy employers_admin_update on public.employer_requests for update to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));
create policy employers_admin_delete on public.employer_requests for delete to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

create policy inquiries_admin_read on public.inquiries for select to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));
create policy inquiries_admin_update on public.inquiries for update to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));
create policy inquiries_admin_delete on public.inquiries for delete to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

create policy vacancies_public_read on public.vacancies for select to anon using (is_published);
create policy vacancies_auth_read on public.vacancies for select to authenticated
  using (is_published or exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));
create policy vacancies_admin_insert on public.vacancies for insert to authenticated
  with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));
create policy vacancies_admin_update on public.vacancies for update to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));
create policy vacancies_admin_delete on public.vacancies for delete to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

revoke all on public.admin_users, public.job_seekers, public.employer_requests, public.inquiries, public.vacancies from anon;
grant insert on public.job_seekers, public.employer_requests, public.inquiries to anon;
grant select on public.vacancies to anon;

-- To make someone an admin: create their user in Supabase → Authentication → Users, then run:
--   insert into public.admin_users (user_id) select id from auth.users where email = 'admin@example.com';

-- ===== Migration "job_seekers_full_application_and_files" (2026-11-25) =====
-- Full multi-step application: extra answers (details), uploaded files (attachments), admin-only review fields.
create or replace function public.seeker_attachments_ok(a jsonb, rid uuid)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(a) = 'array'
     and jsonb_array_length(a) <= 12
     and not exists (
       select 1 from jsonb_array_elements(a) e
       where jsonb_typeof(e) <> 'object'
          or coalesce(e->>'path', '') not like ('uploads/' || rid::text || '/%')
          or char_length(coalesce(e->>'name', '')) > 200
          or char_length(coalesce(e->>'kind', '')) > 40
     );
$$;

alter table public.job_seekers
  add column details jsonb not null default '[]'::jsonb,
  add column attachments jsonb not null default '[]'::jsonb,
  add column consent boolean not null default false,
  add column interview_result text,
  add column admin_notes text;

alter table public.job_seekers
  add constraint job_seekers_details_check check (jsonb_typeof(details) = 'array' and pg_column_size(details) <= 30000),
  add constraint job_seekers_attachments_check check (public.seeker_attachments_ok(attachments, id)),
  add constraint job_seekers_interview_check check (char_length(interview_result) <= 500),
  add constraint job_seekers_notes_check check (char_length(admin_notes) <= 4000);

alter table public.job_seekers drop constraint job_seekers_status_check;
alter table public.job_seekers add constraint job_seekers_status_check
  check (status in ('new','reviewed','contacted','accepted','rejected','archived'));

drop policy seekers_insert on public.job_seekers;
create policy seekers_insert on public.job_seekers
  for insert to anon, authenticated
  with check (status = 'new' and interview_result is null and admin_notes is null);

-- Private bucket for CVs and photos (15 MB per file)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('seeker-files', 'seeker-files', false, 15728640, array[
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'
]);

-- Visitors may only add new files under uploads/<uuid>/ ; they cannot list, read, replace or delete.
create policy seeker_files_anon_upload on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'seeker-files' and (storage.foldername(name))[1] = 'uploads');
create policy seeker_files_admin_read on storage.objects
  for select to authenticated
  using (bucket_id = 'seeker-files' and exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));
create policy seeker_files_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'seeker-files' and exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

-- ===== Migration "employer_requests_full_form" (2026-11-26) =====
-- Full employer request (details[]), consent, admin-only candidates/notes, wider status set.
alter table public.employer_requests
  add column details jsonb not null default '[]'::jsonb,
  add column consent boolean not null default false,
  add column candidates text,
  add column admin_notes text;
alter table public.employer_requests
  add constraint employer_requests_details_check check (jsonb_typeof(details) = 'array' and pg_column_size(details) <= 30000),
  add constraint employer_requests_candidates_check check (char_length(candidates) <= 2000),
  add constraint employer_requests_notes_check check (char_length(admin_notes) <= 4000);
alter table public.employer_requests drop constraint employer_requests_status_check;
alter table public.employer_requests add constraint employer_requests_status_check
  check (status in ('new','reviewed','contacted','processing','done','archived'));
drop policy employers_insert on public.employer_requests;
create policy employers_insert on public.employer_requests
  for insert to anon, authenticated
  with check (status = 'new' and candidates is null and admin_notes is null);

-- ===== Migration "inquiries_service_length" (2026-11-26) =====
-- Service field now carries "القسم – الخدمة الفرعية".
alter table public.inquiries drop constraint inquiries_service_check;
alter table public.inquiries add constraint inquiries_service_check check (char_length(service) between 2 and 200);

-- ===== Migration "request_tracking" (2026-11-26) =====
-- Request numbers (OT-######) on all request tables, client-facing note, last-update time,
-- cross-table unique numbers, and a phone-verified public tracking lookup with simple rate limiting.
create or replace function public.gen_ref() returns text
language sql volatile set search_path = '' as $$
  select 'OT-' || (100000 + floor(random() * 900000))::int::text;
$$;

alter table public.job_seekers       add column ref text, add column public_note text, add column updated_at timestamptz not null default now();
alter table public.employer_requests add column ref text, add column public_note text, add column updated_at timestamptz not null default now();
alter table public.inquiries         add column ref text, add column public_note text, add column admin_notes text, add column updated_at timestamptz not null default now();
-- (existing rows were backfilled with unique numbers here)

alter table public.job_seekers       alter column ref set default public.gen_ref(), alter column ref set not null,
  add constraint job_seekers_ref_check check (ref ~ '^OT-[0-9]{6}$'), add constraint job_seekers_ref_key unique (ref),
  add constraint job_seekers_public_note_check check (char_length(public_note) <= 500);
alter table public.employer_requests alter column ref set default public.gen_ref(), alter column ref set not null,
  add constraint employer_requests_ref_check check (ref ~ '^OT-[0-9]{6}$'), add constraint employer_requests_ref_key unique (ref),
  add constraint employer_requests_public_note_check check (char_length(public_note) <= 500);
alter table public.inquiries         alter column ref set default public.gen_ref(), alter column ref set not null,
  add constraint inquiries_ref_check check (ref ~ '^OT-[0-9]{6}$'), add constraint inquiries_ref_key unique (ref),
  add constraint inquiries_public_note_check check (char_length(public_note) <= 500),
  add constraint inquiries_admin_notes_check check (char_length(admin_notes) <= 4000);

alter table public.inquiries drop constraint inquiries_status_check;
alter table public.inquiries add constraint inquiries_status_check
  check (status in ('new','reviewed','contacted','processing','shipping','done','rejected','archived'));
alter table public.employer_requests drop constraint employer_requests_status_check;
alter table public.employer_requests add constraint employer_requests_status_check
  check (status in ('new','reviewed','contacted','processing','done','rejected','archived'));

create or replace function public.request_ref_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.ref is distinct from old.ref then
    if (tg_table_name <> 'job_seekers'       and exists (select 1 from public.job_seekers       where ref = new.ref))
    or (tg_table_name <> 'employer_requests' and exists (select 1 from public.employer_requests where ref = new.ref))
    or (tg_table_name <> 'inquiries'         and exists (select 1 from public.inquiries         where ref = new.ref)) then
      raise exception 'duplicate request number' using errcode = '23505';
    end if;
  end if;
  if tg_op = 'UPDATE' then new.updated_at := now(); end if;
  return new;
end $$;
revoke execute on function public.request_ref_guard() from public, anon, authenticated;
create trigger job_seekers_ref_guard       before insert or update on public.job_seekers       for each row execute function public.request_ref_guard();
create trigger employer_requests_ref_guard before insert or update on public.employer_requests for each row execute function public.request_ref_guard();
create trigger inquiries_ref_guard         before insert or update on public.inquiries         for each row execute function public.request_ref_guard();

drop policy seekers_insert on public.job_seekers;
create policy seekers_insert on public.job_seekers for insert to anon, authenticated
  with check (status = 'new' and interview_result is null and admin_notes is null and public_note is null);
drop policy employers_insert on public.employer_requests;
create policy employers_insert on public.employer_requests for insert to anon, authenticated
  with check (status = 'new' and candidates is null and admin_notes is null and public_note is null);
drop policy inquiries_insert on public.inquiries;
create policy inquiries_insert on public.inquiries for insert to anon, authenticated
  with check (status = 'new' and admin_notes is null and public_note is null);

-- failed-lookup log (no policies on purpose: only track_request writes it)
create table public.track_attempts (ref text not null, at timestamptz not null default now());
create index track_attempts_ref_idx on public.track_attempts (ref, at desc);
alter table public.track_attempts enable row level security;
revoke all on public.track_attempts from anon, authenticated;

-- Public tracking (intentionally callable by anon): returns kind, title, stage and note only — never names or numbers.
create or replace function public.track_request(p_ref text, p_phone text)
returns table (kind text, title text, stage text, delivery boolean, note text, created_at timestamptz, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_ref text := upper(trim(coalesce(p_ref, '')));
  v_ph  text := right(regexp_replace(translate(coalesce(p_phone, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\D', '', 'g'), 9);
  v_n   integer := 0;
begin
  if v_ref !~ '^OT-[0-9]{6}$' or char_length(v_ph) < 6 then return; end if;
  if (select count(*) from public.track_attempts a where a.ref = v_ref and a.at > now() - interval '1 hour') >= 8 then
    raise exception 'too many attempts' using errcode = 'P0001', hint = 'rate_limited';
  end if;

  return query
    select 'job'::text, ('طلب توظيف – ' || s.desired_job)::text,
      case s.status when 'new' then 'new' when 'accepted' then 'done' when 'rejected' then 'rejected' when 'archived' then 'closed' else 'processing' end,
      false, s.public_note, s.created_at, s.updated_at
    from public.job_seekers s
    where s.ref = v_ref and right(regexp_replace(translate(s.phone, '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\D', '', 'g'), 9) = v_ph
    union all
    select 'employer', ('طلب موظفين – ' || e.positions)::text,
      case e.status when 'new' then 'new' when 'done' then 'done' when 'rejected' then 'rejected' when 'archived' then 'closed' else 'processing' end,
      false, e.public_note, e.created_at, e.updated_at
    from public.employer_requests e
    where e.ref = v_ref and right(regexp_replace(translate(e.phone, '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\D', '', 'g'), 9) = v_ph
    union all
    select 'service', i.service::text,
      case i.status when 'new' then 'new' when 'shipping' then 'shipping' when 'done' then 'done' when 'rejected' then 'rejected' when 'archived' then 'closed' else 'processing' end,
      (i.status = 'shipping' or i.service like 'الدعاية%' or i.service like 'الخدمات الطلابية%'),
      i.public_note, i.created_at, i.updated_at
    from public.inquiries i
    where i.ref = v_ref and right(regexp_replace(translate(i.phone, '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\D', '', 'g'), 9) = v_ph;

  get diagnostics v_n = row_count;
  if v_n = 0 then
    insert into public.track_attempts (ref) values (v_ref);
    delete from public.track_attempts where at < now() - interval '1 day';
  end if;
end $$;
revoke execute on function public.track_request(text, text) from public;
grant execute on function public.track_request(text, text) to anon, authenticated;

-- ===== Migration "track_rate_limit_per_ip" (2026-11-26) =====
-- Rate-limit tracking lookups per caller IP (not per request number), so a guesser can never lock out the real customer.
alter table public.track_attempts add column ip text not null default 'unknown';
drop index if exists public.track_attempts_ref_idx;
create index track_attempts_ip_idx on public.track_attempts (ip, at desc);

create or replace function public.client_ip() returns text
language plpgsql stable set search_path = '' as $$
declare h json;
begin
  begin h := nullif(current_setting('request.headers', true), '')::json; exception when others then h := null; end;
  if h is null then return 'unknown'; end if;
  return coalesce(nullif(h->>'cf-connecting-ip', ''), nullif(h->>'x-real-ip', ''),
                  nullif(trim(split_part(h->>'x-forwarded-for', ',', 1)), ''), 'unknown');
end $$;
revoke execute on function public.client_ip() from public, anon, authenticated;

create or replace function public.track_request(p_ref text, p_phone text)
returns table (kind text, title text, stage text, delivery boolean, note text, created_at timestamptz, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_ref text := upper(trim(coalesce(p_ref, '')));
  v_ph  text := right(regexp_replace(translate(coalesce(p_phone, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\D', '', 'g'), 9);
  v_ip  text := public.client_ip();
  v_n   integer := 0;
begin
  if v_ref !~ '^OT-[0-9]{6}$' or char_length(v_ph) < 6 then return; end if;
  -- this device: max 8 wrong tries per request number, and 30 wrong tries overall, per hour
  if (select count(*) from public.track_attempts a where a.ip = v_ip and a.ref = v_ref and a.at > now() - interval '1 hour') >= 8
  or (select count(*) from public.track_attempts a where a.ip = v_ip and a.at > now() - interval '1 hour') >= 30 then
    raise exception 'too many attempts' using errcode = 'P0001', hint = 'rate_limited';
  end if;

  return query
    select 'job'::text, ('طلب توظيف – ' || s.desired_job)::text,
      case s.status when 'new' then 'new' when 'accepted' then 'done' when 'rejected' then 'rejected' when 'archived' then 'closed' else 'processing' end,
      false, s.public_note, s.created_at, s.updated_at
    from public.job_seekers s
    where s.ref = v_ref and right(regexp_replace(translate(s.phone, '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\D', '', 'g'), 9) = v_ph
    union all
    select 'employer', ('طلب موظفين – ' || e.positions)::text,
      case e.status when 'new' then 'new' when 'done' then 'done' when 'rejected' then 'rejected' when 'archived' then 'closed' else 'processing' end,
      false, e.public_note, e.created_at, e.updated_at
    from public.employer_requests e
    where e.ref = v_ref and right(regexp_replace(translate(e.phone, '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\D', '', 'g'), 9) = v_ph
    union all
    select 'service', i.service::text,
      case i.status when 'new' then 'new' when 'shipping' then 'shipping' when 'done' then 'done' when 'rejected' then 'rejected' when 'archived' then 'closed' else 'processing' end,
      (i.status = 'shipping' or i.service like 'الدعاية%' or i.service like 'الخدمات الطلابية%'),
      i.public_note, i.created_at, i.updated_at
    from public.inquiries i
    where i.ref = v_ref and right(regexp_replace(translate(i.phone, '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\D', '', 'g'), 9) = v_ph;

  get diagnostics v_n = row_count;
  if v_n = 0 then
    insert into public.track_attempts (ref, ip) values (v_ref, v_ip);
    delete from public.track_attempts where at < now() - interval '1 day';
  end if;
end $$;
revoke execute on function public.track_request(text, text) from public;
grant execute on function public.track_request(text, text) to anon, authenticated;

-- ===== Migration "trust_content" (2026-11-26) =====
-- Trust content: portfolio (works), partners, customer reviews, news. Admin-managed; visitors read published items only.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_users a where a.user_id = (select auth.uid()));
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create table public.works (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 150),
  category text not null check (category in ('employment','students','design','marketing','events','travel','realestate','office')),
  description text check (char_length(description) <= 1500),
  client text check (char_length(client) <= 120),
  image_path text check (char_length(image_path) <= 300),
  sort int not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 150),
  field text check (char_length(field) <= 120),
  url text check (url ~ '^https?://' and char_length(url) <= 300),
  logo_path text check (char_length(logo_path) <= 300),
  sort int not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 200),
  body text not null check (char_length(body) between 2 and 5000),
  image_path text check (char_length(image_path) <= 300),
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  city text check (char_length(city) <= 60),
  service text check (char_length(service) <= 80),
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 10 and 1000),
  ref text check (ref ~ '^OT-[0-9]{6}$'),
  phone text check (char_length(phone) between 6 and 30),
  consent boolean not null default false,
  status text not null default 'pending' check (status in ('pending','approved','hidden')),
  created_at timestamptz not null default now()
);
create index works_pub_idx on public.works (is_published, sort, created_at desc);
create index partners_pub_idx on public.partners (is_published, sort);
create index news_pub_idx on public.news (is_published, created_at desc);
create index reviews_status_idx on public.reviews (status, created_at desc);

alter table public.works enable row level security;
alter table public.partners enable row level security;
alter table public.news enable row level security;
alter table public.reviews enable row level security;

-- public reads (published / approved only)
create policy works_read on public.works for select to anon, authenticated using (is_published or (select public.is_admin()));
create policy partners_read on public.partners for select to anon, authenticated using (is_published or (select public.is_admin()));
create policy news_read on public.news for select to anon, authenticated using (is_published or (select public.is_admin()));
create policy reviews_read on public.reviews for select to anon, authenticated using (status = 'approved' or (select public.is_admin()));
-- visitors submit reviews as pending (with consent to publish)
create policy reviews_insert on public.reviews for insert to anon, authenticated with check (status = 'pending' and consent);
-- admin write
create policy works_admin_all on public.works for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy partners_admin_all on public.partners for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy news_admin_all on public.news for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy reviews_admin_update on public.reviews for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy reviews_admin_delete on public.reviews for delete to authenticated using ((select public.is_admin()));

revoke all on public.works, public.partners, public.news, public.reviews from anon;
grant select on public.works, public.partners, public.news to anon;
-- reviewers' phone and request number stay private: anon may read only these columns
grant select (id, name, city, service, rating, body, created_at) on public.reviews to anon;
grant insert (name, city, service, rating, body, ref, phone, consent) on public.reviews to anon;

-- Public bucket for site images (portfolio, partner logos, news); only admins can write
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 5242880, array['image/jpeg','image/png','image/webp']);
create policy site_media_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'site-media' and (select public.is_admin()));
create policy site_media_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'site-media' and (select public.is_admin()));
create policy site_media_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'site-media' and (select public.is_admin()));

-- ===== Migration "trust_content_split_read_policies" (2026-11-26) =====
-- Visitors (anon) can't execute is_admin(), so public read policies must not call it: one policy per role.
drop policy works_read on public.works;
drop policy partners_read on public.partners;
drop policy news_read on public.news;
drop policy reviews_read on public.reviews;
create policy works_public_read    on public.works    for select to anon using (is_published);
create policy partners_public_read on public.partners for select to anon using (is_published);
create policy news_public_read     on public.news     for select to anon using (is_published);
create policy reviews_public_read  on public.reviews  for select to anon using (status = 'approved');
create policy works_auth_read    on public.works    for select to authenticated using (is_published or (select public.is_admin()));
create policy partners_auth_read on public.partners for select to authenticated using (is_published or (select public.is_admin()));
create policy news_auth_read     on public.news     for select to authenticated using (is_published or (select public.is_admin()));
create policy reviews_auth_read  on public.reviews  for select to authenticated using (status = 'approved' or (select public.is_admin()));
