-- ==============================================================================
-- MULTI-TENANT SCHOOL SaaS - PHASE 8: COMPREHENSIVE RLS WRITE POLICIES
-- ==============================================================================

-- 1. Enable RLS on previously unsecured tables
ALTER TABLE public.registration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing constraint if it doesn't allow 'student'
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_check CHECK (role IN ('super_admin', 'school_admin', 'teacher', 'parent', 'staff', 'student'));

-- ==========================================
-- POLICIES FOR public.users (Biometric Face Embeddings & Profiles)
-- ==========================================
CREATE POLICY "Users can view users in their school" ON public.users 
    FOR SELECT USING (
        id IN (SELECT user_id FROM public.user_roles WHERE school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()))
        OR id = auth.uid()
    );

CREATE POLICY "Admins can insert users in their school" ON public.users 
    FOR INSERT WITH CHECK (true); -- Trigger handles links, but allow admin creations

CREATE POLICY "Users can update their own profile" ON public.users 
    FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Admins can update users in their school" ON public.users 
    FOR UPDATE USING (
        id IN (SELECT user_id FROM public.user_roles WHERE school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('school_admin', 'super_admin')))
    );

-- ==========================================
-- POLICIES FOR public.registration_requests (Onboarding Pipeline)
-- ==========================================
CREATE POLICY "Anyone can submit registration requests" ON public.registration_requests 
    FOR INSERT WITH CHECK (status = 'pending');

CREATE POLICY "Super Admins can manage registration requests" ON public.registration_requests 
    FOR ALL USING (
        auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'super_admin')
    );

-- ==========================================
-- POLICIES FOR public.schools
-- ==========================================
CREATE POLICY "Admins can update school" ON public.schools 
    FOR UPDATE USING (
        id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('school_admin', 'super_admin'))
    );

-- ==========================================
-- POLICIES FOR public.user_roles
-- ==========================================
CREATE POLICY "Admins can manage user roles" ON public.user_roles 
    FOR ALL USING (
        school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role = 'school_admin')
        OR auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'super_admin')
    );

-- ==========================================
-- GENERAL TENANT-SCOPED TABLES WRITE POLICIES
-- ==========================================

-- Classes
CREATE POLICY "Admins/Teachers can modify classes" ON public.classes 
    FOR ALL USING (
        school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('school_admin', 'teacher', 'staff'))
    );

-- Academic Years
CREATE POLICY "Admins can modify academic years" ON public.academic_years 
    FOR ALL USING (
        school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('school_admin', 'staff'))
    );

-- Students
CREATE POLICY "Admins/Staff can modify students" ON public.students 
    FOR ALL USING (
        school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('school_admin', 'staff'))
    );

-- Daily Attendance
CREATE POLICY "Teachers/Admins can mark attendance" ON public.daily_attendance 
    FOR ALL USING (
        school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('school_admin', 'teacher', 'staff'))
    );

-- Homework
CREATE POLICY "Teachers/Admins can manage homework" ON public.homework 
    FOR ALL USING (
        school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('school_admin', 'teacher'))
    );

-- Homework Submissions
CREATE POLICY "Students can submit homework" ON public.homework_submissions 
    FOR INSERT WITH CHECK (
        school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role = 'student')
    );

CREATE POLICY "Students can update own submissions" ON public.homework_submissions 
    FOR UPDATE USING (
        school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role = 'student')
    );

CREATE POLICY "Teachers can grade submissions" ON public.homework_submissions 
    FOR UPDATE USING (
        school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role = 'teacher')
    );

-- Exams
CREATE POLICY "Admins/Teachers can manage exams" ON public.exams 
    FOR ALL USING (
        school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('school_admin', 'teacher', 'staff'))
    );

-- Exam Marks
CREATE POLICY "Teachers/Admins can record marks" ON public.exam_marks 
    FOR ALL USING (
        school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('school_admin', 'teacher', 'staff'))
    );

-- Timetables
CREATE POLICY "Admins/Staff can manage timetables" ON public.timetables 
    FOR ALL USING (
        school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('school_admin', 'staff'))
    );

-- Announcements
CREATE POLICY "Admins/Teachers can manage announcements" ON public.announcements 
    FOR ALL USING (
        school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('school_admin', 'teacher'))
    );

-- ==========================================================================
-- The policies below target tables created by LATER migrations (fee_payments
-- in 00010, certificates in 00016) or by the app-table consolidation in 00035.
-- On a CLEAN deploy those tables don't exist yet when this migration runs, so
-- each CREATE POLICY is guarded with to_regclass(...) — the owning migration
-- (re)creates the policy. On an already-migrated DB this file is not re-run.
-- ==========================================================================

-- Leave Applications
DO $guard$ BEGIN
  IF to_regclass('public.leave_applications') IS NOT NULL THEN
    EXECUTE $p$CREATE POLICY "Users can apply for leaves" ON public.leave_applications FOR INSERT WITH CHECK (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('school_admin','teacher','staff')))$p$;
    EXECUTE $p$CREATE POLICY "Users can modify own pending leaves" ON public.leave_applications FOR UPDATE USING (user_id = auth.uid() AND status = 'pending')$p$;
    EXECUTE $p$CREATE POLICY "Admins can review leave applications" ON public.leave_applications FOR UPDATE USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role = 'school_admin'))$p$;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $guard$;

-- Fees & Fee Payments
DO $guard$ BEGIN
  IF to_regclass('public.fees') IS NOT NULL THEN
    EXECUTE $p$CREATE POLICY "Admins can manage fees" ON public.fees FOR ALL USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role = 'school_admin'))$p$;
  END IF;
  IF to_regclass('public.fee_payments') IS NOT NULL THEN
    EXECUTE $p$CREATE POLICY "Admins can manage fee payments" ON public.fee_payments FOR ALL USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role = 'school_admin'))$p$;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $guard$;

-- Salaries & Payroll
DO $guard$ BEGIN
  IF to_regclass('public.salaries') IS NOT NULL THEN
    EXECUTE $p$CREATE POLICY "Admins/Staff can manage salaries" ON public.salaries FOR ALL USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('school_admin','staff')))$p$;
  END IF;
  IF to_regclass('public.payroll_payments') IS NOT NULL THEN
    EXECUTE $p$CREATE POLICY "Admins/Staff can manage payroll" ON public.payroll_payments FOR ALL USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('school_admin','staff')))$p$;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $guard$;

-- Transport (Vehicles, Routes, Allocations)
DO $guard$ BEGIN
  IF to_regclass('public.vehicles') IS NOT NULL THEN
    EXECUTE $p$CREATE POLICY "Admins/Staff can manage vehicles" ON public.vehicles FOR ALL USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('school_admin','staff')))$p$;
  END IF;
  IF to_regclass('public.routes') IS NOT NULL THEN
    EXECUTE $p$CREATE POLICY "Admins/Staff can manage routes" ON public.routes FOR ALL USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('school_admin','staff')))$p$;
  END IF;
  IF to_regclass('public.transport_allocations') IS NOT NULL THEN
    EXECUTE $p$CREATE POLICY "Admins/Staff can manage transport allocations" ON public.transport_allocations FOR ALL USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('school_admin','staff')))$p$;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $guard$;

-- Syllabus / Documents / Certificates / Communications / Inventory
DO $guard$ BEGIN
  IF to_regclass('public.syllabus') IS NOT NULL THEN
    EXECUTE $p$CREATE POLICY "Admins/Teachers can manage syllabus" ON public.syllabus FOR ALL USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('school_admin','teacher')))$p$;
  END IF;
  IF to_regclass('public.documents') IS NOT NULL THEN
    EXECUTE $p$CREATE POLICY "Admins/Staff can manage documents" ON public.documents FOR ALL USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('school_admin','staff')))$p$;
  END IF;
  IF to_regclass('public.certificates') IS NOT NULL THEN
    EXECUTE $p$CREATE POLICY "Admins/Staff can manage certificates" ON public.certificates FOR ALL USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('school_admin','staff')))$p$;
  END IF;
  IF to_regclass('public.communications') IS NOT NULL THEN
    EXECUTE $p$CREATE POLICY "Admins/Staff can manage communications" ON public.communications FOR ALL USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('school_admin','staff')))$p$;
  END IF;
  IF to_regclass('public.inventory_items') IS NOT NULL THEN
    EXECUTE $p$CREATE POLICY "Admins/Staff can manage inventory" ON public.inventory_items FOR ALL USING (school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('school_admin','staff')))$p$;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $guard$;
