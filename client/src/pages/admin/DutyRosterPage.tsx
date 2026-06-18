import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Plus, X, Printer, ClipboardList, ChevronLeft, ChevronRight } from "lucide-react";

type Staff = { id: string; name: string; role?: string };
type DutyEntry = {
  id: string; staff_id: string; duty_date: string; duty_type: string;
  shift: string; location: string; remarks: string;
  staff_name?: string; staff_role?: string;
};

const DUTY_TYPES = ["gate", "exam_invigilation", "lab", "sports", "canteen", "assembly", "library", "other"];
const SHIFTS = ["morning", "afternoon", "full_day"];

const DUTY_COLORS: Record<string, string> = {
  gate: "badge-blue", exam_invigilation: "badge-red", lab: "badge-green",
  sports: "badge-orange", canteen: "badge-yellow", assembly: "badge-purple",
  library: "badge-pink", other: "badge-gray",
};
const SHIFT_BADGE: Record<string, string> = {
  morning: "badge-blue", afternoon: "badge-orange", full_day: "badge-purple",
};

const EMPTY = { staff_id: "", duty_date: "", duty_type: "gate", shift: "morning", location: "", remarks: "" };

function isoWeek(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getWeekDates(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function DutyRosterPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [entries, setEntries]     = useState<DutyEntry[]>([]);
  const [staff, setStaff]         = useState<Staff[]>([]);
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<DutyEntry | null>(null);
  const [form, setForm]           = useState({ ...EMPTY });
  const [saving, setSaving]       = useState(false);
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOfWeek(new Date()));
  const [viewMode, setViewMode]   = useState<"week" | "list">("week");

  const weekDates = getWeekDates(weekStart);
  const weekEnd   = weekDates[6];

  const toDateStr = (d: Date) => d.toISOString().slice(0, 10);
  const weekStartStr = toDateStr(weekStart);
  const weekEndStr   = toDateStr(weekEnd);

  async function fetchData() {
    const [drRes, staffRes] = await Promise.all([
      supabase.from("duty_roster").select("*").eq("school_id", schoolId)
        .gte("duty_date", weekStartStr).lte("duty_date", weekEndStr).order("duty_date"),
      supabase.from("users").select("id, name, role").eq("school_id", schoolId)
        .in("role", ["teacher", "staff", "school_admin"]).order("name"),
    ]);
    const sm = Object.fromEntries((staffRes.data || []).map((s: Staff) => [s.id, s]));
    setStaff(staffRes.data || []);
    setEntries((drRes.data || []).map((e: DutyEntry) => ({
      ...e,
      staff_name: sm[e.staff_id]?.name || "—",
      staff_role: sm[e.staff_id]?.role || "",
    })));
  }

  useEffect(() => { if (schoolId) fetchData(); }, [schoolId, weekStartStr]);

  async function handleSave() {
    if (!form.staff_id || !form.duty_date || !form.duty_type) return;
    setSaving(true);
    const payload = { ...form, school_id: schoolId };
    if (editing) {
      await supabase.from("duty_roster").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("duty_roster").insert(payload);
    }
    setSaving(false);
    setShowForm(false);
    setEditing(null);
    setForm({ ...EMPTY });
    fetchData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this duty assignment?")) return;
    await supabase.from("duty_roster").delete().eq("id", id);
    fetchData();
  }

  function openEdit(e: DutyEntry) {
    setEditing(e);
    setForm({ staff_id: e.staff_id, duty_date: e.duty_date, duty_type: e.duty_type, shift: e.shift, location: e.location || "", remarks: e.remarks || "" });
    setShowForm(true);
  }

  const prevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); };
  const nextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); };
  const goToday  = () => setWeekStart(getMondayOfWeek(new Date()));
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const todayStr  = toDateStr(new Date());

  return (
    <div>
      <div className="page-header flex items-center justify-between no-print">
        <div>
          <h1>Duty Roster</h1>
          <p>Weekly staff duty assignments — gate, invigilation, lab, sports and more</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button type="button"
            onClick={() => { setEditing(null); setForm({ ...EMPTY, duty_date: todayStr }); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> Assign Duty
          </button>
        </div>
      </div>

      {/* Week nav */}
      <div className="flex items-center justify-between mb-4 no-print">
        <div className="flex items-center gap-2">
          <button type="button" onClick={prevWeek} className="p-1.5 rounded border border-border hover:bg-muted"><ChevronLeft className="w-4 h-4" /></button>
          <button type="button" onClick={goToday} className="px-3 py-1.5 text-sm border border-border rounded hover:bg-muted">Today</button>
          <button type="button" onClick={nextWeek} className="p-1.5 rounded border border-border hover:bg-muted"><ChevronRight className="w-4 h-4" /></button>
          <span className="text-sm font-medium ml-2">
            Week {isoWeek(weekStart)} · {weekStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – {weekEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        </div>
        <div className="flex gap-1">
          {(["week", "list"] as const).map(m => (
            <button key={m} type="button" onClick={() => setViewMode(m)}
              className={`px-3 py-1.5 text-sm rounded ${viewMode === m ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"} capitalize`}>{m}</button>
          ))}
        </div>
      </div>

      {/* Week view */}
      {viewMode === "week" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-7 divide-x divide-border border-b border-border">
            {weekDates.map((d, i) => (
              <div key={i} className={`p-2 text-center ${toDateStr(d) === todayStr ? "bg-primary/10" : ""}`}>
                <p className="text-xs text-muted-foreground">{DAY_NAMES[i]}</p>
                <p className={`text-sm font-bold ${toDateStr(d) === todayStr ? "text-primary" : ""}`}>{d.getDate()}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 divide-x divide-border min-h-48">
            {weekDates.map((d, i) => {
              const ds = toDateStr(d);
              const dayDuties = entries.filter(e => e.duty_date === ds);
              return (
                <div key={i} className={`p-2 space-y-1 ${toDateStr(d) === todayStr ? "bg-primary/5" : ""}`}>
                  {dayDuties.map(e => (
                    <div key={e.id}
                      onClick={() => openEdit(e)}
                      className="bg-card rounded p-1.5 border border-border cursor-pointer hover:shadow-sm text-xs">
                      <div className={`inline-block text-[10px] px-1 rounded capitalize ${DUTY_COLORS[e.duty_type] || "badge-gray"} mb-0.5`}>{e.duty_type.replace("_", " ")}</div>
                      <div className="font-medium truncate">{e.staff_name}</div>
                      <div className={`text-[10px] capitalize ${SHIFT_BADGE[e.shift]}`}>{e.shift.replace("_", " ")}</div>
                    </div>
                  ))}
                  {dayDuties.length === 0 && (
                    <button type="button" onClick={() => { setEditing(null); setForm({ ...EMPTY, duty_date: ds }); setShowForm(true); }}
                      className="w-full py-1 text-[11px] text-muted-foreground hover:text-primary hover:bg-primary/5 rounded">+</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List view */}
      {viewMode === "list" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full edu-table">
            <thead><tr><th>Date</th><th>Staff</th><th>Duty Type</th><th>Shift</th><th>Location</th><th>Remarks</th><th className="no-print"></th></tr></thead>
            <tbody>
              {entries.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No duties assigned this week.</td></tr>}
              {entries.map(e => (
                <tr key={e.id}>
                  <td className="font-mono text-sm">{new Date(e.duty_date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</td>
                  <td>
                    <div className="font-medium text-sm">{e.staff_name}</div>
                    <div className="text-xs text-muted-foreground capitalize">{e.staff_role}</div>
                  </td>
                  <td><span className={`${DUTY_COLORS[e.duty_type] || "badge-gray"} capitalize text-xs`}>{e.duty_type.replace("_", " ")}</span></td>
                  <td><span className={`${SHIFT_BADGE[e.shift]} capitalize text-xs`}>{e.shift.replace("_", " ")}</span></td>
                  <td className="text-sm">{e.location || "—"}</td>
                  <td className="text-sm text-muted-foreground">{e.remarks || "—"}</td>
                  <td className="no-print">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => openEdit(e)} className="text-xs text-primary hover:underline">Edit</button>
                      <button type="button" onClick={() => handleDelete(e.id)} className="text-xs text-red-500 hover:text-red-700">Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Print view */}
      <div className="hidden print:block print-full">
        <div style={{ fontFamily: "Arial, sans-serif", fontSize: "11px" }}>
          <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: "8px", marginBottom: "12px" }}>
            <p style={{ fontSize: "14px", fontWeight: "bold" }}>DUTY ROSTER</p>
            <p style={{ fontSize: "10px" }}>
              Week {isoWeek(weekStart)} · {weekStart.toLocaleDateString("en-IN")} to {weekEnd.toLocaleDateString("en-IN")}
            </p>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
            <thead>
              <tr style={{ background: "#f0f0f0" }}>
                {["Date", "Day", "Staff Name", "Duty Type", "Shift", "Location", "Remarks", "Signature"].map(h => (
                  <th key={h} style={{ border: "1px solid #999", padding: "4px 6px", textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id}>
                  <td style={{ border: "1px solid #ccc", padding: "4px 6px" }}>{new Date(e.duty_date + "T00:00:00").toLocaleDateString("en-IN")}</td>
                  <td style={{ border: "1px solid #ccc", padding: "4px 6px" }}>{new Date(e.duty_date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" })}</td>
                  <td style={{ border: "1px solid #ccc", padding: "4px 6px", fontWeight: "500" }}>{e.staff_name}</td>
                  <td style={{ border: "1px solid #ccc", padding: "4px 6px", textTransform: "capitalize" }}>{e.duty_type.replace("_", " ")}</td>
                  <td style={{ border: "1px solid #ccc", padding: "4px 6px", textTransform: "capitalize" }}>{e.shift.replace("_", " ")}</td>
                  <td style={{ border: "1px solid #ccc", padding: "4px 6px" }}>{e.location || ""}</td>
                  <td style={{ border: "1px solid #ccc", padding: "4px 6px" }}>{e.remarks || ""}</td>
                  <td style={{ border: "1px solid #ccc", padding: "4px 6px", width: "80px" }}></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "20px" }}>
            <p>Total Duties: {entries.length}</p>
            <div style={{ textAlign: "center" }}>
              <div style={{ borderTop: "1px solid #000", width: "160px", paddingTop: "4px" }}>Principal</div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 no-print">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <ClipboardList className="w-5 h-5" /> {editing ? "Edit Duty" : "Assign Duty"}
              </h2>
              <button type="button" title="Close" onClick={() => { setShowForm(false); setEditing(null); }}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div><label className="text-xs text-muted-foreground block mb-1">Staff Member *</label>
                <select title="Staff" value={form.staff_id} onChange={e => f("staff_id", e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                  <option value="">— Select Staff —</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name} {s.role ? `(${s.role})` : ""}</option>)}
                </select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Date *</label>
                  <input type="date" value={form.duty_date} onChange={e => f("duty_date", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Shift *</label>
                  <select title="Shift" value={form.shift} onChange={e => f("shift", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                    {SHIFTS.map(s => <option key={s} value={s} className="capitalize">{s.replace("_", " ").charAt(0).toUpperCase() + s.replace("_", " ").slice(1)}</option>)}
                  </select></div>
              </div>
              <div><label className="text-xs text-muted-foreground block mb-1">Duty Type *</label>
                <select title="Duty type" value={form.duty_type} onChange={e => f("duty_type", e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                  {DUTY_TYPES.map(t => <option key={t} value={t} className="capitalize">{t.replace("_", " ").charAt(0).toUpperCase() + t.replace("_", " ").slice(1)}</option>)}
                </select></div>
              <div><label className="text-xs text-muted-foreground block mb-1">Location / Room</label>
                <input value={form.location} onChange={e => f("location", e.target.value)} placeholder="Main Gate / Room 101 / Science Lab…"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              <div><label className="text-xs text-muted-foreground block mb-1">Remarks</label>
                <textarea value={form.remarks} onChange={e => f("remarks", e.target.value)} rows={2}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none" /></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="flex-1 py-2.5 border border-border rounded-lg text-sm">Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving || !form.staff_id || !form.duty_date}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {saving ? "Saving…" : editing ? "Update" : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
