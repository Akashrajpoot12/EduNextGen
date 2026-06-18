-- Migration 00016: Enhance students table + add certificates table

-- ─── 1. Enhance Students Table ────────────────────────────────────────────────
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS name             TEXT,
  ADD COLUMN IF NOT EXISTS roll_number      TEXT,
  ADD COLUMN IF NOT EXISTS admission_number TEXT,
  ADD COLUMN IF NOT EXISTS father_name      TEXT,
  ADD COLUMN IF NOT EXISTS mother_name      TEXT,
  ADD COLUMN IF NOT EXISTS phone            TEXT,
  ADD COLUMN IF NOT EXISTS address          TEXT,
  ADD COLUMN IF NOT EXISTS blood_group      TEXT,
  ADD COLUMN IF NOT EXISTS category         TEXT DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS date_of_birth    DATE,
  ADD COLUMN IF NOT EXISTS gender           TEXT,
  ADD COLUMN IF NOT EXISTS previous_school  TEXT,
  ADD COLUMN IF NOT EXISTS academic_year    TEXT;

-- Backfill name from first_name + last_name for existing records
UPDATE public.students
SET name = TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
WHERE name IS NULL AND (first_name IS NOT NULL OR last_name IS NOT NULL);

-- ─── 2. Certificates Table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.certificates (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id            UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id           UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  cert_type            TEXT NOT NULL CHECK (cert_type IN ('tc', 'bonafide', 'character')),
  reference_number     TEXT,
  issue_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  -- TC-specific fields
  reason_leaving       TEXT,
  last_attendance_date DATE,
  -- Bonafide-specific fields
  purpose              TEXT,
  -- Shared fields
  conduct              TEXT DEFAULT 'Good',
  remarks              TEXT,
  issued_by            UUID REFERENCES public.users(id),
  created_at           TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- Auto-generate reference numbers: TC/2425/0001
CREATE SEQUENCE IF NOT EXISTS certificate_seq START 1;

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School access certificates" ON public.certificates
  FOR ALL
  USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin())
  WITH CHECK (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin());

CREATE INDEX IF NOT EXISTS idx_certificates_school   ON public.certificates(school_id);
CREATE INDEX IF NOT EXISTS idx_certificates_student  ON public.certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_students_school_class ON public.students(school_id, class_id);
