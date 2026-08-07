-- ============================================================================
-- Register a kiosk
--
-- Attendance can only be written by a registered kiosk. This creates one.
--
-- YOU INVENT THE TOKEN. It is not generated anywhere and there is nowhere to
-- look it up — you choose it here, exactly like setting a password, and then
-- type the same string into the kiosk setup screen at /kiosk.
--
-- Only the bcrypt hash is stored, so once you close this file the plaintext
-- cannot be recovered. Write it down before running.
--
-- SECURITY: whoever holds this token can submit attendance scans. It belongs
-- to the physical station, not to a person — treat it like a door key.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- EDIT THE THREE VALUES MARKED  <<<<<  THEN RUN THE WHOLE FILE.
-- ---------------------------------------------------------------------------

insert into public.kiosks (code, label, location, token_hash, reader_id, has_camera)
values (
  'KIOSK-MAIN-01',                    -- <<<<< kiosk code (any name you like)
  'Main entrance kiosk',
  'Main entrance, ground floor',

  extensions.crypt(
    'CHANGE-ME-min-12-characters',  -- <<<<< THE TOKEN. Already generated for you.
    extensions.gen_salt('bf')
  ),

  'HR-DESK-01',                       -- <<<<< reader attached to this station
  true
)
on conflict (code) do update
  set token_hash = excluded.token_hash,
      label      = excluded.label,
      location   = excluded.location,
      reader_id  = excluded.reader_id,
      is_active  = true;


-- ---------------------------------------------------------------------------
-- Confirm it saved. The hash starts with $2a$ — plaintext is never stored.
-- ---------------------------------------------------------------------------
select code, label, location, reader_id, is_active,
       left(token_hash, 7) || '…' as token_hash_prefix
  from public.kiosks;


-- ---------------------------------------------------------------------------
-- OPTIONAL: prove the token works before walking to the kiosk.
--
-- 1. Find a staff id:
--      select id, staff_no, full_name from public.staff limit 5;
-- 2. Paste it below, along with the same token you used above, and run.
--
-- A JSON verdict means it works. {"decision":"rejected","reason":"invalid_kiosk"}
-- means the token does not match what you inserted.
-- ---------------------------------------------------------------------------
-- select public.record_attendance(
--   'KIOSK-MAIN-01',                                    -- kiosk code
--   'CHANGE-ME-min-12-characters',                            -- the same token
--   '00000000-0000-0000-0000-000000000000'::uuid,       -- a real staff id
--   'fingerprint',
--   95
-- );
