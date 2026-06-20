-- Create a demo parent user in Supabase Auth + link to a student
-- Run in Supabase SQL Editor

-- Step 1: Check existing parent setup
SELECT id, email FROM auth.users WHERE email = 'parent1@gems.edu';

-- Step 2: Insert into public.users (after creating auth user manually)
-- First create auth user via Dashboard > Authentication > Add User:
--   Email: parent1@gems.edu
--   Password: Parent@1234
-- Then run Steps 3-4 below.

-- Step 3: Add role (replace USER_ID with the actual UUID from auth.users)
-- INSERT INTO public.user_roles (user_id, school_id, role)
-- SELECT
--   (SELECT id FROM auth.users WHERE email = 'parent1@gems.edu'),
--   (SELECT id FROM public.schools WHERE subdomain = 'gems'),
--   'parent'
-- WHERE NOT EXISTS (
--   SELECT 1 FROM public.user_roles
--   WHERE user_id = (SELECT id FROM auth.users WHERE email = 'parent1@gems.edu')
--   AND role = 'parent'
-- );

-- Step 4: Link student to parent (links first student c1s01@gems.edu to this parent)
-- UPDATE public.students
-- SET parent_user_id = (SELECT id FROM auth.users WHERE email = 'parent1@gems.edu')
-- WHERE enrollment_number = 'GEMS01001';

-- Verify
SELECT
  s.enrollment_number,
  s.first_name || ' ' || s.last_name AS student_name,
  u.email AS parent_email
FROM public.students s
LEFT JOIN auth.users u ON u.id = s.parent_user_id
WHERE s.school_id = (SELECT id FROM public.schools WHERE subdomain = 'gems')
LIMIT 5;
