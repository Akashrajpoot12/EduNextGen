-- ==============================================================================
-- Migration 00039: final reconciliation — remaining columns several pages read,
-- and relax the timetables.day_of_week CHECK to match the app's 0-based convention.
-- All idempotent → no-op on the live DB, fixes clean deploy + the flagged pages.
-- ==============================================================================

-- classes: class-teacher assignment (ClassesPage embeds + inserts class_teacher_id)
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS class_teacher_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- inventory_items: status badge (InventoryPage renders item.status)
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'good';
UPDATE public.inventory_items SET status = 'good' WHERE status IS NULL;

-- students: avatar (student-sidebar reads students.avatar_url)
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- schools: contact fields (CertificatesPage / ExamDateSheet read schools.email/address/phone)
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS email   TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS phone   TEXT;

-- users: date of birth (AdminDashboard teacher-birthday embed)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Relax timetables.day_of_week CHECK: app writes Monday=0 (DAYS_OF_WEEK index),
-- but the original CHECK was BETWEEN 1 AND 7 which rejects 0. Allow 0..6.
DO $$
BEGIN
  ALTER TABLE public.timetables DROP CONSTRAINT IF EXISTS timetables_day_of_week_check;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'timetables_dow_0_6') THEN
    ALTER TABLE public.timetables ADD CONSTRAINT timetables_dow_0_6 CHECK (day_of_week BETWEEN 0 AND 6);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'day_of_week CHECK relax skipped: %', SQLERRM;
END $$;
