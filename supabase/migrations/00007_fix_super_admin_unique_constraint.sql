-- Fix user_roles UNIQUE constraint for super_admin
-- super_admin has NULL school_id, and NULL != NULL in SQL, so duplicates can slip through.
-- Replace the table-level UNIQUE with a partial unique index per role type.

-- Drop old constraint
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_school_id_role_key;

-- For non-super_admin roles: unique per user + school + role
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_tenant_unique
  ON public.user_roles (user_id, school_id, role)
  WHERE school_id IS NOT NULL;

-- For super_admin: only one super_admin role per user
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_super_admin_unique
  ON public.user_roles (user_id, role)
  WHERE role = 'super_admin';
