-- ==============================================================================
-- Migration 00034: PRIVATE storage bucket for student homework submissions
-- ------------------------------------------------------------------------------
-- Files are stored at  {school_id}/{homework_id}/{student_id}-<ts>.<ext>
-- so the first path segment is the school_id. Policies scope every operation to
-- the caller's own school, and the bucket is private (served via signed URLs).
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('homework', 'homework', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Only members of the file's school can read/write it.
DROP POLICY IF EXISTS "homework_insert" ON storage.objects;
CREATE POLICY "homework_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'homework'
    AND (storage.foldername(name))[1] IN (
      SELECT school_id::text FROM public.user_roles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "homework_select" ON storage.objects;
CREATE POLICY "homework_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'homework'
    AND (storage.foldername(name))[1] IN (
      SELECT school_id::text FROM public.user_roles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "homework_update" ON storage.objects;
CREATE POLICY "homework_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'homework'
    AND (storage.foldername(name))[1] IN (
      SELECT school_id::text FROM public.user_roles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "homework_delete" ON storage.objects;
CREATE POLICY "homework_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'homework'
    AND (storage.foldername(name))[1] IN (
      SELECT school_id::text FROM public.user_roles WHERE user_id = auth.uid()
    )
  );
