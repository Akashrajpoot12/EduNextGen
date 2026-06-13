-- ==============================================================================
-- MULTI-TENANT SCHOOL SaaS - PHASE 1: DATABASE SCHEMA & AUTOMATION
-- ==============================================================================

-- 1. Enable pgvector extension for AI biometric matching
CREATE EXTENSION IF NOT EXISTS vector;

-- ==========================================
-- CORE TABLES
-- ==========================================

-- 1. Registration Requests (Self-Serve Onboarding Pipeline)
CREATE TABLE public.registration_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_name TEXT NOT NULL,
    subdomain TEXT UNIQUE NOT NULL,
    admin_name TEXT NOT NULL,
    admin_email TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Schools (The Tenant Table)
CREATE TABLE public.schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subdomain TEXT UNIQUE NOT NULL,
    invoice_prefix TEXT,
    tax_config JSONB, -- Stores custom GST/VAT configs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Users (Global Users, typically extends auth.users in Supabase)
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    face_vector vector(128), -- AI face embedding for biometric matching
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. User Roles (Resolves the Parent-Teacher Multi-Role Overlap)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'school_admin', 'teacher', 'parent', 'staff')),
    UNIQUE(user_id, school_id, role)
);

-- 5. Academic Years
CREATE TABLE public.academic_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g., "2026-2027"
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Classes
CREATE TABLE public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE,
    grade_level TEXT NOT NULL, -- e.g., "10th Grade"
    section TEXT NOT NULL, -- e.g., "A"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Students
CREATE TABLE public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    parent_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    enrollment_number TEXT,
    face_vector vector(128), -- AI face embedding for biometric attendance
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Daily Attendance
CREATE TABLE public.daily_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'half_day')),
    recorded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(student_id, date)
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) FOR MULTI-TENANCY
-- ==========================================

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_attendance ENABLE ROW LEVEL SECURITY;

-- Helper function to fetch the user's active schools based on their role mappings
CREATE OR REPLACE FUNCTION auth.get_user_school_ids()
RETURNS SETOF UUID AS $$
    SELECT school_id FROM public.user_roles WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Read Policies ensuring absolute tenant data isolation
CREATE POLICY "Users can view their own school" ON public.schools FOR SELECT USING (id IN (SELECT auth.get_user_school_ids()));
CREATE POLICY "Users view academic years of their school" ON public.academic_years FOR SELECT USING (school_id IN (SELECT auth.get_user_school_ids()));
CREATE POLICY "Users view classes of their school" ON public.classes FOR SELECT USING (school_id IN (SELECT auth.get_user_school_ids()));
CREATE POLICY "Users view students of their school" ON public.students FOR SELECT USING (school_id IN (SELECT auth.get_user_school_ids()));
CREATE POLICY "Users view attendance of their school" ON public.daily_attendance FOR SELECT USING (school_id IN (SELECT auth.get_user_school_ids()));


-- ==========================================
-- AUTOMATION: SELF-SERVE ONBOARDING TRIGGER
-- ==========================================

-- Trigger function to automatically provision a school upon approval
CREATE OR REPLACE FUNCTION handle_registration_approval()
RETURNS TRIGGER AS $$
DECLARE
    new_school_id UUID;
    new_user_id UUID;
BEGIN
    -- Only trigger when a pending request is explicitly approved
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        
        -- 1. Provision the School
        INSERT INTO public.schools (name, subdomain)
        VALUES (NEW.school_name, NEW.subdomain)
        RETURNING id INTO new_school_id;

        -- 2. Pre-register the School Admin in the global users table
        INSERT INTO public.users (email, full_name) 
        VALUES (NEW.admin_email, NEW.admin_name)
        RETURNING id INTO new_user_id;

        -- 3. Assign the 'school_admin' role to this user for the newly created school
        INSERT INTO public.user_roles (user_id, school_id, role)
        VALUES (new_user_id, new_school_id, 'school_admin');

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_registration_approved
    AFTER UPDATE ON public.registration_requests
    FOR EACH ROW
    EXECUTE FUNCTION handle_registration_approval();
