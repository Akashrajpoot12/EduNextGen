-- ==============================================================================
-- MULTI-TENANT SCHOOL SaaS - PHASE 6: BIOMETRIC MATCHING RPC
-- ==============================================================================

-- Function to match a face vector against the students table for a specific school
-- Returns the matching student_id and the similarity score
CREATE OR REPLACE FUNCTION public.match_student_face(
    query_embedding vector(128),
    match_threshold float,
    match_count int,
    p_school_id uuid
)
RETURNS TABLE (
    id uuid,
    first_name text,
    last_name text,
    similarity float
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        students.id,
        students.first_name,
        students.last_name,
        1 - (students.face_vector <=> query_embedding) AS similarity
    FROM public.students
    WHERE students.school_id = p_school_id
      AND 1 - (students.face_vector <=> query_embedding) > match_threshold
    ORDER BY students.face_vector <=> query_embedding ASC
    LIMIT match_count;
$$;
