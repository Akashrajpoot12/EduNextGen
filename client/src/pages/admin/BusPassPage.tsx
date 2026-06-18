import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Printer, Bus } from "lucide-react";

type Route = { id: string; route_name: string; vehicle_number: string; driver_name: string; driver_phone: string; monthly_fee: number };
type Stop = { id: string; stop_name: string; stop_order: number };
type StudentTransport = {
  id: string;
  student_id: string;
  route_id: string;
  stop_id: string | null;
  students?: { name: string; roll_number: string; admission_number: string; father_name: string; phone: string; classes?: { name: string } | null } | null;
  transport_stops?: { stop_name: string } | null;
};
type School = { name: string; address?: string; phone?: string };

export function BusPassPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [routes, setRoutes] = useState<Route[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [transport, setTransport] = useState<StudentTransport[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [selectedRoute, setSelectedRoute] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear() + "-" + String(new Date().getFullYear() + 1).slice(2));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    setLoading(true);
    Promise.all([
      supabase.from("transport_routes").select("id, route_name, vehicle_number, driver_name, driver_phone, monthly_fee").eq("school_id", schoolId).order("route_name"),
      supabase.from("student_transport").select("id, student_id, route_id, stop_id, students(name, roll_number, admission_number, father_name, phone, classes(name)), transport_stops(stop_name)").eq("school_id", schoolId),
      supabase.from("schools").select("name, address, phone").eq("id", schoolId).single(),
    ]).then(([rRes, tRes, scRes]) => {
      setRoutes(rRes.data as Route[] || []);
      setTransport(tRes.data as StudentTransport[] || []);
      if (scRes.data) setSchool(scRes.data as School);
      const all = tRes.data as StudentTransport[] || [];
      setSelectedIds(new Set(all.map(t => t.id)));
      setLoading(false);
    });
  }, [schoolId]);

  const filtered = selectedRoute === "all" ? transport : transport.filter(t => t.route_id === selectedRoute);
  const printItems = filtered.filter(t => selectedIds.has(t.id));
  const currentRoute = routes.find(r => r.id === selectedRoute);

  function toggle(id: string) { setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function selectAll() { setSelectedIds(new Set(filtered.map(t => t.id))); }
  function clearAll() { setSelectedIds(new Set()); }

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Bus Pass / Route Slip</h1>
          <p>Print transport passes for students using school bus service</p>
        </div>
        <button type="button" onClick={() => window.print()} disabled={printItems.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
          <Printer className="w-4 h-4" /> Print {printItems.length > 0 ? `${printItems.length} Passes` : "Passes"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-blue">
          <div className="flex items-center gap-2"><Bus className="w-4 h-4 text-blue-500" /><p className="text-xs text-muted-foreground">Total Routes</p></div>
          <p className="text-2xl font-bold mt-1">{routes.length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-green">
          <p className="text-xs text-muted-foreground">Transport Students</p>
          <p className="text-2xl font-bold mt-1">{transport.length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-orange">
          <p className="text-xs text-muted-foreground">Selected for Print</p>
          <p className="text-2xl font-bold mt-1">{printItems.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4 no-print">
        <select title="Filter by route" value={selectedRoute} onChange={e => { setSelectedRoute(e.target.value); setSelectedIds(new Set()); }}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
          <option value="all">All Routes</option>
          {routes.map(r => <option key={r.id} value={r.id}>{r.route_name}</option>)}
        </select>
        <div>
          <label className="text-xs text-muted-foreground mr-2">Academic Year:</label>
          <input value={academicYear} onChange={e => setAcademicYear(e.target.value)}
            placeholder="2025-26" className="border border-border rounded-lg px-3 py-2 text-sm bg-background w-28" />
        </div>
        <button type="button" onClick={selectAll} className="text-xs border border-border px-3 py-1.5 rounded-lg hover:bg-muted">Select All ({filtered.length})</button>
        {selectedIds.size > 0 && <button type="button" onClick={clearAll} className="text-xs border border-border px-3 py-1.5 rounded-lg hover:bg-muted">Clear</button>}
        <span className="text-sm text-muted-foreground ml-auto">{selectedIds.size} selected</span>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm no-print">
        <table className="w-full edu-table">
          <thead><tr><th className="w-8"></th><th>Student</th><th>Class</th><th>Route</th><th>Stop</th><th>Monthly Fee</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="text-center text-muted-foreground py-10">Loading…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={6} className="text-center text-muted-foreground py-10">No transport assignments found. Assign students to routes in Transport Management.</td></tr>}
            {filtered.map(t => {
              const stu = t.students as { name: string; classes?: { name: string } | null } | null;
              const cls = (stu?.classes as { name: string } | null)?.name || "—";
              const stop = (t.transport_stops as { stop_name: string } | null)?.stop_name || "—";
              const route = routes.find(r => r.id === t.route_id);
              return (
                <tr key={t.id} className={selectedIds.has(t.id) ? "bg-primary/5" : ""}>
                  <td><input type="checkbox" title="Select" checked={selectedIds.has(t.id)} onChange={() => toggle(t.id)} /></td>
                  <td className="font-medium">{stu?.name || "—"}</td>
                  <td>{cls}</td>
                  <td>{route?.route_name || "—"}</td>
                  <td>{stop}</td>
                  <td>₹{(route?.monthly_fee || 0).toLocaleString("en-IN")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ─── PRINT LAYOUT ─── */}
      {printItems.length > 0 && (
        <div className="hidden print:block print-full">
          {/* 2 passes per row */}
          {Array.from({ length: Math.ceil(printItems.length / 2) }, (_, rowIdx) => (
            <div key={rowIdx} className={`flex gap-4 px-4 ${rowIdx > 0 ? "mt-4" : "mt-6"}`}>
              {[0, 1].map(col => {
                const t = printItems[rowIdx * 2 + col];
                if (!t) return <div key={col} className="flex-1" />;
                const stu = t.students as { name: string; roll_number: string; admission_number: string; father_name: string; phone: string; classes?: { name: string } | null } | null;
                const cls = (stu?.classes as { name: string } | null)?.name || "";
                const stop = (t.transport_stops as { stop_name: string } | null)?.stop_name || "";
                const route = routes.find(r => r.id === t.route_id);
                return (
                  <div key={col} className="flex-1 border-2 border-gray-700 rounded-lg p-4 text-gray-900">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-gray-400 pb-2 mb-2">
                      <div>
                        <h1 className="text-sm font-bold uppercase">{school?.name}</h1>
                        <p className="text-[10px] text-gray-500">🚌 Bus Transport Pass — {academicYear}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-gray-400 uppercase font-bold">Bus Pass</p>
                        <Bus className="w-6 h-6 text-blue-700 ml-auto" />
                      </div>
                    </div>
                    {/* Student info */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] mb-2">
                      <div><span className="text-gray-500">Name:</span> <strong>{stu?.name || "—"}</strong></div>
                      <div><span className="text-gray-500">Class:</span> <strong>{cls}</strong></div>
                      <div><span className="text-gray-500">Adm No:</span> <strong>{stu?.admission_number || "—"}</strong></div>
                      <div><span className="text-gray-500">Roll No:</span> <strong>{stu?.roll_number || "—"}</strong></div>
                      {stu?.father_name && <div><span className="text-gray-500">Father:</span> <strong>{stu.father_name}</strong></div>}
                      {stu?.phone && <div><span className="text-gray-500">Phone:</span> <strong>{stu.phone}</strong></div>}
                    </div>
                    {/* Route info */}
                    <div className="bg-blue-50 border border-blue-200 rounded px-2 py-1.5 text-[10px] mb-2">
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                        <div><span className="text-gray-500">Route:</span> <strong className="text-blue-700">{route?.route_name || "—"}</strong></div>
                        <div><span className="text-gray-500">Stop:</span> <strong>{stop || "—"}</strong></div>
                        {route?.vehicle_number && <div><span className="text-gray-500">Vehicle:</span> <strong>{route.vehicle_number}</strong></div>}
                        {route?.driver_name && <div><span className="text-gray-500">Driver:</span> <strong>{route.driver_name}</strong></div>}
                        {route?.driver_phone && <div><span className="text-gray-500">Driver Ph:</span> <strong>{route.driver_phone}</strong></div>}
                        <div><span className="text-gray-500">Fee/Month:</span> <strong>₹{(route?.monthly_fee || 0).toLocaleString("en-IN")}</strong></div>
                      </div>
                    </div>
                    {/* Signature */}
                    <div className="flex justify-between text-[9px] mt-2">
                      <div className="border-t border-gray-400 pt-0.5 w-24 text-center"><p>Student Signature</p></div>
                      <div className="border-t border-gray-400 pt-0.5 w-28 text-center"><p>Transport In-charge</p></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
