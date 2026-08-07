-- ============================================================================
-- BioAttend · Migration 06 — Fix vector operator resolution
--
-- Migration 05's functions failed at runtime with:
--     operator does not exist: extensions.vector <=> extensions.vector
--
-- Cause: every SECURITY DEFINER function in this project pins
-- `set search_path = ''` (correctly — it is a privilege-escalation guard and
-- the Supabase linter flags its absence). But pgvector installs `<=>` into the
-- `extensions` schema, and an empty search_path means bare operators cannot be
-- found.
--
-- Fix: OPERATOR(extensions.<=>) — the explicit-schema syntax for operators.
-- Unlike wrapping in extensions.cosine_distance(), this still lets the planner
-- use the ivfflat index, so it stays fast as the roster grows.
--
-- Safe to re-run.
-- ============================================================================


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

  -- One row per staff member: their single best-matching angle, best first.
  create temporary table if not exists _face_scores (
    staff_id   uuid,
    similarity real
  ) on commit drop;

  delete from _face_scores;

  insert into _face_scores (staff_id, similarity)
  select fe.staff_id,
         max(1 - (fe.embedding OPERATOR(extensions.<=>) p_embedding))
    from public.face_embeddings fe
    join public.staff s on s.id = fe.staff_id
   where s.status = 'active'
     and (p_department_id is null or s.department_id = p_department_id)
   group by fe.staff_id
   order by 2 desc
   limit 2;

  select staff_id, similarity into v_best_id, v_best
    from _face_scores order by similarity desc limit 1;

  if v_best_id is null then
    return jsonb_build_object('matched', false, 'reason', 'no_candidates');
  end if;

  select similarity into v_runner_up
    from _face_scores where staff_id <> v_best_id
   order by similarity desc limit 1;

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


-- ----------------------------------------------------------------------------
-- Diagnostic: what similarity does a given descriptor actually produce?
--
-- The threshold in hospital_settings was a starting guess. Run this with a
-- real descriptor to see the true range before tuning it, rather than picking
-- a number and hoping.
-- ----------------------------------------------------------------------------
create or replace function public.debug_face_scores(
  p_embedding extensions.vector(1024)
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
   group by s.staff_no, s.full_name
   order by 3 desc;
$$;

comment on function public.debug_face_scores is
  'Development aid for threshold tuning. Admin-only — it reveals how closely a '
  'descriptor matches each staff member. Drop this before any real deployment.';

revoke all on function public.debug_face_scores(extensions.vector) from anon, authenticated;
grant execute on function public.debug_face_scores(extensions.vector) to service_role;
