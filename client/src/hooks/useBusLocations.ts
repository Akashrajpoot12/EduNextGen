import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type BusLoc = {
  route_id: string;
  school_id: string;
  route_name?: string;
  vehicle_number?: string;
  driver_name?: string;
  driver_phone?: string;
  latitude: number;
  longitude: number;
  speed_kmh?: number | null;
  heading?: number | null;
  recorded_at: string;
};

/** A fix is considered "live" if it arrived within the last 60 seconds. */
export function isLiveFix(recorded_at?: string): boolean {
  if (!recorded_at) return false;
  return Date.now() - new Date(recorded_at).getTime() < 60_000;
}

/**
 * Latest bus location per route for a school, kept live via Supabase Realtime.
 * Returns a map keyed by route_id. Empty until data loads.
 */
export function useBusLocations(schoolId?: string): Record<string, BusLoc> {
  const supabase = createClient();
  const [locations, setLocations] = useState<Record<string, BusLoc>>({});

  useEffect(() => {
    if (!schoolId) return;
    let active = true;

    supabase
      .from("bus_latest_locations")
      .select("*")
      .eq("school_id", schoolId)
      .then(({ data }) => {
        if (!active || !data) return;
        const map: Record<string, BusLoc> = {};
        (data as BusLoc[]).forEach((d) => {
          map[d.route_id] = d;
        });
        setLocations(map);
      });

    const channel = supabase
      .channel(`bus-locations-${schoolId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bus_locations",
          filter: `school_id=eq.${schoolId}`,
        },
        (payload) => {
          const row = payload.new as Partial<BusLoc> & { route_id: string };
          setLocations((prev) => ({
            ...prev,
            // merge so route metadata (name/vehicle/driver) from the view is kept
            [row.route_id]: { ...(prev[row.route_id] || {}), ...row } as BusLoc,
          }));
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [schoolId]);

  return locations;
}
