-- ================================================================
-- PASTE IN SUPABASE SQL EDITOR AND RUN
-- ================================================================

-- STEP 1: Add user_id to students
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS students_user_id_key
  ON public.students(user_id) WHERE user_id IS NOT NULL;

-- STEP 2: Link students to auth users by email pattern
UPDATE public.students s
SET user_id = u.id
FROM auth.users u
WHERE s.user_id IS NULL
  AND u.email ~ '^c[0-9]+s[0-9]+@gems\.edu$'
  AND s.enrollment_number = 'GEMS'
    || LPAD(REGEXP_REPLACE(u.email, '^c([0-9]+)s.*', '\1'), 2, '0')
    || LPAD(REGEXP_REPLACE(u.email, '^c[0-9]+s0*([0-9]+)@.*', '\1'), 3, '0');

-- STEP 3: Drop & recreate fees (clean slate)
DROP TABLE IF EXISTS public.fees CASCADE;
CREATE TABLE public.fees (
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
CREATE POLICY "students_view_own_fees" ON public.fees FOR SELECT
  USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));
CREATE POLICY "admin_manage_fees" ON public.fees FOR ALL
  USING (school_id IN (
    SELECT school_id FROM user_roles WHERE user_id = auth.uid()
      AND role IN ('school_admin','admin','staff')
  ));

-- STEP 4: Drop & recreate leave_requests
DROP TABLE IF EXISTS public.leave_requests CASCADE;
CREATE TABLE public.leave_requests (
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
CREATE POLICY "students_manage_own_leaves" ON public.leave_requests FOR ALL
  USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));
CREATE POLICY "admin_manage_leaves" ON public.leave_requests FOR ALL
  USING (school_id IN (
    SELECT school_id FROM user_roles WHERE user_id = auth.uid()
      AND role IN ('school_admin','admin','staff','teacher')
  ));

-- STEP 5: Drop & recreate messages
DROP TABLE IF EXISTS public.messages CASCADE;
CREATE TABLE public.messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  sender_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  is_read     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_view_own_messages" ON public.messages FOR SELECT
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY "users_send_messages" ON public.messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());

-- STEP 6: Drop & recreate student_documents
DROP TABLE IF EXISTS public.student_documents CASCADE;
CREATE TABLE public.student_documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id   UUID REFERENCES public.students(id) ON DELETE CASCADE,
  doc_type     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','processing','issued','rejected')),
  file_url     TEXT,
  requested_at TIMESTAMPTZ DEFAULT now(),
  issued_at    TIMESTAMPTZ
);
ALTER TABLE public.student_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "students_view_own_docs" ON public.student_documents FOR SELECT
  USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));
CREATE POLICY "students_request_docs" ON public.student_documents FOR INSERT
  WITH CHECK (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));
CREATE POLICY "admin_manage_docs" ON public.student_documents FOR ALL
  USING (school_id IN (
    SELECT school_id FROM user_roles WHERE user_id = auth.uid()
      AND role IN ('school_admin','admin','staff')
  ));

-- STEP 7: Verify
SELECT 'students with user_id' AS check, COUNT(*)::text AS result FROM students WHERE user_id IS NOT NULL
UNION ALL
SELECT 'fees table', 'ok'
UNION ALL
SELECT 'leave_requests table', 'ok'
UNION ALL
SELECT 'messages table', 'ok'
UNION ALL
SELECT 'student_documents table', 'ok';
