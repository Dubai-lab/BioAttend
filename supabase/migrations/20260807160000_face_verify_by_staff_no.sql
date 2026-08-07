-- ============================================================================
-- BioAttend · Migration 09 — Face verification by staff number
--
-- WHY THIS EXISTS
--
-- Testing revealed a false accept: with one enrolled face, identify_face
-- matched a different person (a sibling) at similarity 0.69-0.80 against a
-- threshold of 0.62. The enrolled person scored in the same band. No threshold
-- separates them, because 1:N with few identities is really asking "does this
-- face resemble the enrolled one at all?" — and most faces do.
--
-- This is the failure the whole design was meant to avoid: being identified as
-- one person today and another tomorrow. The response is not a higher
-- threshold; it is to stop asking face the wrong question.
--
--   1:N  "who is this?"        <- weak, degrades with roster size, now unused
--   1:1  "is this David?"      <- strong, what face is actually good at
--
-- So the fallback establishes identity first (staff number), then face
-- confirms it. This function does both in one call so the kiosk never needs
-- read access to the staff table.
--
-- Safe to re-run.
-- ============================================================================

create or replace function public.verify_face_by_staff_no(
  p_kiosk_code  text,
  p_kiosk_token text,
  p_staff_no    text,
  p_embedding   extensions.vector(1024)
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
-- Withdraw 1:N identification from the kiosk.
--
-- The function is kept for evaluation work — measuring how 1:N accuracy
-- degrades with roster size is a legitimate result to report — but the anon
-- role used by kiosks can no longer call it.
-- ----------------------------------------------------------------------------
revoke execute on function public.identify_face(text, text, extensions.vector, uuid) from anon;

comment on function public.identify_face is
  'NOT USED IN PRODUCTION. 1:N face identification produced a false accept in '
  'testing (a sibling matched at 0.69-0.80 against a 0.62 threshold with one '
  'enrolled identity). Retained for evaluation only; execute is revoked from '
  'anon so no kiosk can call it. Use verify_face_by_staff_no instead.';


-- ----------------------------------------------------------------------------
-- Raise the verification threshold.
--
-- 0.62 was a guess made before any measurement. Observed same-person scores
-- reached 0.80, and an impostor sibling reached 0.78 under 1:N. For 1:1 the
-- question is much easier, but the threshold should still sit above the
-- impostor band rather than inside it.
--
-- Treat 0.82 as a starting point, not a final answer: measure it properly
-- across your test subjects and report the chosen value with its evidence.
-- ----------------------------------------------------------------------------
update public.hospital_settings
   set face_match_threshold = 0.82
 where id = true;
