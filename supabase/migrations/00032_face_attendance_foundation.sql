-- ==============================================================================
-- Migration 00032: Face Attendance Foundation (InsightFace / ArcFace, 512-d)
-- ------------------------------------------------------------------------------
-- Phase 0 of the separate face-attendance companion service.
--
-- Why a NEW table instead of reusing students.face_vector / users.face_vector:
--   * Those columns are vector(128) (face-api.js, browser engine).
--   * The Python service uses ArcFace = vector(512) AND stores MANY embeddings
--     per person (10-20 photos at different angles) for higher accuracy.
--   * Keeping a separate table preserves the existing 128-d data untouched.
--
-- One person -> many rows in face_embeddings (one per enrolled photo).
-- Students live in public.students; teachers & staff both live in public.users.
-- ==============================================================================

-- 1. Multi-embedding store (512-d, multiple photos per person) ------------------
CREATE TABLE IF NOT EXISTS public.face_embeddings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   UUID NOT NULL REFERENCES public.schools(id)  ON DELETE CASCADE,
    -- exactly one of these is set (student vs staff/teacher)
    student_id  UUID REFERENCES public.students(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES public.users(id)    ON DELETE CASCADE,
    embedding   vector(512) NOT NULL,
    image_label TEXT,                       -- e.g. "front", "left30", "frame_007"
    created_at  TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,

    -- enforce "subject of attendance" = exactly one of student / user
    CONSTRAINT chk_face_embed_one_subject CHECK (
        (student_id IS NOT NULL AND user_id IS NULL) OR
        (student_id IS NULL     AND user_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_face_embed_school   ON public.face_embeddings(school_id);
CREATE INDEX IF NOT EXISTS idx_face_embed_student  ON public.face_embeddings(student_id);
CREATE INDEX IF NOT EXISTS idx_face_embed_user     ON public.face_embeddings(user_id);

-- ANN index for fast cosine similarity search over 512-d vectors
CREATE INDEX IF NOT EXISTS idx_face_embed_vector
    ON public.face_embeddings
    USING hnsw (embedding vector_cosine_ops);

-- 2. Extra columns on attendance tables so face writes are clean ----------------
--    method: how the row was created (manual vs face_ai)
--    confidence: similarity score (0-1) when marked by face
--    check_in_at: exact timestamp the face was detected at the gate/camera
ALTER TABLE public.daily_attendance
    ADD COLUMN IF NOT EXISTS method      TEXT DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS confidence  NUMERIC,
    ADD COLUMN IF NOT EXISTS check_in_at TIMESTAMPTZ;

ALTER TABLE public.staff_attendance
    ADD COLUMN IF NOT EXISTS method      TEXT DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS confidence  NUMERIC,
    ADD COLUMN IF NOT EXISTS check_in_at TIMESTAMPTZ;

-- 3. Match RPC (512-d) — best embedding per person, top-N people ----------------
--    Returns student OR staff matches above the threshold for one school.
--    The Python service calls this with a freshly computed ArcFace vector.
CREATE OR REPLACE FUNCTION public.match_face_embedding(
    query_embedding vector(512),
    match_threshold float,
    match_count     int,
    p_school_id     uuid
)
RETURNS TABLE (
    entity_type text,   -- 'student' | 'staff'
    entity_id   uuid,   -- students.id  OR  users.id
    full_name   text,
    similarity  float
)
LANGUAGE sql
STABLE
AS $$
    WITH scored AS (
        SELECT
            CASE WHEN fe.student_id IS NOT NULL THEN 'student' ELSE 'staff' END AS entity_type,
            COALESCE(fe.student_id, fe.user_id) AS entity_id,
            CASE WHEN fe.student_id IS NOT NULL
                 THEN s.first_name || ' ' || s.last_name
                 ELSE u.full_name
            END AS full_name,
            1 - (fe.embedding <=> query_embedding) AS similarity
        FROM public.face_embeddings fe
        LEFT JOIN public.students s ON s.id = fe.student_id
        LEFT JOIN public.users    u ON u.id = fe.user_id
        WHERE fe.school_id = p_school_id
    )
    SELECT entity_type, entity_id, full_name, MAX(similarity) AS similarity
    FROM scored
    GROUP BY entity_type, entity_id, full_name
    HAVING MAX(similarity) > match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
$$;

-- 4. Row Level Security --------------------------------------------------------
--    The Python service connects with the service_role key (bypasses RLS).
--    These policies let the WEB app (admin) read/manage embeddings for its own
--    school, matching the pattern used by staff_attendance (migration 00017).
ALTER TABLE public.face_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School access face_embeddings" ON public.face_embeddings;
CREATE POLICY "School access face_embeddings" ON public.face_embeddings
    FOR ALL
    USING (
        school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid())
        OR is_super_admin()
    )
    WITH CHECK (
        school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid())
        OR is_super_admin()
    );
