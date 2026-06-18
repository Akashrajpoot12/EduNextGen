-- Migration 00021: School Expenses Ledger

CREATE TABLE IF NOT EXISTS public.school_expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  category     TEXT NOT NULL DEFAULT 'other', -- salary/utilities/maintenance/supplies/other
  description  TEXT NOT NULL,
  amount       NUMERIC(12,2) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  paid_to      TEXT,
  reference    TEXT,
  recorded_by  UUID REFERENCES public.users(id),
  created_at   TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.school_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School access expenses" ON public.school_expenses
  FOR ALL
  USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin())
  WITH CHECK (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()) OR is_super_admin());

CREATE INDEX IF NOT EXISTS idx_expenses_school ON public.school_expenses(school_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date   ON public.school_expenses(expense_date);
