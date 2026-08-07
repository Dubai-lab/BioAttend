-- ============================================================================
-- BioAttend · Migration 10 — Restore 1:N face identification, with guards
--
-- Migration 09 withdrew 1:N face after a sibling false accept. Restoring it as
-- the primary fallback, because a check-in that requires typing is a check-in
-- staff will avoid.
--
-- WHAT THE EARLIER TEST ACTUALLY SHOWED
--
-- The false accept happened with ONE enrolled face. identify_face compares the
-- best match against the runner-up and refuses when they are close — but with
-- a single enrolled identity there is no runner-up, so the margin rule never
-- ran. The guard that exists precisely to catch look-alikes was inactive.
--
-- With both siblings enrolled the same scan should return 'ambiguous' and name
-- nobody. That needs verifying with real data, not assuming.
--
-- THE DESIGN NOW
--
--   confident match   -> check in immediately, no typing
--   ambiguous / weak  -> fall back to staff number + 1:1 verification
--
-- Speed in the common case, typing only when the system genuinely cannot tell
-- two people apart.
--
-- RESIDUAL RISK, stated plainly: 1:N face accuracy degrades as the roster
-- grows. The thresholds below must be measured across the test subjects and
-- reported, not assumed.
-- ============================================================================

grant execute on function public.identify_face(text, text, extensions.vector, uuid)
  to anon, authenticated;

comment on function public.identify_face is
  'Primary face fallback: 1:N identification. Requires both a similarity '
  'threshold and a clear margin over the runner-up. Returns ambiguous rather '
  'than guessing when two people score close together — the caller then asks '
  'for a staff number instead.';


-- ----------------------------------------------------------------------------
-- Thresholds
--
-- Observed so far: same-person and sibling both scored 0.69-0.80 in 1:N with
-- one enrolled identity. 0.82 sits above that band. The margin is raised from
-- 0.08 to 0.15 because siblings are the case that matters and a small margin
-- would let a near-tie through.
--
-- These are starting points. Measure them.
-- ----------------------------------------------------------------------------
update public.hospital_settings
   set face_match_threshold = 0.82,
       face_match_margin    = 0.15
 where id = true;


-- ----------------------------------------------------------------------------
-- Evaluation helper: score a descriptor against every enrolled staff member.
--
-- This is how the threshold gets chosen from evidence rather than guessed.
-- Run it with a live capture from each test subject and record the spread
-- between the correct person and the closest impostor.
--
-- service_role only — it reveals how closely named people resemble each other.
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
   where s.status = 'active'
   group by s.staff_no, s.full_name
   order by 3 desc;
$$;

revoke all on function public.debug_face_scores(extensions.vector) from anon, authenticated;
grant execute on function public.debug_face_scores(extensions.vector) to service_role;
