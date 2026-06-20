import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { FileText, TrendingUp, Download } from "lucide-react";

export function TeacherMarksHistoryPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExam, setSelectedExam] = useState("");
  const [marks, setMarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMarks, setLoadingMarks] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    supabase.from("exams").select("id, name, exam_type, total_marks, classes:class_id(name)")
      .eq("school_id", schoolId).order("created_at", { ascending: false })
      .then(({ data }) => { setExams(data || []); setLoading(false); });
  }, [schoolId]);

  useEffect(() => {
    if (!selectedExam) return;
    setLoadingMarks(true);
    supabase.from("exam_marks")
      .select("marks_obtained, grade, students:student_id(users:user_id(full_name))")
      .eq("exam_id", selectedExam)
      .order("marks_obtained", { ascending: false })
      .then(({ data }) => { setMarks(data || []); setLoadingMarks(false); });
  }, [selectedExam]);

  const exam = exams.find(e => e.id === selectedExam);
  const total = exam?.total_marks || 100;
  const avg = marks.length ? Math.round(marks.reduce((s, m) => s + m.marks_obtained, 0) / marks.length) : 0;
  const highest = marks.length ? Math.max(...marks.map(m => m.marks_obtained)) : 0;
  const lowest = marks.length ? Math.min(...marks.map(m => m.marks_obtained)) : 0;
  // Pass threshold: 33% (standard for Indian schools)
  const passed = marks.filter(m => (m.marks_obtained / total) >= 0.33).length;

  function downloadCSV() {
    const header = ["Rank", "Student Name", "Marks Obtained", "Max Marks", "Percentage", "Grade", "Status"];
    const rows = marks.map((m, i) => {
      const pct = Math.round((m.marks_obtained / total) * 100);
      return [i + 1, m.students?.users?.full_name || "—", m.marks_obtained, total, `${pct}%`, m.grade || "—", pct >= 33 ? "Pass" : "Fail"];
    });
    const csv = [header, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `marks-${exam?.name?.replace(/\s+/g, "-") || "exam"}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  const chartData = marks.slice(0, 20).map(m => ({
    name: (m.students?.users?.full_name || "").split(" ")[0],
    marks: m.marks_obtained,
    fill: (m.marks_obtained / total) >= 0.75 ? "#10b981" : (m.marks_obtained / total) >= 0.50 ? "#f59e0b" : "#ef4444",
  }));

  if (loading) return <div className="flex justify-center items-center h-48"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Exam Results & Marks History</h1>
        <p className="text-sm text-muted-foreground mt-1">View and analyze student performance per exam</p>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <select title="Select exam" value={selectedExam} onChange={e => setSelectedExam(e.target.value)}
          className="w-full md:w-80 h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="">-- Select Exam --</option>
          {exams.map(e => <option key={e.id} value={e.id}>{e.name} {e.classes?.name ? `· Class ${e.classes.name}` : ""}</option>)}
        </select>
        {marks.length > 0 && (
          <button type="button" onClick={downloadCSV}
            className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90">
            <Download className="w-4 h-4" /> Download CSV
          </button>
        )}
      </div>

      {selectedExam && !loadingMarks && marks.length > 0 && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Total Students", value: marks.length },
              { label: "Average", value: `${avg}/${total}` },
              { label: "Highest", value: highest },
              { label: "Lowest", value: lowest },
              { label: "Pass %", value: `${Math.round((passed / marks.length) * 100)}%` },
            ].map(s => (
              <div key={s.label} className="bg-card border border-border rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />Student-wise Marks (Top 20)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, total]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v}/${total}`, "Marks"]} />
                <Bar dataKey="marks" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2 text-xs text-muted-foreground justify-center">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />≥75% (Good)</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" />50-74%</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />&lt;50%</span>
            </div>
          </div>

          {/* Table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border"><h3 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4" />All Students</h3></div>
            <div className="overflow-x-auto">
              <table className="edu-table">
                <thead><tr><th>#</th><th>Student</th><th>Marks</th><th>Percentage</th><th>Grade</th><th>Status</th></tr></thead>
                <tbody>
                  {marks.map((m, i) => {
                    const pct = Math.round((m.marks_obtained / total) * 100);
                    return (
                      <tr key={i}>
                        <td className="text-muted-foreground">{i + 1}</td>
                        <td className="font-medium">{m.students?.users?.full_name || "—"}</td>
                        <td>{m.marks_obtained}/{total}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 75 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444" }} />
                            </div>
                            <span className="text-sm">{pct}%</span>
                          </div>
                        </td>
                        <td><span className="font-semibold">{m.grade || "—"}</span></td>
                        <td><span className={pct >= 35 ? "badge-green" : "badge-red"}>{pct >= 35 ? "Pass" : "Fail"}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {selectedExam && !loadingMarks && marks.length === 0 && (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="font-medium">No marks entered for this exam yet</p>
          <p className="text-sm text-muted-foreground mt-1">Go to Gradebook to enter marks</p>
        </div>
      )}
    </div>
  );
}
