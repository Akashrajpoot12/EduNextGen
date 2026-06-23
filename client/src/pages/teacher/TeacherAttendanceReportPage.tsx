import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Users, CalendarCheck, Search, Download, Printer } from "lucide-react";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function TeacherAttendanceReportPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [month, setMonth] = useState(new Date().getMonth());
  const [year] = useState(new Date().getFullYear());
  const [report, setReport] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!schoolId) return;
    supabase.from("classes").select("id, grade_level, section")
      .eq("school_id", schoolId).order("grade_level")
      .then(({ data }) => setClasses(data || []));
  }, [schoolId]);

  useEffect(() => {
    if (!selectedClass) return;
    generateReport();
  }, [selectedClass, month]);

  async function generateReport() {
    setLoading(true);
    const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${new Date(year, month + 1, 0).getDate()}`;

    const { data: students } = await supabase
      .from("students")
      .select("id, enrollment_number, users:user_id(full_name)")
      .eq("class_id", selectedClass);

    if (!students || students.length === 0) { setReport([]); setLoading(false); return; }

    // ONE aggregation query in the DB instead of 2 queries per student (N+1).
    const ids = students.map((s: any) => s.id);
    const { data: summary } = await supabase.rpc("attendance_summary", {
      p_student_ids: ids, p_start: startDate, p_end: endDate,
    });
    const sumMap: Record<string, { total: number; present: number }> = {};
    (summary || []).forEach((row: any) => { sumMap[row.student_id] = { total: Number(row.total), present: Number(row.present) }; });

    const reportData = students.map((s: any) => {
      const agg = sumMap[s.id] || { total: 0, present: 0 };
      const pct = agg.total ? Math.round((agg.present / agg.total) * 100) : 0;
      return {
        id: s.id,
        name: s.users?.full_name || "—",
        roll: s.enrollment_number,
        total: agg.total,
        present: agg.present,
        absent: agg.total - agg.present,
        pct,
      };
    });

    setReport(reportData.sort((a, b) => a.name.localeCompare(b.name)));
    setLoading(false);
  }

  const filtered = report.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()));
  const avgPct = report.length ? Math.round(report.reduce((s, r) => s + r.pct, 0) / report.length) : 0;
  const below75 = report.filter(r => r.pct < 75).length;
  const className = classes.find(c => c.id === selectedClass);
  const classLabel = className ? `Class${className.grade_level}-${className.section}` : "report";

  function downloadCSV() {
    const header = ["Roll No", "Student Name", "Present Days", "Absent Days", "Total Days", "Percentage", "Status"];
    const rows = filtered.map(r => [
      r.roll, r.name, r.present, r.absent, r.total, `${r.pct}%`,
      r.pct >= 75 ? "Good" : r.pct >= 50 ? "Average" : "Low",
    ]);
    const csv = [header, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `attendance-${classLabel}-${MONTHS[month]}${year}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  const pieData = [
    { name: "≥75% (Good)", value: report.filter(r => r.pct >= 75).length, color: "#10b981" },
    { name: "50-74%", value: report.filter(r => r.pct >= 50 && r.pct < 75).length, color: "#f59e0b" },
    { name: "<50% (Low)", value: report.filter(r => r.pct < 50).length, color: "#ef4444" },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Student Attendance Report</h1>
          <p className="text-sm text-muted-foreground mt-1">Monthly attendance analysis per class</p>
        </div>
        {report.length > 0 && (
          <div className="flex gap-2">
            <button type="button" onClick={() => window.print()}
              className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors">
              <Printer className="w-4 h-4" /> Print
            </button>
            <button type="button" onClick={downloadCSV}
              className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition-opacity">
              <Download className="w-4 h-4" /> Download CSV
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
          className="h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="">-- Select Class --</option>
          {classes.map(c => <option key={c.id} value={c.id}>Class {c.grade_level} - {c.section}</option>)}
        </select>
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          className="h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
          {MONTHS.map((m, i) => <option key={i} value={i}>{m} {year}</option>)}
        </select>
        {report.length > 0 && (
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search student..." className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        )}
      </div>

      {loading && <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}

      {!loading && report.length > 0 && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Students", value: report.length, color: "text-blue-500" },
              { label: "Class Avg", value: `${avgPct}%`, color: "text-emerald-500" },
              { label: "Below 75%", value: below75, color: "text-red-500" },
              { label: "Full Attendance", value: report.filter(r => r.pct === 100).length, color: "text-purple-500" },
            ].map(s => (
              <div key={s.label} className="bg-card border border-border rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {/* Pie chart */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold mb-3">Attendance Distribution</h3>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={60} label={({ name, value }) => `${value}`}>
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: d.color }} />
                    <span className="text-muted-foreground">{d.name}</span>
                    <span className="ml-auto font-semibold">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Low attendance alert */}
            <div className="md:col-span-2 bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-red-500">
                <CalendarCheck className="w-4 h-4" />Students Below 75% (Action Required)
              </h3>
              {report.filter(r => r.pct < 75).length === 0
                ? <p className="text-sm text-muted-foreground py-6 text-center">All students have good attendance!</p>
                : <div className="space-y-2">
                  {report.filter(r => r.pct < 75).map(r => (
                    <div key={r.id} className="flex items-center gap-3 p-2 rounded-lg bg-red-500/5 border border-red-500/20">
                      <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-xs font-bold text-red-500">{r.pct}%</div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{r.present}/{r.total} days present</p>
                      </div>
                      <span className="badge-red text-xs">{r.absent} absent</span>
                    </div>
                  ))}
                </div>
              }
            </div>
          </div>

          {/* Full table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold">Complete Report — {MONTHS[month]} {year}</h3>
              <span className="text-sm text-muted-foreground">{filtered.length} students</span>
            </div>
            <div className="overflow-x-auto">
              <table className="edu-table">
                <thead><tr><th>Roll</th><th>Student</th><th>Present</th><th>Absent</th><th>Total</th><th>%</th><th>Status</th></tr></thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id}>
                      <td className="text-muted-foreground font-mono text-xs">{r.roll}</td>
                      <td className="font-medium">{r.name}</td>
                      <td className="text-emerald-600 font-semibold">{r.present}</td>
                      <td className="text-red-500 font-semibold">{r.absent}</td>
                      <td>{r.total}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: r.pct >= 75 ? "#10b981" : r.pct >= 50 ? "#f59e0b" : "#ef4444" }} />
                          </div>
                          <span className="text-sm font-semibold">{r.pct}%</span>
                        </div>
                      </td>
                      <td><span className={r.pct >= 75 ? "badge-green" : r.pct >= 50 ? "badge-yellow" : "badge-red"}>{r.pct >= 75 ? "Good" : r.pct >= 50 ? "Average" : "Low"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!loading && !selectedClass && (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="font-medium">Select a class to view report</p>
        </div>
      )}
    </div>
  );
}
