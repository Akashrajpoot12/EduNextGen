import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Bus, MapPin, Phone, Clock, Navigation, Info, Wifi, WifiOff } from "lucide-react";

type Route = { id: string; route_name: string; vehicle_number: string; driver_name: string; driver_phone: string; total_capacity: number };
type Stop = { id: string; route_id: string; stop_name: string; stop_order: number; pickup_time: string };

export function GpsTrackingPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [routes, setRoutes] = useState<Route[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [tab, setTab] = useState<"live" | "routes" | "setup">("live");

  // Simulated live positions for demo
  const [liveData, setLiveData] = useState<Record<string, { lat: number; lng: number; speed: number; status: string; lastUpdate: string }>>({});

  useEffect(() => {
    if (!schoolId) return;
    Promise.all([
      supabase.from("transport_routes").select("*").eq("school_id", schoolId).order("route_name"),
      supabase.from("transport_stops").select("*").eq("school_id", schoolId).order("stop_order"),
    ]).then(([rRes, sRes]) => {
      const r = rRes.data as Route[] || [];
      setRoutes(r);
      setStops(sRes.data as Stop[] || []);
      if (r.length > 0) setSelectedRoute(r[0]);
      // Simulate live data
      const live: typeof liveData = {};
      r.forEach(route => {
        live[route.id] = {
          lat: 28.6139 + (Math.random() - 0.5) * 0.1,
          lng: 77.2090 + (Math.random() - 0.5) * 0.1,
          speed: Math.floor(Math.random() * 40) + 10,
          status: Math.random() > 0.3 ? "moving" : "stopped",
          lastUpdate: new Date().toLocaleTimeString("en-IN"),
        };
      });
      setLiveData(live);
    });
  }, [schoolId]);

  const routeStops = selectedRoute ? stops.filter(s => s.route_id === selectedRoute.id) : [];

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Bus GPS Tracking</h1>
          <p>Live vehicle location, route progress and driver contact</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {routes.filter(r => liveData[r.id]?.status === "moving").length} vehicles moving
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-blue">
          <div className="flex items-center gap-2"><Bus className="w-4 h-4 text-blue-500" /><p className="text-xs text-muted-foreground">Total Buses</p></div>
          <p className="text-2xl font-bold">{routes.length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-green">
          <p className="text-xs text-muted-foreground">Moving Now</p>
          <p className="text-2xl font-bold">{Object.values(liveData).filter(d => d.status === "moving").length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-orange">
          <p className="text-xs text-muted-foreground">Stopped</p>
          <p className="text-2xl font-bold">{Object.values(liveData).filter(d => d.status === "stopped").length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-purple">
          <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-purple-500" /><p className="text-xs text-muted-foreground">Total Stops</p></div>
          <p className="text-2xl font-bold">{stops.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 mb-6 w-fit">
        {(["live", "routes", "setup"] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {t === "live" ? "Live Status" : t === "routes" ? "Routes & Stops" : "GPS Setup"}
          </button>
        ))}
      </div>

      {/* LIVE TAB */}
      {tab === "live" && (
        <div className="grid grid-cols-3 gap-4">
          {/* Vehicle cards */}
          <div className="space-y-3">
            {routes.length === 0 && <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">No routes configured. Add routes in Transport Management.</div>}
            {routes.map(r => {
              const live = liveData[r.id];
              const isMoving = live?.status === "moving";
              return (
                <button key={r.id} type="button" onClick={() => setSelectedRoute(r)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${selectedRoute?.id === r.id ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border bg-card hover:bg-muted/30"}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-sm">{r.route_name}</p>
                      <p className="text-xs text-muted-foreground">{r.vehicle_number}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isMoving ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                      {isMoving ? "● Moving" : "■ Stopped"}
                    </span>
                  </div>
                  {live && (
                    <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                      <span>🚀 {live.speed} km/h</span>
                      <span>🕐 {live.lastUpdate}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Map placeholder + route details */}
          <div className="col-span-2 space-y-4">
            {/* Map placeholder */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-xl border border-blue-200 dark:border-blue-800 h-64 flex flex-col items-center justify-center relative overflow-hidden">
              <Navigation className="w-10 h-10 text-blue-400 mb-2" />
              <p className="font-semibold text-blue-700 dark:text-blue-300">Live Map View</p>
              <p className="text-xs text-blue-500 mt-1 text-center px-6">Connect a GPS hardware device or GPS SIM to enable real-time tracking on map</p>
              {selectedRoute && liveData[selectedRoute.id] && (
                <div className="absolute bottom-3 right-3 bg-white dark:bg-card rounded-lg shadow-md p-2 text-xs font-mono border border-blue-200">
                  <p className="text-blue-600">📍 {liveData[selectedRoute.id].lat.toFixed(4)}, {liveData[selectedRoute.id].lng.toFixed(4)}</p>
                  <p className="text-muted-foreground">Simulated position</p>
                </div>
              )}
            </div>

            {/* Selected route info */}
            {selectedRoute && (
              <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold">{selectedRoute.route_name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedRoute.vehicle_number}</p>
                  </div>
                  {selectedRoute.driver_phone && (
                    <a href={`tel:${selectedRoute.driver_phone}`}
                      className="flex items-center gap-1.5 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700">
                      <Phone className="w-3.5 h-3.5" /> Call Driver
                    </a>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                  <div><span className="text-muted-foreground">Driver:</span> <strong>{selectedRoute.driver_name || "—"}</strong></div>
                  <div><span className="text-muted-foreground">Phone:</span> <strong>{selectedRoute.driver_phone || "—"}</strong></div>
                </div>
                {routeStops.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Stops ({routeStops.length})</p>
                    <div className="space-y-1">
                      {routeStops.map((stop, i) => (
                        <div key={stop.id} className="flex items-center gap-2 text-sm">
                          <div className="flex flex-col items-center">
                            <div className={`w-2.5 h-2.5 rounded-full border-2 ${i === 0 ? "border-emerald-500 bg-emerald-500" : i === routeStops.length - 1 ? "border-red-500 bg-red-500" : "border-blue-400 bg-white"}`} />
                            {i < routeStops.length - 1 && <div className="w-0.5 h-4 bg-border" />}
                          </div>
                          <span className={i === 0 ? "text-emerald-600 font-medium" : i === routeStops.length - 1 ? "text-red-600 font-medium" : ""}>{stop.stop_name}</span>
                          {stop.pickup_time && <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1"><Clock className="w-3 h-3" />{stop.pickup_time}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ROUTES TAB */}
      {tab === "routes" && (
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          <table className="w-full edu-table">
            <thead><tr><th>Route</th><th>Vehicle</th><th>Driver</th><th>Phone</th><th>Stops</th><th>Capacity</th><th>Live Status</th></tr></thead>
            <tbody>
              {routes.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No routes. Add in Transport Management.</td></tr>}
              {routes.map(r => {
                const live = liveData[r.id];
                const routeStopCount = stops.filter(s => s.route_id === r.id).length;
                return (
                  <tr key={r.id}>
                    <td className="font-semibold">{r.route_name}</td>
                    <td>{r.vehicle_number || "—"}</td>
                    <td>{r.driver_name || "—"}</td>
                    <td>{r.driver_phone ? <a href={`tel:${r.driver_phone}`} className="text-primary hover:underline">{r.driver_phone}</a> : "—"}</td>
                    <td>{routeStopCount}</td>
                    <td>{r.total_capacity}</td>
                    <td>
                      {live ? (
                        <span className={`flex items-center gap-1 text-xs ${live.status === "moving" ? "text-emerald-600" : "text-gray-500"}`}>
                          {live.status === "moving" ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                          {live.status} · {live.speed}km/h
                        </span>
                      ) : <span className="badge-gray">No data</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* SETUP TAB */}
      {tab === "setup" && (
        <div className="space-y-4 max-w-2xl">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">GPS Hardware Required</p>
              <p>Real-time tracking requires a GPS device or SIM installed in each bus. The device sends location data to this system via API.</p>
            </div>
          </div>
          {[
            { step: "1", title: "Install GPS Device", desc: "Install a GPS tracker (e.g. Teltonika FMB920, Concox GT06) in each school bus. Connect to vehicle power." },
            { step: "2", title: "Configure APN", desc: "Set the device's server IP/domain to point to your school's tracking server and configure APN for the SIM card." },
            { step: "3", title: "Get API endpoint", desc: "Contact your EduNextGen provider to get the GPS webhook endpoint URL for your school instance." },
            { step: "4", title: "Map device to route", desc: "After hardware setup, map each GPS device IMEI to a bus route in the settings here." },
            { step: "5", title: "Test live tracking", desc: "Go on a test drive — vehicle should appear moving on the Live Status tab within 30 seconds." },
          ].map(s => (
            <div key={s.step} className="bg-card rounded-xl border border-border p-4 shadow-sm flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">{s.step}</div>
              <div><p className="font-semibold text-sm">{s.title}</p><p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p></div>
            </div>
          ))}
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
            <p className="font-semibold text-sm mb-2">Supported GPS Devices</p>
            <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
              {["Teltonika FMB920", "Concox GT06N", "Queclink GV300", "Coban GPS103", "Eelink TK-Star", "Jimi JT701"].map(d => (
                <div key={d} className="flex items-center gap-1.5"><MapPin className="w-3 h-3 text-blue-400" />{d}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
