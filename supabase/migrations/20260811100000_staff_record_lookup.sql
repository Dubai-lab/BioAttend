-- ============================================================================
-- BioAttend · Migration 13 — Staff attendance lookup at the kiosk
--
-- Lets a staff member view their own recent attendance without an account.
--
-- WHY NOT A STAFF LOGIN
--
-- Staff deliberately have no accounts: if they could sign in, they could sign
-- in from anywhere, and remote attendance fraud becomes possible again. That
-- constraint has shaped the whole system and is not relaxed here.
--
-- WHY A STAFF NUMBER ALONE IS NOT ENOUGH
--
-- Attendance reveals working patterns — when someone is on nights, when they
-- were absent. Allowing anyone to type a colleague's number and read their
-- record would be an information disclosure, and staff numbers are printed on
-- badges. Identity is therefore asserted and then confirmed biometrically,
-- the same rule the check-in path follows.
--
-- The function returns only what a person needs to check their own record:
-- dates, times and status. No match scores, no biometric data, no other
-- staff member's rows.
--
-- Safe to re-run.
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
  -- Same station credential the attendance path requires. A lookup is only
  -- possible from a registered kiosk, not from any browser holding the key.
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

  -- Bounded to this staff member and this window. Match scores are excluded:
  -- they are evaluation data, not something a staff member needs, and showing
  -- them invites arguments about numbers nobody can act on.
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
