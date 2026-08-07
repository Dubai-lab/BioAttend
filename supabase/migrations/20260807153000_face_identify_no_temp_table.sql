-- ============================================================================
-- BioAttend · Migration 07 — identify_face without a temp table
--
-- Migration 06 fixed the operator but used a temporary table, which failed on
-- Supabase with:
--     DELETE requires a WHERE clause
--
-- Supabase enables a safe-update guard that rejects unqualified DELETEs. The
-- temp table was unnecessary anyway: ranking the top two candidates is a
-- single window-function query, which is both simpler and one pass instead of
-- three.
--
-- Safe to re-run.
-- ============================================================================

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

  -- Score every active staff member by their best-matching enrolled angle,
  -- then pull the top two in one pass. The runner-up is needed for the margin
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
    select staff_id,
           similarity,
           row_number() over (order by similarity desc) as position
      from scored
  )
  select max(staff_id)    filter (where position = 1),
         max(similarity)  filter (where position = 1),
         max(similarity)  filter (where position = 2)
    into v_best_id, v_best, v_runner_up
    from ranked
   where position <= 2;

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
