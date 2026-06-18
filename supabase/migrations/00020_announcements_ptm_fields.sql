-- Migration 00020: Add PTM/Event fields to announcements table

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS event_time  TEXT,
  ADD COLUMN IF NOT EXISTS event_venue TEXT,
  ADD COLUMN IF NOT EXISTS event_class TEXT;
