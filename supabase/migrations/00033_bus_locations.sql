-- ==============================================================================
-- Migration 00033: Bus Locations (GPS / live transport tracking)
-- ------------------------------------------------------------------------------
-- Phase 3 foundation for the separate GPS tracking service.
--
-- A bus device / driver's phone posts coordinates to the gps-tracking service,
-- which writes them here (service_role). The web app (Admin GpsTrackingPage,
-- Parent ParentTransportPage) reads the latest point per route — live via
-- Supabase Realtime.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.bus_locations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   UUID NOT NULL REFERENCES public.schools(id)          ON DELETE CASCADE,
    route_id    UUID NOT NULL REFERENCES public.transport_routes(id) ON DELETE CASCADE,
    latitude    DOUBLE PRECISION NOT NULL,
    longitude   DOUBLE PRECISION NOT NULL,
    speed_kmh   DOUBLE PRECISION,
    heading     DOUBLE PRECISION,             -- compass degrees 0-360 (optional)
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_bus_loc_route_time
    ON public.bus_locations(route_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_bus_loc_school_time
    ON public.bus_locations(school_id, recorded_at DESC);

-- Latest point per route (handy for the map markers). security_invoker = RLS of
-- the caller applies, so tenant isolation is preserved.
CREATE OR REPLACE VIEW public.bus_latest_locations
WITH (security_invoker = on) AS
    SELECT DISTINCT ON (bl.route_id)
        bl.route_id,
        bl.school_id,
        r.route_name,
        r.vehicle_number,
        r.driver_name,
        r.driver_phone,
        bl.latitude,
        bl.longitude,
        bl.speed_kmh,
        bl.heading,
        bl.recorded_at
    FROM public.bus_locations bl
    JOIN public.transport_routes r ON r.id = bl.route_id
    ORDER BY bl.route_id, bl.recorded_at DESC;

-- ── Row Level Security ────────────────────────────────────────────────────────
-- School members (admin/teacher/parent) read their own school's locations.
-- The GPS service writes with the service_role key (bypasses RLS).
ALTER TABLE public.bus_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School read bus_locations" ON public.bus_locations;
CREATE POLICY "School read bus_locations" ON public.bus_locations
    FOR SELECT
    USING (
        school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid())
        OR is_super_admin()
    );

-- ── Realtime ──────────────────────────────────────────────────────────────────
-- Add to the realtime publication so the web app can subscribe to live updates.
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bus_locations;
EXCEPTION
    WHEN duplicate_object THEN NULL;   -- already added
    WHEN undefined_object THEN NULL;   -- publication missing (non-Supabase env)
END $$;
