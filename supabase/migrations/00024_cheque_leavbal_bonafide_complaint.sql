-- Cheque Payments
CREATE TABLE IF NOT EXISTS public.cheque_payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id       UUID REFERENCES public.students(id) ON DELETE SET NULL,
  cheque_number    TEXT NOT NULL,
  bank_name        TEXT NOT NULL,
  branch           TEXT,
  amount           NUMERIC(12,2) NOT NULL,
  cheque_date      DATE NOT NULL,
  deposit_date     DATE,
  status           TEXT NOT NULL DEFAULT 'pending',  -- pending/deposited/cleared/bounced
  bounce_reason    TEXT,
  remarks          TEXT,
  created_at       TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- Staff Leave Balances (per year per leave type)
CREATE TABLE IF NOT EXISTS public.staff_leave_balances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  staff_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  year            INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  leave_type      TEXT NOT NULL,   -- CL, EL, ML, SL
  total_allowed   INT NOT NULL DEFAULT 0,
  carry_forward   INT NOT NULL DEFAULT 0,
  used            INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(school_id, staff_id, year, leave_type)
);

-- Bonafide / Character Certificates
CREATE TABLE IF NOT EXISTS public.bonafide_certificates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  cert_number     TEXT NOT NULL,
  cert_type       TEXT NOT NULL DEFAULT 'bonafide',  -- bonafide/character/study
  purpose         TEXT NOT NULL,
  issue_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_till      DATE,
  remarks         TEXT,
  created_at      TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(school_id, cert_number)
);

-- Complaint Register
CREATE TABLE IF NOT EXISTS public.complaints (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  complaint_number  TEXT NOT NULL,
  complainant_name  TEXT NOT NULL,
  complainant_type  TEXT NOT NULL DEFAULT 'parent',  -- parent/student/staff/other
  complainant_phone TEXT,
  student_id        UUID REFERENCES public.students(id) ON DELETE SET NULL,
  complaint_type    TEXT NOT NULL,
  description       TEXT NOT NULL,
  priority          TEXT NOT NULL DEFAULT 'medium',  -- low/medium/high
  status            TEXT NOT NULL DEFAULT 'pending',  -- pending/in_progress/resolved/closed
  assigned_to       TEXT,
  resolution_note   TEXT,
  received_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  resolved_date     DATE,
  created_at        TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(school_id, complaint_number)
);

-- RLS
ALTER TABLE public.cheque_payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_leave_balances   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonafide_certificates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints             ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_cheques"   ON public.cheque_payments       USING (school_id = (SELECT school_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "school_lvbal"     ON public.staff_leave_balances  USING (school_id = (SELECT school_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "school_bonafide"  ON public.bonafide_certificates USING (school_id = (SELECT school_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "school_complaint" ON public.complaints            USING (school_id = (SELECT school_id FROM public.users WHERE id = auth.uid()));
