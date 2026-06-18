-- ==============================================================================
-- MIGRATION 00010: Fix RLS Gaps + Create Missing Tables
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 1: fee_payments table (referenced in razorpay edge function but missing)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fee_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id      UUID REFERENCES public.students(id) ON DELETE CASCADE,
  fee_id          UUID,                           -- optional ref to fees table
  razorpay_order_id     TEXT,
  razorpay_payment_id   TEXT,
  amount          NUMERIC(10,2) NOT NULL,
  currency        TEXT DEFAULT 'INR',
  status          TEXT DEFAULT 'pending'
                    CHECK (status IN ('pending', 'paid', 'overdue', 'waived')),
  due_date        DATE,
  payment_date    TIMESTAMP WITH TIME ZONE,
  description     TEXT,
  notes           TEXT,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;

-- School admins and staff can manage fee_payments in their school
CREATE POLICY "Admins manage fee_payments"
  ON public.fee_payments FOR ALL
  USING (
    school_id IN (
      SELECT school_id FROM public.user_roles
      WHERE user_id = (SELECT id FROM public.users WHERE email = (auth.jwt()->>'email'))
      AND role IN ('school_admin', 'staff')
    )
  )
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM public.user_roles
      WHERE user_id = (SELECT id FROM public.users WHERE email = (auth.jwt()->>'email'))
      AND role IN ('school_admin', 'staff')
    )
  );

-- Parents can view their own children's fee payments
CREATE POLICY "Parents view own fee_payments"
  ON public.fee_payments FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM public.students
      WHERE parent_id = (SELECT id FROM public.users WHERE email = (auth.jwt()->>'email'))
    )
  );

-- Super admins can see all fee_payments
CREATE POLICY "Super admins view all fee_payments"
  ON public.fee_payments FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 2: registration_requests RLS
-- Allow super admin to INSERT with status='approved' (for direct provisioning)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can submit registration requests" ON public.registration_requests;

CREATE POLICY "Anyone can submit pending registration requests"
  ON public.registration_requests FOR INSERT
  WITH CHECK (
    status = 'pending'
    OR is_super_admin()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 3: users table — super admin SELECT and INSERT
-- ─────────────────────────────────────────────────────────────────────────────

-- Super admin can view ALL users (not just their school)
DROP POLICY IF EXISTS "Super admins can view all users" ON public.users;
CREATE POLICY "Super admins can view all users"
  ON public.users FOR SELECT
  USING (is_super_admin());

-- Super admin can insert new users (for creating new super admins)
DROP POLICY IF EXISTS "Super admins can insert users" ON public.users;
CREATE POLICY "Super admins can insert users"
  ON public.users FOR INSERT
  WITH CHECK (is_super_admin());

-- Super admin can update any user
DROP POLICY IF EXISTS "Super admins can update users" ON public.users;
CREATE POLICY "Super admins can update users"
  ON public.users FOR UPDATE
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 4: user_roles — super admin must be able to INSERT without school_id
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Super Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Super Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 5: Allow anyone to self-register in public.users (for school admin signup)
-- (needed so school admins can sign up after approval)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can insert their own record" ON public.users;
CREATE POLICY "Users can insert their own record"
  ON public.users FOR INSERT
  WITH CHECK (
    id = (SELECT id FROM public.users WHERE email = (auth.jwt()->>'email') LIMIT 1)
    OR is_super_admin()
    OR NOT EXISTS (SELECT 1 FROM public.users WHERE email = (auth.jwt()->>'email'))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 6: fees table — referenced in fee_payments but may not exist
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fees (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id      UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,          -- e.g. "Tuition Fee Q1"
  amount        NUMERIC(10,2) NOT NULL,
  frequency     TEXT DEFAULT 'monthly'
                  CHECK (frequency IN ('monthly', 'quarterly', 'yearly', 'one_time')),
  due_date      DATE,
  academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage fees"
  ON public.fees FOR ALL
  USING (
    school_id IN (
      SELECT school_id FROM public.user_roles
      WHERE user_id = (SELECT id FROM public.users WHERE email = (auth.jwt()->>'email'))
      AND role IN ('school_admin', 'staff')
    )
  )
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM public.user_roles
      WHERE user_id = (SELECT id FROM public.users WHERE email = (auth.jwt()->>'email'))
      AND role IN ('school_admin', 'staff')
    )
  );

CREATE POLICY "All school members can view fees"
  ON public.fees FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM public.user_roles
      WHERE user_id = (SELECT id FROM public.users WHERE email = (auth.jwt()->>'email'))
    )
  );

CREATE POLICY "Super admins view all fees"
  ON public.fees FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 7: Add fee_id FK to fee_payments now that fees table exists
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.fee_payments
  ADD CONSTRAINT fee_payments_fee_id_fk
  FOREIGN KEY (fee_id) REFERENCES public.fees(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 8: Auto-update updated_at on fee_payments
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_fee_payments_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fee_payments_updated_at ON public.fee_payments;
CREATE TRIGGER fee_payments_updated_at
  BEFORE UPDATE ON public.fee_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_fee_payments_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 9: monthly_revenue and school_revenue_summary views need super admin access
-- Views inherit RLS from underlying tables — but add explicit grant just in case
-- ─────────────────────────────────────────────────────────────────────────────
GRANT SELECT ON public.monthly_revenue TO authenticated;
GRANT SELECT ON public.school_revenue_summary TO authenticated;
