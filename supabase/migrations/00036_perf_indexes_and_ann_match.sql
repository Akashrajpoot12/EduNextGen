-- ==============================================================================
-- Migration 00036: P1 performance — hot-path indexes + ANN-first face matching
-- ==============================================================================

-- ── exam_marks indexes ───────────────────────────────────────────────────────
-- exam_marks only had UNIQUE(exam_id, student_id, subject) (exam_id-leading).
-- School-wide aggregations (AdminDashboard topper, TeacherDashboard) filtered by
-- school_id did a sequential scan; student/parent reads filtered by student_id.
CREATE INDEX IF NOT EXISTS idx_exam_marks_school  ON public.exam_marks(school_id);
CREATE INDEX IF NOT EXISTS idx_exam_marks_student ON public.exam_marks(student_id);

-- ── ANN-first face matching ──────────────────────────────────────────────────
-- The previous version scanned EVERY embedding in the school per detected face
-- (GROUP/HAVING over a full table scan — the HNSW index was never used). This
-- rewrite does an index-backed nearest-neighbour search first (ORDER BY <=> LIMIT,
-- which uses the HNSW vector_cosine_ops index), then aggregates the few nearest
-- rows per person. Cost goes from O(N) to ~O(log N) and stops growing linearly
-- with enrollment size.
CREATE OR REPLACE FUNCTION public.match_face_embedding(
    query_embedding vector(512),
    match_threshold float,
    match_count     int,
    p_school_id     uuid
)
RETURNS TABLE (
    entity_type text,
    entity_id   uuid,
    full_name   text,
    similarity  float
)
LANGUAGE sql
STABLE
AS $$
    WITH nearest AS (
        -- index-backed ANN: pull a handful of nearest vectors (enough to cover
        -- several enrolled photos per person)
        SELECT
            fe.student_id,
            fe.user_id,
            1 - (fe.embedding <=> query_embedding) AS similarity
        FROM public.face_embeddings fe
        WHERE fe.school_id = p_school_id
        ORDER BY fe.embedding <=> query_embedding
        LIMIT GREATEST(match_count * 20, 20)
    ),
    scored AS (
        SELECT
            CASE WHEN n.student_id IS NOT NULL THEN 'student' ELSE 'staff' END AS entity_type,
            COALESCE(n.student_id, n.user_id) AS entity_id,
            n.similarity
        FROM nearest n
    )
    SELECT
        s.entity_type,
        s.entity_id,
        CASE WHEN s.entity_type = 'student'
             THEN (SELECT st.first_name || ' ' || st.last_name FROM public.students st WHERE st.id = s.entity_id)
             ELSE (SELECT u.full_name FROM public.users u WHERE u.id = s.entity_id)
        END AS full_name,
        MAX(s.similarity) AS similarity
    FROM scored s
    GROUP BY s.entity_type, s.entity_id
    HAVING MAX(s.similarity) > match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
$$;
