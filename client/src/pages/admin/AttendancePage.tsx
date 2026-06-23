import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Save, ChevronLeft, ChevronRight, CheckCircle, Users } from "lucide-react";

type Class = { id: string; grade_level: string; section: string };
const classLabel = (c?: { grade_level?: string; section?: string } | null) =>
  c ? `${c.grade_level ?? ""}${c.section ? " - " + c.section : ""}`.trim() || "—" : "—";
type Student = { id: string; name: string; roll_number: string };
type AttendanceStatus = "present" | "absent" | "late" | "half_day";

type ClassSummary = {
  classObj: Class;
  total: number;
  present: number;
  absent: number;
  late: number;
  half_day: number;
};

const STATUS_BTNS: { value: AttendanceStatus; label: string; active: string; inactive: string }[] = [
  { value: "present",  label: "P",        active: "bg-emerald-500 text-white border-emerald-500", inactive: "border-border text-muted-foreground hover:bg-emerald-50" },
  { value: "absent",   label: "A",        active: "bg-red-500 text-white border-red-500",         inactive: "border-border text-muted-foreground hover:bg-red-50" },
  { value: "late",     label: "L",        active: "bg-amber-400 text-white border-amber-400",     inactive: "border-border text-muted-foreground hover:bg-amber-50" },
  { value: "half_day", label: "½",        active: "bg-blue-500 text-white border-blue-500",       inactive: "border-border text-muted-foreground hover:bg-blue-50" },
];

export function AttendancePage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [tab, setTab] = useState<"dashboard" | "mark">("dashboard");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dashSummary, setDashSummary] = useState<ClassSummary[]>([]);
  const [dashLoading, setDashLoading] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    supabase.from("classes").select("id, grade_level, section").eq("school_id", schoolId).order("grade_level")
      .then(({ data }) => setClasses(data || []));
  }, [schoolId]);

  // Fetch class students when class changes
  useEffect(() => {
    if (!schoolId || !selectedClass) { setStudents([]); return; }
    supabase.from("students").select("id, name, roll_number").eq("school_id", schoolId).eq("class_id", selectedClass).order("roll_number")
      .then(({ data }) => setStudents(data || []));
  }, [schoolId, selectedClass]);

  // Fetch existing attendance for selected class + date
  useEffect(() => {
    if (!schoolId || !selectedClass || !date || students.length === 0) return;
    supabase.from("daily_attendance").select("student_id, status").eq("school_id", schoolId).eq("date", date)
      .in("student_id", students.map((s) => s.id))
      .then(({ data }) => {
        const map: Record<string, AttendanceStatus> = {};
        students.forEach((s) => { map[s.id] = "present"; }); // default to present
        (data || []).forEach((r) => { map[r.student_id] = r.status as AttendanceStatus; });
        setAttendance(map);
      });
  }, [schoolId, selectedClass, date, students.length]);

  // Dashboard: fetch today's class-wise attendance summary
  useEffect(() => {
    if (!schoolId || tab !== "dashboard") return;
    setDashLoading(true);
    async function loadDashboard() {
      const [classRes, attRes, studRes] = await Promise.all([
        supabase.from("classes").select("id, grade_level, section").eq("school_id", schoolId).order("grade_level"),
        supabase.from("daily_attendance").select("student_id, status, students(class_id)").eq("school_id", schoolId).eq("date", date),
        supabase.from("students").select("id, class_id").eq("school_id", schoolId),
      ]);
      const allClasses = classRes.data || [];
      const allStudents = studRes.data || [];
      const attData = attRes.data || [];

      const attMap: Record<string, AttendanceStatus> = {};
      attData.forEach((a) => { attMap[a.student_id] = a.status as AttendanceStatus; });

      const classStudentCount: Record<string, number> = {};
      allStudents.forEach((s) => { classStudentCount[s.class_id] = (classStudentCount[s.class_id] || 0) + 1; });

      const classAtt: Record<string, { present: number; absent: number; late: number; half_day: number }> = {};
      attData.forEach((a) => {
        const s = allStudents.find((st) => st.id === a.student_id);
        if (!s) return;
        if (!classAtt[s.class_id]) classAtt[s.class_id] = { present: 0, absent: 0, late: 0, half_day: 0 };
        classAtt[s.class_id][a.status as AttendanceStatus]++;
      });

      const summary: ClassSummary[] = allClasses.map((c) => ({
        classObj: c,
        total: classStudentCount[c.id] || 0,
        present: classAtt[c.id]?.present || 0,
        absent: classAtt[c.id]?.absent || 0,
        late: classAtt[c.id]?.late || 0,
        half_day: classAtt[c.id]?.half_day || 0,
      }));
      setDashSummary(summary);
      setDashLoading(false);
    }
    loadDashboard();
  }, [schoolId, tab, date]);

  function setStatus(studentId: string, status: AttendanceStatus) {
    setAttendance((prev) => ({ ...prev, [studentId]: status }));
  }

  function markAll(status: AttendanceStatus) {
    const all: Record<string, AttendanceStatus> = {};
    students.forEach((s) => { all[s.id] = status; });
    setAttendance(all);
  }

  async function handleSave() {
    if (students.length === 0) return;
    setSaving(true);
    const upserts = students.map((s) => ({
      school_id: schoolId,
      student_id: s.id,
      date,
      status: attendance[s.id] || "present",
    }));
    await supabase.from("daily_attendance").upsert(upserts, { onConflict: "student_id,date" });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function shiftDate(days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split("T")[0]);
  }

  const todayStr = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  const summary = { present: 0, absent: 0, late: 0, half_day: 0 };
  students.forEach((s) => { const st = attendance[s.id] || "present"; summary[st]++; });

  return (
    <div>
      <div className="page-header">
        <h1>Attendance</h1>
        <p>Mark and monitor student attendance class-wise</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 mb-6 w-fit">
        {(["dashboard", "mark"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {t === "dashboard" ? "Class-wise Dashboard" : "Mark Attendance"}
          </button>
        ))}
      </div>

      {/* Date picker (shared) */}
      <div className="flex items-center gap-3 mb-5">
        <button type="button" title="Previous day" onClick={() => shiftDate(-1)} className="p-1.5 rounded-lg hover:bg-muted border border-border">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <input type="date" title="Select date" value={date} onChange={(e) => setDate(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background" />
        <button type="button" title="Next day" onClick={() => shiftDate(1)} className="p-1.5 rounded-lg hover:bg-muted border border-border">
          <ChevronRight className="w-4 h-4" />
        </button>
        <span className="text-sm text-muted-foreground">{new Date(date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
      </div>

      {/* ── DASHBOARD TAB ── */}
      {tab === "dashboard" && (
        <>
          {dashLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              {/* Overall totals */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Total Students", val: dashSummary.reduce((a, c) => a + c.total, 0), color: "card-accent-blue" },
                  { label: "Present", val: dashSummary.reduce((a, c) => a + c.present, 0), color: "card-accent-green" },
                  { label: "Absent", val: dashSummary.reduce((a, c) => a + c.absent, 0), color: "card-accent-red" },
                  { label: "Late / Half Day", val: dashSummary.reduce((a, c) => a + c.late + c.half_day, 0), color: "card-accent-orange" },
                ].map((item) => (
                  <div key={item.label} className={`bg-card rounded-xl p-4 border border-border shadow-sm ${item.color}`}>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-2xl font-bold mt-1">{item.val}</p>
                  </div>
                ))}
              </div>

              {/* Class-wise table */}
              <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                <table className="w-full edu-table">
                  <thead>
                    <tr>
                      <th>Class</th>
                      <th>Total</th>
                      <th>Present</th>
                      <th>Absent</th>
                      <th>Late</th>
                      <th>Half Day</th>
                      <th>Attendance %</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashSummary.length === 0 && (
                      <tr><td colSpan={8} className="text-center text-muted-foreground py-10">No classes found.</td></tr>
                    )}
                    {dashSummary.map((row) => {
                      const marked = row.present + row.absent + row.late + row.half_day;
                      const pct = row.total > 0 ? Math.round(((row.present + row.late) / row.total) * 100) : null;
                      const pctColor = pct === null ? "" : pct >= 90 ? "text-emerald-600" : pct >= 75 ? "text-amber-600" : "text-red-500";
                      return (
                        <tr key={row.classObj.id}>
                          <td className="font-medium">{classLabel(row.classObj)}</td>
                          <td>{row.total}</td>
                          <td className="text-emerald-600 font-semibold">{row.present}</td>
                          <td className="text-red-500 font-semibold">{row.absent}</td>
                          <td className="text-amber-600">{row.late}</td>
                          <td className="text-blue-600">{row.half_day}</td>
                          <td>
                            {pct !== null ? (
                              <span className={`font-bold ${pctColor}`}>{pct}%</span>
                            ) : marked === 0 ? (
                              <span className="text-muted-foreground text-xs">Not marked</span>
                            ) : "—"}
                          </td>
                          <td>
                            <button type="button" onClick={() => { setSelectedClass(row.classObj.id); setTab("mark"); }}
                              className="text-xs text-primary border border-primary/30 px-2 py-1 rounded hover:bg-primary/5">
                              Mark
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* ── MARK TAB ── */}
      {tab === "mark" && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <select title="Select class" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
              <option value="">Select class…</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}
            </select>
            {students.length > 0 && (
              <>
                <button type="button" onClick={() => markAll("present")} className="text-xs border border-emerald-200 text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100">All Present</button>
                <button type="button" onClick={() => markAll("absent")} className="text-xs border border-red-200 text-red-600 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100">All Absent</button>
                <div className="ml-auto flex gap-4 text-xs">
                  <span className="text-emerald-600 font-semibold">{summary.present} Present</span>
                  <span className="text-red-500 font-semibold">{summary.absent} Absent</span>
                  <span className="text-amber-600">{summary.late} Late</span>
                  <span className="text-blue-600">{summary.half_day} Half</span>
                </div>
                <button type="button" onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                  {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {saved ? "Saved!" : saving ? "Saving…" : "Save"}
                </button>
              </>
            )}
          </div>

          {!selectedClass ? (
            <div className="bg-card rounded-xl border border-border p-12 text-center text-muted-foreground">
              Select a class to mark attendance.
            </div>
          ) : students.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-12 text-center text-muted-foreground">
              No students in this class. Enroll students first.
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
              <table className="w-full edu-table">
                <thead>
                  <tr>
                    <th className="w-8">#</th>
                    <th>Student Name</th>
                    <th>Roll No.</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, idx) => {
                    const current = attendance[s.id] || "present";
                    return (
                      <tr key={s.id}>
                        <td className="text-muted-foreground text-sm">{idx + 1}</td>
                        <td className="font-medium">{s.name}</td>
                        <td className="text-sm text-muted-foreground">{s.roll_number || "—"}</td>
                        <td>
                          <div className="flex gap-1">
                            {STATUS_BTNS.map((btn) => (
                              <button key={btn.value} type="button" onClick={() => setStatus(s.id, btn.value)}
                                className={`w-8 h-8 rounded-lg border text-xs font-bold transition-all ${current === btn.value ? btn.active : btn.inactive}`}>
                                {btn.label}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
