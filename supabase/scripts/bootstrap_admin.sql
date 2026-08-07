-- ============================================================================
-- Bootstrap the first administrator
--
-- Console users are created by an admin — but the first one has nobody to
-- create them, so it happens here, once, by hand.
--
-- STEP 1  Supabase Dashboard -> Authentication -> Users -> "Add user"
--         Create the user with an email and password.
--         Tick "Auto Confirm User" so no email round-trip is needed.
--
-- STEP 2  Edit the two values below, then run this file in the SQL editor.
--
-- This is a script, not a migration. It is not part of the schema and is
-- never run automatically.
-- ============================================================================

insert into public.profiles (id, full_name, email, role, department_id, is_active)
select
  u.id,
  'John Doe',                     -- <-- your name, as it appears in the sidebar
  u.email,
  'admin',
  null,                           -- admins are not scoped to a department
  true
from auth.users u
where u.email = 'eg8217178@gmail.com'   -- <-- the email you just created
on conflict (id) do update
  set role      = 'admin',
      is_active = true;

-- Confirm it worked. Expect exactly one row, role = admin.
select p.full_name, p.email, p.role, p.is_active
  from public.profiles p
 where p.role = 'admin';


-- ----------------------------------------------------------------------------
-- Adding a supervisor later
--
-- Same idea, but scoped to one department. Supervisors see only their own
-- department's attendance — that scoping is enforced by RLS, not by the UI.
-- ----------------------------------------------------------------------------
-- insert into public.profiles (id, full_name, email, role, department_id, is_active)
-- select u.id, 'Supervisor Name', u.email, 'supervisor', d.id, true
--   from auth.users u
--   cross join public.departments d
--  where u.email = 'supervisor@example.com'
--    and d.code  = 'ICU'
-- on conflict (id) do update
--   set role = 'supervisor', department_id = excluded.department_id;
