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
