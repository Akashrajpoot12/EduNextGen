-- PTM Meetings Table
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.ptm_meetings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id    UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  date        DATE NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  venue       TEXT,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'scheduled'
              CHECK (status IN ('scheduled','ongoing','completed','cancelled')),
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ptm_meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school_ptm_access" ON public.ptm_meetings;
CREATE POLICY "school_ptm_access" ON public.ptm_meetings
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND school_id = ptm_meetings.school_id
  ));

-- Verify
SELECT 'ptm_meetings created' AS result;
