-- ==============================================================================
-- SUPER ADMIN ENHANCEMENTS
-- ==============================================================================

-- 1. Add is_active flag to schools (for suspend/activate)
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- 2. Add contact info to schools
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS admin_email TEXT,
  ADD COLUMN IF NOT EXISTS admin_name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT;

-- 3. Super Admin Activity Log table
CREATE TABLE IF NOT EXISTS public.super_admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  performed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL, -- 'school', 'registration_request', 'super_admin'
  target_id UUID,
  target_name TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. RLS for super_admin_logs (only super admins can read/write)
ALTER TABLE public.super_admin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage logs"
  ON public.super_admin_logs
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- 5. RLS policy: Block suspended school access
-- When school is inactive, school_admin cannot login
CREATE OR REPLACE FUNCTION public.is_school_active(p_school_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(is_active, true) FROM public.schools WHERE id = p_school_id;
$$;

-- 6. Update registration_requests to store more info (copy to schools on approve)
ALTER TABLE public.registration_requests
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 7. Fix: When a registration request is approved, copy admin info to schools table
CREATE OR REPLACE FUNCTION public.on_registration_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    -- Insert school if not exists
    INSERT INTO public.schools (name, subdomain, admin_email, admin_name, is_active)
    VALUES (NEW.school_name, NEW.subdomain, NEW.admin_email, NEW.admin_name, true)
    ON CONFLICT (subdomain) DO UPDATE
      SET admin_email = EXCLUDED.admin_email,
          admin_name  = EXCLUDED.admin_name,
          is_active   = true;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS on_registration_approved ON public.registration_requests;
CREATE TRIGGER on_registration_approved
  AFTER UPDATE ON public.registration_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.on_registration_approved();

-- Also fire on INSERT with status=approved (for direct provision)
CREATE OR REPLACE FUNCTION public.on_registration_insert_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'approved' THEN
    INSERT INTO public.schools (name, subdomain, admin_email, admin_name, is_active)
    VALUES (NEW.school_name, NEW.subdomain, NEW.admin_email, NEW.admin_name, true)
    ON CONFLICT (subdomain) DO UPDATE
      SET admin_email = EXCLUDED.admin_email,
          admin_name  = EXCLUDED.admin_name,
          is_active   = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_registration_insert_approved ON public.registration_requests;
CREATE TRIGGER on_registration_insert_approved
  AFTER INSERT ON public.registration_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.on_registration_insert_approved();

-- 8. RLS: Allow super admins to update schools (suspend/activate)
DROP POLICY IF EXISTS "Super Admins can update schools" ON public.schools;
CREATE POLICY "Super Admins can update schools"
  ON public.schools
  FOR UPDATE
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "Super Admins can insert schools" ON public.schools;
CREATE POLICY "Super Admins can insert schools"
  ON public.schools
  FOR INSERT
  WITH CHECK (is_super_admin());
