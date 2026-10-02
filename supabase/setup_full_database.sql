-- ============================================================================
-- BioAttend · Full database setup (all 13 migrations, consolidated)
-- Northcrest General Hospital
--
-- HOW TO USE
--   Supabase Dashboard -> SQL Editor -> New query -> paste this whole file -> Run.
--   It builds the complete schema on an EMPTY project in one go and ends by
--   printing a row of counts so you can see that it worked.
--
-- WHAT THIS IS
--   The final state produced by supabase/migrations/20260807090000 through
--   20260811100000, written out once. The intermediate steps those migrations
--   went through (1024-d face vectors, the temp-table and max(uuid) versions of
--   identify_face, the withdrawn-then-restored 1:N grant) are not replayed —
--   only where they ended up.
--
--   The migrations folder remains the history. This file is for standing up a
--   fresh project; do not run it against a database that already holds staff
--   or attendance data you care about.
--
-- AFTER RUNNING IT
--   1. Create your login under Authentication -> Users (tick Auto Confirm User)
--   2. Run supabase/scripts/bootstrap_admin.sql to make that login an admin
--
-- Safe to re-run: every statement is idempotent.
-- ============================================================================


-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================
create schema if not exists extensions;

create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists vector     with schema extensions;
create extension if not exists pgcrypto   with schema extensions;

grant usage on schema public to anon, authenticated, service_role;


-- ============================================================================
-- 2. ENUMS
-- ============================================================================
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

  if not exists (select 1 from pg_type where typname = 'checkin_status') then
    create type public.checkin_status as enum (
      'on_time',
      'late',              -- inside the grace window
      'late_unapproved',   -- past grace; recorded but needs supervisor sign-off
      'unscheduled'        -- worked without a roster entry
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'checkout_status') then
    create type public.checkout_status as enum (
      'on_time',
      'early',             -- left before the window opened, needs sign-off
      'late',
      'missing'            -- never checked out
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'biometric_method') then
    create type public.biometric_method as enum ('fingerprint', 'face', 'manual');
  end if;
end
$$;


-- ============================================================================
-- 3. touch_updated_at — no table dependencies, so it is defined first.
--
-- `set search_path = ''` is mandatory on every SECURITY DEFINER function in
-- this project. Without it they are a privilege-escalation vector, and
-- Supabase's Security Advisor flags them.
-- ============================================================================
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
-- 4. CORE TABLES
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

  -- Denormalised enrollment progress, kept in sync by triggers below.
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
  checkin_grace_after_min   int not null default 60,

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
-- 5. RLS HELPER FUNCTIONS
--
-- Defined after the tables they read (`language sql` bodies are validated at
-- creation). SECURITY DEFINER so RLS policies can check the caller's role
-- without recursing into profiles, which itself has RLS enabled.
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

-- Every policy below calls these as the signed-in user, so that role must be
-- able to execute them. Granted explicitly rather than relying on defaults.
grant execute on function public.current_console_role()  to authenticated, service_role;
grant execute on function public.is_admin()              to authenticated, service_role;
grant execute on function public.current_department_id() to authenticated, service_role;


-- ============================================================================
-- 6. CORE TABLES — GRANTS, RLS, POLICIES
--
-- Grants are explicit because a table in `public` is not reachable through the
-- Data API without them.
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


-- ============================================================================
-- 7. BIOMETRIC TABLES
--
--   * Fingerprint templates can ONLY be matched by the reader's firmware.
--     Supabase is the system of record; the module's flash is a re-syncable
--     cache. reader_slots maps flash slot -> template.
--   * Face embeddings are plain vectors, so pgvector matches them in SQL.
--   * Biometric data is readable by admins only — never by supervisors,
--     never by anon.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- fingerprint_templates — 512-byte proprietary template, stored base64.
-- Four fingers per staff member: both thumbs, both index fingers.
-- ----------------------------------------------------------------------------
create table if not exists public.fingerprint_templates (
  id           uuid primary key default gen_random_uuid(),
  staff_id     uuid not null references public.staff(id) on delete cascade,
  finger       public.finger_position not null,

  template     text not null,          -- base64 of the 512-byte template
  quality      int  not null,          -- NFIQ-style score, higher is better
  minutiae     int,                    -- captured for the quality gate display

  enrolled_by  uuid references public.profiles(id) on delete set null,
  device_id    text,                   -- which reader captured it
  created_at   timestamptz not null default now(),

  unique (staff_id, finger),
  constraint fingerprint_quality_gate check (quality between 0 and 100)
);

comment on table public.fingerprint_templates is
  'Proprietary 512-byte templates. Cannot be matched in SQL or JS — only the '
  'reader firmware can compare them. This table is the system of record; the '
  'reader flash is a cache rebuilt from here.';

create index if not exists fingerprint_templates_staff_idx on public.fingerprint_templates (staff_id);

grant select on public.fingerprint_templates to anon;
grant select, insert, update, delete on public.fingerprint_templates to authenticated;
grant all on public.fingerprint_templates to service_role;

alter table public.fingerprint_templates enable row level security;

-- Admins only. Supervisors have no business reading raw biometric data.
drop policy if exists "fingerprint_templates_admin_only" on public.fingerprint_templates;
create policy "fingerprint_templates_admin_only"
  on public.fingerprint_templates for all to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );


-- ----------------------------------------------------------------------------
-- face_embeddings — 512-d ArcFace embedding from InsightFace buffalo_l.
-- Multiple rows per staff member (5 angles), matched by cosine distance.
-- ----------------------------------------------------------------------------
create table if not exists public.face_embeddings (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid not null references public.staff(id) on delete cascade,

  embedding   extensions.vector(512) not null,
  angle       text not null check (
                angle in ('front', 'left', 'right', 'up', 'down')
              ),
  quality     real not null,           -- detector confidence at capture time

  enrolled_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),

  unique (staff_id, angle)
);

comment on table public.face_embeddings is
  'Face descriptors only. Raw face images are never stored — at most one '
  'reference thumbnail lives in a private Storage bucket.';

comment on column public.face_embeddings.embedding is
  '512-d L2-normalised ArcFace embedding from InsightFace buffalo_l. Cosine '
  'similarity reduces to a dot product because the vectors are normalised.';

-- Cosine index for 1:N search. Rebuild lists as the roster grows.
create index if not exists face_embeddings_vector_idx
  on public.face_embeddings
  using ivfflat (embedding extensions.vector_cosine_ops)
  with (lists = 100);

create index if not exists face_embeddings_staff_idx on public.face_embeddings (staff_id);

grant select on public.face_embeddings to anon;
grant select, insert, update, delete on public.face_embeddings to authenticated;
grant all on public.face_embeddings to service_role;

alter table public.face_embeddings enable row level security;

drop policy if exists "face_embeddings_admin_only" on public.face_embeddings;
create policy "face_embeddings_admin_only"
  on public.face_embeddings for all to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );


-- ----------------------------------------------------------------------------
-- readers — physical fingerprint devices
-- ----------------------------------------------------------------------------
create table if not exists public.readers (
  id             text primary key,               -- e.g. HR-DESK-01
  label          text not null,
  location       text,
  firmware       text,
  resolution_dpi int,
  capacity       int not null default 1000,      -- template slots in flash
  last_synced_at timestamptz,
  last_seen_at   timestamptz,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

grant select on public.readers to anon;
grant select, insert, update, delete on public.readers to authenticated;
grant all on public.readers to service_role;

alter table public.readers enable row level security;

drop policy if exists "readers_select_authenticated" on public.readers;
create policy "readers_select_authenticated"
  on public.readers for select to authenticated
  using ( true );

drop policy if exists "readers_admin_write" on public.readers;
create policy "readers_admin_write"
  on public.readers for all to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );


-- ----------------------------------------------------------------------------
-- reader_slots — maps a reader's flash slot to a stored template.
--
-- This is what makes a dead reader a non-event: wipe the replacement,
-- re-download every template from fingerprint_templates, rewrite this map.
-- ----------------------------------------------------------------------------
create table if not exists public.reader_slots (
  reader_id   text not null references public.readers(id) on delete cascade,
  slot_id     int  not null,
  template_id uuid not null references public.fingerprint_templates(id) on delete cascade,
  staff_id    uuid not null references public.staff(id) on delete cascade,
  synced_at   timestamptz not null default now(),

  primary key (reader_id, slot_id),
  unique (reader_id, template_id),
  constraint reader_slot_non_negative check (slot_id >= 0)
);

comment on table public.reader_slots is
  'Slot map for on-device 1:N search. HighSpeedSearch returns a slot number; '
  'this table turns that number back into a staff_id.';

create index if not exists reader_slots_staff_idx on public.reader_slots (staff_id);

grant select on public.reader_slots to anon;
grant select, insert, update, delete on public.reader_slots to authenticated;
grant all on public.reader_slots to service_role;

alter table public.reader_slots enable row level security;

drop policy if exists "reader_slots_admin_only" on public.reader_slots;
create policy "reader_slots_admin_only"
  on public.reader_slots for all to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );


-- ----------------------------------------------------------------------------
-- Enrollment progress counters
--
-- Kept in the database rather than recomputed in the UI, so the staff
-- directory can show enrollment state without N+1 queries.
-- ----------------------------------------------------------------------------
create or replace function public.sync_fingerprint_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_staff uuid := coalesce(new.staff_id, old.staff_id);
begin
  update public.staff
     set fingerprints_enrolled = (
           select count(*) from public.fingerprint_templates
            where staff_id = target_staff
         )
   where id = target_staff;
  return null;
end;
$$;

drop trigger if exists fingerprint_templates_sync_count on public.fingerprint_templates;
create trigger fingerprint_templates_sync_count
  after insert or delete on public.fingerprint_templates
  for each row execute function public.sync_fingerprint_count();


create or replace function public.sync_face_enrolled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_staff uuid := coalesce(new.staff_id, old.staff_id);
begin
  update public.staff
     set face_enrolled = exists (
           select 1 from public.face_embeddings where staff_id = target_staff
         )
   where id = target_staff;
  return null;
end;
$$;

drop trigger if exists face_embeddings_sync_enrolled on public.face_embeddings;
create trigger face_embeddings_sync_enrolled
  after insert or delete on public.face_embeddings
  for each row execute function public.sync_face_enrolled();


-- ============================================================================
-- 8. SETTINGS, KIOSKS, ATTENDANCE, AUDIT
--
--   RULE 1  Attendance can only be written by a registered kiosk.
--           The INSERT path is a SECURITY DEFINER function that demands the
--           kiosk secret, and direct INSERT is denied to everyone.
--
--   RULE 2  Time windows govern state, not scan order.
--           After the check-in window closes the system does NOT start
--           checking people out. It stays closed until check-out opens.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- hospital_settings — single row of institution-wide configuration
-- ----------------------------------------------------------------------------
create table if not exists public.hospital_settings (
  id                  boolean primary key default true,
  hospital_name       text not null default 'Northcrest General',
  system_name         text not null default 'BioAttend',
  timezone            text not null default 'Africa/Kigali',

  -- Starting points for ArcFace embeddings — tune them from measured data
  -- in the console under Settings, not here.
  face_match_threshold        real not null default 0.50,  -- min cosine similarity
  face_match_margin           real not null default 0.10,  -- top must beat runner-up by this
  fingerprint_min_quality     int  not null default 60,

  -- Minimum gap between check-in and check-out, guards against a second
  -- scan seconds later being read as "leaving".
  min_shift_duration_min      int  not null default 240,

  updated_at          timestamptz not null default now(),
  constraint hospital_settings_singleton check (id = true)
);

insert into public.hospital_settings (id) values (true) on conflict (id) do nothing;

grant select on public.hospital_settings to anon;
grant select, insert, update, delete on public.hospital_settings to authenticated;
grant all on public.hospital_settings to service_role;

alter table public.hospital_settings enable row level security;

drop policy if exists "hospital_settings_select_authenticated" on public.hospital_settings;
create policy "hospital_settings_select_authenticated"
  on public.hospital_settings for select to authenticated
  using ( true );

drop policy if exists "hospital_settings_admin_write" on public.hospital_settings;
create policy "hospital_settings_admin_write"
  on public.hospital_settings for update to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );


-- ----------------------------------------------------------------------------
-- kiosks — check-in stations. Authenticate as DEVICES, not as people.
-- ----------------------------------------------------------------------------
create table if not exists public.kiosks (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,            -- e.g. KIOSK-MAIN-01
  label         text not null,
  location      text,

  -- bcrypt hash of the device secret. The plaintext is shown once at
  -- registration and never stored.
  token_hash    text not null,

  reader_id     text references public.readers(id) on delete set null,
  has_camera    boolean not null default true,

  is_active     boolean not null default true,
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now()
);

comment on table public.kiosks is
  'Physical check-in stations. token_hash is bcrypt; plaintext is never stored. '
  'Attendance writes are impossible without a matching token.';

grant select on public.kiosks to anon;
grant select, insert, update, delete on public.kiosks to authenticated;
grant all on public.kiosks to service_role;

alter table public.kiosks enable row level security;

-- token_hash is deliberately reachable only by admins.
drop policy if exists "kiosks_admin_only" on public.kiosks;
create policy "kiosks_admin_only"
  on public.kiosks for all to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );


-- ----------------------------------------------------------------------------
-- attendance — ONE row per staff member per shift date.
-- Check-in and check-out are columns on that row, not separate events, so
-- "already marked today" is a primary-key fact rather than a query.
-- ----------------------------------------------------------------------------
create table if not exists public.attendance (
  id            uuid primary key default gen_random_uuid(),
  staff_id      uuid not null references public.staff(id) on delete cascade,
  shift_date    date not null,
  shift_id      uuid references public.shifts(id) on delete set null,

  -- Denormalised so department-scoped RLS does not join on every row.
  department_id uuid not null references public.departments(id) on delete restrict,

  check_in_at         timestamptz,
  check_in_method     public.biometric_method,
  check_in_confidence int,
  check_in_status     public.checkin_status,
  check_in_kiosk_id   uuid references public.kiosks(id) on delete set null,

  check_out_at         timestamptz,
  check_out_method     public.biometric_method,
  check_out_confidence int,
  check_out_status     public.checkout_status,
  check_out_kiosk_id   uuid references public.kiosks(id) on delete set null,

  -- Anything not clean needs a human to look at it.
  requires_approval boolean not null default false,
  approved_by       uuid references public.profiles(id) on delete set null,
  approved_at       timestamptz,
  approval_note     text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (staff_id, shift_date),
  constraint attendance_checkout_after_checkin
    check ( check_out_at is null or check_in_at is null or check_out_at > check_in_at )
);

comment on column public.attendance.shift_date is
  'The date the SHIFT started, not the calendar date of the scan. A night '
  'shift beginning 23:00 on the 7th files under the 7th even when the staff '
  'member checks out at 07:00 on the 8th.';

create index if not exists attendance_date_idx       on public.attendance (shift_date desc);
create index if not exists attendance_staff_idx      on public.attendance (staff_id, shift_date desc);
create index if not exists attendance_department_idx on public.attendance (department_id, shift_date desc);
create index if not exists attendance_approval_idx   on public.attendance (requires_approval)
  where requires_approval = true;

drop trigger if exists attendance_touch on public.attendance;
create trigger attendance_touch
  before update on public.attendance
  for each row execute function public.touch_updated_at();

grant select on public.attendance to anon;
grant select, update on public.attendance to authenticated;
grant all on public.attendance to service_role;

alter table public.attendance enable row level security;

-- Read: admins everywhere, supervisors their own department.
drop policy if exists "attendance_select_scoped" on public.attendance;
create policy "attendance_select_scoped"
  on public.attendance for select to authenticated
  using (
    public.is_admin()
    or department_id = public.current_department_id()
  );

-- Update: only to approve/annotate exceptions. Never to fabricate a check-in.
drop policy if exists "attendance_update_scoped" on public.attendance;
create policy "attendance_update_scoped"
  on public.attendance for update to authenticated
  using (
    public.is_admin()
    or department_id = public.current_department_id()
  )
  with check (
    public.is_admin()
    or department_id = public.current_department_id()
  );

-- NOTE: there is deliberately NO insert policy and NO insert grant for
-- `authenticated`. The only way a row is created is record_attendance()
-- below, which requires a valid kiosk token. This is RULE 1.


-- ----------------------------------------------------------------------------
-- attendance_attempts — every scan, including rejections.
-- ----------------------------------------------------------------------------
create table if not exists public.attendance_attempts (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid references public.staff(id) on delete set null,  -- null = unidentified
  kiosk_id    uuid references public.kiosks(id) on delete set null,
  method      public.biometric_method not null,
  confidence  int,
  decision    text not null check (
                decision in ('check_in', 'check_out', 'rejected', 'duplicate')
              ),
  reason      text,
  occurred_at timestamptz not null default now()
);

create index if not exists attendance_attempts_time_idx  on public.attendance_attempts (occurred_at desc);
create index if not exists attendance_attempts_staff_idx on public.attendance_attempts (staff_id, occurred_at desc);

grant select on public.attendance_attempts to anon;
grant select on public.attendance_attempts to authenticated;
grant all on public.attendance_attempts to service_role;

alter table public.attendance_attempts enable row level security;

drop policy if exists "attendance_attempts_select_scoped" on public.attendance_attempts;
create policy "attendance_attempts_select_scoped"
  on public.attendance_attempts for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.staff s
      where s.id = attendance_attempts.staff_id
        and s.department_id = public.current_department_id()
    )
  );


-- ----------------------------------------------------------------------------
-- audit_log — who changed what in the console
--
-- Entries are append-only. No update or delete policy exists for any
-- browser-facing role, so a log line cannot be edited away after the fact.
-- ----------------------------------------------------------------------------
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  entity      text not null,
  entity_id   text,
  detail      jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists audit_log_time_idx on public.audit_log (occurred_at desc);

grant select on public.audit_log to anon;
grant select, insert on public.audit_log to authenticated;
grant all on public.audit_log to service_role;

alter table public.audit_log enable row level security;

drop policy if exists "audit_log_insert_own" on public.audit_log;
create policy "audit_log_insert_own"
  on public.audit_log for insert to authenticated
  with check ( actor_id = (select auth.uid()) );

drop policy if exists "audit_log_admin_read" on public.audit_log;
drop policy if exists "audit_log_read" on public.audit_log;
create policy "audit_log_read"
  on public.audit_log for select to authenticated
  using ( public.is_admin() or actor_id = (select auth.uid()) );


-- ============================================================================
-- 9. record_attendance() — the ONLY path that writes attendance.
--
-- Requires a valid kiosk token. Resolves the staff member's shift for the
-- moment of the scan (handling night shifts that cross midnight), applies the
-- window rules, and returns a JSON verdict for the kiosk to display.
-- ============================================================================
create or replace function public.record_attendance(
  p_kiosk_code  text,
  p_kiosk_token text,
  p_staff_id    uuid,
  p_method      public.biometric_method,
  p_confidence  int default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kiosk        public.kiosks%rowtype;
  v_staff        public.staff%rowtype;
  v_settings     public.hospital_settings%rowtype;
  v_tz           text;
  v_now          timestamptz := now();
  v_local_date   date;

  v_assignment   record;
  v_matched      boolean := false;
  v_shift_start  timestamptz;
  v_shift_end    timestamptz;

  v_checkin_open   timestamptz;
  v_checkin_close  timestamptz;
  v_checkout_open  timestamptz;
  v_checkout_close timestamptz;

  v_existing     public.attendance%rowtype;
  v_status       public.checkin_status;
  v_out_status   public.checkout_status;
  v_reason       text;
begin
  ------------------------------------------------------------------
  -- RULE 1: a valid kiosk credential, or nothing happens.
  ------------------------------------------------------------------
  select * into v_kiosk
    from public.kiosks
   where code = p_kiosk_code and is_active = true;

  if not found or v_kiosk.token_hash <> extensions.crypt(p_kiosk_token, v_kiosk.token_hash) then
    -- Deliberately vague: do not tell an attacker which half was wrong.
    return jsonb_build_object('decision', 'rejected', 'reason', 'invalid_kiosk');
  end if;

  update public.kiosks set last_seen_at = v_now where id = v_kiosk.id;

  ------------------------------------------------------------------
  -- Staff must exist and be active.
  ------------------------------------------------------------------
  select * into v_staff from public.staff where id = p_staff_id;

  if not found or v_staff.status <> 'active' then
    insert into public.attendance_attempts (staff_id, kiosk_id, method, confidence, decision, reason)
    values (p_staff_id, v_kiosk.id, p_method, p_confidence, 'rejected', 'inactive_staff');
    return jsonb_build_object('decision', 'rejected', 'reason', 'inactive_staff');
  end if;

  select * into v_settings from public.hospital_settings where id = true;
  v_tz := v_settings.timezone;
  v_local_date := (v_now at time zone v_tz)::date;

  ------------------------------------------------------------------
  -- Find the shift this scan belongs to.
  --
  -- Yesterday is checked as well as today because a night shift that began
  -- at 23:00 yesterday is still running at 06:00 today. Tomorrow is checked
  -- because a shift's check-in window can open before midnight.
  ------------------------------------------------------------------
  for v_assignment in
    select sa.*, sh.starts_at, sh.ends_at, sh.crosses_midnight, sh.name as shift_name,
           sh.checkin_opens_before_min, sh.checkin_grace_after_min,
           sh.checkout_opens_before_min, sh.checkout_closes_after_min
      from public.shift_assignments sa
      join public.shifts sh on sh.id = sa.shift_id
     where sa.staff_id = p_staff_id
       and sa.shift_date between v_local_date - 1 and v_local_date + 1
     order by sa.shift_date
  loop
    v_shift_start := (v_assignment.shift_date + v_assignment.starts_at) at time zone v_tz;
    v_shift_end   := (v_assignment.shift_date
                        + v_assignment.ends_at
                        + (case when v_assignment.crosses_midnight then interval '1 day'
                                else interval '0' end)
                     ) at time zone v_tz;

    v_checkin_open   := v_shift_start - make_interval(mins => v_assignment.checkin_opens_before_min);
    v_checkin_close  := v_shift_start + make_interval(mins => v_assignment.checkin_grace_after_min);
    v_checkout_open  := v_shift_end   - make_interval(mins => v_assignment.checkout_opens_before_min);
    v_checkout_close := v_shift_end   + make_interval(mins => v_assignment.checkout_closes_after_min);

    -- Scan falls anywhere inside this shift's span: this is the one.
    --
    -- The explicit flag matters. A bare `exit when` would leave v_assignment
    -- holding the LAST row when nothing matched, and an off-shift scan would
    -- then be attributed to a shift the staff member is not working.
    if v_now between v_checkin_open and v_checkout_close then
      v_matched := true;
      exit;
    end if;
  end loop;

  ------------------------------------------------------------------
  -- No roster entry: record it, flag it, let a supervisor decide.
  -- Never silently drop a scan — a nurse covering an emergency must not
  -- vanish from the log because the roster was not updated.
  ------------------------------------------------------------------
  if not v_matched then
    insert into public.attendance (
      staff_id, shift_date, department_id,
      check_in_at, check_in_method, check_in_confidence,
      check_in_status, check_in_kiosk_id, requires_approval
    )
    values (
      p_staff_id, v_local_date, v_staff.department_id,
      v_now, p_method, p_confidence,
      'unscheduled', v_kiosk.id, true
    )
    on conflict (staff_id, shift_date) do nothing;

    insert into public.attendance_attempts (staff_id, kiosk_id, method, confidence, decision, reason)
    values (p_staff_id, v_kiosk.id, p_method, p_confidence, 'check_in', 'unscheduled');

    return jsonb_build_object(
      'decision', 'check_in', 'status', 'unscheduled',
      'staff_name', v_staff.full_name, 'staff_no', v_staff.staff_no,
      'at', v_now, 'note', 'No shift rostered — flagged for supervisor'
    );
  end if;

  select * into v_existing
    from public.attendance
   where staff_id = p_staff_id and shift_date = v_assignment.shift_date;

  ------------------------------------------------------------------
  -- CHECK-IN
  ------------------------------------------------------------------
  if v_existing.check_in_at is null then

    if v_now < v_checkin_open then
      insert into public.attendance_attempts (staff_id, kiosk_id, method, confidence, decision, reason)
      values (p_staff_id, v_kiosk.id, p_method, p_confidence, 'rejected', 'too_early');
      return jsonb_build_object('decision', 'rejected', 'reason', 'too_early',
                                'opens_at', v_checkin_open);
    end if;

    if v_now <= v_shift_start then
      v_status := 'on_time';
    elsif v_now <= v_checkin_close then
      v_status := 'late';
    else
      -- Past the grace window. RULE 2 says check-in is closed — but we record
      -- it as unapproved rather than erase a person who actually worked.
      v_status := 'late_unapproved';
    end if;

    insert into public.attendance (
      staff_id, shift_date, shift_id, department_id,
      check_in_at, check_in_method, check_in_confidence,
      check_in_status, check_in_kiosk_id, requires_approval
    )
    values (
      p_staff_id, v_assignment.shift_date, v_assignment.shift_id, v_staff.department_id,
      v_now, p_method, p_confidence,
      v_status, v_kiosk.id, (v_status = 'late_unapproved')
    )
    on conflict (staff_id, shift_date) do update
      set check_in_at = excluded.check_in_at,
          check_in_method = excluded.check_in_method,
          check_in_confidence = excluded.check_in_confidence,
          check_in_status = excluded.check_in_status,
          check_in_kiosk_id = excluded.check_in_kiosk_id,
          requires_approval = excluded.requires_approval;

    insert into public.attendance_attempts (staff_id, kiosk_id, method, confidence, decision, reason)
    values (p_staff_id, v_kiosk.id, p_method, p_confidence, 'check_in', v_status::text);

    return jsonb_build_object(
      'decision', 'check_in', 'status', v_status,
      'staff_name', v_staff.full_name, 'staff_no', v_staff.staff_no,
      'shift', v_assignment.shift_name, 'at', v_now
    );
  end if;

  ------------------------------------------------------------------
  -- ALREADY CHECKED OUT — nothing left to do today.
  ------------------------------------------------------------------
  if v_existing.check_out_at is not null then
    insert into public.attendance_attempts (staff_id, kiosk_id, method, confidence, decision, reason)
    values (p_staff_id, v_kiosk.id, p_method, p_confidence, 'duplicate', 'already_complete');
    return jsonb_build_object(
      'decision', 'duplicate', 'reason', 'already_complete',
      'staff_name', v_staff.full_name,
      'checked_in_at', v_existing.check_in_at,
      'checked_out_at', v_existing.check_out_at
    );
  end if;

  ------------------------------------------------------------------
  -- CHECK-OUT
  --
  -- RULE 2 in force: between the close of check-in and the opening of
  -- check-out the system accepts nothing. It does not quietly start
  -- checking people out the moment check-in ends.
  ------------------------------------------------------------------
  if v_now < v_checkout_open then
    -- Guard against a second scan moments after arriving being read as leaving.
    if v_now < v_existing.check_in_at + make_interval(mins => v_settings.min_shift_duration_min) then
      insert into public.attendance_attempts (staff_id, kiosk_id, method, confidence, decision, reason)
      values (p_staff_id, v_kiosk.id, p_method, p_confidence, 'rejected', 'window_closed');
      return jsonb_build_object(
        'decision', 'rejected', 'reason', 'window_closed',
        'staff_name', v_staff.full_name,
        'checkout_opens_at', v_checkout_open
      );
    end if;

    -- Genuinely leaving early after a real stretch of work: allow, but flag.
    v_out_status := 'early';
  elsif v_now <= v_checkout_close then
    v_out_status := 'on_time';
  else
    v_out_status := 'late';
  end if;

  update public.attendance
     set check_out_at = v_now,
         check_out_method = p_method,
         check_out_confidence = p_confidence,
         check_out_status = v_out_status,
         check_out_kiosk_id = v_kiosk.id,
         requires_approval = requires_approval or (v_out_status = 'early')
   where id = v_existing.id;

  insert into public.attendance_attempts (staff_id, kiosk_id, method, confidence, decision, reason)
  values (p_staff_id, v_kiosk.id, p_method, p_confidence, 'check_out', v_out_status::text);

  return jsonb_build_object(
    'decision', 'check_out', 'status', v_out_status,
    'staff_name', v_staff.full_name, 'staff_no', v_staff.staff_no,
    'shift', v_assignment.shift_name, 'at', v_now
  );
end;
$$;

comment on function public.record_attendance is
  'The only write path for attendance. Requires a valid kiosk token (RULE 1) '
  'and enforces shift windows (RULE 2). Direct INSERT on attendance is not '
  'granted to any browser-facing role.';

-- The kiosk calls this with the anon key plus its device token.
grant execute on function public.record_attendance(text, text, uuid, public.biometric_method, int)
  to anon, authenticated;


-- ============================================================================
-- 10. FACE MATCHING (512-d ArcFace)
--
-- Matching runs inside SECURITY DEFINER functions rather than in the browser
-- because `face_embeddings` is admin-only under RLS and the kiosk holds just
-- the anon key. The kiosk sends an embedding and gets back a decision — it
-- never sees anyone's stored biometrics.
--
-- pgvector operators must be schema-qualified: OPERATOR(extensions.<=>).
-- A bare `<=>` cannot be resolved under an empty search_path.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- verify_face — 1:1, confirm the person the fingerprint already identified
-- ----------------------------------------------------------------------------
create or replace function public.verify_face(
  p_kiosk_code  text,
  p_kiosk_token text,
  p_staff_id    uuid,
  p_embedding   extensions.vector(512)
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kiosk      public.kiosks%rowtype;
  v_settings   public.hospital_settings%rowtype;
  v_similarity real;
begin
  select * into v_kiosk
    from public.kiosks
   where code = p_kiosk_code and is_active = true;

  if not found or v_kiosk.token_hash <> extensions.crypt(p_kiosk_token, v_kiosk.token_hash) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_kiosk');
  end if;

  select * into v_settings from public.hospital_settings where id = true;

  -- Best of the enrolled angles: someone turning slightly should still match
  -- against whichever stored pose is closest.
  select max(1 - (fe.embedding OPERATOR(extensions.<=>) p_embedding))
    into v_similarity
    from public.face_embeddings fe
   where fe.staff_id = p_staff_id;

  if v_similarity is null then
    return jsonb_build_object('ok', false, 'reason', 'no_face_enrolled');
  end if;

  return jsonb_build_object(
    'ok', v_similarity >= v_settings.face_match_threshold,
    'similarity', round(v_similarity::numeric, 4),
    'threshold', v_settings.face_match_threshold
  );
end;
$$;

comment on function public.verify_face is
  '1:1 face verification. Used as a second factor after the fingerprint has '
  'already identified someone.';

grant execute on function public.verify_face(text, text, uuid, extensions.vector)
  to anon, authenticated;


-- ----------------------------------------------------------------------------
-- verify_face_by_staff_no — the person states who they are, face confirms it
-- ----------------------------------------------------------------------------
create or replace function public.verify_face_by_staff_no(
  p_kiosk_code  text,
  p_kiosk_token text,
  p_staff_no    text,
  p_embedding   extensions.vector(512)
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kiosk      public.kiosks%rowtype;
  v_settings   public.hospital_settings%rowtype;
  v_staff      public.staff%rowtype;
  v_similarity real;
begin
  select * into v_kiosk
    from public.kiosks
   where code = p_kiosk_code and is_active = true;

  if not found or v_kiosk.token_hash <> extensions.crypt(p_kiosk_token, v_kiosk.token_hash) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_kiosk');
  end if;

  select * into v_settings from public.hospital_settings where id = true;

  -- Accept either the full number or just its digits, so a kiosk keypad does
  -- not need to type the prefix.
  select * into v_staff
    from public.staff
   where status = 'active'
     and (
       upper(staff_no) = upper(trim(p_staff_no))
       or regexp_replace(staff_no, '\D', '', 'g') = regexp_replace(trim(p_staff_no), '\D', '', 'g')
     )
   limit 1;

  if not found then
    -- Deliberately vague: confirming which staff numbers exist would let
    -- anyone enumerate the roster from the kiosk.
    return jsonb_build_object('ok', false, 'reason', 'not_verified');
  end if;

  select max(1 - (fe.embedding OPERATOR(extensions.<=>) p_embedding))
    into v_similarity
    from public.face_embeddings fe
   where fe.staff_id = v_staff.id;

  if v_similarity is null then
    return jsonb_build_object('ok', false, 'reason', 'no_face_enrolled');
  end if;

  if v_similarity < v_settings.face_match_threshold then
    return jsonb_build_object(
      'ok', false, 'reason', 'not_verified',
      'similarity', round(v_similarity::numeric, 4)
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'staff_id', v_staff.id,
    'staff_name', v_staff.full_name,
    'staff_no', v_staff.staff_no,
    'similarity', round(v_similarity::numeric, 4)
  );
end;
$$;

comment on function public.verify_face_by_staff_no is
  'Fallback check-in: the person states who they are, face confirms it. 1:1 '
  'verification, never 1:N identification.';

grant execute on function public.verify_face_by_staff_no(text, text, text, extensions.vector)
  to anon, authenticated;


-- ----------------------------------------------------------------------------
-- identify_face — 1:N, the primary face fallback
--
-- Enforces TWO conditions before naming anyone:
--   1. the best match clears the similarity threshold, and
--   2. it beats the runner-up by a clear margin
--
-- If two people score close together the function returns nobody rather than
-- picking the higher number. The caller then asks for a staff number.
-- ----------------------------------------------------------------------------
create or replace function public.identify_face(
  p_kiosk_code    text,
  p_kiosk_token   text,
  p_embedding     extensions.vector(512),
  p_department_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kiosk     public.kiosks%rowtype;
  v_settings  public.hospital_settings%rowtype;
  v_best_id   uuid;
  v_best      real;
  v_runner_up real;
  v_margin    real;
begin
  select * into v_kiosk
    from public.kiosks
   where code = p_kiosk_code and is_active = true;

  if not found or v_kiosk.token_hash <> extensions.crypt(p_kiosk_token, v_kiosk.token_hash) then
    return jsonb_build_object('matched', false, 'reason', 'invalid_kiosk');
  end if;

  select * into v_settings from public.hospital_settings where id = true;

  -- Score every active staff member by their best-matching enrolled angle,
  -- then take the top row and the runner-up. The runner-up drives the margin
  -- rule, which is what stops a near-tie being resolved by guessing.
  with scored as (
    select fe.staff_id,
           max(1 - (fe.embedding OPERATOR(extensions.<=>) p_embedding)) as similarity
      from public.face_embeddings fe
      join public.staff s on s.id = fe.staff_id
     where s.status = 'active'
       and (p_department_id is null or s.department_id = p_department_id)
     group by fe.staff_id
  ),
  ranked as (
    select staff_id, similarity,
           row_number() over (order by similarity desc) as position
      from scored
  )
  select top.staff_id,
         top.similarity,
         (select second.similarity from ranked second where second.position = 2)
    into v_best_id, v_best, v_runner_up
    from ranked top
   where top.position = 1;

  if v_best_id is null then
    return jsonb_build_object('matched', false, 'reason', 'no_candidates');
  end if;

  v_margin := v_best - coalesce(v_runner_up, 0);

  if v_best < v_settings.face_match_threshold then
    return jsonb_build_object(
      'matched', false, 'reason', 'below_threshold',
      'similarity', round(v_best::numeric, 4),
      'threshold', v_settings.face_match_threshold
    );
  end if;

  -- Two people scoring close together: name nobody. This is the rule that
  -- prevents "identified as John one day, Peter the next".
  if v_runner_up is not null and v_margin < v_settings.face_match_margin then
    return jsonb_build_object(
      'matched', false, 'reason', 'ambiguous',
      'similarity', round(v_best::numeric, 4),
      'margin', round(v_margin::numeric, 4)
    );
  end if;

  return jsonb_build_object(
    'matched', true,
    'staff_id', v_best_id,
    'similarity', round(v_best::numeric, 4),
    'margin', round(v_margin::numeric, 4)
  );
end;
$$;

comment on function public.identify_face is
  'Primary face fallback: 1:N identification. Requires both a similarity '
  'threshold and a clear margin over the runner-up. Returns ambiguous rather '
  'than guessing when two people score close together — the caller then asks '
  'for a staff number instead.';

grant execute on function public.identify_face(text, text, extensions.vector, uuid)
  to anon, authenticated;


-- ----------------------------------------------------------------------------
-- debug_face_scores — evaluation helper, service_role only.
--
-- Scores an embedding against every enrolled staff member. It reveals how
-- closely named people resemble each other, so no browser-facing role may
-- call it. PUBLIC is revoked too: functions are executable by PUBLIC by
-- default, and revoking from anon alone would leave that door open.
-- ----------------------------------------------------------------------------
create or replace function public.debug_face_scores(
  p_embedding extensions.vector(512)
)
returns table (staff_no text, full_name text, best_similarity real)
language sql
security definer
set search_path = ''
as $$
  select s.staff_no,
         s.full_name,
         max(1 - (fe.embedding OPERATOR(extensions.<=>) p_embedding))::real
    from public.face_embeddings fe
    join public.staff s on s.id = fe.staff_id
   where s.status = 'active'
   group by s.staff_no, s.full_name
   order by 3 desc;
$$;

revoke all on function public.debug_face_scores(extensions.vector) from public, anon, authenticated;
grant execute on function public.debug_face_scores(extensions.vector) to service_role;


-- ============================================================================
-- 11. STAFF ATTENDANCE LOOKUP AT THE KIOSK
--
-- Lets a staff member view their own recent attendance without an account.
-- Requires the station credential; the caller must already have established
-- the staff_id biometrically. Returns dates, times and status only.
-- ============================================================================
create or replace function public.staff_attendance_lookup(
  p_kiosk_code  text,
  p_kiosk_token text,
  p_staff_id    uuid,
  p_days        int default 30
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kiosk    public.kiosks%rowtype;
  v_staff    public.staff%rowtype;
  v_records  jsonb;
  v_settings public.hospital_settings%rowtype;
  v_from     date;
begin
  select * into v_kiosk
    from public.kiosks
   where code = p_kiosk_code and is_active = true;

  if not found or v_kiosk.token_hash <> extensions.crypt(p_kiosk_token, v_kiosk.token_hash) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_kiosk');
  end if;

  select * into v_staff from public.staff where id = p_staff_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  select * into v_settings from public.hospital_settings where id = true;
  v_from := ((now() at time zone v_settings.timezone)::date) - greatest(p_days, 1);

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'shift_date',       a.shift_date,
               'check_in_at',      a.check_in_at,
               'check_in_status',  a.check_in_status,
               'check_in_method',  a.check_in_method,
               'check_out_at',     a.check_out_at,
               'check_out_status', a.check_out_status,
               'requires_approval', a.requires_approval,
               'shift_name',       s.name
             )
             order by a.shift_date desc
           ),
           '[]'::jsonb
         )
    into v_records
    from public.attendance a
    left join public.shifts s on s.id = a.shift_id
   where a.staff_id = p_staff_id
     and a.shift_date >= v_from;

  return jsonb_build_object(
    'ok', true,
    'staff_name', v_staff.full_name,
    'staff_no', v_staff.staff_no,
    'days', p_days,
    'records', v_records
  );
end;
$$;

comment on function public.staff_attendance_lookup is
  'Lets a staff member read their own recent attendance at a kiosk. Requires a '
  'station credential, and the caller must already have established the '
  'staff_id biometrically — the function does not authenticate the person, it '
  'only scopes and filters the data.';

grant execute on function public.staff_attendance_lookup(text, text, uuid, int)
  to anon, authenticated;


-- ============================================================================
-- 12. ADMIN MANAGEMENT FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- assign_console_role — turn an existing auth user into an admin or supervisor
--
-- The auth account itself must already exist. Creating auth users requires
-- the service role key, which must never reach a browser — so this function
-- handles the half that safely can: attaching a role and a department.
-- ----------------------------------------------------------------------------
create or replace function public.assign_console_role(
  p_email         text,
  p_full_name     text,
  p_role          public.console_role,
  p_department_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'not_admin');
  end if;

  -- A supervisor scoped to no department would see nothing at all, which
  -- looks like a broken account rather than a configuration mistake.
  if p_role = 'supervisor' and p_department_id is null then
    return jsonb_build_object('ok', false, 'reason', 'department_required');
  end if;

  select id into v_user_id
    from auth.users
   where lower(email) = lower(trim(p_email))
   limit 1;

  if v_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_such_user');
  end if;

  insert into public.profiles (id, full_name, email, role, department_id, is_active)
  values (v_user_id, trim(p_full_name), lower(trim(p_email)), p_role,
          case when p_role = 'admin' then null else p_department_id end, true)
  on conflict (id) do update
    set full_name     = excluded.full_name,
        role          = excluded.role,
        department_id = excluded.department_id,
        is_active     = true;

  return jsonb_build_object('ok', true, 'user_id', v_user_id);
end;
$$;

grant execute on function public.assign_console_role(text, text, public.console_role, uuid)
  to authenticated;


-- ----------------------------------------------------------------------------
-- revoke_console_access — deactivate rather than delete
--
-- Deleting the profile would orphan every approval they signed off. Marking
-- them inactive keeps the history intact while stopping them signing in.
-- ----------------------------------------------------------------------------
create or replace function public.revoke_console_access(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'not_admin');
  end if;

  if p_profile_id = (select auth.uid()) then
    return jsonb_build_object('ok', false, 'reason', 'cannot_revoke_self');
  end if;

  update public.profiles set is_active = false where id = p_profile_id;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.revoke_console_access(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- register_kiosk — create a station, or rotate its token
--
-- The plaintext token is hashed here and never stored. It is returned to the
-- caller once so the admin can type it into that station, and cannot be
-- recovered afterwards.
-- ----------------------------------------------------------------------------
create or replace function public.register_kiosk(
  p_code      text,
  p_label     text,
  p_location  text,
  p_reader_id text,
  p_token     text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'not_admin');
  end if;

  if length(trim(p_token)) < 12 then
    return jsonb_build_object('ok', false, 'reason', 'token_too_short');
  end if;

  insert into public.kiosks (code, label, location, token_hash, reader_id, has_camera)
  values (
    trim(p_code),
    trim(p_label),
    nullif(trim(p_location), ''),
    extensions.crypt(trim(p_token), extensions.gen_salt('bf')),
    nullif(trim(p_reader_id), ''),
    true
  )
  on conflict (code) do update
    set label      = excluded.label,
        location   = excluded.location,
        token_hash = excluded.token_hash,
        reader_id  = excluded.reader_id,
        is_active  = true;

  return jsonb_build_object('ok', true, 'code', trim(p_code));
end;
$$;

grant execute on function public.register_kiosk(text, text, text, text, text)
  to authenticated;


-- ----------------------------------------------------------------------------
-- set_staff_status — deactivate or reinstate a staff member
--
-- A terminated employee who can still clock in is a security hole.
-- Deactivating removes them from the next reader sync and blocks
-- record_attendance immediately. Their attendance history is untouched.
-- ----------------------------------------------------------------------------
create or replace function public.set_staff_status(
  p_staff_id uuid,
  p_status   public.staff_status,
  p_ends_on  date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'not_admin');
  end if;

  update public.staff
     set status  = p_status,
         ends_on = case when p_status = 'terminated'
                        then coalesce(p_ends_on, current_date)
                        else null end
   where id = p_staff_id;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.set_staff_status(uuid, public.staff_status, date)
  to authenticated;


-- ============================================================================
-- 13. REFERENCE DATA
--
-- Departments, job titles and the three standard shifts. No staff, no
-- biometrics, no attendance.
-- ============================================================================
insert into public.departments (code, name, is_clinical) values
  ('EMG',  'Emergency',            true),
  ('ICU',  'Intensive Care Unit',  true),
  ('GMD',  'General Medicine',     true),
  ('SUR',  'Surgery / Theatre',    true),
  ('MAT',  'Maternity (Obs & Gyn)',true),
  ('PAE',  'Paediatrics',          true),
  ('OPD',  'Outpatient',           true),
  ('LAB',  'Laboratory',           true),
  ('RAD',  'Radiology',            true),
  ('PHA',  'Pharmacy',             true),
  ('REC',  'Health Records',       false),
  ('ADM',  'Administration',       false)
on conflict (code) do nothing;

insert into public.job_titles (title, category) values
  -- Medical
  ('Consultant',            'medical'),
  ('Medical Officer',       'medical'),
  ('Resident',              'medical'),
  ('Intern',                'medical'),

  -- Nursing
  ('Chief Nursing Officer', 'nursing'),
  ('Charge Nurse',          'nursing'),
  ('Staff Nurse',           'nursing'),
  ('Enrolled Nurse',        'nursing'),
  ('Nursing Assistant',     'nursing'),
  ('Midwife',               'nursing'),

  -- Allied health
  ('Anaesthetist',          'allied_health'),
  ('Pharmacist',            'allied_health'),
  ('Pharmacy Technician',   'allied_health'),
  ('Lab Technologist',      'allied_health'),
  ('Lab Technician',        'allied_health'),
  ('Radiographer',          'allied_health'),
  ('Physiotherapist',       'allied_health'),

  -- Support
  ('Records Officer',       'support'),
  ('Receptionist',          'support'),
  ('Security Officer',      'support'),
  ('Cleaner',               'support'),
  ('Driver',                'support'),

  -- Administration
  ('Hospital Administrator','admin'),
  ('HR Officer',            'admin'),
  ('Accountant',            'admin'),
  ('IT Officer',            'admin')
on conflict (title) do nothing;

-- The standard 3 x 8-hour hospital rotation. Night crosses midnight.
-- Windows: open 30 min early, 60 min grace after start. Editable in Settings.
insert into public.shifts (
  code, name, starts_at, ends_at, crosses_midnight,
  checkin_opens_before_min, checkin_grace_after_min,
  checkout_opens_before_min, checkout_closes_after_min
) values
  ('morning', 'Morning Shift', '07:00', '15:00', false, 30, 60, 30, 60),
  ('evening', 'Evening Shift', '15:00', '23:00', false, 30, 60, 30, 60),
  ('night',   'Night Shift',   '23:00', '07:00', true,  30, 60, 30, 60)
on conflict (code) do nothing;


-- ============================================================================
-- 14. Tell the Data API to pick up the new schema immediately
-- ============================================================================
notify pgrst, 'reload schema';


-- ============================================================================
-- 15. CONFIRMATION
--
-- Expect exactly:
--   tables 15 · rls_enabled 15 · policies 26 · functions 16
--   departments 12 · job_titles 26 · shifts 3 · settings_rows 1
-- ============================================================================
select
  (select count(*) from pg_tables   where schemaname = 'public')                      as tables,
  (select count(*) from pg_tables   where schemaname = 'public' and rowsecurity)      as rls_enabled,
  (select count(*) from pg_policies where schemaname = 'public')                      as policies,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'touch_updated_at', 'current_console_role', 'is_admin', 'current_department_id',
      'sync_fingerprint_count', 'sync_face_enrolled', 'record_attendance',
      'verify_face', 'verify_face_by_staff_no', 'identify_face', 'debug_face_scores',
      'staff_attendance_lookup', 'assign_console_role', 'revoke_console_access',
      'register_kiosk', 'set_staff_status'))                                          as functions,
  (select count(*) from public.departments)                                           as departments,
  (select count(*) from public.job_titles)                                            as job_titles,
  (select count(*) from public.shifts)                                                as shifts,
  (select count(*) from public.hospital_settings)                                     as settings_rows;
