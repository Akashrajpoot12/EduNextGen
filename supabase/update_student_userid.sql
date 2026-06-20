-- Update existing students with user_id (UPDATE not INSERT — no quota trigger)
-- Run in Supabase SQL Editor

DO $$
DECLARE
  v_user_id    UUID;
  v_class_num  INT;
  v_student_num INT;
  v_enrollment TEXT;
  v_updated    INT := 0;
BEGIN
  FOR v_class_num IN 1..10 LOOP
    FOR v_student_num IN 1..5 LOOP
      SELECT id INTO v_user_id FROM auth.users
        WHERE email = 'c' || v_class_num || 's' || LPAD(v_student_num::text,2,'0') || '@gems.edu';

      IF v_user_id IS NULL THEN CONTINUE; END IF;

      v_enrollment := 'GEMS'
        || LPAD(v_class_num::text,2,'0')
        || LPAD(v_student_num::text,3,'0');

      UPDATE public.students
        SET user_id = v_user_id
        WHERE enrollment_number = v_enrollment
          AND (user_id IS NULL OR user_id != v_user_id);

      IF FOUND THEN v_updated := v_updated + 1; END IF;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'Updated % students with user_id', v_updated;
END $$;

-- Verify
SELECT
  COUNT(*)                                    AS total,
  COUNT(*) FILTER (WHERE user_id IS NOT NULL) AS with_user_id
FROM public.students;
