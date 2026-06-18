-- ==============================================================================
-- MIGRATION 00013: High Priority SaaS Features
-- 1. Payment Failure Auto-Suspend (3 strikes)
-- 2. School Notes / CRM
-- 3. Quota Override tracking
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 1: Payment failure counter on schools
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS payment_failure_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_payment_failed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS quota_override_reason  TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 2: Auto-suspend + increment failure count on 3 failed payments
-- Replaces/extends the existing on_payment_failed trigger
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.on_payment_failed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_fail_count INTEGER;
BEGIN
  IF NEW.status = 'failed' AND (OLD.status IS NULL OR OLD.status != 'failed') THEN

    -- Increment failure count on the school
    UPDATE public.schools
    SET
      payment_failure_count  = COALESCE(payment_failure_count, 0) + 1,
      last_payment_failed_at = NOW()
    WHERE id = NEW.school_id
    RETURNING payment_failure_count INTO v_fail_count;

    -- Auto-suspend after 3 consecutive failures
    IF v_fail_count >= 3 THEN
      UPDATE public.schools
      SET
        is_active         = false,
        suspended_at      = NOW(),
        suspension_reason = 'Auto-suspended: 3 consecutive payment failures. Please update payment method.'
      WHERE id = NEW.school_id AND is_active = true;

      -- Alert for auto-suspend
      INSERT INTO public.super_admin_alerts (type, title, message, school_id, school_name, metadata)
      VALUES (
        'auto_suspended',
        '🔴 Auto-Suspended: ' || NEW.school_name,
        'School "' || NEW.school_name || '" has been automatically suspended after 3 consecutive payment failures.',
        NEW.school_id,
        NEW.school_name,
        jsonb_build_object('failure_count', v_fail_count, 'razorpay_order_id', NEW.razorpay_order_id)
      );
    END IF;

    -- Regular payment failed alert
    INSERT INTO public.super_admin_alerts (type, title, message, school_id, school_name, metadata)
    VALUES (
      'payment_failed',
      'Payment Failed: ' || NEW.school_name,
      'Payment of ₹' || NEW.amount || ' failed (attempt ' || COALESCE(v_fail_count, 1) || '/3). Reason: ' || COALESCE(NEW.failure_reason, 'Unknown'),
      NEW.school_id,
      NEW.school_name,
      jsonb_build_object(
        'razorpay_order_id', NEW.razorpay_order_id,
        'amount',            NEW.amount,
        'plan',              NEW.plan_name,
        'failure_count',     COALESCE(v_fail_count, 1)
      )
    );

  END IF;

  -- Reset failure count on successful payment
  IF NEW.status = 'captured' AND (OLD.status IS NULL OR OLD.status != 'captured') THEN
    UPDATE public.schools
    SET
      payment_failure_count  = 0,
      last_payment_failed_at = NULL
    WHERE id = NEW.school_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_payment_failed ON public.platform_payments;
CREATE TRIGGER on_payment_failed
  AFTER INSERT OR UPDATE ON public.platform_payments
  FOR EACH ROW EXECUTE FUNCTION public.on_payment_failed();

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 3: School Notes / CRM table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_notes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  note           TEXT NOT NULL,
  note_type      TEXT DEFAULT 'general',  -- 'general', 'payment', 'support', 'upgrade'
  created_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.school_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage school notes"
  ON public.school_notes FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE INDEX IF NOT EXISTS idx_school_notes_school_id ON public.school_notes (school_id);
CREATE INDEX IF NOT EXISTS idx_school_notes_created_at ON public.school_notes (created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 4: Bulk email log table (track what was sent)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bulk_email_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject        TEXT NOT NULL,
  body           TEXT NOT NULL,
  recipients     TEXT[] NOT NULL,          -- array of emails
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_by        UUID REFERENCES public.users(id) ON DELETE SET NULL,
  sent_by_name   TEXT,
  filter_applied TEXT,                     -- 'all', 'active', 'trialing', 'suspended'
  sent_at        TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.bulk_email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage bulk email logs"
  ON public.bulk_email_logs FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 5: Update schools_with_stats view to include new columns
-- Must DROP first because s.* now has additional columns from migration 00012
-- ─────────────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.schools_with_stats;
CREATE VIEW public.schools_with_stats AS
SELECT
  s.*,
  COALESCE(st.student_count, 0)  AS student_count,
  COALESCE(tr.teacher_count, 0)  AS teacher_count,
  COALESCE(cl.class_count, 0)    AS class_count,
  COALESCE(nt.note_count, 0)     AS note_count,
  lp.last_payment_at,
  lp.total_paid
FROM public.schools s
LEFT JOIN (
  SELECT school_id, COUNT(*) AS student_count
  FROM public.students GROUP BY school_id
) st ON st.school_id = s.id
LEFT JOIN (
  SELECT school_id, COUNT(*) AS teacher_count
  FROM public.user_roles WHERE role = 'teacher' GROUP BY school_id
) tr ON tr.school_id = s.id
LEFT JOIN (
  SELECT school_id, COUNT(*) AS class_count
  FROM public.classes GROUP BY school_id
) cl ON cl.school_id = s.id
LEFT JOIN (
  SELECT school_id, COUNT(*) AS note_count
  FROM public.school_notes GROUP BY school_id
) nt ON nt.school_id = s.id
LEFT JOIN (
  SELECT school_id, MAX(created_at) AS last_payment_at, SUM(amount) AS total_paid
  FROM public.platform_payments WHERE status = 'captured' GROUP BY school_id
) lp ON lp.school_id = s.id;

GRANT SELECT ON public.schools_with_stats TO authenticated;
