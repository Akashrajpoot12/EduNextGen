-- ==============================================================================
-- Migration 00035: Consolidate app tables that previously lived only in
-- hand-run helper scripts (supabase/fix_missing_tables.sql, create_*.sql).
--
-- Everything here is idempotent (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT
-- EXISTS / DROP POLICY IF EXISTS), so it is a no-op on the already-running DB and
-- the source of truth for a clean deploy. After this, `supabase db reset` from
-- migrations alone produces a complete, working schema.
-- ==============================================================================

-- ── students: login + parent linkage columns ────────────────────────────────
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parent_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS students_user_id_key
  ON public.students(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_students_parent_user_id ON public.students(parent_user_id);

-- Backfill parent_user_id (auth.users id) from the legacy parent_id (public.users)
-- by matching email, so the parent portal (which filters on parent_user_id = auth.uid())
-- works for already-linked records.
UPDATE public.students s
SET parent_user_id = au.id
FROM public.users pu
JOIN auth.users au ON lower(au.email) = lower(pu.email)
WHERE s.parent_user_id IS NULL AND s.parent_id = pu.id;

-- ── fees (flat, student-facing) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fees (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id  UUID REFERENCES public.students(id) ON DELETE CASCADE,
  fee_type    TEXT NOT NULL DEFAULT 'Tuition Fee',
  description TEXT,
  amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  due_date    DATE,
  paid_date   DATE,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue')),
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.fees ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_fees_school ON public.fees(school_id);
CREATE INDEX IF NOT EXISTS idx_fees_student ON public.fees(student_id);
DROP POLICY IF EXISTS "students_view_own_fees" ON public.fees;
CREATE POLICY "students_view_own_fees" ON public.fees FOR SELECT
  USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "admin_manage_fees" ON public.fees;
CREATE POLICY "admin_manage_fees" ON public.fees FOR ALL
  USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('school_admin','admin','staff')));

-- ── leave_requests (student/parent leaves) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id  UUID REFERENCES public.students(id) ON DELETE CASCADE,
  class_id    UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  from_date   DATE NOT NULL,
  to_date     DATE,
  leave_type  TEXT NOT NULL DEFAULT 'Sick Leave',
  reason      TEXT,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_leave_req_school ON public.leave_requests(school_id);
CREATE INDEX IF NOT EXISTS idx_leave_req_student ON public.leave_requests(student_id);
DROP POLICY IF EXISTS "students_manage_own_leaves" ON public.leave_requests;
CREATE POLICY "students_manage_own_leaves" ON public.leave_requests FOR ALL
  USING (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
    OR student_id IN (SELECT id FROM public.students WHERE parent_user_id = auth.uid())
  );
DROP POLICY IF EXISTS "admin_manage_leaves" ON public.leave_requests;
CREATE POLICY "admin_manage_leaves" ON public.leave_requests FOR ALL
  USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('school_admin','admin','staff','teacher')));

-- ── messages (student <-> school direct messages) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  sender_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  is_read     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_messages_school ON public.messages(school_id);
DROP POLICY IF EXISTS "users_view_own_messages" ON public.messages;
CREATE POLICY "users_view_own_messages" ON public.messages FOR SELECT
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());
DROP POLICY IF EXISTS "users_send_messages" ON public.messages;
CREATE POLICY "users_send_messages" ON public.messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());

-- ── student_documents (document requests) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id   UUID REFERENCES public.students(id) ON DELETE CASCADE,
  doc_type     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','issued','rejected')),
  file_url     TEXT,
  requested_at TIMESTAMPTZ DEFAULT now(),
  issued_at    TIMESTAMPTZ
);
ALTER TABLE public.student_documents ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_student_docs_school ON public.student_documents(school_id);
DROP POLICY IF EXISTS "students_view_own_docs" ON public.student_documents;
CREATE POLICY "students_view_own_docs" ON public.student_documents FOR SELECT
  USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "students_request_docs" ON public.student_documents;
CREATE POLICY "students_request_docs" ON public.student_documents FOR INSERT
  WITH CHECK (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "admin_manage_docs" ON public.student_documents;
CREATE POLICY "admin_manage_docs" ON public.student_documents FOR ALL
  USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('school_admin','admin','staff')));

-- ── daily_diary ──────────────────────────────────────────────────────────────
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
CREATE INDEX IF NOT EXISTS idx_daily_diary_school_date ON public.daily_diary(school_id, date);
DROP POLICY IF EXISTS "diary_school_access" ON public.daily_diary;
CREATE POLICY "diary_school_access" ON public.daily_diary FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND school_id = daily_diary.school_id));

-- ── ptm_meetings ─────────────────────────────────────────────────────────────
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
  status      TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','ongoing','completed','cancelled')),
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ptm_meetings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ptm_school_date ON public.ptm_meetings(school_id, date);
DROP POLICY IF EXISTS "school_ptm_access" ON public.ptm_meetings;
CREATE POLICY "school_ptm_access" ON public.ptm_meetings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND school_id = ptm_meetings.school_id));

-- ── message_templates ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.message_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('absent','fees','homework','exam','general','ptm','holiday','custom')),
  message     TEXT NOT NULL,
  variables   TEXT[],
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_msg_templates_school ON public.message_templates(school_id);
DROP POLICY IF EXISTS "school_templates_access" ON public.message_templates;
CREATE POLICY "school_templates_access" ON public.message_templates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND school_id = message_templates.school_id AND role IN ('admin','school_admin','super_admin')));

-- ── leave_applications (staff/teacher leaves) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.leave_applications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leave_type  TEXT NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  reason      TEXT,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.leave_applications ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_leave_apps_school ON public.leave_applications(school_id);
CREATE INDEX IF NOT EXISTS idx_leave_apps_user ON public.leave_applications(user_id);
DROP POLICY IF EXISTS "users_own_leaves" ON public.leave_applications;
CREATE POLICY "users_own_leaves" ON public.leave_applications FOR ALL TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND school_id = leave_applications.school_id AND role IN ('admin','school_admin','super_admin','staff')));

-- ── syllabus ─────────────────────────────────────────────────────────────────
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
CREATE INDEX IF NOT EXISTS idx_syllabus_school ON public.syllabus(school_id);
DROP POLICY IF EXISTS "school_syllabus_access" ON public.syllabus;
CREATE POLICY "school_syllabus_access" ON public.syllabus FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND school_id = syllabus.school_id));

-- ── teacher_notifications ────────────────────────────────────────────────────
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
CREATE POLICY "own_notifications" ON public.teacher_notifications FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- ── teacher_parent_messages ──────────────────────────────────────────────────
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
CREATE INDEX IF NOT EXISTS idx_tpm_school ON public.teacher_parent_messages(school_id);
DROP POLICY IF EXISTS "message_participants" ON public.teacher_parent_messages;
CREATE POLICY "message_participants" ON public.teacher_parent_messages FOR ALL TO authenticated
  USING (teacher_id = auth.uid() OR parent_id = auth.uid());
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.teacher_parent_messages;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

-- ── communications (admin broadcast log + parent inbox) ──────────────────────
CREATE TABLE IF NOT EXISTS public.communications (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  sender_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_type TEXT,
  message_type   TEXT,
  subject        TEXT,
  body           TEXT,
  status         TEXT DEFAULT 'sent',
  created_at     TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_communications_school_created ON public.communications(school_id, created_at DESC);
DROP POLICY IF EXISTS "comm_school_read" ON public.communications;
CREATE POLICY "comm_school_read" ON public.communications FOR SELECT TO authenticated
  USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "comm_admin_manage" ON public.communications;
CREATE POLICY "comm_admin_manage" ON public.communications FOR ALL TO authenticated
  USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('school_admin','admin','staff','teacher')));

-- ── salaries (payroll base) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.salaries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  base_salary NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (school_id, user_id)
);
ALTER TABLE public.salaries ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_salaries_school ON public.salaries(school_id);
DROP POLICY IF EXISTS "salaries_admin_manage" ON public.salaries;
CREATE POLICY "salaries_admin_manage" ON public.salaries FOR ALL TO authenticated
  USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('school_admin','admin','staff')));

-- ── vehicles + routes (admin transport mgmt) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vehicles (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  vehicle_number TEXT,
  driver_name    TEXT,
  driver_phone   TEXT,
  capacity       INTEGER DEFAULT 40,
  created_at     TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_vehicles_school ON public.vehicles(school_id);
DROP POLICY IF EXISTS "vehicles_school_access" ON public.vehicles;
CREATE POLICY "vehicles_school_access" ON public.vehicles FOR ALL TO authenticated
  USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.routes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  vehicle_id  UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  route_name  TEXT NOT NULL,
  stops       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_routes_school ON public.routes(school_id);
DROP POLICY IF EXISTS "routes_school_access" ON public.routes;
CREATE POLICY "routes_school_access" ON public.routes FOR ALL TO authenticated
  USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()));

-- ── inventory_items ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  item_name   TEXT NOT NULL,
  category    TEXT,
  quantity    INTEGER DEFAULT 0,
  unit_price  NUMERIC(10,2),
  location    TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_inventory_school ON public.inventory_items(school_id);
DROP POLICY IF EXISTS "inventory_admin_manage" ON public.inventory_items;
CREATE POLICY "inventory_admin_manage" ON public.inventory_items FOR ALL TO authenticated
  USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('school_admin','admin','staff')));
