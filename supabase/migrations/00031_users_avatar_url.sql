-- ==============================================================================
-- MIGRATION 00031: add avatar_url to users
-- Teacher/parent profiles live in public.users (there is no teachers/parents
-- table). The sidebars and Account Settings read/write an avatar_url, so add
-- the column here to support profile photos for all roles.
-- ==============================================================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;
