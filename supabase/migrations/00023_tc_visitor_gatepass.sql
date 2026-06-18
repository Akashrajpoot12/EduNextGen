-- Transfer Certificates
CREATE TABLE IF NOT EXISTS public.transfer_certificates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  tc_number       TEXT NOT NULL,
  issue_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  leaving_date    DATE,
  reason          TEXT,
  conduct         TEXT DEFAULT 'Good',
  last_class      TEXT,
  last_exam       TEXT,
  fee_cleared     BOOLEAN DEFAULT true,
  remarks         TEXT,
  issued_by       UUID REFERENCES public.users(id),
  created_at      TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(school_id, tc_number)
);

-- Visitor Log / Gate Register
CREATE TABLE IF NOT EXISTS public.visitor_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  visitor_name    TEXT NOT NULL,
  visitor_phone   TEXT,
  purpose         TEXT NOT NULL,
  whom_to_meet    TEXT,
  id_proof_type   TEXT,
  vehicle_number  TEXT,
  entry_time      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  exit_time       TIMESTAMPTZ,
  notes           TEXT,
  visit_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- Student Gate Passes
CREATE TABLE IF NOT EXISTS public.gate_passes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  pass_number     TEXT NOT NULL,
  pass_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  reason          TEXT NOT NULL,
  out_time        TEXT NOT NULL,
  expected_return TEXT,
  actual_return   TEXT,
  approved_by     TEXT,
  status          TEXT NOT NULL DEFAULT 'approved',
  created_at      TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(school_id, pass_number)
);

-- RLS
ALTER TABLE public.transfer_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gate_passes           ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_tc"      ON public.transfer_certificates USING (school_id = (SELECT school_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "school_visitor" ON public.visitor_logs          USING (school_id = (SELECT school_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "school_gatepass"ON public.gate_passes           USING (school_id = (SELECT school_id FROM public.users WHERE id = auth.uid()));
