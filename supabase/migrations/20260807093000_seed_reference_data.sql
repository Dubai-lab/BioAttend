-- ============================================================================
-- BioAttend · Migration 04 — Reference data
--
-- Departments, job titles and the three standard shifts. Reference data only:
-- no staff, no biometrics, no attendance. Safe to run on production.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Departments (12) — clinical, diagnostic and administrative
-- ----------------------------------------------------------------------------
insert into public.departments (code, name, is_clinical) values
  ('EMG',  'Emergency',            true),
  ('ICU',  'Intensive Care Unit',  true),
  ('GMD',  'General Medicine',     true),
  ('SUR',  'Surgery / Theatre',    true),
  ('MAT',  'Maternity (Obs & Gyn)',true),
  ('PAE',  'Paediatrics',          true),
  ('OPD',  'Outpatient',           true),
  ('LAB',  'Laboratory',           true),
  ('RAD',  'Radiology',            true),
  ('PHA',  'Pharmacy',             true),
  ('REC',  'Health Records',       false),
  ('ADM',  'Administration',       false)
on conflict (code) do nothing;


-- ----------------------------------------------------------------------------
-- Job titles, grouped so the enrollment form can filter by category
-- ----------------------------------------------------------------------------
insert into public.job_titles (title, category) values
  -- Medical
  ('Consultant',            'medical'),
  ('Medical Officer',       'medical'),
  ('Resident',              'medical'),
  ('Intern',                'medical'),

  -- Nursing
  ('Chief Nursing Officer', 'nursing'),
  ('Charge Nurse',          'nursing'),
  ('Staff Nurse',           'nursing'),
  ('Enrolled Nurse',        'nursing'),
  ('Nursing Assistant',     'nursing'),
  ('Midwife',               'nursing'),

  -- Allied health
  ('Anaesthetist',          'allied_health'),
  ('Pharmacist',            'allied_health'),
  ('Pharmacy Technician',   'allied_health'),
  ('Lab Technologist',      'allied_health'),
  ('Lab Technician',        'allied_health'),
  ('Radiographer',          'allied_health'),
  ('Physiotherapist',       'allied_health'),

  -- Support
  ('Records Officer',       'support'),
  ('Receptionist',          'support'),
  ('Security Officer',      'support'),
  ('Cleaner',               'support'),
  ('Driver',                'support'),

  -- Administration
  ('Hospital Administrator','admin'),
  ('HR Officer',            'admin'),
  ('Accountant',            'admin'),
  ('IT Officer',            'admin')
on conflict (title) do nothing;


-- ----------------------------------------------------------------------------
-- Shifts — the standard 3 x 8-hour hospital rotation.
--
-- Night crosses midnight, so crosses_midnight = true. That flag is what keeps
-- a 23:00 Monday shift filed under Monday when the nurse checks out at 07:00
-- on Tuesday.
--
-- Windows default to: open 30 min early, 60 min grace after start.
-- Admin can change these per shift in Settings.
-- ----------------------------------------------------------------------------
insert into public.shifts (
  code, name, starts_at, ends_at, crosses_midnight,
  checkin_opens_before_min, checkin_grace_after_min,
  checkout_opens_before_min, checkout_closes_after_min
) values
  ('morning', 'Morning Shift', '07:00', '15:00', false, 30, 60, 30, 60),
  ('evening', 'Evening Shift', '15:00', '23:00', false, 30, 60, 30, 60),
  ('night',   'Night Shift',   '23:00', '07:00', true,  30, 60, 30, 60)
on conflict (code) do nothing;
