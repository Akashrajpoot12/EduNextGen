-- ==============================================================================
-- Migration 00037: Schema reconciliation — add columns the app uses that existed
-- only on the live (hand-edited) DB, so a CLEAN deploy from migrations matches it.
-- Also unifies the dual marks tables onto exam_marks, and adds the avatars bucket.
--
-- All ADD COLUMN / CREATE are IF NOT EXISTS → no-op on the already-running DB.
-- ==============================================================================

-- ── classes: display name used by ~14 pages' classes(name) embeds ────────────
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS name TEXT;
-- backfill a readable name where missing
UPDATE public.classes SET name = TRIM(COALESCE(grade_level,'') || ' - ' || COALESCE(section,''))
WHERE name IS NULL;

-- ── exams: columns the marks/exam UI selects ─────────────────────────────────
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS subject      TEXT,
  ADD COLUMN IF NOT EXISTS total_marks  NUMERIC,
  ADD COLUMN IF NOT EXISTS exam_type    TEXT,
  ADD COLUMN IF NOT EXISTS class_id     UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;

-- ── exam_marks: columns the gradebook/report code writes & reads ─────────────
ALTER TABLE public.exam_marks
  ADD COLUMN IF NOT EXISTS grade      TEXT,
  ADD COLUMN IF NOT EXISTS class_id   UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_absent  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_marks  NUMERIC DEFAULT 100,
  ADD COLUMN IF NOT EXISTS teacher_id UUID,
  ADD COLUMN IF NOT EXISTS remarks    TEXT;

-- ── homework: columns the teacher/admin homework code uses ───────────────────
ALTER TABLE public.homework
  ADD COLUMN IF NOT EXISTS subject    TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID;
-- keep created_by in sync with the legacy teacher_id where present
UPDATE public.homework SET created_by = teacher_id
WHERE created_by IS NULL AND teacher_id IS NOT NULL;

-- ── daily_attendance: columns used by attendance + seed/face ─────────────────
ALTER TABLE public.daily_attendance
  ADD COLUMN IF NOT EXISTS class_id  UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS marked_by TEXT;

-- ── users / students / messages misc columns ────────────────────────────────
ALTER TABLE public.users    ADD COLUMN IF NOT EXISTS class_id     UUID REFERENCES public.classes(id) ON DELETE SET NULL;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent_phone TEXT;
ALTER TABLE public.teacher_parent_messages
  ADD COLUMN IF NOT EXISTS sender_name TEXT,
  ADD COLUMN IF NOT EXISTS is_reply    BOOLEAN DEFAULT false;

-- ── Unify dual marks tables: migrate legacy public.marks → exam_marks ─────────
-- Admin ExamsPage historically wrote public.marks; everyone reads exam_marks.
-- Copy any rows that aren't already in exam_marks (matched on exam_id+student_id+subject).
DO $$
BEGIN
  IF to_regclass('public.marks') IS NOT NULL THEN
    INSERT INTO public.exam_marks
      (school_id, exam_id, student_id, subject, marks_obtained, max_marks, grade, is_absent, class_id)
    SELECT m.school_id, m.exam_id, m.student_id, m.subject, m.marks_obtained, m.max_marks,
           m.grade, COALESCE(m.is_absent, false), m.class_id
    FROM public.marks m
    WHERE NOT EXISTS (
      SELECT 1 FROM public.exam_marks em
      WHERE em.exam_id = m.exam_id AND em.student_id = m.student_id AND em.subject = m.subject
    );
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'marks->exam_marks migration skipped: %', SQLERRM;
END $$;

-- ── avatars storage bucket (profile photos, AccountSettingsPage) ──────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatars_read" ON storage.objects;
CREATE POLICY "avatars_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_write" ON storage.objects;
CREATE POLICY "avatars_write" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
CREATE POLICY "avatars_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'avatars');
