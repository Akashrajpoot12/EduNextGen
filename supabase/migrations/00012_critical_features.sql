-- ==============================================================================
-- MIGRATION 00012: Critical Features
-- 1. Trial Expiry Auto-Suspend
-- 2. Student Quota Enforcement
-- 3. School Admin setup tracking
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 1: Trial Expiry — function to suspend expired trials
-- Called by edge function cron job daily
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.suspend_expired_trials()
RETURNS TABLE(suspended_school_id UUID, suspended_school_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.schools
  SET
    is_active          = false,
    suspended_at       = NOW(),
    suspension_reason  = 'Trial period expired (30 days). Please upgrade your subscription.'
  WHERE
    is_active                = true
    AND (subscription_status = 'trialing' OR subscription_status IS NULL)
    AND subscription_renewal_date < CURRENT_DATE
  RETURNING id, name;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 2: Student Quota Enforcement — trigger on students INSERT
-- Blocks insert if school has exceeded student_quota
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_student_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quota       INTEGER;
  v_count       INTEGER;
  v_is_active   BOOLEAN;
  v_sub_status  TEXT;
BEGIN
  -- Get school quota and status
  SELECT student_quota, is_active, subscription_status
  INTO v_quota, v_is_active, v_sub_status
  FROM public.schools
  WHERE id = NEW.school_id;

  -- Block if school is suspended
  IF v_is_active = false THEN
    RAISE EXCEPTION 'School account is suspended. Contact your administrator.';
  END IF;

  -- Count current students
  SELECT COUNT(*) INTO v_count
  FROM public.students
  WHERE school_id = NEW.school_id;

  -- Block if quota exceeded
  IF v_count >= COALESCE(v_quota, 50) THEN
    RAISE EXCEPTION 'Student quota exceeded (% / %). Please upgrade your subscription plan to add more students.',
      v_count, COALESCE(v_quota, 50);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_student_quota ON public.students;
CREATE TRIGGER enforce_student_quota
  BEFORE INSERT ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.enforce_student_quota();

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 3: Track school admin setup status
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS setup_completed    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS setup_completed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS invite_token       TEXT,
  ADD COLUMN IF NOT EXISTS invite_expires_at  TIMESTAMP WITH TIME ZONE;

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 4: Generate invite token when school is approved
-- School admin uses this token to set their password
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_school_invite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- When a school is created (approved), generate a 24-hour invite token
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.is_active = true AND OLD.is_active = false) THEN
    UPDATE public.schools
    SET
      invite_token      = encode(gen_random_bytes(32), 'hex'),
      invite_expires_at = NOW() + INTERVAL '7 days'
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS generate_school_invite ON public.schools;
CREATE TRIGGER generate_school_invite
  AFTER INSERT OR UPDATE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.generate_school_invite();

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 5: Alert when trial is about to expire (7 days before)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.alert_trial_expiring()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, name, admin_email, subscription_renewal_date
    FROM public.schools
    WHERE is_active = true
      AND (subscription_status = 'trialing' OR subscription_status IS NULL)
      AND subscription_renewal_date = CURRENT_DATE + INTERVAL '7 days'
  LOOP
    INSERT INTO public.super_admin_alerts (type, title, message, school_id, school_name, metadata)
    VALUES (
      'trial_expiring',
      'Trial Expiring Soon: ' || r.name,
      'School "' || r.name || '" trial expires on ' || r.subscription_renewal_date || '. Admin: ' || COALESCE(r.admin_email, 'unknown'),
      r.id,
      r.name,
      jsonb_build_object('admin_email', r.admin_email, 'expires', r.subscription_renewal_date)
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 6: RLS — allow anyone to read schools by invite_token
-- (for first-time setup page — unauthenticated user sets password)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "Anyone can verify invite token"
  ON public.schools FOR SELECT
  USING (invite_token IS NOT NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 7: Password reset log table
-- Track which admin requested reset and when
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.password_reset_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  admin_email   TEXT NOT NULL,
  triggered_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reset_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes         TEXT
);

ALTER TABLE public.password_reset_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage reset logs"
  ON public.password_reset_logs FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
