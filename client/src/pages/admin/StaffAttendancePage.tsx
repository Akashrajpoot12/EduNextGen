import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Save, CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight } from "lucide-react";

type StaffMember = {
  user_id: string;
  role: string;
  users: { id: string; full_name: string; email: string } | null;
};

type AttendanceRecord = {
  user_id: string;
  status: "present" | "absent" | "late" | "half_day";
  notes: string;
  method?: string;
};

const STATUS_OPTIONS = [
  { value: "present", label: "Present", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "absent", label: "Absent", className: "bg-red-100 text-red-700 border-red-200" },
  { value: "late", label: "Late", className: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "half_day", label: "Half Day", className: "bg-blue-100 text-blue-700 border-blue-200" },
] as const;

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function StaffAttendancePage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [viewMode, setViewMode] = useState<"mark" | "history">("mark");
  const [historyData, setHistoryData] = useState<{ date: string; present: number; absent: number; late: number; half_day: number }[]>([]);

  async function fetchStaff() {
    const { data } = await supabase
      .from("user_roles")
      .select("user_id, role, users(id, full_name, email)")
      .eq("school_id", schoolId)
      .in("role", ["teacher", "staff", "admin", "school_admin"])
      .order("role");
    setStaff((data || []) as StaffMember[]);
  }

  async function fetchAttendanceForDate(d: string) {
    const { data } = await supabase
      .from("staff_attendance")
      .select("user_id, status, notes, method")
      .eq("school_id", schoolId)
      .eq("date", d);

    const map: Record<string, AttendanceRecord> = {};
    if (data) {
      data.forEach((r) => {
        map[r.user_id] = { user_id: r.user_id, status: r.status as AttendanceRecord["status"], notes: r.notes || "", method: (r as any).method };
      });
    }
    setAttendance(map);
  }

  async function fetchHistory() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const { data } = await supabase
      .from("staff_attendance")
      .select("date, status")
      .eq("school_id", schoolId)
      .gte("date", thirtyDaysAgo)
      .order("date", { ascending: false });

    if (!data) return;
    const byDate: Record<string, { present: number; absent: number; late: number; half_day: number }> = {};
    data.forEach((r) => {
      if (!byDate[r.date]) byDate[r.date] = { present: 0, absent: 0, late: 0, half_day: 0 };
      byDate[r.date][r.status as keyof typeof byDate[string]]++;
    });
    setHistoryData(
      Object.entries(byDate)
        .map(([date, counts]) => ({ date, ...counts }))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 30)
    );
  }

  useEffect(() => { if (schoolId) { fetchStaff(); } }, [schoolId]);
  useEffect(() => { if (schoolId && staff.length > 0) fetchAttendanceForDate(date); }, [schoolId, date, staff.length]);
  useEffect(() => { if (schoolId && viewMode === "history") fetchHistory(); }, [schoolId, viewMode]);

  function setStatus(userId: string, status: AttendanceRecord["status"]) {
    setAttendance((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], user_id: userId, status, notes: prev[userId]?.notes || "" },
    }));
  }

  function setNotes(userId: string, notes: string) {
    setAttendance((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], user_id: userId, notes, status: prev[userId]?.status || "present" },
    }));
  }

  async function handleSave() {
    setSaving(true);
    const upserts = staff.map((s) => {
      const rec = attendance[s.user_id];
      return {
        school_id: schoolId,
        user_id: s.user_id,
        date,
        status: rec?.status || "present",
        notes: rec?.notes || "",
      };
    });
    await supabase.from("staff_attendance").upsert(upserts, { onConflict: "school_id,user_id,date" });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function shiftDate(days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split("T")[0]);
  }

  const summary = { present: 0, absent: 0, late: 0, half_day: 0 };
  staff.forEach((s) => {
    const st = attendance[s.user_id]?.status || "present";
    summary[st as keyof typeof summary]++;
  });

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Staff Attendance</h1>
          <p>Mark daily attendance for all teaching and non-teaching staff</p>
        </div>
        {viewMode === "mark" && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || staff.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? "Saved!" : saving ? "Saving…" : "Save Attendance"}
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-green">
          <p className="text-xs text-muted-foreground">Present</p>
          <p className="text-2xl font-bold text-emerald-600">{summary.present}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-red">
          <p className="text-xs text-muted-foreground">Absent</p>
          <p className="text-2xl font-bold text-red-600">{summary.absent}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-orange">
          <p className="text-xs text-muted-foreground">Late</p>
          <p className="text-2xl font-bold text-amber-600">{summary.late}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-blue">
          <p className="text-xs text-muted-foreground">Half Day</p>
          <p className="text-2xl font-bold text-blue-600">{summary.half_day}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 mb-6 w-fit">
        {(["mark", "history"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setViewMode(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t === "mark" ? "Mark Attendance" : "30-Day History"}
          </button>
        ))}
      </div>

      {viewMode === "mark" && (
        <>
          {/* Date selector */}
          <div className="flex items-center gap-3 mb-4">
            <button type="button" title="Previous day" onClick={() => shiftDate(-1)} className="p-1.5 rounded-lg hover:bg-muted border border-border">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              title="Select date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-background"
            />
            <button type="button" title="Next day" onClick={() => shiftDate(1)} className="p-1.5 rounded-lg hover:bg-muted border border-border">
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="text-sm text-muted-foreground">{fmtDate(date)}</span>
            <button
              type="button"
              onClick={() => {
                const updated = { ...attendance };
                staff.forEach((s) => { if (!updated[s.user_id]) updated[s.user_id] = { user_id: s.user_id, status: "present", notes: "" }; });
                setAttendance(updated);
              }}
              className="ml-auto text-xs border border-border px-3 py-1.5 rounded-lg hover:bg-muted"
            >
              Mark All Present
            </button>
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            <table className="w-full edu-table">
              <thead>
                <tr>
                  <th>Staff Name</th>
                  <th>Role</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {staff.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-muted-foreground py-10">No staff found. Add staff in the Staff section.</td></tr>
                )}
                {staff.map((s) => {
                  const rec = attendance[s.user_id];
                  const currentStatus = rec?.status || "present";
                  const u = s.users as { full_name: string; email: string } | null;
                  return (
                    <tr key={s.user_id}>
                      <td className="font-medium">
                        {u?.full_name || "Unknown"}
                        {rec?.method === "face_ai" && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200 align-middle">
                            📷 Face
                          </span>
                        )}
                      </td>
                      <td><span className="badge-blue capitalize">{s.role.replace("_", " ")}</span></td>
                      <td className="text-sm text-muted-foreground">{u?.email || "—"}</td>
                      <td>
                        <div className="flex gap-1">
                          {STATUS_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setStatus(s.user_id, opt.value)}
                              className={`px-2 py-1 rounded-lg text-xs font-medium border transition-all ${currentStatus === opt.value ? opt.className : "border-border text-muted-foreground hover:bg-muted"}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td>
                        <input
                          value={rec?.notes || ""}
                          onChange={(e) => setNotes(s.user_id, e.target.value)}
                          placeholder="Optional note"
                          className="border border-border rounded px-2 py-1 text-xs bg-background w-36"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {viewMode === "history" && (
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          <table className="w-full edu-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Present</th>
                <th>Absent</th>
                <th>Late</th>
                <th>Half Day</th>
                <th>Total Marked</th>
              </tr>
            </thead>
            <tbody>
              {historyData.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-10">No attendance history in last 30 days.</td></tr>
              )}
              {historyData.map((row) => {
                const total = row.present + row.absent + row.late + row.half_day;
                return (
                  <tr key={row.date}>
                    <td className="font-medium">{new Date(row.date).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td><span className="text-emerald-600 font-semibold">{row.present}</span></td>
                    <td><span className="text-red-500 font-semibold">{row.absent}</span></td>
                    <td><span className="text-amber-600 font-semibold">{row.late}</span></td>
                    <td><span className="text-blue-600 font-semibold">{row.half_day}</span></td>
                    <td className="text-muted-foreground">{total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
