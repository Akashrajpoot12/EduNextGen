-- Migration 00017: Staff Attendance

CREATE TABLE IF NOT EXISTS public.staff_attendance (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  status      TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'half_day')),
  notes       TEXT,
  marked_by   UUID REFERENCES public.users(id),
  created_at  TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(school_id, user_id, date)
);

ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School access staff_attendance" ON public.staff_attendance
  FOR ALL
  USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin())
  WITH CHECK (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin());

CREATE INDEX IF NOT EXISTS idx_staff_att_school_date ON public.staff_attendance(school_id, date);
