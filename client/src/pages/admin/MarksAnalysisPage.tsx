import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type Exam = { id: string; name: string; start_date: string };
type Mark = { student_id: string; subject: string; marks_obtained: number; max_marks: number; students?: { name: string; classes?: { grade_level: string; section: string } | null } | null };
const classLabel = (c?: { grade_level?: string; section?: string } | null) =>
  c ? `${c.grade_level ?? ""}${c.section ? " - " + c.section : ""}`.trim() || "—" : "—";

type SubjectStats = {
  subject: string;
  maxMarks: number;
  total: number;
  appeared: number;
  sum: number;
  highest: number;
  lowest: number;
  passed: number;
};

export function MarksAnalysisPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<{ id: string; grade_level: string; section: string }[]>([]);
  const [selectedExam, setSelectedExam] = useState("");
  const [selectedClass, setSelectedClass] = useState("all");
  const [marks, setMarks] = useState<Mark[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    Promise.all([
      supabase.from("exams").select("id, name, start_date").eq("school_id", schoolId).order("start_date", { ascending: false }),
      supabase.from("classes").select("id, grade_level, section").eq("school_id", schoolId).order("grade_level"),
    ]).then(([eRes, cRes]) => {
      setExams(eRes.data || []);
      setClasses(cRes.data || []);
    });
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId || !selectedExam) { setMarks([]); return; }
    setLoading(true);
    let q = supabase.from("exam_marks")
      .select("student_id, subject, marks_obtained, max_marks, students(name, classes(grade_level, section))")
      .eq("school_id", schoolId).eq("exam_id", selectedExam);
    supabase.from("exam_marks")
      .select("student_id, subject, marks_obtained, max_marks, students(name, class_id, classes(grade_level, section))")
      .eq("school_id", schoolId).eq("exam_id", selectedExam)
      .then(async ({ data }) => {
        if (!data) { setMarks([]); setLoading(false); return; }
        if (selectedClass === "all") {
          setMarks(data as Mark[]);
        } else {
          // filter by class — join through students
          const stuRes = await supabase.from("students").select("id").eq("school_id", schoolId).eq("class_id", selectedClass);
          const stuIds = new Set((stuRes.data || []).map((s: { id: string }) => s.id));
          setMarks((data as Mark[]).filter(m => stuIds.has(m.student_id)));
        }
        setLoading(false);
      });
    void q;
  }, [schoolId, selectedExam, selectedClass]);

  // Compute subject stats
  const subjectMap = new Map<string, SubjectStats>();
  marks.forEach(m => {
    if (!subjectMap.has(m.subject)) {
      subjectMap.set(m.subject, { subject: m.subject, maxMarks: m.max_marks, total: 0, appeared: 0, sum: 0, highest: 0, lowest: Infinity, passed: 0 });
    }
    const s = subjectMap.get(m.subject)!;
    s.total++;
    s.appeared++;
    s.sum += m.marks_obtained;
    if (m.marks_obtained > s.highest) s.highest = m.marks_obtained;
    if (m.marks_obtained < s.lowest) s.lowest = m.marks_obtained;
    const passMark = s.maxMarks * 0.33;
    if (m.marks_obtained >= passMark) s.passed++;
  });
  const stats = Array.from(subjectMap.values()).sort((a, b) => a.subject.localeCompare(b.subject));

  // Overall stats
  const totalStudents = new Set(marks.map(m => m.student_id)).size;
  const overallAvg = stats.length > 0 ? stats.reduce((s, x) => s + (x.appeared > 0 ? x.sum / x.appeared : 0), 0) / stats.length : 0;

  function avgPct(s: SubjectStats) { return s.appeared > 0 ? (s.sum / s.appeared / s.maxMarks) * 100 : 0; }
  function passPct(s: SubjectStats) { return s.appeared > 0 ? (s.passed / s.appeared) * 100 : 0; }

  const weakSubjects = stats.filter(s => avgPct(s) < 50);
  const strongSubjects = stats.filter(s => avgPct(s) >= 75);

  return (
    <div>
      <div className="page-header">
        <h1>Subject-wise Marks Analysis</h1>
        <p>Class average, topper, pass percentage per subject — identify weak areas</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select title="Select exam" value={selectedExam} onChange={e => setSelectedExam(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background w-64">
          <option value="">Select Exam…</option>
          {exams.map(e => <option key={e.id} value={e.id}>{e.name} ({new Date(e.start_date).toLocaleDateString("en-IN", { month: "short", year: "numeric" })})</option>)}
        </select>
        <select title="Filter by class" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
          <option value="all">All Classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}
        </select>
      </div>

      {!selectedExam && (
        <div className="bg-card rounded-xl border border-border p-12 text-center text-muted-foreground">
          Select an exam to view subject-wise analysis.
        </div>
      )}

      {selectedExam && loading && <div className="text-center text-muted-foreground py-12">Loading marks…</div>}

      {selectedExam && !loading && marks.length === 0 && (
        <div className="bg-card rounded-xl border border-border p-12 text-center text-muted-foreground">
          No marks recorded for this exam yet.
        </div>
      )}

      {selectedExam && !loading && marks.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-blue">
              <p className="text-xs text-muted-foreground">Students</p>
              <p className="text-2xl font-bold">{totalStudents}</p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-green">
              <p className="text-xs text-muted-foreground">Subjects</p>
              <p className="text-2xl font-bold">{stats.length}</p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-purple">
              <p className="text-xs text-muted-foreground">Overall Avg %</p>
              <p className="text-2xl font-bold">{overallAvg.toFixed(1)}%</p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-red">
              <p className="text-xs text-muted-foreground">Weak Subjects (&lt;50%)</p>
              <p className="text-2xl font-bold">{weakSubjects.length}</p>
            </div>
          </div>

          {/* Alert banners */}
          {weakSubjects.length > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700">
              <TrendingDown className="w-4 h-4 flex-shrink-0" />
              <span><strong>Weak subjects:</strong> {weakSubjects.map(s => s.subject).join(", ")} — average below 50%</span>
            </div>
          )}
          {strongSubjects.length > 0 && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-sm text-green-700">
              <TrendingUp className="w-4 h-4 flex-shrink-0" />
              <span><strong>Strong subjects:</strong> {strongSubjects.map(s => s.subject).join(", ")} — average above 75%</span>
            </div>
          )}

          {/* Main analysis table */}
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            <table className="w-full edu-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Max Marks</th>
                  <th>Students</th>
                  <th>Average</th>
                  <th>Average %</th>
                  <th>Highest</th>
                  <th>Lowest</th>
                  <th>Passed</th>
                  <th>Pass %</th>
                  <th>Performance</th>
                </tr>
              </thead>
              <tbody>
                {stats.map(s => {
                  const avg = s.appeared > 0 ? s.sum / s.appeared : 0;
                  const avgP = avgPct(s);
                  const passP = passPct(s);
                  const perfColor = avgP >= 75 ? "badge-green" : avgP >= 50 ? "badge-yellow" : "badge-red";
                  const perfLabel = avgP >= 75 ? "Good" : avgP >= 50 ? "Average" : "Needs Attention";
                  return (
                    <tr key={s.subject}>
                      <td className="font-semibold">{s.subject}</td>
                      <td>{s.maxMarks}</td>
                      <td>{s.appeared}</td>
                      <td>{avg.toFixed(1)}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{avgP.toFixed(1)}%</span>
                          <div className="flex-1 bg-muted rounded-full h-1.5 w-16">
                            <div className={`h-1.5 rounded-full ${avgP >= 75 ? "bg-emerald-500" : avgP >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                              style={{ width: `${Math.min(100, avgP)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="text-emerald-600 font-semibold">{s.highest.toFixed(1)}</td>
                      <td className="text-red-500">{s.lowest === Infinity ? "—" : s.lowest.toFixed(1)}</td>
                      <td>{s.passed} / {s.appeared}</td>
                      <td className="font-semibold">{passP.toFixed(1)}%</td>
                      <td><span className={perfColor}>{perfLabel}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Student-level detail — top 5 and bottom 5 per subject */}
          <div className="mt-6 space-y-4">
            <h2 className="font-bold text-base">Subject Toppers &amp; Lowest Scorers</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stats.map(s => {
                const subMarks = marks.filter(m => m.subject === s.subject).sort((a, b) => b.marks_obtained - a.marks_obtained);
                const top3 = subMarks.slice(0, 3);
                const bottom3 = subMarks.slice(-3).reverse();
                return (
                  <div key={s.subject} className="bg-card rounded-xl border border-border p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-sm">{s.subject}</h3>
                      <span className={avgPct(s) >= 75 ? "badge-green" : avgPct(s) >= 50 ? "badge-yellow" : "badge-red"}>
                        Avg: {avgPct(s).toFixed(1)}%
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-emerald-600 font-semibold mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Top Scorers</p>
                        {top3.map((m, i) => {
                          const sn = m.students as { name: string } | null;
                          return <p key={i} className="text-muted-foreground">{i + 1}. {sn?.name || "—"} — <strong>{m.marks_obtained}/{m.max_marks}</strong></p>;
                        })}
                      </div>
                      <div>
                        <p className="text-red-500 font-semibold mb-1 flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Needs Help</p>
                        {bottom3.map((m, i) => {
                          const sn = m.students as { name: string } | null;
                          return <p key={i} className="text-muted-foreground">{i + 1}. {sn?.name || "—"} — <strong>{m.marks_obtained}/{m.max_marks}</strong></p>;
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
