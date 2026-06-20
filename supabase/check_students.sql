-- Check what's actually in students table
SELECT COUNT(*) AS total_students FROM public.students;

-- Show first 5 students with their enrollment numbers
SELECT id, enrollment_number, first_name, last_name, school_id, user_id
FROM public.students
LIMIT 5;

-- Check auth users with gems.edu email
SELECT COUNT(*) AS gems_auth_users FROM auth.users WHERE email LIKE '%@gems.edu';

-- Show first 3 auth users
SELECT id, email FROM auth.users WHERE email LIKE '%@gems.edu' LIMIT 3;
