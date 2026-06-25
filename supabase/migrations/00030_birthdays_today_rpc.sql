-- ==============================================================================
-- MIGRATION 00030: today's-birthday students via RPC
-- The dashboard previously fetched ALL students' DOBs to the browser (capped at
-- 1000) and filtered for today's birthdays client-side. This computes it in the
-- DB so it is correct at any scale.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.students_birthdays_today(p_school uuid)
RETURNS TABLE (name text)
LANGUAGE sql STABLE AS $$
  SELECT name
  FROM public.students
  WHERE school_id = p_school
    AND date_of_birth IS NOT NULL
    AND EXTRACT(MONTH FROM date_of_birth) = EXTRACT(MONTH FROM current_date)
    AND EXTRACT(DAY   FROM date_of_birth) = EXTRACT(DAY   FROM current_date);
$$;

GRANT EXECUTE ON FUNCTION public.students_birthdays_today(uuid) TO authenticated;
