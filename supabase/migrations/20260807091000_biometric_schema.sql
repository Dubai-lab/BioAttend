-- ============================================================================
-- BioAttend · Migration 02 — Biometric schema
--
-- Covers: fingerprint_templates, face_embeddings, readers, reader_slots.
--
-- Design notes carried from the architecture decisions:
--   * Fingerprint templates can ONLY be matched by the reader's firmware.
--     Supabase is the system of record; the module's flash is a re-syncable
--     cache. reader_slots maps flash slot -> template.
--   * Face embeddings are plain vectors, so pgvector matches them in SQL.
--   * Biometric data is the most sensitive thing in this database. It is
--     readable by admins only — never by supervisors, never by anon.
-- ============================================================================


-- ============================================================================
-- fingerprint_templates
-- 512-byte proprietary template, stored base64 (~684 chars).
-- Four fingers per staff member: both thumbs, both index fingers.
-- ============================================================================
create table if not exists public.fingerprint_templates (
  id           uuid primary key default gen_random_uuid(),
  staff_id     uuid not null references public.staff(id) on delete cascade,
  finger       public.finger_position not null,

  template     text not null,          -- base64 of the 512-byte template
  quality      int  not null,          -- NFIQ-style score, higher is better
  minutiae     int,                    -- captured for the quality gate display

  enrolled_by  uuid references public.profiles(id) on delete set null,
  device_id    text,                   -- which reader captured it
  created_at   timestamptz not null default now(),

  unique (staff_id, finger),
  constraint fingerprint_quality_gate check (quality between 0 and 100)
);

comment on table public.fingerprint_templates is
  'Proprietary 512-byte templates. Cannot be matched in SQL or JS — only the '
  'reader firmware can compare them. This table is the system of record; the '
  'reader flash is a cache rebuilt from here.';

create index if not exists fingerprint_templates_staff_idx on public.fingerprint_templates (staff_id);

grant select on public.fingerprint_templates to anon;
grant select, insert, update, delete on public.fingerprint_templates to authenticated;
grant all on public.fingerprint_templates to service_role;

alter table public.fingerprint_templates enable row level security;

-- Admins only. Supervisors have no business reading raw biometric data.
drop policy if exists "fingerprint_templates_admin_only" on public.fingerprint_templates;
create policy "fingerprint_templates_admin_only"
  on public.fingerprint_templates for all to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );


-- ============================================================================
-- face_embeddings
-- 1024-d descriptor from @vladmandic/human. Multiple rows per staff member
-- (5 angles), matched by cosine distance.
-- ============================================================================
create table if not exists public.face_embeddings (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid not null references public.staff(id) on delete cascade,

  embedding   extensions.vector(1024) not null,
  angle       text not null check (
                angle in ('front', 'left', 'right', 'up', 'down')
              ),
  quality     real not null,           -- detector confidence at capture time

  enrolled_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),

  unique (staff_id, angle)
);

comment on table public.face_embeddings is
  'Face descriptors only. Raw face images are never stored — at most one '
  'reference thumbnail lives in a private Storage bucket.';

-- Cosine index for 1:N fallback search. Rebuild lists as the roster grows.
create index if not exists face_embeddings_vector_idx
  on public.face_embeddings
  using ivfflat (embedding extensions.vector_cosine_ops)
  with (lists = 100);

create index if not exists face_embeddings_staff_idx on public.face_embeddings (staff_id);

grant select on public.face_embeddings to anon;
grant select, insert, update, delete on public.face_embeddings to authenticated;
grant all on public.face_embeddings to service_role;

alter table public.face_embeddings enable row level security;

drop policy if exists "face_embeddings_admin_only" on public.face_embeddings;
create policy "face_embeddings_admin_only"
  on public.face_embeddings for all to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );


-- ============================================================================
-- readers — physical fingerprint devices
-- ============================================================================
create table if not exists public.readers (
  id             text primary key,               -- e.g. HR-DESK-01
  label          text not null,
  location       text,
  firmware       text,
  resolution_dpi int,
  capacity       int not null default 1000,      -- template slots in flash
  last_synced_at timestamptz,
  last_seen_at   timestamptz,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

grant select on public.readers to anon;
grant select, insert, update, delete on public.readers to authenticated;
grant all on public.readers to service_role;

alter table public.readers enable row level security;

drop policy if exists "readers_select_authenticated" on public.readers;
create policy "readers_select_authenticated"
  on public.readers for select to authenticated
  using ( true );

drop policy if exists "readers_admin_write" on public.readers;
create policy "readers_admin_write"
  on public.readers for all to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );


-- ============================================================================
-- reader_slots — maps a reader's flash slot to a stored template.
--
-- This is what makes a dead reader a non-event: wipe the replacement,
-- re-download every template from fingerprint_templates, rewrite this map.
-- ============================================================================
create table if not exists public.reader_slots (
  reader_id   text not null references public.readers(id) on delete cascade,
  slot_id     int  not null,
  template_id uuid not null references public.fingerprint_templates(id) on delete cascade,
  staff_id    uuid not null references public.staff(id) on delete cascade,
  synced_at   timestamptz not null default now(),

  primary key (reader_id, slot_id),
  unique (reader_id, template_id),
  constraint reader_slot_non_negative check (slot_id >= 0)
);

comment on table public.reader_slots is
  'Slot map for on-device 1:N search. HighSpeedSearch returns a slot number; '
  'this table turns that number back into a staff_id.';

create index if not exists reader_slots_staff_idx on public.reader_slots (staff_id);

grant select on public.reader_slots to anon;
grant select, insert, update, delete on public.reader_slots to authenticated;
grant all on public.reader_slots to service_role;

alter table public.reader_slots enable row level security;

drop policy if exists "reader_slots_admin_only" on public.reader_slots;
create policy "reader_slots_admin_only"
  on public.reader_slots for all to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );


-- ============================================================================
-- Enrollment progress counters
--
-- Kept in the database rather than recomputed in the UI, so the staff
-- directory can show enrollment state without N+1 queries.
-- ============================================================================

create or replace function public.sync_fingerprint_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_staff uuid := coalesce(new.staff_id, old.staff_id);
begin
  update public.staff
     set fingerprints_enrolled = (
           select count(*) from public.fingerprint_templates
            where staff_id = target_staff
         )
   where id = target_staff;
  return null;
end;
$$;

drop trigger if exists fingerprint_templates_sync_count on public.fingerprint_templates;
create trigger fingerprint_templates_sync_count
  after insert or delete on public.fingerprint_templates
  for each row execute function public.sync_fingerprint_count();


create or replace function public.sync_face_enrolled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_staff uuid := coalesce(new.staff_id, old.staff_id);
begin
  update public.staff
     set face_enrolled = exists (
           select 1 from public.face_embeddings where staff_id = target_staff
         )
   where id = target_staff;
  return null;
end;
$$;

drop trigger if exists face_embeddings_sync_enrolled on public.face_embeddings;
create trigger face_embeddings_sync_enrolled
  after insert or delete on public.face_embeddings
  for each row execute function public.sync_face_enrolled();
