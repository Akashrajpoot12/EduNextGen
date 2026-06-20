-- ============================================================
-- Missing Teacher Tables Migration
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. leave_applications (Teacher leave requests)
CREATE TABLE IF NOT EXISTS public.leave_applications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leave_type    TEXT NOT NULL,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  reason        TEXT,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  reviewed_by   UUID REFERENCES auth.users(id),
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.leave_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_leaves" ON public.leave_applications;
CREATE POLICY "users_own_leaves" ON public.leave_applications
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND school_id = leave_applications.school_id AND role IN ('admin','super_admin')
  ));

-- 2. syllabus
CREATE TABLE IF NOT EXISTS public.syllabus (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id    UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  subject     TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed')),
  order_index INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.syllabus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school_syllabus_access" ON public.syllabus;
CREATE POLICY "school_syllabus_access" ON public.syllabus
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND school_id = syllabus.school_id
  ));

-- 3. teacher_notifications (read-status tracker for announcements)
CREATE TABLE IF NOT EXISTS public.teacher_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  is_read         BOOLEAN DEFAULT false,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, announcement_id)
);

ALTER TABLE public.teacher_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_notifications" ON public.teacher_notifications;
CREATE POLICY "own_notifications" ON public.teacher_notifications
  FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- 4. teacher_parent_messages (chat between teacher and parent)
CREATE TABLE IF NOT EXISTS public.teacher_parent_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message     TEXT NOT NULL,
  is_read     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.teacher_parent_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message_participants" ON public.teacher_parent_messages;
CREATE POLICY "message_participants" ON public.teacher_parent_messages
  FOR ALL TO authenticated
  USING (teacher_id = auth.uid() OR parent_id = auth.uid());

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.teacher_parent_messages;

-- ============================================================
-- Verify all tables created
-- ============================================================
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('leave_applications','syllabus','teacher_notifications','teacher_parent_messages')
ORDER BY table_name;
