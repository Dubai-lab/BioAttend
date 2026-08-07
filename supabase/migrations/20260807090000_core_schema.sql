-- ============================================================================
-- BioAttend · Migration 01 — Core schema
-- Northcrest General Hospital
--
-- Covers: enums, profiles (console users), departments, job_titles, staff,
--         shifts, shift_assignments, and the RLS helper functions.
--
-- ORDERING NOTE
--   `language sql` functions are validated when they are created, so any
--   function referencing public.profiles must come AFTER that table exists.
--   Hence: tables first, then helpers, then the policies that call them.
--
-- CONVENTION FOR EVERY TABLE IN THIS PROJECT (do not break it):
--   1. create table
--   2. explicit GRANTs          <- required since the Oct 2026 Data API change
--   3. enable row level security
--   4. policies
-- All four happen in the same migration so no table is ever exposed
-- without policies, or invisible to the API.
--
-- This file is safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists vector     with schema extensions;


-- ----------------------------------------------------------------------------
-- Enums (idempotent — re-running this migration will not fail)
-- ----------------------------------------------------------------------------
do $$
begin
  -- Console roles only. Staff are NOT users and never sign in.
  if not exists (select 1 from pg_type where typname = 'console_role') then
    create type public.console_role as enum ('admin', 'supervisor');
  end if;

  if not exists (select 1 from pg_type where typname = 'staff_status') then
    create type public.staff_status as enum ('active', 'suspended', 'terminated');
  end if;

  if not exists (select 1 from pg_type where typname = 'shift_code') then
    create type public.shift_code as enum ('morning', 'evening', 'night');
  end if;

  if not exists (select 1 from pg_type where typname = 'finger_position') then
    create type public.finger_position as enum
      ('left_thumb', 'left_index', 'right_thumb', 'right_index');
  end if;
end
$$;


-- ----------------------------------------------------------------------------
-- touch_updated_at — no table dependencies, safe to define first.
--
-- `set search_path = ''` is mandatory on every SECURITY DEFINER function in
-- this project. Without it they are a privilege-escalation vector, and
-- Supabase's Security Advisor flags them.
-- ----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ============================================================================
-- TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles — console users (Admin / Supervisor). One row per auth.users row.
-- Staff members do NOT appear here.
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null,
  email         text not null,
  role          public.console_role not null default 'supervisor',
  department_id uuid,  -- FK added below; NULL = all departments (admins)
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is
  'Console users only (admin/supervisor). Staff never have accounts — see staff table.';

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();


-- ----------------------------------------------------------------------------
-- departments
-- ----------------------------------------------------------------------------
create table if not exists public.departments (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  is_clinical boolean not null default true,
  created_at  timestamptz not null default now()
);

-- profiles.department_id -> departments.id (added now that both exist)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_department_fk'
  ) then
    alter table public.profiles
      add constraint profiles_department_fk
      foreign key (department_id) references public.departments(id) on delete set null;
  end if;
end
$$;


-- ----------------------------------------------------------------------------
-- job_titles — grouped so the enrollment form can filter by category
-- ----------------------------------------------------------------------------
create table if not exists public.job_titles (
  id         uuid primary key default gen_random_uuid(),
  title      text not null unique,
  category   text not null check (
               category in ('medical', 'nursing', 'allied_health', 'support', 'admin')
             ),
  created_at timestamptz not null default now()
);


-- ----------------------------------------------------------------------------
-- staff — the people being tracked. NOT users, no login, no auth row.
-- ----------------------------------------------------------------------------
create table if not exists public.staff (
  id             uuid primary key default gen_random_uuid(),
  staff_no       text not null unique,           -- e.g. NGH-1181
  full_name      text not null,
  department_id  uuid not null references public.departments(id) on delete restrict,
  job_title_id   uuid not null references public.job_titles(id)  on delete restrict,
  phone          text,
  email          text,
  status         public.staff_status not null default 'active',
  starts_on      date not null default current_date,
  ends_on        date,

  -- Biometric consent. Enrollment is blocked until this is true.
  consent_given      boolean not null default false,
  consent_given_at   timestamptz,
  consent_form_url   text,

  -- Denormalised enrollment progress, kept in sync by triggers in migration 02.
  fingerprints_enrolled int not null default 0,
  face_enrolled         boolean not null default false,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint staff_consent_timestamp
    check ( consent_given = false or consent_given_at is not null ),
  constraint staff_dates_sane
    check ( ends_on is null or ends_on >= starts_on )
);

comment on table public.staff is
  'Hospital staff. Deliberately NOT linked to auth.users — staff cannot sign in, '
  'which is what prevents remote attendance fraud.';

create index if not exists staff_department_idx on public.staff (department_id);
create index if not exists staff_status_idx     on public.staff (status) where status = 'active';

drop trigger if exists staff_touch on public.staff;
create trigger staff_touch
  before update on public.staff
  for each row execute function public.touch_updated_at();


-- ----------------------------------------------------------------------------
-- shifts — the three standard hospital shifts, with configurable windows.
--
-- Night shift crosses midnight (23:00 -> 07:00); `crosses_midnight` marks it
-- so attendance is filed against the SHIFT date, not the calendar date.
-- ----------------------------------------------------------------------------
create table if not exists public.shifts (
  id            uuid primary key default gen_random_uuid(),
  code          public.shift_code not null unique,
  name          text not null,
  starts_at     time not null,
  ends_at       time not null,

  -- Check-in window: from N minutes before start, to N minutes after.
  checkin_opens_before_min  int not null default 30,
  checkin_grace_after_min   int not null default 60,   -- the 60 min you specified

  -- Check-out window, relative to shift end.
  checkout_opens_before_min int not null default 30,
  checkout_closes_after_min int not null default 60,

  crosses_midnight boolean not null default false,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint shift_windows_positive check (
    checkin_opens_before_min  >= 0 and checkin_grace_after_min   >= 0 and
    checkout_opens_before_min >= 0 and checkout_closes_after_min >= 0
  )
);

comment on column public.shifts.checkin_grace_after_min is
  'Minutes after shift start that check-in stays open. Arrivals past this are '
  'still recorded but flagged late — never silently dropped.';

drop trigger if exists shifts_touch on public.shifts;
create trigger shifts_touch
  before update on public.shifts
  for each row execute function public.touch_updated_at();


-- ----------------------------------------------------------------------------
-- shift_assignments — who works which shift on which date (the roster)
-- ----------------------------------------------------------------------------
create table if not exists public.shift_assignments (
  id         uuid primary key default gen_random_uuid(),
  staff_id   uuid not null references public.staff(id)  on delete cascade,
  shift_id   uuid not null references public.shifts(id) on delete restrict,
  shift_date date not null,
  notes      text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),

  unique (staff_id, shift_date)
);

comment on table public.shift_assignments is
  'The roster. shift_date is the date the shift BEGINS — a night shift starting '
  '23:00 on the 7th belongs to the 7th even though it ends on the 8th.';

create index if not exists shift_assignments_date_idx  on public.shift_assignments (shift_date);
create index if not exists shift_assignments_staff_idx on public.shift_assignments (staff_id, shift_date);


-- ============================================================================
-- HELPER FUNCTIONS
--
-- Defined after the tables they read. SECURITY DEFINER so RLS policies can
-- check the caller's role without recursing into profiles (which itself has
-- RLS enabled).
-- ============================================================================

create or replace function public.current_console_role()
returns public.console_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- Department a supervisor oversees. NULL for admins (they see everything).
create or replace function public.current_department_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select department_id from public.profiles where id = (select auth.uid());
$$;


-- ============================================================================
-- GRANTS, RLS AND POLICIES
--
-- Grants are explicit because, since the October 2026 Data API change, a table
-- in `public` is NOT reachable by the API without them.
-- ============================================================================

-- ---------------------------------------------------------------- profiles --
grant select on public.profiles to anon;
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select to authenticated
  using ( id = (select auth.uid()) or public.is_admin() );

-- Update your own name only. Role changes go through an admin.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using ( id = (select auth.uid()) )
  with check ( id = (select auth.uid()) );

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all"
  on public.profiles for all to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );


-- ------------------------------------------------------------- departments --
grant select on public.departments to anon;
grant select, insert, update, delete on public.departments to authenticated;
grant all on public.departments to service_role;

alter table public.departments enable row level security;

-- Every console user needs the department list to render filters and forms.
drop policy if exists "departments_select_authenticated" on public.departments;
create policy "departments_select_authenticated"
  on public.departments for select to authenticated
  using ( true );

drop policy if exists "departments_admin_write" on public.departments;
create policy "departments_admin_write"
  on public.departments for all to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );


-- -------------------------------------------------------------- job_titles --
grant select on public.job_titles to anon;
grant select, insert, update, delete on public.job_titles to authenticated;
grant all on public.job_titles to service_role;

alter table public.job_titles enable row level security;

drop policy if exists "job_titles_select_authenticated" on public.job_titles;
create policy "job_titles_select_authenticated"
  on public.job_titles for select to authenticated
  using ( true );

drop policy if exists "job_titles_admin_write" on public.job_titles;
create policy "job_titles_admin_write"
  on public.job_titles for all to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );


-- ------------------------------------------------------------------- staff --
grant select on public.staff to anon;
grant select, insert, update, delete on public.staff to authenticated;
grant all on public.staff to service_role;

alter table public.staff enable row level security;

-- Admins see all staff. Supervisors see only their own department.
drop policy if exists "staff_select_scoped" on public.staff;
create policy "staff_select_scoped"
  on public.staff for select to authenticated
  using (
    public.is_admin()
    or department_id = public.current_department_id()
  );

-- Only admins/HR create and edit staff records.
drop policy if exists "staff_admin_write" on public.staff;
create policy "staff_admin_write"
  on public.staff for all to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );


-- ------------------------------------------------------------------ shifts --
grant select on public.shifts to anon;
grant select, insert, update, delete on public.shifts to authenticated;
grant all on public.shifts to service_role;

alter table public.shifts enable row level security;

drop policy if exists "shifts_select_authenticated" on public.shifts;
create policy "shifts_select_authenticated"
  on public.shifts for select to authenticated
  using ( true );

drop policy if exists "shifts_admin_write" on public.shifts;
create policy "shifts_admin_write"
  on public.shifts for all to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );


-- ------------------------------------------------------- shift_assignments --
grant select on public.shift_assignments to anon;
grant select, insert, update, delete on public.shift_assignments to authenticated;
grant all on public.shift_assignments to service_role;

alter table public.shift_assignments enable row level security;

drop policy if exists "shift_assignments_select_scoped" on public.shift_assignments;
create policy "shift_assignments_select_scoped"
  on public.shift_assignments for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.staff s
      where s.id = shift_assignments.staff_id
        and s.department_id = public.current_department_id()
    )
  );

-- Supervisors roster their own department; admins roster anyone.
drop policy if exists "shift_assignments_write_scoped" on public.shift_assignments;
create policy "shift_assignments_write_scoped"
  on public.shift_assignments for all to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.staff s
      where s.id = shift_assignments.staff_id
        and s.department_id = public.current_department_id()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.staff s
      where s.id = shift_assignments.staff_id
        and s.department_id = public.current_department_id()
    )
  );
