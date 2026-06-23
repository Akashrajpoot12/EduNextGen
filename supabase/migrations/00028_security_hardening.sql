-- ==============================================================================
-- MIGRATION 00028: SECURITY HARDENING
-- ------------------------------------------------------------------------------
-- Fixes three classes of RLS weakness found in an audit:
--   1. Over-permissive `WITH CHECK (true)` INSERT policies (users, admissions)
--   2. Email-based identity lookups in RLS (spoofable / indirect) replaced with
--      auth.uid(), which Postgres derives from the validated JWT.
-- All policies remain functionally equivalent for legitimate users; they just
-- stop trusting client-supplied data for authorization.
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 1: public.users — remove `WITH CHECK (true)` INSERT policy
-- The old policy let ANY authenticated user insert arbitrary rows into users.
-- Privileged inserts already happen via service-role Edge Functions (which
-- bypass RLS), so client-side inserts only need to cover self-signup.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can insert users in their school" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own record" ON public.users;

-- A user may insert only their own row, matching their authenticated identity.
CREATE POLICY "Users can insert their own record" ON public.users
  FOR INSERT WITH CHECK (id = auth.uid());

-- School admins may insert user rows scoped to a school they administer.
CREATE POLICY "Admins can insert users in their school" ON public.users
  FOR INSERT WITH CHECK (
    school_id IN (
      SELECT school_id FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'school_admin'
    )
  );
-- (Super admins already covered by "Super admins can insert users" from 00010.)

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 2: public.admission_applications — bound the public INSERT
-- Public admission form is intentionally open, but the old `WITH CHECK (true)`
-- allowed inserting into ANY (even non-existent) school with any status.
-- Now: only status='pending' applications, only for real, active schools.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can apply" ON public.admission_applications;
CREATE POLICY "Anyone can apply" ON public.admission_applications
  FOR INSERT WITH CHECK (
    status = 'pending'
    AND school_id IN (SELECT id FROM public.schools WHERE is_active = true)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 3: public.fee_payments — replace email lookups with auth.uid()
-- public.users.id == auth.uid(), so the email round-trip was unnecessary and
-- relied on the (client-influenced) email JWT claim.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins manage fee_payments" ON public.fee_payments;
CREATE POLICY "Admins manage fee_payments"
  ON public.fee_payments FOR ALL
  USING (
    school_id IN (
      SELECT school_id FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('school_admin', 'staff')
    )
  )
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('school_admin', 'staff')
    )
  );

DROP POLICY IF EXISTS "Parents view own fee_payments" ON public.fee_payments;
CREATE POLICY "Parents view own fee_payments"
  ON public.fee_payments FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM public.students WHERE parent_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 4: public.fees — same email-lookup → auth.uid() change
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins manage fees" ON public.fees;
CREATE POLICY "Admins manage fees"
  ON public.fees FOR ALL
  USING (
    school_id IN (
      SELECT school_id FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('school_admin', 'staff')
    )
  )
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('school_admin', 'staff')
    )
  );

DROP POLICY IF EXISTS "All school members can view fees" ON public.fees;
CREATE POLICY "All school members can view fees"
  ON public.fees FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  );
