-- ============================================================================
-- BioAttend · Migration 03 — Attendance, kiosks, audit
--
-- This migration enforces the two rules the whole system rests on:
--
--   RULE 1  Attendance can only be written by a registered kiosk.
--           No kiosk credential -> no write. A stolen anon key plus a laptop
--           webcam still cannot forge a check-in, because the INSERT path is
--           a SECURITY DEFINER function that demands the kiosk secret and
--           direct INSERT is denied to everyone.
--
--   RULE 2  Time windows govern state, not scan order.
--           After the check-in window closes the system does NOT start
--           checking people out. It stays closed until the check-out window
--           opens. A scan in between is recorded as an attempt and rejected.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;


-- ----------------------------------------------------------------------------
-- hospital_settings — single row of institution-wide configuration
-- ----------------------------------------------------------------------------
create table if not exists public.hospital_settings (
  id                  boolean primary key default true,
  hospital_name       text not null default 'Northcrest General',
  system_name         text not null default 'BioAttend',
  timezone            text not null default 'Africa/Kigali',

  -- Face is a second factor / fallback, never a primary identifier.
  face_match_threshold        real not null default 0.62,  -- min cosine similarity
  face_match_margin           real not null default 0.08,  -- top must beat runner-up by this
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

-- Note: token_hash is deliberately reachable only by admins.
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
do $$
begin
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
-- Gives you the confidence-score dataset for the results chapter, and an
-- audit trail when someone claims the system missed them.
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
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;

alter table public.audit_log enable row level security;

drop policy if exists "audit_log_admin_read" on public.audit_log;
create policy "audit_log_admin_read"
  on public.audit_log for select to authenticated
  using ( public.is_admin() );


-- ============================================================================
-- record_attendance() — the ONLY path that writes attendance.
--
-- Requires a valid kiosk token. Resolves the staff member's shift for the
-- moment of the scan (handling night shifts that cross midnight), applies the
-- window rules, and returns a JSON verdict for the kiosk to display.
--
-- Returns, e.g.
--   { "decision": "check_in", "status": "on_time",
--     "staff_name": "Dr. Paul Mugisha", "staff_no": "NGH-1181",
--     "shift": "Morning Shift", "at": "2026-08-07T07:02:11+02:00" }
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
