-- Migration 00018: Enhance announcements table for daily diary + circulars

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS notice_type  TEXT NOT NULL DEFAULT 'announcement',
  ADD COLUMN IF NOT EXISTS notice_date  DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS priority     TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS is_pinned    BOOLEAN DEFAULT false;

-- RLS policy (in case it was missing)
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'announcements' AND policyname = 'School access announcements'
  ) THEN
    CREATE POLICY "School access announcements" ON public.announcements
      FOR ALL
      USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin())
      WITH CHECK (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_announcements_school_date ON public.announcements(school_id, notice_date);
