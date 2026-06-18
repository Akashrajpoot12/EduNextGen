-- ==============================================================================
-- PLATFORM PAYMENT TRACKING — Full Revenue Intelligence
-- ==============================================================================

-- 1. Platform Payments Table (Every subscription payment recorded here)
CREATE TABLE IF NOT EXISTS public.platform_payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  school_name         TEXT NOT NULL,
  school_subdomain    TEXT NOT NULL,
  admin_email         TEXT,

  -- Razorpay data
  razorpay_order_id   TEXT UNIQUE,
  razorpay_payment_id TEXT UNIQUE,

  -- Payment details
  amount              NUMERIC(10,2) NOT NULL,        -- in INR
  currency            TEXT DEFAULT 'INR',
  plan_name           TEXT,                           -- 'Essential', 'Premium', etc.
  payment_type        TEXT DEFAULT 'subscription'     -- 'subscription', 'addon', 'fee'
                        CHECK (payment_type IN ('subscription', 'addon', 'fee')),
  status              TEXT DEFAULT 'pending'
                        CHECK (status IN ('pending', 'captured', 'failed', 'refunded')),

  -- Subscription period
  billing_month       INTEGER,                        -- 1-12
  billing_year        INTEGER,
  next_renewal_date   DATE,

  -- Metadata
  notes               JSONB,
  failure_reason      TEXT,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. RLS — only super admins can access platform_payments
ALTER TABLE public.platform_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins full access to platform_payments"
  ON public.platform_payments FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- 3. School admins can see their own payment history
CREATE POLICY "School admins can view own payments"
  ON public.platform_payments FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM public.user_roles
      WHERE user_id = (SELECT id FROM public.users WHERE email = auth.jwt()->>'email')
      AND role = 'school_admin'
    )
  );

-- 4. Revenue summary view (month-wise aggregation)
CREATE OR REPLACE VIEW public.monthly_revenue AS
SELECT
  billing_year,
  billing_month,
  COUNT(*)                    AS total_payments,
  SUM(amount)                 AS total_revenue,
  COUNT(CASE WHEN status = 'captured' THEN 1 END)  AS successful_payments,
  COUNT(CASE WHEN status = 'failed'   THEN 1 END)  AS failed_payments,
  SUM(CASE WHEN status = 'captured' THEN amount ELSE 0 END) AS collected_revenue
FROM public.platform_payments
GROUP BY billing_year, billing_month
ORDER BY billing_year DESC, billing_month DESC;

-- 5. Per-school revenue summary view
CREATE OR REPLACE VIEW public.school_revenue_summary AS
SELECT
  school_id,
  school_name,
  school_subdomain,
  admin_email,
  plan_name,
  COUNT(*)                    AS total_invoices,
  SUM(CASE WHEN status = 'captured' THEN amount ELSE 0 END) AS total_paid,
  MAX(created_at)             AS last_payment_at,
  MAX(next_renewal_date)      AS next_renewal_date,
  bool_or(status = 'failed')  AS has_failed_payment
FROM public.platform_payments
GROUP BY school_id, school_name, school_subdomain, admin_email, plan_name;

-- 6. Auto-update updated_at on platform_payments
CREATE OR REPLACE FUNCTION public.update_platform_payments_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS platform_payments_updated_at ON public.platform_payments;
CREATE TRIGGER platform_payments_updated_at
  BEFORE UPDATE ON public.platform_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_platform_payments_updated_at();

-- 7. Add renewal_date to schools table
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS subscription_renewal_date DATE,
  ADD COLUMN IF NOT EXISTS subscription_plan         TEXT DEFAULT 'trialing';
