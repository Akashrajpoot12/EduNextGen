-- School Circulars / Letters
CREATE TABLE IF NOT EXISTS public.circulars (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  circular_number TEXT NOT NULL,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  issued_to       TEXT NOT NULL DEFAULT 'all',  -- all/parents/staff/students/teachers
  issue_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  academic_year   TEXT NOT NULL DEFAULT '2025-26',
  created_at      TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(school_id, circular_number)
);

ALTER TABLE public.circulars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_circulars" ON public.circulars
  USING (school_id = (SELECT school_id FROM public.users WHERE id = auth.uid()));
