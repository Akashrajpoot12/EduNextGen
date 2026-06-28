// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Bus, MapPin, PhoneCall } from "lucide-react";
import { motion } from "framer-motion";
import { BusMap, type BusMarker } from "@/components/BusMap";
import { useBusLocations, isLiveFix } from "@/hooks/useBusLocations";

type RouteRow = {
  id: string;
  route_name: string;
  vehicle_number: string;
  driver_name: string;
  driver_phone: string;
  total_capacity: number;
  child_name?: string;
};

function fmtTime(ts?: string) {
  return ts ? new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";
}

export function ParentTransportPage() {
  const params = useParams();
  const tenant = params.tenantId as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [schoolId, setSchoolId] = useState<string | undefined>();
  const [routes, setRoutes] = useState<RouteRow[]>([]);

  const liveLocs = useBusLocations(schoolId);

  useEffect(() => {
    fetchTransport();
  }, [tenant]);

  async function fetchTransport() {
    setLoading(true);
    try {
      const { data: school } = await supabase
        .from("schools").select("id").eq("subdomain", tenant).single();
      if (!school) return;
      setSchoolId(school.id);

      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) return;

      // this parent's children
      const { data: kids } = await supabase
        .from("students")
        .select("id, first_name, last_name")
        .eq("school_id", school.id)
        .eq("parent_user_id", uid);
      if (!kids || kids.length === 0) return;

      const kidById: Record<string, string> = {};
      kids.forEach((k: any) => { kidById[k.id] = `${k.first_name} ${k.last_name}`.trim(); });

      // their assigned routes
      const { data: assigns } = await supabase
        .from("student_transport")
        .select("route_id, student_id")
        .in("student_id", kids.map((k: any) => k.id));
      if (!assigns || assigns.length === 0) return;

      const routeIds = [...new Set(assigns.map((a: any) => a.route_id))];
      const routeChild: Record<string, string> = {};
      assigns.forEach((a: any) => { routeChild[a.route_id] = kidById[a.student_id]; });

      const { data: routeRows } = await supabase
        .from("transport_routes").select("*").in("id", routeIds);

      setRoutes(((routeRows as RouteRow[]) || []).map((r) => ({ ...r, child_name: routeChild[r.id] })));
    } catch (error) {
      console.error("Error fetching transport:", error);
    } finally {
      setLoading(false);
    }
  }

  const markers: BusMarker[] = routes
    .filter((r) => liveLocs[r.id])
    .map((r) => {
      const live = liveLocs[r.id];
      const stale = !isLiveFix(live.recorded_at);
      return {
        id: r.id,
        label: r.vehicle_number || r.route_name,
        lat: live.latitude,
        lng: live.longitude,
        sub: `${(live.speed_kmh ?? 0).toFixed(0)} km/h · ${fmtTime(live.recorded_at)}${stale ? " (stale)" : ""}`,
        stale,
      };
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Transport Tracker</h1>
          <p className="text-sm text-muted-foreground mt-1">Live status of your child's assigned school bus.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500/50" />
        </div>
      ) : routes.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border shadow-xl">
          <Bus className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-bold text-foreground mb-1">No transport assigned</h3>
          <p className="text-muted-foreground text-sm">Your child is not currently enrolled in the school transport facility.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Route info cards */}
          <div className="lg:col-span-1 space-y-6">
            {routes.map((r) => {
              const live = liveLocs[r.id];
              const liveNow = live && isLiveFix(live.recorded_at);
              return (
                <motion.div key={r.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                  <Card className="bg-card backdrop-blur-xl border-border shadow-xl overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-500/20 to-transparent rounded-bl-full pointer-events-none" />
                    <CardContent className="p-6 relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                          <Bus className="w-6 h-6 text-amber-400" />
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${liveNow ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                          {liveNow ? `● Live · ${(live.speed_kmh ?? 0).toFixed(0)} km/h` : "○ Offline"}
                        </span>
                      </div>
                      <h3 className="text-2xl font-bold text-foreground mb-1">{r.vehicle_number || "Bus"}</h3>
                      <p className="text-amber-400 font-medium mb-1">Route: {r.route_name}</p>
                      {r.child_name && <p className="text-xs text-muted-foreground mb-5">For: {r.child_name}</p>}

                      <div className="space-y-4">
                        <div className="bg-muted p-3 rounded-lg border border-border">
                          <p className="text-xs text-muted-foreground mb-1">Driver Details</p>
                          <p className="text-sm text-foreground font-medium">{r.driver_name || "—"}</p>
                          {r.driver_phone && (
                            <a href={`tel:${r.driver_phone}`} className="text-sm text-amber-600 flex items-center mt-1 hover:underline">
                              <PhoneCall className="w-3 h-3 mr-1" /> {r.driver_phone}
                            </a>
                          )}
                        </div>
                        <div className="bg-muted p-3 rounded-lg border border-border">
                          <p className="text-xs text-muted-foreground mb-1">Last Update</p>
                          <p className="text-sm text-foreground font-medium">{fmtTime(live?.recorded_at)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Live map */}
          <div className="lg:col-span-2">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="h-full">
              <Card className="bg-card backdrop-blur-xl border-border shadow-xl h-full flex flex-col min-h-[420px]">
                <CardContent className="p-4 flex-1">
                  {markers.length > 0 ? (
                    <BusMap buses={markers} height={420} />
                  ) : (
                    <div className="h-[420px] flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 rounded-full bg-muted border border-border flex items-center justify-center mx-auto mb-4 relative">
                        <motion.div
                          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className="absolute inset-0 rounded-full border-2 border-amber-500"
                        />
                        <MapPin className="w-8 h-8 text-amber-500" />
                      </div>
                      <h3 className="text-lg font-bold text-foreground mb-2">Live Tracking Offline</h3>
                      <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                        The bus will appear on the map once it starts sending its GPS location for pickup or drop-off.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      )}
    </div>
  );
}
