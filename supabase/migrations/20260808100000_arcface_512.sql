-- ============================================================================
-- BioAttend · Migration 12 — Move face recognition to ArcFace (512-d)
--
-- Replaces the browser-computed 1024-d descriptors with 512-d ArcFace
-- embeddings produced by InsightFace running as a local service.
--
-- WHY
--
-- The previous model produced overlapping genuine and impostor distributions
-- for closely related individuals: a sibling scored 0.69-0.80 against an
-- enrolled face, the same band as the genuine person, so no threshold
-- separated them (Chapter 5, §5.6.4). ArcFace is trained with an additive
-- angular margin loss that explicitly maximises separation between identities,
-- which is the precise property that failed.
--
-- This does not make face matching categorical — it remains a continuous
-- similarity measure, and siblings will still score higher than strangers.
-- It widens the margin, which is what the safeguards need in order to work.
--
-- DESTRUCTIVE: every stored face embedding is deleted. The two models produce
-- incompatible vectors of different dimensionality; there is no conversion.
-- Every staff member must have their face captured again.
--
-- Fingerprint templates are untouched.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Drop the functions that take the old vector type.
--
-- Postgres identifies functions by their argument types, so these cannot be
-- replaced in place — the dimension is part of the signature.
-- ----------------------------------------------------------------------------
drop function if exists public.verify_face(text, text, uuid, extensions.vector);
drop function if exists public.identify_face(text, text, extensions.vector, uuid);
drop function if exists public.verify_face_by_staff_no(text, text, text, extensions.vector);
drop function if exists public.debug_face_scores(extensions.vector);


-- ----------------------------------------------------------------------------
-- 2. Clear the incompatible embeddings and change the dimension.
--
-- The delete has a where clause because Supabase's safe-update guard rejects
-- unqualified DELETE statements.
-- ----------------------------------------------------------------------------
drop index if exists face_embeddings_vector_idx;

delete from public.face_embeddings where true;

alter table public.face_embeddings
  alter column embedding type extensions.vector(512);

comment on column public.face_embeddings.embedding is
  '512-d L2-normalised ArcFace embedding from InsightFace buffalo_l. Cosine '
  'similarity reduces to a dot product because the vectors are normalised.';

create index face_embeddings_vector_idx
  on public.face_embeddings
  using ivfflat (embedding extensions.vector_cosine_ops)
  with (lists = 100);


-- ----------------------------------------------------------------------------
-- 3. Recreate the matching functions against the new dimension.
--
-- Logic is unchanged from migrations 08-10: threshold plus margin for
-- identification, threshold alone for verification. Only the vector size
-- differs.
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

grant execute on function public.verify_face(text, text, uuid, extensions.vector)
  to anon, authenticated;


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

  select * into v_staff
    from public.staff
   where status = 'active'
     and (
       upper(staff_no) = upper(trim(p_staff_no))
       or regexp_replace(staff_no, '\D', '', 'g') = regexp_replace(trim(p_staff_no), '\D', '', 'g')
     )
   limit 1;

  if not found then
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

grant execute on function public.verify_face_by_staff_no(text, text, text, extensions.vector)
  to anon, authenticated;


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

grant execute on function public.identify_face(text, text, extensions.vector, uuid)
  to anon, authenticated;


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

revoke all on function public.debug_face_scores(extensions.vector) from anon, authenticated;
grant execute on function public.debug_face_scores(extensions.vector) to service_role;


-- ----------------------------------------------------------------------------
-- 4. Reset the thresholds.
--
-- The previous values (0.82 / 0.15) were derived from the old model's score
-- distribution and carry no meaning for ArcFace, whose scores are distributed
-- differently. These are conservative starting points to be replaced by
-- measurement — for normalised ArcFace embeddings, genuine pairs typically sit
-- well above 0.5 and unrelated pairs well below 0.3.
--
-- Do not treat these as final. Measure them.
-- ----------------------------------------------------------------------------
update public.hospital_settings
   set face_match_threshold = 0.50,
       face_match_margin    = 0.10
 where id = true;
