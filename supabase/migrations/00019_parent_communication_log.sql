-- Migration 00019: Parent Communication Log

CREATE TABLE IF NOT EXISTS public.parent_communication_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  contact_name  TEXT NOT NULL,          -- parent/guardian name
  contact_phone TEXT,
  comm_type     TEXT NOT NULL DEFAULT 'call',  -- call/sms/whatsapp/meeting/email/letter
  direction     TEXT NOT NULL DEFAULT 'outgoing',  -- outgoing/incoming
  subject       TEXT NOT NULL,
  notes         TEXT,
  follow_up_date DATE,
  follow_up_done BOOLEAN DEFAULT false,
  logged_by     UUID REFERENCES public.users(id),
  comm_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.parent_communication_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School access comm_log" ON public.parent_communication_log
  FOR ALL
  USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin())
  WITH CHECK (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin());

CREATE INDEX IF NOT EXISTS idx_comm_log_school      ON public.parent_communication_log(school_id);
CREATE INDEX IF NOT EXISTS idx_comm_log_student     ON public.parent_communication_log(student_id);
CREATE INDEX IF NOT EXISTS idx_comm_log_follow_up   ON public.parent_communication_log(follow_up_date) WHERE follow_up_done = false;
