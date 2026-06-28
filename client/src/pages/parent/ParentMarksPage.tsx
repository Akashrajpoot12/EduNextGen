import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Award, TrendingUp, Users, FileText } from "lucide-react";

type ExamResult = {
  exam_name: string; subject: string; exam_type: string;
  marks_obtained: number; total_marks: number; grade: string; pct: number;
};

export function ParentMarksPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();
  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState("");
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loadingMarks, setLoadingMarks] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: kids } = await supabase
        .from("students")
        .select("id, user_id, name, classes:class_id(grade_level, section)")
        .eq("school_id", schoolId)
        .eq("parent_user_id", user.id);
      if (kids && kids.length > 0) {
        setChildren(kids);
        setSelectedChild(kids[0].id);
      }
      setLoading(false);
    })();
  }, [schoolId]);

  useEffect(() => {
    if (!selectedChild) return;
    (async () => {
      setLoadingMarks(true);
      const { data: marks } = await supabase
        .from("exam_marks")
        .select("marks_obtained, grade, subject, exams:exam_id(id, name, exam_type, total_marks, school_id)")
        .eq("student_id", selectedChild);
      const filtered = (marks || []).filter((m: any) => m.exams?.school_id === schoolId);
      setResults(filtered.map((m: any) => ({
        exam_name: m.exams?.name || "—",
        subject: m.subject || "—",
        exam_type: m.exams?.exam_type || "—",
        marks_obtained: m.marks_obtained,
        total_marks: m.exams?.total_marks || 100,
        grade: m.grade || "—",
        pct: Math.round((m.marks_obtained / (m.exams?.total_marks || 100)) * 100),
      })));
      setLoadingMarks(false);
    })();
  }, [selectedChild]);

  const avg = results.length ? Math.round(results.reduce((s, r) => s + r.pct, 0) / results.length) : 0;
  const best = results.length ? results.reduce((a, b) => (a.pct > b.pct ? a : b)) : null;
  const passed = results.filter(r => r.pct >= 33).length;

  const chartData = results.map(r => ({
    name: r.exam_name.slice(0, 12),
    pct: r.pct,
    fill: r.pct >= 75 ? "#10b981" : r.pct >= 50 ? "#f59e0b" : "#ef4444",
  }));

  const selectedChildData = children.find(c => c.id === selectedChild);

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (children.length === 0) return (
    <div className="text-center py-16 bg-card border border-border rounded-xl">
      <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
      <p className="font-medium">No children linked to your account</p>
      <p className="text-sm text-muted-foreground mt-1">Contact school admin to link your child's profile</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Child's Exam Results</h1>
        <p className="text-sm text-muted-foreground mt-1">Academic performance across all exams</p>
      </div>

      {children.length > 1 && (
        <select value={selectedChild} onChange={e => setSelectedChild(e.target.value)}
          className="h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 w-72">
          {children.map(c => (
            <option key={c.id} value={c.id}>
              {(c as any).name} — Class {(c.classes as any)?.grade_level}-{(c.classes as any)?.section}
            </option>
          ))}
        </select>
      )}

      {selectedChildData && (
        <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center font-bold text-amber-600">
            {((selectedChildData as any)?.name || "?")[0]}
          </div>
          <div>
            <p className="font-semibold">{(selectedChildData as any)?.name}</p>
            <p className="text-xs text-muted-foreground">
              Class {(selectedChildData.classes as any)?.grade_level} - {(selectedChildData.classes as any)?.section}
            </p>
          </div>
        </div>
      )}

      {loadingMarks ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="font-medium">No exam results yet</p>
          <p className="text-sm text-muted-foreground mt-1">Results will appear here after exams are graded</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Exams Taken",  value: results.length, color: "text-amber-500" },
              { label: "Average Score", value: `${avg}%`,     color: avg >= 60 ? "text-emerald-500" : "text-amber-500" },
              { label: "Best Score",   value: best ? `${best.pct}%` : "—", color: "text-blue-500" },
              { label: "Passed",       value: `${passed}/${results.length}`, color: "text-emerald-500" },
            ].map(s => (
              <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {chartData.length > 1 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-500" /> Performance Chart
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v}%`, "Score"]} />
                  <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                    {chartData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <h3 className="font-semibold">Detailed Results</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Exam</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Subject</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Marks</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">%</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Grade</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{r.exam_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.subject}</td>
                      <td className="px-4 py-3 font-semibold">{r.marks_obtained}/{r.total_marks}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{
                              width: `${r.pct}%`,
                              background: r.pct >= 75 ? "#10b981" : r.pct >= 50 ? "#f59e0b" : "#ef4444"
                            }} />
                          </div>
                          <span className="font-semibold">{r.pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-bold text-amber-600">{r.grade}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.pct >= 33 ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>
                          {r.pct >= 33 ? "Pass" : "Fail"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
