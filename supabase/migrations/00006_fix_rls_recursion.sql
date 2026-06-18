-- Drop existing broken policies
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "School Admins can manage roles within their school" ON public.user_roles;
DROP POLICY IF EXISTS "Super Admins can view all schools" ON public.schools;
DROP POLICY IF EXISTS "Super Admins can view registration requests" ON public.registration_requests;

-- Create a helper function to securely check if a user is super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'super_admin'
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- Create a helper function to securely check if a user is school_admin for a specific school
CREATE OR REPLACE FUNCTION public.is_school_admin(check_school_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'school_admin' AND school_id = check_school_id
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- Create new non-recursive policies for user_roles
CREATE POLICY "Super Admins can manage all roles" ON public.user_roles 
    FOR ALL USING (public.is_super_admin());

CREATE POLICY "School Admins can manage roles within their school" ON public.user_roles 
    FOR ALL USING (public.is_school_admin(school_id));

CREATE POLICY "Users can view their own roles" ON public.user_roles 
    FOR SELECT USING (user_id = auth.uid());
    
-- Ensure Super Admins can SELECT from schools table
CREATE POLICY "Super Admins can view all schools" ON public.schools 
    FOR SELECT USING (public.is_super_admin());

-- Ensure Super Admins can SELECT from registration requests
CREATE POLICY "Super Admins can view registration requests" ON public.registration_requests 
    FOR SELECT USING (public.is_super_admin());
