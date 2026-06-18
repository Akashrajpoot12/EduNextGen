-- ==============================================================================
-- MIGRATION 00011: Super Admin Final Fixes + Plan Config
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 1: Backfill subscription_renewal_date for existing schools
-- Set renewal = created_at + 30 days for trialing schools
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.schools
SET subscription_renewal_date = (created_at + INTERVAL '30 days')::DATE
WHERE subscription_renewal_date IS NULL
  AND subscription_status IN ('trialing', 'active', 'past_due');

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 2: Subscription Plans config table
-- Allows super admin to change pricing from DB without code deploy
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT UNIQUE NOT NULL,          -- 'Trial', 'Essential', 'Premium'
  slug            TEXT UNIQUE NOT NULL,          -- 'trialing', 'essential', 'premium'
  price_monthly   NUMERIC(10,2) NOT NULL DEFAULT 0,
  student_quota   INTEGER NOT NULL DEFAULT 50,
  features        JSONB DEFAULT '[]',
  is_active       BOOLEAN DEFAULT true,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Super admin can manage plans
CREATE POLICY "Super admins manage plans"
  ON public.subscription_plans FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Anyone authenticated can view active plans (for school subscription page)
CREATE POLICY "All authenticated can view plans"
  ON public.subscription_plans FOR SELECT
  USING (is_active = true AND auth.uid() IS NOT NULL);

-- Seed default plans
INSERT INTO public.subscription_plans (name, slug, price_monthly, student_quota, features, sort_order)
VALUES
  ('Trial',     'trialing',  0,    50,    '["50 Students","Basic Attendance","Basic Homework"]', 0),
  ('Essential', 'essential', 999,  500,   '["500 Students","All Core Modules","Fee Management","Reports","Email Support"]', 1),
  ('Premium',   'premium',   4999, 10000, '["10,000 Students","All Modules","Face AI Biometric","Priority Support","Custom Branding","API Access"]', 2)
ON CONFLICT (slug) DO UPDATE
  SET price_monthly = EXCLUDED.price_monthly,
      student_quota = EXCLUDED.student_quota,
      features      = EXCLUDED.features;

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 3: Platform payments - ensure school_id stays populated
-- Add school_subdomain index for fast filtering
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_platform_payments_subdomain
  ON public.platform_payments (school_subdomain);

CREATE INDEX IF NOT EXISTS idx_platform_payments_status
  ON public.platform_payments (status);

CREATE INDEX IF NOT EXISTS idx_platform_payments_billing
  ON public.platform_payments (billing_year, billing_month);

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 4: Schools table - add student_count as computed view helper
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.schools_with_stats AS
SELECT
  s.*,
  COALESCE(st.student_count, 0)  AS student_count,
  COALESCE(tr.teacher_count, 0)  AS teacher_count,
  COALESCE(cl.class_count, 0)    AS class_count,
  lp.last_payment_at,
  lp.total_paid
FROM public.schools s
LEFT JOIN (
  SELECT school_id, COUNT(*) AS student_count
  FROM public.students
  GROUP BY school_id
) st ON st.school_id = s.id
LEFT JOIN (
  SELECT school_id, COUNT(*) AS teacher_count
  FROM public.user_roles
  WHERE role = 'teacher'
  GROUP BY school_id
) tr ON tr.school_id = s.id
LEFT JOIN (
  SELECT school_id, COUNT(*) AS class_count
  FROM public.classes
  GROUP BY school_id
) cl ON cl.school_id = s.id
LEFT JOIN (
  SELECT
    school_id,
    MAX(created_at) AS last_payment_at,
    SUM(amount)     AS total_paid
  FROM public.platform_payments
  WHERE status = 'captured'
  GROUP BY school_id
) lp ON lp.school_id = s.id;

GRANT SELECT ON public.schools_with_stats TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 5: Notification / alert preferences for super admins
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.super_admin_alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL,    -- 'payment_failed', 'new_request', 'school_quota_exceeded'
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  school_id   UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  school_name TEXT,
  is_read     BOOLEAN DEFAULT false,
  metadata    JSONB,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.super_admin_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage alerts"
  ON public.super_admin_alerts FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 6: Real MRR view — from actual captured payments this month
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.current_mrr AS
SELECT
  COALESCE(SUM(amount), 0)  AS mrr,
  COUNT(*)                  AS paying_schools
FROM public.platform_payments
WHERE status       = 'captured'
  AND billing_year  = EXTRACT(YEAR  FROM CURRENT_DATE)
  AND billing_month = EXTRACT(MONTH FROM CURRENT_DATE);

GRANT SELECT ON public.current_mrr TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 7: Trigger to auto-create alert when payment fails
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.on_payment_failed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'failed' AND (OLD.status IS NULL OR OLD.status != 'failed') THEN
    INSERT INTO public.super_admin_alerts (type, title, message, school_id, school_name, metadata)
    VALUES (
      'payment_failed',
      'Payment Failed: ' || NEW.school_name,
      'A payment of ₹' || NEW.amount || ' for plan "' || COALESCE(NEW.plan_name, 'Unknown') || '" failed. Reason: ' || COALESCE(NEW.failure_reason, 'Unknown'),
      NEW.school_id,
      NEW.school_name,
      jsonb_build_object('razorpay_order_id', NEW.razorpay_order_id, 'amount', NEW.amount, 'plan', NEW.plan_name)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_payment_failed ON public.platform_payments;
CREATE TRIGGER on_payment_failed
  AFTER INSERT OR UPDATE ON public.platform_payments
  FOR EACH ROW EXECUTE FUNCTION public.on_payment_failed();

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 8: Trigger to alert when new registration request comes in
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.on_new_registration_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    INSERT INTO public.super_admin_alerts (type, title, message, school_name, metadata)
    VALUES (
      'new_request',
      'New School Request: ' || NEW.school_name,
      NEW.admin_name || ' (' || NEW.admin_email || ') wants to onboard "' || NEW.school_name || '" with subdomain "' || NEW.subdomain || '".',
      NEW.school_name,
      jsonb_build_object('request_id', NEW.id, 'subdomain', NEW.subdomain, 'admin_email', NEW.admin_email)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_registration_request ON public.registration_requests;
CREATE TRIGGER on_new_registration_request
  AFTER INSERT ON public.registration_requests
  FOR EACH ROW EXECUTE FUNCTION public.on_new_registration_request();
