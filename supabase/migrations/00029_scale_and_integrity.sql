-- ==============================================================================
-- MIGRATION 00029: SCALE & DATA INTEGRITY  (Phase 1)
-- ------------------------------------------------------------------------------
-- Makes the schema safe for a real school (5000+ students, 100+ staff):
--   1. De-duplicate classes and enforce one row per (school, year, grade, section)
--   2. Performance indexes on the hottest query paths
--   3. Server-side aggregation RPCs so dashboards/reports never pull 100k+ rows
--      to the browser (kills the 1000-row ceiling + N+1 query problems)
-- All changes are additive/idempotent and respect RLS (functions run as invoker).
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CLASSES: de-duplicate, then enforce uniqueness
-- A missing unique key let "Class 10 - A" be created twice, which silently split
-- a section's students/marks/attendance across two ids (wrong ranks & rollups).
-- Repoint every class_id reference to the earliest "keeper" row, drop the dupes,
-- then add a unique index (COALESCE handles a NULL academic_year_id correctly).
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  grp   record;
  keeper uuid;
  dup    uuid;
  tbl    record;
BEGIN
  FOR grp IN
    SELECT array_agg(id ORDER BY created_at) AS ids
    FROM public.classes
    GROUP BY school_id,
             COALESCE(academic_year_id, '00000000-0000-0000-0000-000000000000'::uuid),
             grade_level, section
    HAVING count(*) > 1
  LOOP
    keeper := grp.ids[1];
    FOREACH dup IN ARRAY grp.ids[2:array_length(grp.ids, 1)] LOOP
      -- Repoint every public table that has a class_id column to the keeper.
      FOR tbl IN
        SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'class_id'
      LOOP
        EXECUTE format('UPDATE public.%I SET class_id = $1 WHERE class_id = $2', tbl.table_name)
          USING keeper, dup;
      END LOOP;
      DELETE FROM public.classes WHERE id = dup;
    END LOOP;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS classes_unique_section
  ON public.classes (
    school_id,
    COALESCE(academic_year_id, '00000000-0000-0000-0000-000000000000'::uuid),
    grade_level,
    section
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PERFORMANCE INDEXES
-- daily_attendance grows to ~1M rows/year; these back the dashboard, reports,
-- and fee screens so they stay fast at scale.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_att_student_date ON public.daily_attendance (student_id, date);
CREATE INDEX IF NOT EXISTS idx_att_school_date  ON public.daily_attendance (school_id, date);
CREATE INDEX IF NOT EXISTS idx_students_school_class ON public.students (school_id, class_id);

-- student_fee_assignments may not exist in every environment — guard it.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'student_fee_assignments') THEN
    CREATE INDEX IF NOT EXISTS idx_feeassign_school_status
      ON public.student_fee_assignments (school_id, status);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3a. RPC: attendance_summary
-- Per-student present/total counts for a set of students over a date range,
-- computed in ONE query in the DB. Replaces the old N+1 (2 queries per student).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.attendance_summary(
  p_student_ids uuid[],
  p_start date,
  p_end   date
)
RETURNS TABLE (student_id uuid, total bigint, present bigint)
LANGUAGE sql STABLE AS $$
  SELECT da.student_id,
         count(*)                                          AS total,
         count(*) FILTER (WHERE da.status = 'present')      AS present
  FROM public.daily_attendance da
  WHERE da.student_id = ANY (p_student_ids)
    AND da.date BETWEEN p_start AND p_end
  GROUP BY da.student_id;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3b. RPC: students_below_attendance
-- Count of students under a threshold over the last N days, school-wide.
-- Threshold/days are parameters (no more hardcoded 75%).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.students_below_attendance(
  p_school    uuid,
  p_threshold numeric DEFAULT 0.75,
  p_days      int     DEFAULT 30
)
RETURNS integer
LANGUAGE sql STABLE AS $$
  SELECT count(*)::int FROM (
    SELECT da.student_id
    FROM public.daily_attendance da
    WHERE da.school_id = p_school
      AND da.date >= current_date - p_days
    GROUP BY da.student_id
    HAVING count(*) >= 5
       AND avg(CASE WHEN da.status = 'present' THEN 1.0 ELSE 0.0 END) < p_threshold
  ) t;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3c. RPC: pending_fees_summary  (count + total amount, guarded)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'student_fee_assignments') THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.pending_fees_summary(p_school uuid)
      RETURNS TABLE (cnt bigint, total numeric)
      LANGUAGE sql STABLE AS $body$
        SELECT count(*) AS cnt,
               COALESCE(sum(GREATEST(0, amount - COALESCE(discount,0) + COALESCE(fine,0))), 0) AS total
        FROM public.student_fee_assignments
        WHERE school_id = p_school AND status = 'pending';
      $body$;
    $fn$;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.attendance_summary(uuid[], date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.students_below_attendance(uuid, numeric, int) TO authenticated;
