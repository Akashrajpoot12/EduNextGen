-- ================================================================
-- STEP 1: Add missing user_id column to students table
-- ================================================================
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS admission_date DATE,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS students_user_id_key ON public.students(user_id);

-- ================================================================
-- STEP 2: Fix schools RLS (allow login form to read school)
-- ================================================================
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_authenticated_read_schools" ON schools;
CREATE POLICY "allow_authenticated_read_schools"
  ON schools FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "allow_anon_read_schools" ON schools;
CREATE POLICY "allow_anon_read_schools"
  ON schools FOR SELECT TO anon USING (true);

-- ================================================================
-- STEP 3: Seed student records from auth.users
-- ================================================================
DO $$
DECLARE
  v_school_id uuid;
  v_class_id  uuid;
  v_user_id   uuid;
  v_email     text;
  v_class_num int;
  v_student_num int;
  v_full_name text;
  v_enrollment text;
  name_idx    int;
  first_names text[] := ARRAY[
    'Aarav','Ananya','Arjun','Diya','Ishaan','Kavya','Krishna','Meera','Neha','Rohan',
    'Sanya','Shiv','Tanvi','Veer','Yash','Zara','Aditya','Bhavna','Chirag','Deepa',
    'Esha','Farhan','Gauri','Harsh','Isha','Jay','Komal','Lakshmi','Manav','Nisha',
    'Om','Pooja','Ravi','Simran','Tarun','Uma','Varun','Wishi','Xena','Yamini',
    'Abhi','Bela','Chetan','Divya','Ekta','Faiz','Gita','Hina','Ishan','Jyoti',
    'Kabir','Lata','Mohit','Naina','Parth','Radha','Sahil','Trisha','Uday','Vijay',
    'Aisha','Bhuvan','Chhavi','Dhruv','Elina','Firoz','Gopika','Hemant','Indu','Jatin',
    'Kiran','Lalit','Mahi','Nakul','Ojas','Pragya','Qasim','Reena','Shubham','Tina',
    'Ujjwal','Vani','Waqar','Xander','Yuvraj','Amara','Bharat','Chanchal','Dinesh','Eva',
    'Fatima','Gagan','Heena','Imran','Jisha','Kartik','Leena','Mukul','Nina','Oscar',
    'Puja','Rahul','Samar','Tulsi','Usha','Vivek','Winnie','Xerxes','Yukta','Zoya',
    'Atul','Bindu','Chand','Dipti','Ellora','Farida','Gopal','Harini','Irfan','Jasmine'
  ];
  last_names text[] := ARRAY[
    'Sharma','Verma','Gupta','Singh','Kumar','Patel','Joshi','Mehta','Shah','Rao',
    'Nair','Pillai','Reddy','Iyer','Menon'
  ];
BEGIN
  -- Get school
  SELECT id INTO v_school_id FROM schools WHERE subdomain = 'gems' LIMIT 1;
  IF v_school_id IS NULL THEN
    INSERT INTO schools (name, subdomain, email, is_active)
    VALUES ('GEMS International School', 'gems', 'info@gems.edu', true)
    RETURNING id INTO v_school_id;
    RAISE NOTICE 'Created school, ID: %', v_school_id;
  ELSE
    RAISE NOTICE 'Found school, ID: %', v_school_id;
  END IF;

  -- Ensure 12 classes exist
  FOR v_class_num IN 1..12 LOOP
    IF NOT EXISTS (
      SELECT 1 FROM classes WHERE school_id = v_school_id AND grade_level = v_class_num::text AND section = 'A'
    ) THEN
      INSERT INTO classes (school_id, grade_level, section)
      VALUES (v_school_id, v_class_num::text, 'A');
      RAISE NOTICE 'Created class %', v_class_num;
    END IF;
  END LOOP;

  -- Seed each student
  FOR v_class_num IN 1..12 LOOP
    FOR v_student_num IN 1..10 LOOP
      v_email := 'c' || v_class_num || 's' || LPAD(v_student_num::text, 2, '0') || '@gems.edu';

      SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
      IF v_user_id IS NULL THEN
        RAISE NOTICE 'Auth user NOT FOUND: %', v_email;
        CONTINUE;
      END IF;

      name_idx := (v_class_num - 1) * 10 + v_student_num - 1;
      v_full_name := first_names[name_idx % array_length(first_names,1) + 1]
                  || ' ' || last_names[name_idx % array_length(last_names,1) + 1];
      v_enrollment := 'GEMS' || LPAD(v_class_num::text,2,'0') || LPAD(v_student_num::text,3,'0');

      -- public.users
      INSERT INTO public.users (id, email, full_name, name, role, school_id)
      VALUES (v_user_id, v_email, v_full_name, v_full_name, 'student', v_school_id)
      ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            name = EXCLUDED.name,
            role = 'student',
            school_id = EXCLUDED.school_id;

      -- user_roles
      INSERT INTO user_roles (user_id, school_id, role)
      VALUES (v_user_id, v_school_id, 'student')
      ON CONFLICT (user_id, school_id) DO UPDATE SET role = 'student';

      -- Get class id
      SELECT id INTO v_class_id FROM classes
      WHERE school_id = v_school_id AND grade_level = v_class_num::text AND section = 'A'
      LIMIT 1;

      -- students table
      INSERT INTO students (user_id, school_id, class_id, first_name, last_name, enrollment_number, is_active, admission_date)
      VALUES (
        v_user_id, v_school_id, v_class_id,
        split_part(v_full_name, ' ', 1),
        split_part(v_full_name, ' ', 2),
        v_enrollment, true, '2025-04-01'
      )
      ON CONFLICT (user_id) DO UPDATE
        SET class_id = EXCLUDED.class_id,
            school_id = EXCLUDED.school_id,
            enrollment_number = EXCLUDED.enrollment_number;

      RAISE NOTICE 'Seeded: %', v_email;
    END LOOP;
  END LOOP;

  RAISE NOTICE '✅ All done!';
END $$;

-- ================================================================
-- STEP 4: Verify
-- ================================================================
SELECT 'students' as tbl, COUNT(*) as cnt FROM students
UNION ALL
SELECT 'user_roles_student', COUNT(*) FROM user_roles WHERE role = 'student'
UNION ALL
SELECT 'public_users_student', COUNT(*) FROM public.users WHERE role = 'student';
