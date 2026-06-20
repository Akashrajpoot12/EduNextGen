-- ================================================================
-- STEP 1: Apna school subdomain check karo
-- ================================================================
SELECT id, name, subdomain FROM public.schools;

-- ================================================================
-- STEP 2: Ye SQL Supabase Dashboard → SQL Editor mein run karo
-- Pehle upar se apna school_id copy karo
-- ================================================================

-- Demo teacher create karna ka sabse aasaan tarika:
-- Admin Panel → /{subdomain}/admin/teachers → Add Teacher
-- Email: akash@gems.edu  Password: Akash@123  (ya jo bhi fill kiya tha)
--
-- Ya niche se directly check karo ki koi teacher already hai:

SELECT
  u.id,
  u.email,
  u.name,
  u.role,
  s.subdomain,
  s.name as school_name
FROM public.users u
JOIN public.schools s ON u.school_id = s.id
WHERE u.role = 'teacher'
ORDER BY u.created_at DESC
LIMIT 10;
