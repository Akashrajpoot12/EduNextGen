-- ==============================================================================
-- MIGRATION 00015: School Core Features
-- 1. Fee Structure + Receipts
-- 2. Marks / Grade Book
-- 3. Academic Calendar
-- 4. Library Management
-- 5. Transport Routes & Stops
-- 6. Student Health Records
-- 7. Online Admission Applications
-- 8. Document Storage metadata
-- ==============================================================================

-- ─── 1. Fee Structures ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fee_structures (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  amount          NUMERIC(10,2) NOT NULL,
  frequency       TEXT NOT NULL DEFAULT 'monthly',  -- monthly/quarterly/annual/one_time
  applicable_to   TEXT DEFAULT 'all',               -- all/specific_class
  class_ids       TEXT[],
  late_fine_per_day NUMERIC(6,2) DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  academic_year   TEXT,
  created_at      TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- Fee assignments per student per period
CREATE TABLE IF NOT EXISTS public.student_fee_assignments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id        UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  fee_structure_id  UUID NOT NULL REFERENCES public.fee_structures(id) ON DELETE CASCADE,
  due_date          DATE NOT NULL,
  amount            NUMERIC(10,2) NOT NULL,
  discount          NUMERIC(10,2) DEFAULT 0,
  fine              NUMERIC(10,2) DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'pending',  -- pending/paid/partial/waived
  academic_year     TEXT,
  month             INTEGER,
  year              INTEGER,
  created_at        TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- Fee receipts
CREATE TABLE IF NOT EXISTS public.fee_receipts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number      TEXT NOT NULL,
  school_id           UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id          UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  assignment_id       UUID REFERENCES public.student_fee_assignments(id),
  amount_paid         NUMERIC(10,2) NOT NULL,
  payment_mode        TEXT NOT NULL DEFAULT 'cash',  -- cash/online/cheque/dd/upi
  razorpay_payment_id TEXT,
  collected_by        UUID REFERENCES public.users(id),
  remarks             TEXT,
  paid_at             TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- Auto receipt number
CREATE SEQUENCE IF NOT EXISTS public.receipt_number_seq START 1001;

CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.receipt_number IS NULL OR NEW.receipt_number = '' THEN
    NEW.receipt_number := 'RCP-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(NEXTVAL('public.receipt_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_receipt_number ON public.fee_receipts;
CREATE TRIGGER set_receipt_number
  BEFORE INSERT ON public.fee_receipts
  FOR EACH ROW EXECUTE FUNCTION public.generate_receipt_number();

ALTER TABLE public.fee_structures          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_fee_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_receipts            ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School access fee_structures"       ON public.fee_structures          FOR ALL USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin()) WITH CHECK (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin());
CREATE POLICY "School access fee_assignments"      ON public.student_fee_assignments FOR ALL USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin()) WITH CHECK (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin());
CREATE POLICY "School access fee_receipts"         ON public.fee_receipts            FOR ALL USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin()) WITH CHECK (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin());

-- ─── 2. Marks / Grade Book ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.marks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id     UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id       UUID REFERENCES public.classes(id),
  exam_id        UUID REFERENCES public.exams(id),
  subject        TEXT NOT NULL,
  max_marks      NUMERIC(6,2) NOT NULL DEFAULT 100,
  marks_obtained NUMERIC(6,2),
  is_absent      BOOLEAN DEFAULT false,
  grade          TEXT,
  remarks        TEXT,
  entered_by     UUID REFERENCES public.users(id),
  created_at     TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at     TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(school_id, student_id, exam_id, subject)
);

ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School access marks" ON public.marks FOR ALL USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin()) WITH CHECK (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin());

-- Grade calculator function
CREATE OR REPLACE FUNCTION public.calculate_grade(marks NUMERIC, max_marks NUMERIC)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE pct NUMERIC;
BEGIN
  IF max_marks = 0 OR marks IS NULL THEN RETURN 'N/A'; END IF;
  pct := (marks / max_marks) * 100;
  IF    pct >= 90 THEN RETURN 'A+';
  ELSIF pct >= 80 THEN RETURN 'A';
  ELSIF pct >= 70 THEN RETURN 'B+';
  ELSIF pct >= 60 THEN RETURN 'B';
  ELSIF pct >= 50 THEN RETURN 'C';
  ELSIF pct >= 40 THEN RETURN 'D';
  ELSE                  RETURN 'F';
  END IF;
END;
$$;

-- ─── 3. Academic Calendar ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.academic_calendar (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  event_date  DATE NOT NULL,
  end_date    DATE,
  event_type  TEXT NOT NULL DEFAULT 'event',  -- holiday/exam/ptm/sports/cultural/other
  color       TEXT DEFAULT '#3B82F6',
  is_holiday  BOOLEAN DEFAULT false,
  created_by  UUID REFERENCES public.users(id),
  created_at  TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.academic_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School access calendar" ON public.academic_calendar FOR ALL USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin()) WITH CHECK (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin());
CREATE POLICY "All auth view calendar" ON public.academic_calendar FOR SELECT USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin());

-- ─── 4. Library ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.library_books (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  author           TEXT,
  isbn             TEXT,
  category         TEXT DEFAULT 'General',
  publisher        TEXT,
  publish_year     INTEGER,
  total_copies     INTEGER NOT NULL DEFAULT 1,
  available_copies INTEGER NOT NULL DEFAULT 1,
  rack_location    TEXT,
  cover_url        TEXT,
  created_at       TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.library_issues (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  book_id      UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  student_id   UUID REFERENCES public.students(id),
  issued_to_name TEXT,
  issued_by    UUID REFERENCES public.users(id),
  issue_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date     DATE NOT NULL,
  return_date  DATE,
  fine_amount  NUMERIC(6,2) DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'issued',  -- issued/returned/overdue
  created_at   TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.library_books  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School access library_books"  ON public.library_books  FOR ALL USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin()) WITH CHECK (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin());
CREATE POLICY "School access library_issues" ON public.library_issues FOR ALL USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin()) WITH CHECK (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin());

-- ─── 5. Transport Routes ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transport_routes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  route_name     TEXT NOT NULL,
  vehicle_number TEXT,
  driver_name    TEXT,
  driver_phone   TEXT,
  monthly_fee    NUMERIC(8,2) DEFAULT 0,
  total_capacity INTEGER DEFAULT 40,
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.transport_stops (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id    UUID NOT NULL REFERENCES public.transport_routes(id) ON DELETE CASCADE,
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  stop_name   TEXT NOT NULL,
  stop_order  INTEGER NOT NULL,
  pickup_time TIME,
  drop_time   TIME,
  created_at  TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.student_transport (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  route_id   UUID NOT NULL REFERENCES public.transport_routes(id),
  stop_id    UUID REFERENCES public.transport_stops(id),
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(student_id)
);

ALTER TABLE public.transport_routes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_stops   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_transport ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School access transport_routes"  ON public.transport_routes  FOR ALL USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin()) WITH CHECK (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin());
CREATE POLICY "School access transport_stops"   ON public.transport_stops   FOR ALL USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin()) WITH CHECK (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin());
CREATE POLICY "School access student_transport" ON public.student_transport FOR ALL USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin()) WITH CHECK (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin());

-- ─── 6. Student Health Records ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_health (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id        UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  blood_group       TEXT,
  height_cm         NUMERIC(5,2),
  weight_kg         NUMERIC(5,2),
  vision            TEXT,
  medical_conditions TEXT,
  allergies         TEXT,
  medications       TEXT,
  emergency_contact TEXT NOT NULL DEFAULT '',
  emergency_phone   TEXT NOT NULL DEFAULT '',
  last_checkup_date DATE,
  doctor_name       TEXT,
  notes             TEXT,
  updated_at        TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(student_id)
);

ALTER TABLE public.student_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School access health" ON public.student_health FOR ALL USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin()) WITH CHECK (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin());

-- ─── 7. Online Admission Applications ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admission_applications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_name      TEXT NOT NULL,
  date_of_birth     DATE,
  gender            TEXT,
  applying_for_class TEXT NOT NULL,
  father_name       TEXT,
  mother_name       TEXT,
  parent_phone      TEXT NOT NULL,
  parent_email      TEXT,
  address           TEXT,
  previous_school   TEXT,
  previous_class    TEXT,
  reason_for_change TEXT,
  documents_submitted TEXT[],
  status            TEXT NOT NULL DEFAULT 'pending',  -- pending/called/admitted/rejected
  interview_date    DATE,
  notes             TEXT,
  academic_year     TEXT,
  applied_at        TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.admission_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can apply" ON public.admission_applications FOR INSERT WITH CHECK (true);
CREATE POLICY "School manages applications" ON public.admission_applications FOR ALL USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin());

-- ─── 8. Document Storage metadata ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id   UUID REFERENCES public.students(id) ON DELETE CASCADE,
  doc_type     TEXT NOT NULL DEFAULT 'general',  -- general/tc/bonafide/birth_cert/aadhar/photo
  file_name    TEXT NOT NULL,
  file_url     TEXT NOT NULL,
  file_size    INTEGER,
  mime_type    TEXT,
  uploaded_by  UUID REFERENCES public.users(id),
  description  TEXT,
  created_at   TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.school_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School access documents" ON public.school_documents FOR ALL USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin()) WITH CHECK (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin());

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_fee_structures_school     ON public.fee_structures(school_id);
CREATE INDEX IF NOT EXISTS idx_fee_assignments_student   ON public.student_fee_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_assignments_status    ON public.student_fee_assignments(status);
CREATE INDEX IF NOT EXISTS idx_fee_receipts_school       ON public.fee_receipts(school_id);
CREATE INDEX IF NOT EXISTS idx_marks_student_exam        ON public.marks(student_id, exam_id);
CREATE INDEX IF NOT EXISTS idx_calendar_school_date      ON public.academic_calendar(school_id, event_date);
CREATE INDEX IF NOT EXISTS idx_library_books_school      ON public.library_books(school_id);
CREATE INDEX IF NOT EXISTS idx_library_issues_status     ON public.library_issues(status);
CREATE INDEX IF NOT EXISTS idx_health_student            ON public.student_health(student_id);
CREATE INDEX IF NOT EXISTS idx_admissions_school_status  ON public.admission_applications(school_id, status);
