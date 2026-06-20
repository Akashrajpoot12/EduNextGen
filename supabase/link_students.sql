-- Link students to auth users using DO block (more reliable)
-- Paste in Supabase SQL Editor and Run

DO $$
DECLARE
  v_user_id    UUID;
  v_enrollment TEXT;
  v_class_num  INT;
  v_student_num INT;
  v_updated    INT := 0;
BEGIN
  FOR v_class_num IN 1..12 LOOP
    FOR v_student_num IN 1..10 LOOP
      SELECT id INTO v_user_id
      FROM auth.users
      WHERE email = 'c' || v_class_num || 's' || LPAD(v_student_num::text, 2, '0') || '@gems.edu';

      IF v_user_id IS NOT NULL THEN
        v_enrollment := 'GEMS'
          || LPAD(v_class_num::text, 2, '0')
          || LPAD(v_student_num::text, 3, '0');

        UPDATE public.students
        SET user_id = v_user_id
        WHERE enrollment_number = v_enrollment AND user_id IS NULL;

        v_updated := v_updated + 1;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Linked % students to auth users', v_updated;
END $$;

-- Verify
SELECT COUNT(*) AS students_linked FROM public.students WHERE user_id IS NOT NULL;
