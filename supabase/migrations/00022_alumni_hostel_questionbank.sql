-- Migration 00022: Alumni, Hostel, Question Bank

-- ── Alumni ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.alumni (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  admission_number TEXT,
  batch_year      INTEGER NOT NULL,   -- year of passing/leaving
  last_class      TEXT,
  father_name     TEXT,
  phone           TEXT,
  email           TEXT,
  current_city    TEXT,
  occupation      TEXT,
  organization    TEXT,
  achievement     TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);
ALTER TABLE public.alumni ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School access alumni" ON public.alumni FOR ALL
  USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin())
  WITH CHECK (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin());
CREATE INDEX IF NOT EXISTS idx_alumni_school ON public.alumni(school_id);

-- ── Hostel ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hostels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT DEFAULT 'boys',  -- boys/girls/mixed
  warden_name TEXT,
  warden_phone TEXT,
  total_rooms INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);
ALTER TABLE public.hostels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School access hostels" ON public.hostels FOR ALL
  USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin())
  WITH CHECK (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin());

CREATE TABLE IF NOT EXISTS public.hostel_rooms (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  hostel_id  UUID NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  room_type  TEXT DEFAULT 'dormitory',  -- dormitory/double/single
  capacity   INTEGER DEFAULT 4,
  monthly_fee NUMERIC(8,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);
ALTER TABLE public.hostel_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School access hostel_rooms" ON public.hostel_rooms FOR ALL
  USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin())
  WITH CHECK (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin());

CREATE TABLE IF NOT EXISTS public.hostel_assignments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  room_id    UUID NOT NULL REFERENCES public.hostel_rooms(id),
  bed_number TEXT,
  join_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  leave_date DATE,
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(student_id, is_active)
);
ALTER TABLE public.hostel_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School access hostel_assignments" ON public.hostel_assignments FOR ALL
  USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin())
  WITH CHECK (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin());

-- ── Question Bank ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.question_papers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  subject      TEXT NOT NULL,
  class_name   TEXT NOT NULL,
  exam_type    TEXT DEFAULT 'unit_test',  -- unit_test/mid_term/annual/practice
  total_marks  INTEGER DEFAULT 100,
  duration_min INTEGER DEFAULT 180,
  instructions TEXT,
  academic_year TEXT,
  created_at   TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);
ALTER TABLE public.question_papers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School access question_papers" ON public.question_papers FOR ALL
  USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin())
  WITH CHECK (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin());

CREATE TABLE IF NOT EXISTS public.questions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  paper_id     UUID NOT NULL REFERENCES public.question_papers(id) ON DELETE CASCADE,
  section_name TEXT DEFAULT 'Section A',
  q_type       TEXT DEFAULT 'short',  -- mcq/short/long/fill/true_false
  q_number     INTEGER DEFAULT 1,
  question     TEXT NOT NULL,
  options      TEXT[],               -- for MCQ: 4 options
  correct_answer TEXT,
  marks        INTEGER DEFAULT 1,
  created_at   TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School access questions" ON public.questions FOR ALL
  USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin())
  WITH CHECK (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin());

CREATE INDEX IF NOT EXISTS idx_questions_paper ON public.questions(paper_id);
CREATE INDEX IF NOT EXISTS idx_qpapers_school  ON public.question_papers(school_id);
