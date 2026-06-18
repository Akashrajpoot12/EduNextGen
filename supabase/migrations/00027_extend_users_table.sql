-- Extend users table with columns needed by newer admin pages
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS name          TEXT,
  ADD COLUMN IF NOT EXISTS school_id     UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS role          TEXT DEFAULT 'staff',
  ADD COLUMN IF NOT EXISTS department    TEXT,
  ADD COLUMN IF NOT EXISTS phone         TEXT,
  ADD COLUMN IF NOT EXISTS address       TEXT,
  ADD COLUMN IF NOT EXISTS subject       TEXT,
  ADD COLUMN IF NOT EXISTS qualification TEXT,
  ADD COLUMN IF NOT EXISTS joining_date  DATE;

-- Backfill name from full_name where name is null
UPDATE public.users SET name = full_name WHERE name IS NULL AND full_name IS NOT NULL;

-- Backfill school_id and role from user_roles (pick first role per user)
UPDATE public.users u
SET school_id = ur.school_id,
    role      = ur.role
FROM (
  SELECT DISTINCT ON (user_id) user_id, school_id, role
  FROM public.user_roles
  ORDER BY user_id, created_at DESC
) ur
WHERE u.id = ur.user_id AND u.school_id IS NULL;

-- Index for fast school-scoped queries
CREATE INDEX IF NOT EXISTS idx_users_school_id ON public.users(school_id);
CREATE INDEX IF NOT EXISTS idx_users_role      ON public.users(role);
