-- Message Templates Table
CREATE TABLE IF NOT EXISTS public.message_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'general'
              CHECK (category IN ('absent','fees','homework','exam','general','ptm','holiday','custom')),
  message     TEXT NOT NULL,
  variables   TEXT[],          -- list of {PLACEHOLDER} names used
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school_templates_access" ON public.message_templates;
CREATE POLICY "school_templates_access" ON public.message_templates
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND school_id = message_templates.school_id
      AND role IN ('admin','super_admin')
  ));

-- Seed default templates (will be inserted per-school on first use)
SELECT 'message_templates created' AS result;
