-- Run in Supabase SQL Editor

-- Step 1: Find and disable the quota trigger
DO $$
DECLARE trig_name TEXT;
BEGIN
  SELECT trigger_name INTO trig_name
  FROM information_schema.triggers
  WHERE event_object_table = 'students'
    AND trigger_name ILIKE '%quota%'
  LIMIT 1;
  IF trig_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.students DISABLE TRIGGER ' || quote_ident(trig_name);
    RAISE NOTICE 'Disabled trigger: %', trig_name;
  ELSE
    RAISE NOTICE 'No quota trigger found';
  END IF;
END $$;

-- Step 2: Add constraints
ALTER TABLE public.students
  ADD CONSTRAINT IF NOT EXISTS students_enrollment_number_key UNIQUE (enrollment_number);

-- Step 3: Seed students
DO $$
DECLARE
  v_school_id   UUID;
  v_class_id    UUID;
  v_user_id     UUID;
  v_full_name   TEXT;
  v_class_num   INT;
  v_student_num INT;
  v_enrollment  TEXT;
  v_inserted    INT := 0;
BEGIN
  SELECT id INTO v_school_id FROM public.schools WHERE subdomain = 'gems' LIMIT 1;
  IF v_school_id IS NULL THEN RAISE EXCEPTION 'School not found'; END IF;

  FOR v_class_num IN 1..12 LOOP
    SELECT id INTO v_class_id FROM public.classes
    WHERE school_id = v_school_id AND grade_level = v_class_num::text LIMIT 1;

    FOR v_student_num IN 1..10 LOOP
      SELECT id INTO v_user_id FROM auth.users
      WHERE email = 'c' || v_class_num || 's' || LPAD(v_student_num::text, 2, '0') || '@gems.edu';
      IF v_user_id IS NULL THEN CONTINUE; END IF;

      SELECT full_name INTO v_full_name FROM public.users WHERE id = v_user_id;
      v_enrollment := 'GEMS' || LPAD(v_class_num::text,2,'0') || LPAD(v_student_num::text,3,'0');

      INSERT INTO public.students (school_id, class_id, user_id, first_name, last_name, enrollment_number)
      VALUES (
        v_school_id, v_class_id, v_user_id,
        COALESCE(NULLIF(split_part(v_full_name,' ',1),''),'Student'),
        COALESCE(NULLIF(split_part(v_full_name,' ',2),''),'User'),
        v_enrollment
      )
      ON CONFLICT (enrollment_number) DO UPDATE
        SET user_id = EXCLUDED.user_id, class_id = EXCLUDED.class_id;

      v_inserted := v_inserted + 1;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'Inserted/updated % students', v_inserted;
END $$;

-- Step 4: Re-enable trigger
DO $$
DECLARE trig_name TEXT;
BEGIN
  SELECT trigger_name INTO trig_name
  FROM information_schema.triggers
  WHERE event_object_table = 'students'
    AND trigger_name ILIKE '%quota%'
  LIMIT 1;
  IF trig_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.students ENABLE TRIGGER ' || quote_ident(trig_name);
    RAISE NOTICE 'Re-enabled trigger: %', trig_name;
  END IF;
END $$;

-- Verify
SELECT
  COUNT(*)                                     AS total_students,
  COUNT(*) FILTER (WHERE user_id IS NOT NULL)  AS with_user_id
FROM public.students;
