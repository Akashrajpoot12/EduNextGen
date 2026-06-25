import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Users, BookOpen, Clock, Bell, TrendingDown, CheckCircle2, AlertTriangle, ChevronRight, TrendingUp, CalendarClock, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

interface Period {
  subject: string;
  period: number;
  start_time?: string;
  class_name?: string;
}

interface HomeworkStat {
  id: string;
  title: string;
  due_date: string;
  submitted: number;
  total: number;
}

interface PerformanceDrop {
  student_name: string;
  subject: string;
  prev_marks: number;
  curr_marks: number;
  drop: number;
}

interface PtmInfo {
  date: string;
  daysAway: number;
}

interface AvgComparison {
  classAvg: number;
  schoolAvg: number;
  diff: number;
}

export function TeacherDashboard() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();
  const navigate = useNavigate();

  const [loading, setLoading]         = useState(true);
  const [teacherName, setTeacherName] = useState("");
  const [teacherId, setTeacherId]     = useState("");
  const [stats, setStats]             = useState({ students: 0, homework: 0, classes: 0, notices: 0 });
  const [todayPeriods, setTodayPeriods] = useState<Period[]>([]);
  const [recentNotices, setRecentNotices] = useState<{ id: string; title: string; created_at: string }[]>([]);
  const [homeworkStats, setHomeworkStats] = useState<HomeworkStat[]>([]);
  const [performanceDrops, setPerformanceDrops] = useState<PerformanceDrop[]>([]);
  const [nextPeriodMins, setNextPeriodMins] = useState<number | null>(null);
  const [nextPeriodSubject, setNextPeriodSubject] = useState("");
  const [ptmInfo, setPtmInfo] = useState<PtmInfo | null>(null);
  const [avgComparison, setAvgComparison] = useState<AvgComparison | null>(null);

  interface StudentOfWeek {
    name: string;
    attendancePct: number;
    examAvg: number;
    score: number;
    studentId: string;
  }
  const [studentOfWeek, setStudentOfWeek] = useState<StudentOfWeek | null>(null);
  const [announcingSotw, setAnnouncingSotw] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    const load = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setTeacherId(user.id);

        const { data: profile } = await supabase
          .from("users")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();
        const teacherClassId: string | null = (profile as any)?.class_id ?? null;

        if (!profile?.full_name) {
          const { data: ur } = await supabase.from("users").select("name, full_name").eq("id", user.id).single();
          setTeacherName(ur?.name || ur?.full_name || "Teacher");
        } else {
          setTeacherName(profile.full_name);
        }

        const todayDay = DAYS[new Date().getDay()];
        const todayStr = new Date().toISOString().split("T")[0];

        const [
          { count: stuCount },
          { count: hwCount },
          { count: noticeCount },
          { data: periods },
          { data: notices },
          { data: homework },
        ] = await Promise.all([
          supabase.from("students").select("*", { count: "exact", head: true }).eq("school_id", schoolId),
          supabase.from("homework").select("*", { count: "exact", head: true }).eq("school_id", schoolId).eq("teacher_id", user.id),
          supabase.from("announcements").select("*", { count: "exact", head: true }).eq("school_id", schoolId),
          supabase.from("timetables")
            .select("subject, period_number, start_time, classes:class_id(name)")
            .eq("school_id", schoolId)
            .eq("teacher_id", user.id)
            .eq("day_of_week", todayDay)
            .order("period_number"),
          supabase.from("announcements")
            .select("id, title, created_at")
            .eq("school_id", schoolId)
            .order("created_at", { ascending: false })
            .limit(3),
          supabase.from("homework")
            .select("id, title, due_date, class_id")
            .eq("school_id", schoolId)
            .eq("teacher_id", user.id)
            .gte("due_date", todayStr)
            .order("due_date")
            .limit(4),
        ]);

        setStats({ students: stuCount || 0, homework: hwCount || 0, classes: (periods || []).length, notices: noticeCount || 0 });
        const mappedPeriods = (periods || []).map((p: any) => ({
          subject: p.subject,
          period: p.period_number,
          start_time: p.start_time,
          class_name: p.classes?.name,
        }));
        setTodayPeriods(mappedPeriods);
        setRecentNotices(notices || []);

        // Next class countdown
        const now = new Date();
        const todayPeriodsSorted = mappedPeriods.filter((p: Period) => p.start_time);
        for (const p of todayPeriodsSorted) {
          const [h, m] = (p.start_time || "").split(":").map(Number);
          const periodTime = new Date();
          periodTime.setHours(h, m, 0, 0);
          const diff = Math.round((periodTime.getTime() - now.getTime()) / 60000);
          if (diff > 0) {
            setNextPeriodMins(diff);
            setNextPeriodSubject(p.subject);
            break;
          }
        }

        // Homework submission rates
        if ((homework || []).length > 0) {
          const hwIds = (homework || []).map((h: any) => h.id);
          const { data: submissions } = await supabase
            .from("homework_submissions")
            .select("homework_id")
            .in("homework_id", hwIds);

          const submissionCounts: Record<string, number> = {};
          (submissions || []).forEach((s: any) => {
            submissionCounts[s.homework_id] = (submissionCounts[s.homework_id] || 0) + 1;
          });

          const classIds = [...new Set((homework || []).map((h: any) => h.class_id))];
          const { data: studentCounts } = await supabase
            .from("students")
            .select("class_id")
            .in("class_id", classIds)
            .eq("school_id", schoolId);

          const classSizes: Record<string, number> = {};
          (studentCounts || []).forEach((s: any) => {
            classSizes[s.class_id] = (classSizes[s.class_id] || 0) + 1;
          });

          setHomeworkStats((homework || []).map((h: any) => ({
            id: h.id,
            title: h.title,
            due_date: h.due_date,
            submitted: submissionCounts[h.id] || 0,
            total: classSizes[h.class_id] || 0,
          })));
        }

        // Performance drop detection (compare last 2 exams per student)
        const { data: examResults } = await supabase
          .from("exam_marks")
          .select("student_id, marks_obtained, max_marks, subject, exam_id, students:student_id(first_name, last_name)")
          .eq("school_id", schoolId)
          .order("exam_id", { ascending: false })
          .limit(500);

        if (examResults && examResults.length > 0) {
          const byStudentSubject: Record<string, { marks: number; max: number }[]> = {};
          (examResults as any[]).forEach((r: any) => {
            const key = `${r.student_id}__${r.subject}`;
            if (!byStudentSubject[key]) byStudentSubject[key] = [];
            byStudentSubject[key].push({ marks: r.marks_obtained, max: r.max_marks });
          });

          const drops: PerformanceDrop[] = [];
          Object.entries(byStudentSubject).forEach(([key, entries]) => {
            if (entries.length < 2) return;
            const [curr, prev] = entries;
            const currPct = (curr.marks / (curr.max || 100)) * 100;
            const prevPct = (prev.marks / (prev.max || 100)) * 100;
            const drop = prevPct - currPct;
            if (drop >= 15) {
              const [studentId, subject] = key.split("__");
              const er = (examResults as any[]).find((r: any) => r.student_id === studentId && r.subject === subject);
              const sName = er?.students ? `${er.students.first_name || ""} ${er.students.last_name || ""}`.trim() : "Student";
              drops.push({ student_name: sName, subject, prev_marks: Math.round(prevPct), curr_marks: Math.round(currPct), drop: Math.round(drop) });
            }
          });
          setPerformanceDrops(drops.slice(0, 5));

          // Class avg vs school avg comparison
          const schoolResults = examResults as any[];
          const schoolTotal = schoolResults.reduce((sum, r) => sum + (r.marks_obtained / (r.max_marks || 100)) * 100, 0);
          const schoolAvg = schoolResults.length > 0 ? Math.round(schoolTotal / schoolResults.length) : 0;

          if (teacherClassId) {
            const classResults = schoolResults.filter((r: any) => r.class_id === teacherClassId);
            if (classResults.length > 0) {
              const classTotal = classResults.reduce((sum: number, r: any) => sum + (r.marks_obtained / (r.max_marks || 100)) * 100, 0);
              const classAvg = Math.round(classTotal / classResults.length);
              setAvgComparison({ classAvg, schoolAvg, diff: classAvg - schoolAvg });
            }
          }
        }

        // PTM countdown — next scheduled PTM for this school
        const { data: ptmData } = await supabase
          .from("ptm_meetings")
          .select("date")
          .eq("school_id", schoolId)
          .eq("status", "scheduled")
          .gt("date", todayStr)
          .order("date", { ascending: true })
          .limit(1);

        if (ptmData && ptmData.length > 0) {
          const ptmDate = new Date(ptmData[0].date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const daysAway = Math.round((ptmDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          setPtmInfo({ date: ptmData[0].date, daysAway });
        }

        // Student of the Week
        if (teacherClassId) {
          const now2 = new Date();
          const monthStart = new Date(now2.getFullYear(), now2.getMonth(), 1).toISOString().split("T")[0];
          const monthEnd = new Date(now2.getFullYear(), now2.getMonth() + 1, 0).toISOString().split("T")[0];

          const { data: classStudents } = await supabase
            .from("students")
            .select("id, name")
            .eq("school_id", schoolId)
            .eq("class_id", teacherClassId);

          if (classStudents && classStudents.length > 0) {
            const studentIds = classStudents.map((s: any) => s.id);

            const [{ data: attData }, { data: examData }] = await Promise.all([
              supabase
                .from("daily_attendance")
                .select("student_id, status")
                .eq("school_id", schoolId)
                .in("student_id", studentIds)
                .gte("date", monthStart)
                .lte("date", monthEnd),
              supabase
                .from("exam_marks")
                .select("student_id, marks_obtained, max_marks")
                .eq("school_id", schoolId)
                .in("student_id", studentIds)
                .order("created_at", { ascending: false })
                .limit(500),
            ]);

            const attMap: Record<string, { present: number; total: number }> = {};
            for (const r of attData || []) {
              if (!attMap[r.student_id]) attMap[r.student_id] = { present: 0, total: 0 };
              attMap[r.student_id].total += 1;
              if (r.status === "present") attMap[r.student_id].present += 1;
            }

            const examMap: Record<string, { total: number; count: number }> = {};
            for (const r of examData || []) {
              const pct = (r.marks_obtained / (r.max_marks || 100)) * 100;
              if (!examMap[r.student_id]) examMap[r.student_id] = { total: 0, count: 0 };
              examMap[r.student_id].total += pct;
              examMap[r.student_id].count += 1;
            }

            let bestStudent: StudentOfWeek | null = null;
            for (const s of classStudents as any[]) {
              const att = attMap[s.id];
              const attPct = att && att.total > 0 ? (att.present / att.total) * 100 : 0;
              const ex = examMap[s.id];
              const examAvg = ex && ex.count > 0 ? ex.total / ex.count : 0;
              const score = attPct * 0.5 + examAvg * 0.5;
              if (!bestStudent || score > bestStudent.score) {
                bestStudent = { name: s.name, attendancePct: Math.round(attPct), examAvg: Math.round(examAvg), score: Math.round(score), studentId: s.id };
              }
            }
            if (bestStudent) setStudentOfWeek(bestStudent);
          }
        }

      } finally {
        setLoading(false);
      }
    };
    load();
  }, [schoolId]);

  async function handleAnnounceSotw() {
    if (!studentOfWeek) return;
    setAnnouncingSotw(true);
    try {
      const { error } = await supabase.from("announcements").insert({
        school_id: schoolId,
        title: `👑 Student of the Week: ${studentOfWeek.name}`,
        content: `Congratulations to ${studentOfWeek.name} for outstanding performance!`,
        audience: "all",
      });
      if (error) throw error;
      toast.success("Announced!");
    } catch {
      toast.error("Failed to send announcement.");
    } finally {
      setAnnouncingSotw(false);
    }
  }

  if (loading) return (
    <div className="flex justify-center items-center h-48">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const tenant = window.location.pathname.split("/")[1];
  const isClassAbove = avgComparison && avgComparison.diff >= 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Welcome back, {teacherName}!</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {/* PTM countdown badge */}
          {ptmInfo && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-500/10 border border-violet-500/25 text-violet-600 dark:text-violet-400 text-sm font-medium">
              <CalendarClock className="w-4 h-4" />
              <span>
                PTM in <strong>{ptmInfo.daysAway} day{ptmInfo.daysAway !== 1 ? "s" : ""}</strong>
                {" "}—{" "}
                {new Date(ptmInfo.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </span>
            </div>
          )}
          {nextPeriodMins !== null && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 text-sm font-medium">
              <Clock className="w-4 h-4" />
              <span>Next: <strong>{nextPeriodSubject}</strong> in {nextPeriodMins} min</span>
            </div>
          )}
        </div>
      </div>

      {/* Class avg vs school avg comparison chip */}
      {avgComparison && (
        <div className={[
          "inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold",
          isClassAbove
            ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-400"
            : "bg-red-500/10 border-red-500/25 text-red-700 dark:text-red-400"
        ].join(" ")}>
          {isClassAbove
            ? <TrendingUp className="w-4 h-4 shrink-0" />
            : <TrendingDown className="w-4 h-4 shrink-0" />
          }
          <span>
            Your class: <strong>{avgComparison.classAvg}%</strong>
            {" | "}
            School avg: <strong>{avgComparison.schoolAvg}%</strong>
            {" "}
            {isClassAbove
              ? `↑ +${avgComparison.diff}%`
              : `↓ ${avgComparison.diff}%`
            }
          </span>
        </div>
      )}

      {/* Performance drop alert */}
      {performanceDrops.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/8 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-red-500" />
            <p className="text-sm font-semibold text-red-600 dark:text-red-400">
              {performanceDrops.length} student{performanceDrops.length > 1 ? "s" : ""} with significant performance drop (≥15%)
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {performanceDrops.map((d, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/20 rounded-lg px-2.5 py-1">
                <AlertTriangle className="w-3 h-3" />
                {d.student_name} · {d.subject}: {d.prev_marks}% → {d.curr_marks}% (↓{d.drop}%)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Students", value: stats.students, icon: Users, color: "text-fuchsia-500" },
          { label: "My Homework", value: stats.homework, icon: BookOpen, color: "text-violet-500" },
          { label: "Periods Today", value: stats.classes, icon: Clock, color: "text-amber-500" },
          { label: "Notices", value: stats.notices, icon: Bell, color: "text-orange-500" },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl p-4 border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Today's Schedule */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold mb-3 flex items-center gap-2 text-foreground">
            <Clock className="w-4 h-4 text-violet-500" />
            Today's Schedule ({DAYS[new Date().getDay()]})
          </h3>
          {todayPeriods.length === 0
            ? <p className="text-sm text-muted-foreground py-6 text-center">No periods scheduled today.</p>
            : (
              <div className="space-y-2">
                {todayPeriods.map(p => (
                  <div key={p.period} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{p.period}</div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{p.subject}</p>
                      <p className="text-xs text-muted-foreground">{p.class_name}{p.start_time ? ` · ${p.start_time}` : ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </div>

        {/* Homework submission rates */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold mb-3 flex items-center gap-2 text-foreground">
            <CheckCircle2 className="w-4 h-4 text-fuchsia-500" />
            Homework Submission Rates
          </h3>
          {homeworkStats.length === 0
            ? <p className="text-sm text-muted-foreground py-6 text-center">No active homework assignments.</p>
            : (
              <div className="space-y-3">
                {homeworkStats.map(hw => {
                  const pct = hw.total > 0 ? Math.round((hw.submitted / hw.total) * 100) : 0;
                  const isLow = pct < 50;
                  return (
                    <div key={hw.id}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-foreground truncate max-w-[60%]">{hw.title}</p>
                        <span className={`text-xs font-bold ${isLow ? "text-red-500" : "text-emerald-500"}`}>
                          {hw.submitted}/{hw.total} submitted
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          ref={el => { if (el) el.style.width = `${pct}%`; }}
                          className={`h-full rounded-full transition-all ${isLow ? "bg-red-500" : "bg-emerald-500"}`}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Due: {new Date(hw.due_date).toLocaleDateString("en-IN")} · {pct}% submitted
                      </p>
                    </div>
                  );
                })}
              </div>
            )
          }
        </div>
      </div>

      {/* Recent Notices */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold mb-3 flex items-center gap-2 text-foreground">
          <Bell className="w-4 h-4 text-amber-500" />
          Recent Notices
        </h3>
        {recentNotices.length === 0
          ? <p className="text-sm text-muted-foreground py-4 text-center">No notices yet.</p>
          : (
            <div className="grid sm:grid-cols-3 gap-3">
              {recentNotices.map(n => (
                <div key={n.id} className="p-3 rounded-lg bg-muted/40 border border-border">
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleDateString("en-IN")}</p>
                </div>
              ))}
            </div>
          )
        }
      </div>

      {/* Student of the Week */}
      {studentOfWeek && (
        <div className="rounded-xl border border-amber-400/40 bg-gradient-to-br from-amber-500/8 to-yellow-500/5 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Crown className="w-8 h-8 text-amber-500 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-0.5">👑 Student of the Week</p>
              <p className="text-xl font-bold text-foreground truncate">{studentOfWeek.name}</p>
              <p className="text-sm text-muted-foreground">
                Attendance: {studentOfWeek.attendancePct}% · Exam avg: {studentOfWeek.examAvg}% · Score: {studentOfWeek.score}%
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAnnounceSotw}
            disabled={announcingSotw}
            className="flex-shrink-0 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold bg-amber-500 text-foreground hover:bg-amber-600 transition-colors disabled:opacity-50"
          >
            {announcingSotw ? "Announcing…" : "🌟 Announce"}
          </button>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Mark Attendance", icon: CheckCircle2, color: "text-emerald-500 bg-emerald-500/10", href: `/${tenant}/teacher/attendance` },
          { label: "Add Homework", icon: BookOpen, color: "text-fuchsia-500 bg-fuchsia-500/10", href: `/${tenant}/teacher/homework` },
          { label: "Enter Marks", icon: TrendingDown, color: "text-violet-500 bg-violet-500/10", href: `/${tenant}/teacher/gradebook` },
          { label: "Message Parents", icon: Bell, color: "text-amber-500 bg-amber-500/10", href: `/${tenant}/teacher/messages` },
        ].map(a => (
          <button
            key={a.label}
            type="button"
            onClick={() => navigate(a.href)}
            className="flex items-center gap-2 p-3 rounded-xl bg-card border border-border hover:border-primary/40 transition-all text-sm font-medium text-foreground"
          >
            <span className={`p-1.5 rounded-lg ${a.color}`}>
              <a.icon className="w-4 h-4" />
            </span>
            {a.label}
            <ChevronRight className="w-3.5 h-3.5 ml-auto text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}
