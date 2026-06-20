-- ============================================================
-- DEMO SEED — Run this in Supabase SQL Editor
-- Creates demo teacher, student, parent accounts for testing
-- ============================================================
-- NOTE: This only inserts the profile rows in public.users and
-- public.user_roles. The auth.users rows must be created via
-- the "Add Teacher" flow in Admin panel OR via Supabase Auth
-- Dashboard (Authentication → Users → Invite).
--
-- Easiest: Use the Admin Panel → Teachers → Add Teacher
-- Email:    teacher@demo.edu
-- Password: Demo@1234
-- Then copy the user_id from Supabase Auth and run below.
-- ============================================================

-- Step 1: Find your school ID
-- SELECT id, name, subdomain FROM public.schools LIMIT 10;

-- Step 2: After creating auth user, update the users table row:
-- UPDATE public.users
-- SET school_id = '<YOUR_SCHOOL_ID>',
--     role = 'teacher',
--     name = 'Demo Teacher'
-- WHERE email = 'teacher@demo.edu';

-- Step 3: Insert user_role
-- INSERT INTO public.user_roles (user_id, school_id, role)
-- SELECT id, '<YOUR_SCHOOL_ID>', 'teacher'
-- FROM public.users WHERE email = 'teacher@demo.edu'
-- ON CONFLICT DO NOTHING;

-- ============================================================
-- QUICK: If you want to check existing users in your school:
-- ============================================================
-- SELECT u.email, u.name, u.role, u.school_id
-- FROM public.users u
-- WHERE u.school_id = '<YOUR_SCHOOL_ID>';
