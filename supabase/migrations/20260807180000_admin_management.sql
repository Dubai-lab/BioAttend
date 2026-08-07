-- ============================================================================
-- BioAttend · Migration 11 — Audit writes, supervisor and kiosk management
--
-- Three gaps closed:
--   1. audit_log had no insert path, so the page was always empty
--   2. supervisors could only be created by editing SQL by hand
--   3. kiosks likewise, including their bcrypt token
--
-- Safe to re-run.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- audit_log: allow console users to record their own actions
--
-- Entries are append-only. No update or delete policy exists for any
-- browser-facing role, so a log line cannot be edited away after the fact —
-- which is the entire point of keeping one.
-- ----------------------------------------------------------------------------
grant insert on public.audit_log to authenticated;

drop policy if exists "audit_log_insert_own" on public.audit_log;
create policy "audit_log_insert_own"
  on public.audit_log for insert to authenticated
  with check ( actor_id = (select auth.uid()) );

-- Supervisors should see what happened to their own department's records.
drop policy if exists "audit_log_admin_read" on public.audit_log;
create policy "audit_log_read"
  on public.audit_log for select to authenticated
  using ( public.is_admin() or actor_id = (select auth.uid()) );


-- ----------------------------------------------------------------------------
-- assign_console_role — turn an existing auth user into an admin or supervisor
--
-- The auth account itself must already exist (created in the Supabase
-- dashboard, or by the person signing up). Creating auth users requires the
-- service role key, which must never reach a browser — so this function
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
-- Staff status changes
--
-- A terminated employee who can still clock in is a security hole, not a
-- missing convenience. Deactivating removes them from the next reader sync
-- (which only writes active staff) and blocks record_attendance immediately,
-- since that already checks status.
--
-- Their attendance history is untouched — it belongs to the hospital's
-- records, not to their employment.
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
