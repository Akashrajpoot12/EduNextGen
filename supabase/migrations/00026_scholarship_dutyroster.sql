-- Scholarship Register
CREATE TABLE IF NOT EXISTS public.scholarships (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  scholarship_name TEXT NOT NULL,
  provider         TEXT NOT NULL,           -- Govt / Private / NGO / Trust
  provider_type    TEXT NOT NULL DEFAULT 'government',
  amount           NUMERIC(12,2) NOT NULL,
  frequency        TEXT NOT NULL DEFAULT 'annual', -- annual/monthly/one-time
  academic_year    TEXT NOT NULL DEFAULT '2025-26',
  start_date       DATE,
  end_date         DATE,
  account_number   TEXT,
  ifsc_code        TEXT,
  bank_name        TEXT,
  status           TEXT NOT NULL DEFAULT 'active', -- active/expired/pending
  documents        TEXT,
  remarks          TEXT,
  created_at       TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- Duty Roster
CREATE TABLE IF NOT EXISTS public.duty_roster (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  staff_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  duty_date        DATE NOT NULL,
  duty_type        TEXT NOT NULL,  -- gate/exam_invigilation/lab/sports/canteen/assembly/other
  shift            TEXT NOT NULL DEFAULT 'morning', -- morning/afternoon/full_day
  location         TEXT,
  remarks          TEXT,
  created_at       TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- RLS
ALTER TABLE public.scholarships  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duty_roster    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_scholarships" ON public.scholarships
  USING (school_id = (SELECT school_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "school_duty_roster"  ON public.duty_roster
  USING (school_id = (SELECT school_id FROM public.users WHERE id = auth.uid()));
