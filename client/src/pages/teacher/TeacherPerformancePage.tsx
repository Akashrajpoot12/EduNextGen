import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend } from "recharts";
import { TrendingUp, Award, Users } from "lucide-react";

export function TeacherPerformancePage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [exams, setExams] = useState<any[]>([]);
  const [classPerf, setClassPerf] = useState<any[]>([]);
  const [subjectPerf, setSubjectPerf] = useState<any[]>([]);
  const [toppers, setToppers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    Promise.all([
      supabase.from("classes").select("id, grade_level, section").eq("school_id", schoolId).order("grade_level"),
      supabase.from("exams").select("id, name, subject, total_marks, classes:class_id(name, id)").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(20),
    ]).then(([{ data: cls }, { data: ex }]) => {
      setClasses(cls || []);
      setExams(ex || []);
    });
  }, [schoolId]);

  useEffect(() => {
    if (!selectedClass) return;
    loadPerformance();
  }, [selectedClass]);

  async function loadPerformance() {
    setLoading(true);
    const classExams = exams.filter(e => e.classes?.id === selectedClass);

    if (classExams.length === 0) {
      setClassPerf([]); setSubjectPerf([]); setToppers([]);
      setLoading(false);
      return;
    }

    const examIds = classExams.map((e: any) => e.id);

    // Single batch query — replaces N+1 per-exam queries
    const { data: allMarks } = await supabase
      .from("exam_marks")
      .select("exam_id, marks_obtained, students:student_id(users:user_id(full_name))")
      .in("exam_id", examIds);

    const marksByExam: Record<string, number[]> = {};
    examIds.forEach((id: string) => { marksByExam[id] = []; });
    (allMarks || []).forEach((m: any) => {
      if (marksByExam[m.exam_id]) marksByExam[m.exam_id].push(m.marks_obtained);
    });

    // Exam-wise class average
    const perfData = classExams.map((exam: any) => {
      const marks = marksByExam[exam.id] || [];
      if (marks.length === 0) return null;
      const avg = Math.round(marks.reduce((s: number, v: number) => s + v, 0) / marks.length);
      const pct = Math.round((avg / exam.total_marks) * 100);
      return { exam: exam.name.slice(0, 15), avg, pct, total: exam.total_marks };
    });
    setClassPerf(perfData.filter(Boolean) as any[]);

    // Subject-wise radar from same batch data
    const subjects = [...new Set(classExams.map((e: any) => e.subject).filter(Boolean))] as string[];
    const subData = subjects.map(subject => {
      const subExams = classExams.filter((e: any) => e.subject === subject);
      let total = 0, count = 0;
      subExams.forEach((exam: any) => {
        (marksByExam[exam.id] || []).forEach((v: number) => {
          total += (v / exam.total_marks) * 100; count++;
        });
      });
      return { subject: subject.slice(0, 10), score: count ? Math.round(total / count) : 0 };
    });
    setSubjectPerf(subData.filter(d => d.score > 0));

    // Top 5 students from same batch
    const examTotalMap: Record<string, number> = {};
    classExams.forEach((e: any) => { examTotalMap[e.id] = e.total_marks || 100; });

    const studentMap: Record<string, { name: string; total: number; max: number }> = {};
    (allMarks || []).forEach((m: any) => {
      const name = m.students?.users?.full_name || "—";
      if (!studentMap[name]) studentMap[name] = { name, total: 0, max: 0 };
      studentMap[name].total += m.marks_obtained;
      studentMap[name].max += examTotalMap[m.exam_id] || 100;
    });

    const sorted = Object.values(studentMap)
      .map(s => ({ ...s, pct: Math.round((s.total / s.max) * 100) }))
      .sort((a, b) => b.pct - a.pct).slice(0, 5);
    setToppers(sorted);

    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Class Performance Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Visual insights into student and class performance</p>
      </div>

      <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
        className="h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full md:w-72">
        <option value="">-- Select Class --</option>
        {classes.map(c => <option key={c.id} value={c.id}>Class {c.grade_level} - {c.section}</option>)}
      </select>

      {loading && <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}

      {!loading && selectedClass && (
        <div className="space-y-4">
          {/* Exam trend */}
          {classPerf.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />Exam-wise Class Average (%)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={classPerf}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="exam" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v}%`, "Average"]} />
                  <Line type="monotone" dataKey="pct" stroke="#6366f1" strokeWidth={2} dot={{ fill: "#6366f1" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            {/* Subject radar */}
            {subjectPerf.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold mb-4">Subject-wise Performance</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={subjectPerf}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                    <Radar name="Avg %" dataKey="score" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Toppers */}
            {toppers.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold mb-4 flex items-center gap-2"><Award className="w-4 h-4 text-amber-500" />Top 5 Students (Overall)</h3>
                <div className="space-y-3">
                  {toppers.map((s, i) => (
                    <div key={s.name} className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? "bg-amber-500/20 text-amber-600" : i === 1 ? "bg-slate-400/20 text-slate-500" : i === 2 ? "bg-orange-400/20 text-orange-600" : "bg-muted text-muted-foreground"}`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.name}</p>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${s.pct}%` }} />
                        </div>
                      </div>
                      <span className="text-sm font-bold text-emerald-600">{s.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {classPerf.length === 0 && subjectPerf.length === 0 && (
            <div className="text-center py-16 bg-card border border-border rounded-xl">
              <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="font-medium">No exam data available for this class</p>
              <p className="text-sm text-muted-foreground mt-1">Enter marks in Gradebook first</p>
            </div>
          )}
        </div>
      )}

      {!selectedClass && (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="font-medium">Select a class to view analytics</p>
        </div>
      )}
    </div>
  );
}
