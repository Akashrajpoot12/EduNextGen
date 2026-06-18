-- ==============================================================================
-- MIGRATION 00014: Advanced Platform Features
-- 1. Support Ticket System
-- 2. Platform Announcements (in-app banners)
-- 3. School Archive / Soft Delete
-- 4. White-label Settings per school
-- 5. API Key Management
-- 6. Onboarding Progress view
-- 7. Churn Risk computed columns
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Support Ticket System
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number   SERIAL,
  school_id       UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  school_name     TEXT,
  submitted_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  submitter_email TEXT NOT NULL,
  submitter_name  TEXT,
  category        TEXT NOT NULL DEFAULT 'general',  -- 'billing','technical','feature','general','urgent'
  subject         TEXT NOT NULL,
  description     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open',     -- 'open','in_progress','resolved','closed'
  priority        TEXT NOT NULL DEFAULT 'medium',   -- 'low','medium','high','urgent'
  assigned_to     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_name   TEXT,
  resolution      TEXT,
  resolved_at     TIMESTAMP WITH TIME ZONE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage tickets"
  ON public.support_tickets FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "School members can create tickets"
  ON public.support_tickets FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "School members can view their tickets"
  ON public.support_tickets FOR SELECT
  USING (auth.uid() = submitted_by OR is_super_admin());

-- Ticket replies
CREATE TABLE IF NOT EXISTS public.ticket_replies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  author_name TEXT,
  author_role TEXT DEFAULT 'user',  -- 'user', 'super_admin'
  message     TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,  -- internal notes not visible to school
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.ticket_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage replies"
  ON public.ticket_replies FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Users view non-internal replies on their tickets"
  ON public.ticket_replies FOR SELECT
  USING (
    (is_internal = false AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.submitted_by = auth.uid()
    ))
    OR is_super_admin()
  );

CREATE INDEX IF NOT EXISTS idx_support_tickets_status   ON public.support_tickets (status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_school   ON public.support_tickets (school_id);
CREATE INDEX IF NOT EXISTS idx_ticket_replies_ticket_id ON public.ticket_replies (ticket_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Platform Announcements (in-app banners for school portals)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_announcements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  message       TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'info',  -- 'info','warning','success','urgent'
  target        TEXT NOT NULL DEFAULT 'all',   -- 'all','trialing','paid','specific'
  target_school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  is_active     BOOLEAN DEFAULT true,
  starts_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  ends_at       TIMESTAMP WITH TIME ZONE,
  created_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage announcements"
  ON public.platform_announcements FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "All authenticated users can view active announcements"
  ON public.platform_announcements FOR SELECT
  USING (
    is_active = true
    AND (ends_at IS NULL OR ends_at > NOW())
    AND starts_at <= NOW()
    AND auth.uid() IS NOT NULL
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. School Archive (soft delete)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS is_archived        BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at        TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS archive_reason     TEXT,
  ADD COLUMN IF NOT EXISTS last_admin_login_at TIMESTAMP WITH TIME ZONE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. White-label Settings per school
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_branding (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID UNIQUE NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  platform_name   TEXT DEFAULT 'EduNextGen',
  logo_url        TEXT,
  favicon_url     TEXT,
  primary_color   TEXT DEFAULT '#10b981',    -- emerald-500
  secondary_color TEXT DEFAULT '#0f172a',    -- slate-900
  accent_color    TEXT DEFAULT '#3b82f6',    -- blue-500
  custom_domain   TEXT,
  footer_text     TEXT,
  support_email   TEXT,
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.school_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage branding"
  ON public.school_branding FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "School members view their own branding"
  ON public.school_branding FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()
    )
    OR is_super_admin()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. API Key Management
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,                        -- 'Production Key', 'Integration Key'
  key_prefix   TEXT NOT NULL,                        -- 'enk_live_' prefix shown in UI
  key_hash     TEXT NOT NULL,                        -- bcrypt/sha256 hash of actual key
  key_preview  TEXT NOT NULL,                        -- first 8 + last 4 chars for display
  scopes       TEXT[] DEFAULT ARRAY['read'],         -- ['read','write','webhooks']
  is_active    BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at   TIMESTAMP WITH TIME ZONE,
  created_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  revoked_at   TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.school_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage all api keys"
  ON public.school_api_keys FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "School admins manage their own keys"
  ON public.school_api_keys FOR ALL
  USING (
    school_id IN (
      SELECT school_id FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('school_admin','admin')
    )
  )
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('school_admin','admin')
    )
  );

CREATE INDEX IF NOT EXISTS idx_api_keys_school_id ON public.school_api_keys (school_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. School Onboarding Progress view
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.school_onboarding_progress AS
SELECT
  s.id,
  s.name,
  s.subdomain,
  s.admin_email,
  s.admin_name,
  s.created_at,
  s.subscription_status,
  s.is_active,
  s.setup_completed,
  COALESCE(st.student_count, 0)   AS student_count,
  COALESCE(tr.teacher_count, 0)   AS teacher_count,
  COALESCE(cl.class_count, 0)     AS class_count,
  COALESCE(ex.exam_count, 0)      AS exam_count,
  -- Onboarding score: 0-100
  (
    CASE WHEN s.setup_completed THEN 20 ELSE 0 END +
    CASE WHEN COALESCE(st.student_count, 0) > 0 THEN 20 ELSE 0 END +
    CASE WHEN COALESCE(tr.teacher_count, 0) > 0 THEN 20 ELSE 0 END +
    CASE WHEN COALESCE(cl.class_count, 0)  > 0 THEN 20 ELSE 0 END +
    CASE WHEN COALESCE(ex.exam_count, 0)   > 0 THEN 20 ELSE 0 END
  )::INTEGER AS onboarding_score
FROM public.schools s
LEFT JOIN (SELECT school_id, COUNT(*) AS student_count FROM public.students GROUP BY school_id) st ON st.school_id = s.id
LEFT JOIN (SELECT school_id, COUNT(*) AS teacher_count FROM public.user_roles WHERE role='teacher' GROUP BY school_id) tr ON tr.school_id = s.id
LEFT JOIN (SELECT school_id, COUNT(*) AS class_count FROM public.classes GROUP BY school_id) cl ON cl.school_id = s.id
LEFT JOIN (SELECT school_id, COUNT(*) AS exam_count FROM public.exams GROUP BY school_id) ex ON ex.school_id = s.id
WHERE s.is_archived IS NOT true;

GRANT SELECT ON public.school_onboarding_progress TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Churn Risk — function to compute risk score per school
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.compute_churn_risk(school_row public.schools)
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  risk_score INTEGER := 0;
BEGIN
  -- Payment failures
  IF COALESCE(school_row.payment_failure_count, 0) >= 2 THEN risk_score := risk_score + 40;
  ELSIF COALESCE(school_row.payment_failure_count, 0) = 1 THEN risk_score := risk_score + 15;
  END IF;

  -- Suspended
  IF school_row.is_active = false THEN risk_score := risk_score + 50; END IF;

  -- Trial expiring soon (within 7 days)
  IF school_row.subscription_status = 'trialing'
    AND school_row.subscription_renewal_date IS NOT NULL
    AND school_row.subscription_renewal_date <= CURRENT_DATE + INTERVAL '7 days' THEN
    risk_score := risk_score + 30;
  END IF;

  -- No activity (no admin login tracked)
  IF school_row.last_admin_login_at IS NULL OR
     school_row.last_admin_login_at < NOW() - INTERVAL '30 days' THEN
    risk_score := risk_score + 20;
  END IF;

  IF risk_score >= 60 THEN RETURN 'high';
  ELSIF risk_score >= 30 THEN RETURN 'medium';
  ELSE RETURN 'low';
  END IF;
END;
$$;
