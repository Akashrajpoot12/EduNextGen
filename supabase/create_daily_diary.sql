-- Daily Diary Table
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.daily_diary (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id    UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  subject     TEXT,
  homework    TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.daily_diary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "diary_school_access" ON public.daily_diary;
CREATE POLICY "diary_school_access" ON public.daily_diary
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND school_id = daily_diary.school_id
  ));

SELECT 'daily_diary created' AS result;
