-- ============================================================================
-- BioAttend · Migration 05 — Face matching
--
-- Face descriptors are ordinary vectors, so unlike fingerprint templates they
-- CAN be compared in SQL. pgvector does the work.
--
-- Matching runs inside SECURITY DEFINER functions rather than in the browser
-- because `face_embeddings` is admin-only under RLS and the kiosk holds just
-- the anon key. The kiosk sends a descriptor and gets back a decision — it
-- never sees anyone's stored biometrics. That is deliberate: a compromised
-- kiosk leaks nothing.
--
-- Safe to re-run.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- verify_face — 1:1
--
-- The primary path. Fingerprint identifies the person; this only answers
-- "is this the same person?", which is far more accurate than asking
-- "who among all staff is this?".
-- ----------------------------------------------------------------------------
create or replace function public.verify_face(
  p_kiosk_code  text,
  p_kiosk_token text,
  p_staff_id    uuid,
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
  v_similarity real;
begin
  select * into v_kiosk
    from public.kiosks
   where code = p_kiosk_code and is_active = true;

  if not found or v_kiosk.token_hash <> extensions.crypt(p_kiosk_token, v_kiosk.token_hash) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_kiosk');
  end if;

  select * into v_settings from public.hospital_settings where id = true;

  -- Best of the enrolled angles. A person turning slightly should still match
  -- against whichever stored pose is closest.
  select max(1 - (fe.embedding <=> p_embedding))
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
  'already identified someone — accurate enough to run at a loose threshold '
  'without falsely rejecting tired staff at 6am.';

grant execute on function public.verify_face(text, text, uuid, extensions.vector)
  to anon, authenticated;


-- ----------------------------------------------------------------------------
-- identify_face — 1:N, fallback only
--
-- Used when a finger will not read at all. Accuracy degrades as the roster
-- grows, so this enforces TWO conditions before naming anyone:
--
--   1. the best match clears the similarity threshold, and
--   2. it beats the runner-up by a clear margin
--
-- The margin is the important one. If two people score close together the
-- function returns nobody rather than picking the higher number — that is
-- exactly how "identified as John one day, Peter the next" happens, and it is
-- refused here rather than papered over.
-- ----------------------------------------------------------------------------
create or replace function public.identify_face(
  p_kiosk_code    text,
  p_kiosk_token   text,
  p_embedding     extensions.vector(1024),
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
  v_best      record;
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

  -- One row per staff member: their single best-matching angle.
  with scored as (
    select fe.staff_id,
           max(1 - (fe.embedding <=> p_embedding)) as similarity
      from public.face_embeddings fe
      join public.staff s on s.id = fe.staff_id
     where s.status = 'active'
       and (p_department_id is null or s.department_id = p_department_id)
     group by fe.staff_id
     order by similarity desc
     limit 2
  )
  select staff_id, similarity into v_best from scored limit 1;

  if v_best is null then
    return jsonb_build_object('matched', false, 'reason', 'no_candidates');
  end if;

  with scored as (
    select fe.staff_id,
           max(1 - (fe.embedding <=> p_embedding)) as similarity
      from public.face_embeddings fe
      join public.staff s on s.id = fe.staff_id
     where s.status = 'active'
       and (p_department_id is null or s.department_id = p_department_id)
     group by fe.staff_id
     order by similarity desc
     offset 1 limit 1
  )
  select similarity into v_runner_up from scored;

  v_margin := v_best.similarity - coalesce(v_runner_up, 0);

  if v_best.similarity < v_settings.face_match_threshold then
    return jsonb_build_object(
      'matched', false, 'reason', 'below_threshold',
      'similarity', round(v_best.similarity::numeric, 4)
    );
  end if;

  -- Two people scoring close together: refuse both.
  if v_runner_up is not null and v_margin < v_settings.face_match_margin then
    return jsonb_build_object(
      'matched', false, 'reason', 'ambiguous',
      'similarity', round(v_best.similarity::numeric, 4),
      'margin', round(v_margin::numeric, 4)
    );
  end if;

  return jsonb_build_object(
    'matched', true,
    'staff_id', v_best.staff_id,
    'similarity', round(v_best.similarity::numeric, 4),
    'margin', round(v_margin::numeric, 4)
  );
end;
$$;

comment on function public.identify_face is
  '1:N face identification, fallback only. Requires both a similarity '
  'threshold and a clear margin over the runner-up — a close second place '
  'returns nobody rather than a guess.';

grant execute on function public.identify_face(text, text, extensions.vector, uuid)
  to anon, authenticated;
