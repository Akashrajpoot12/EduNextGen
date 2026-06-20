import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Link, useParams } from "react-router-dom";
import {
  CalendarCheck, BookOpen, Award, Bell, ChevronRight,
  CheckCircle2, XCircle, Clock, Wallet, CalendarOff,
  TrendingUp, BookMarked, AlertTriangle, Star, Trophy, BookText, Radar
} from "lucide-react";

// ── SVG Radar Chart ──────────────────────────────────────────────────────────
function RadarChart({ subjects }: { subjects: { name: string; pct: number }[] }) {
  const cx = 100, cy = 100, r = 70;
  const n = subjects.length;
  if (n < 3) return null;

  // Angle for each axis: start at top (-90°)
  const angle = (i: number) => ((2 * Math.PI * i) / n) - Math.PI / 2;
  const pt = (i: number, radius: number) => ({
    x: cx + radius * Math.cos(angle(i)),
    y: cy + radius * Math.sin(angle(i)),
  });

  // Background rings at 25%, 50%, 75%, 100%
  const ringPcts = [0.25, 0.5, 0.75, 1];
  const ringPath = (frac: number) => {
    const pts = subjects.map((_, i) => pt(i, r * frac));
    return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ") + " Z";
  };

  // Data polygon
  const dataPath = subjects
    .map((s, i) => {
      const p = pt(i, r * (Math.min(100, Math.max(0, s.pct)) / 100));
      return `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
    })
    .join(" ") + " Z";

  return (
    <svg viewBox="0 0 200 200" className="w-48 h-48">
      {/* Background rings */}
      {ringPcts.map((frac) => (
        <path key={frac} d={ringPath(frac)} fill="rgba(139,92,246,0.1)" stroke="rgba(139,92,246,0.25)" strokeWidth="0.8" />
      ))}
      {/* Axis lines */}
      {subjects.map((_, i) => {
        const tip = pt(i, r);
        return <line key={i} x1={cx} y1={cy} x2={tip.x.toFixed(2)} y2={tip.y.toFixed(2)} stroke="rgba(139,92,246,0.3)" strokeWidth="0.8" />;
      })}
      {/* Data polygon */}
      <path d={dataPath} fill="rgba(196,75,196,0.4)" stroke="#C44BC4" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Data points */}
      {subjects.map((s, i) => {
        const p = pt(i, r * (Math.min(100, Math.max(0, s.pct)) / 100));
        return <circle key={i} cx={p.x.toFixed(2)} cy={p.y.toFixed(2)} r="3" fill="#C44BC4" />;
      })}
      {/* Labels */}
      {subjects.map((s, i) => {
        const labelR = r + 16;
        const p = pt(i, labelR);
        const label = s.name.length > 8 ? s.name.slice(0, 8) : s.name;
        const anchor = p.x < cx - 5 ? "end" : p.x > cx + 5 ? "start" : "middle";
        return (
          <text key={i} x={p.x.toFixed(2)} y={p.y.toFixed(2)} textAnchor={anchor} dominantBaseline="middle"
            fontSize="7" fill="currentColor" className="fill-muted-foreground">
            {label}
          </text>
        );
      })}
    </svg>
  );
}

export function StudentDashboard() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();
  const params = useParams();
  const tenant = params.tenantId as string;

  const [loading, setLoading]               = useState(true);
  const [userId, setUserId]                 = useState<string | null>(null);
  const [studentName, setStudentName]       = useState("");
  const [className, setClassName]           = useState("");
  const [rollNo, setRollNo]                 = useState("");
  const [attendancePct, setAttendancePct]   = useState<number | null>(null);
  const [pendingHomework, setPendingHomework] = useState(0);
  const [latestGrade, setLatestGrade]       = useState<string | null>(null);
  const [latestExam, setLatestExam]         = useState("");
  const [notices, setNotices]               = useState<any[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<string | null>(null);
  const [upcomingHW, setUpcomingHW]         = useState<any[]>([]);
  const [recentMarks, setRecentMarks]       = useState<any[]>([]);
  const [pendingFee, setPendingFee]         = useState<number | null>(null);
  const [timetableToday, setTimetableToday] = useState<any[]>([]);
  const [pendingLeave, setPendingLeave]     = useState(0);

  // ── Personal Goal Tracker ────────────────────────────────────────────────
  const [goals, setGoals]                              = useState<Record<string, number>>({});

  // Load goals from localStorage once userId is known
  useEffect(() => {
    if (!userId) return;
    try {
      const raw = localStorage.getItem(`goals_${userId}`);
      if (raw) setGoals(JSON.parse(raw));
    } catch (_) {}
  }, [userId]);

  const updateGoal = useCallback((subject: string, value: number) => {
    setGoals(prev => {
      const next = { ...prev, [subject]: value };
      if (userId) localStorage.setItem(`goals_${userId}`, JSON.stringify(next));
      return next;
    });
  }, [userId]);

  // ── New medium-impact states ─────────────────────────────────────────────
  const [subjectRadarData, setSubjectRadarData]        = useState<{ name: string; pct: number }[]>([]);
  const [classRank, setClassRank]                     = useState<number | null>(null);
  const [classSize, setClassSize]                     = useState<number | null>(null);
  const [syllabusProgress, setSyllabusProgress]       = useState<{ subject: string; completed: number; total: number }[]>([]);
  const [feeDueDateChip, setFeeDueDateChip]           = useState<{ amount: number; daysUntil: number; dueDate: string } | null>(null);

  // ref callback for dynamic progress bar widths (no inline styles)
  const progressBarRef = useCallback((el: HTMLDivElement | null, pct: number) => {
    if (el) el.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  }, []);

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        setUserId(user.id);

        // ── Student profile ───────────────────────────────
        const { data: student } = await supabase
          .from("students")
          .select("id, user_id, class_id, first_name, last_name, roll_number, classes:class_id(name, grade_level, section)")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!student) { setLoading(false); return; }

        const dbName = [student.first_name, student.last_name].filter(Boolean).join(" ");
        const metaName = user.user_metadata?.full_name || user.user_metadata?.name || "";
        setStudentName(dbName || metaName || user.email?.split("@")[0] || "Student");
        setRollNo(student.roll_number || "");
        const cls = student.classes as any;
        if (cls) setClassName(cls.name || `Class ${cls.grade_level}${cls.section ? " - " + cls.section : ""}`);

        const today = new Date().toISOString().split("T")[0];
        const now   = new Date();
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        const next7days  = new Date(now.getTime() + 7 * 86400000).toISOString().split("T")[0];
        const dayName    = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][now.getDay()];

        const [
          { count: total }, { count: present },
          todayRec, { count: hwCount },
          hwUpcoming, lastMarks,
          noticeData, feeData,
          ttData, leaveData,
        ] = await Promise.all([
          // Attendance this month
          supabase.from("daily_attendance").select("*",{count:"exact",head:true}).eq("student_id",user.id).gte("date",monthStart),
          supabase.from("daily_attendance").select("*",{count:"exact",head:true}).eq("student_id",user.id).eq("status","present").gte("date",monthStart),
          // Today
          supabase.from("daily_attendance").select("status").eq("student_id",user.id).eq("date",today).maybeSingle(),
          // Homework count
          supabase.from("homework").select("*",{count:"exact",head:true}).eq("class_id",student.class_id).eq("school_id",schoolId).gte("due_date",today),
          // Upcoming homework (next 7 days)
          supabase.from("homework").select("id,title,subject,due_date").eq("class_id",student.class_id).eq("school_id",schoolId).gte("due_date",today).lte("due_date",next7days).order("due_date").limit(4),
          // Recent marks
          supabase.from("exam_marks").select("marks_obtained,grade,exams:exam_id(name,total_marks)").eq("student_id",user.id).order("created_at",{ascending:false}).limit(4),
          // Notices
          supabase.from("announcements").select("id,title,priority,created_at").eq("school_id",schoolId).in("audience",["all","students"]).order("created_at",{ascending:false}).limit(4),
          // Pending fees
          supabase.from("student_fee_assignments").select("amount,paid_amount,due_date,status").eq("student_id",student.id).eq("status","pending").limit(5),
          // Today's timetable
          supabase.from("timetable").select("period_number,subject,start_time,end_time,teacher:teacher_id(full_name)").eq("class_id",student.class_id).eq("school_id",schoolId).eq("day_of_week",dayName).order("period_number"),
          // Pending leave
          supabase.from("leave_requests").select("id",{count:"exact",head:true}).eq("student_id",student.id).eq("status","pending"),
        ]);

        if (total) setAttendancePct(Math.round(((present || 0) / total) * 100));
        setTodayAttendance((todayRec.data as any)?.status || null);
        setPendingHomework(hwCount || 0);
        setUpcomingHW(hwUpcoming.data || []);
        setRecentMarks(lastMarks.data || []);

        // ── Radar chart: group all exam marks by subject ─────────────────
        try {
          const { data: allMarks } = await supabase
            .from("exam_marks")
            .select("marks_obtained, exams:exam_id(subject, total_marks)")
            .eq("student_id", user.id);
          if (allMarks && allMarks.length > 0) {
            const subMap: Record<string, { total: number; maxTotal: number; count: number }> = {};
            for (const row of allMarks) {
              const subject = (row.exams as any)?.subject;
              const totalMarks = (row.exams as any)?.total_marks || 100;
              if (!subject) continue;
              if (!subMap[subject]) subMap[subject] = { total: 0, maxTotal: 0, count: 0 };
              subMap[subject].total += (row.marks_obtained || 0);
              subMap[subject].maxTotal += totalMarks;
              subMap[subject].count += 1;
            }
            const radarPoints = Object.entries(subMap)
              .map(([name, v]) => ({ name, pct: v.maxTotal > 0 ? Math.round((v.total / v.maxTotal) * 100) : 0 }))
              .sort((a, b) => b.pct - a.pct)
              .slice(0, 6);
            if (radarPoints.length >= 3) setSubjectRadarData(radarPoints);
          }
        } catch (_) {}
        setNotices(noticeData.data || []);
        setTimetableToday(ttData.data || []);
        setPendingLeave(leaveData.count || 0);

        // Pending fee total
        if (feeData.data?.length) {
          const total_pending = feeData.data.reduce((s: number, f: any) => s + ((f.amount || 0) - (f.paid_amount || 0)), 0);
          setPendingFee(total_pending);
        }

        // Latest grade
        if (lastMarks.data?.[0]) {
          const m = lastMarks.data[0];
          const pct = m.marks_obtained != null ? Math.round((m.marks_obtained / ((m.exams as any)?.total_marks || 100)) * 100) : null;
          setLatestGrade(m.grade || (pct !== null ? `${pct}%` : null));
          setLatestExam((m.exams as any)?.name || "");
        }

        // ── Feature 1: Class rank ─────────────────────────────────────────
        try {
          const { data: allStudentIds } = await supabase
            .from("students")
            .select("id")
            .eq("class_id", student.class_id)
            .eq("school_id", schoolId);

          if (allStudentIds && allStudentIds.length > 1) {
            const ids = allStudentIds.map((s: any) => s.id);
            const { data: classMarks } = await supabase
              .from("exam_marks")
              .select("student_id, marks_obtained")
              .in("student_id", ids);

            if (classMarks && classMarks.length > 0) {
              // Sum marks per student
              const totalsMap: Record<string, number> = {};
              for (const row of classMarks) {
                if (!totalsMap[row.student_id]) totalsMap[row.student_id] = 0;
                totalsMap[row.student_id] += row.marks_obtained || 0;
              }
              const myTotal = totalsMap[student.id] || 0;
              // Rank = number of students with strictly higher total + 1
              const rank = Object.values(totalsMap).filter(t => t > myTotal).length + 1;
              setClassRank(rank);
              setClassSize(Object.keys(totalsMap).length);
            }
          }
        } catch (_) {
          // Gracefully skip if exam_marks is unavailable
        }

        // ── Feature 2: Syllabus progress ─────────────────────────────────
        try {
          const { data: syllabusTopics } = await supabase
            .from("syllabus_topics")
            .select("subject, status")
            .eq("class_id", student.class_id)
            .eq("school_id", schoolId);

          if (syllabusTopics && syllabusTopics.length > 0) {
            const subjectMap: Record<string, { total: number; completed: number }> = {};
            for (const t of syllabusTopics) {
              const sub = t.subject || "General";
              if (!subjectMap[sub]) subjectMap[sub] = { total: 0, completed: 0 };
              subjectMap[sub].total += 1;
              if (t.status === "completed") subjectMap[sub].completed += 1;
            }
            // Take top 4 subjects by total topics
            const sorted = Object.entries(subjectMap)
              .sort((a, b) => b[1].total - a[1].total)
              .slice(0, 4)
              .map(([subject, v]) => ({ subject, ...v }));
            setSyllabusProgress(sorted);
          }
        } catch (_) {
          // Gracefully skip if syllabus_topics table doesn't exist
        }

        // ── Feature 3: Fee due date chip ─────────────────────────────────
        try {
          const { data: pendingFees } = await supabase
            .from("student_fee_assignments")
            .select("amount, paid_amount, due_date, status")
            .eq("student_id", student.id)
            .eq("status", "pending")
            .order("due_date", { ascending: true })
            .limit(10);

          if (pendingFees && pendingFees.length > 0) {
            // Find earliest due_date that has remaining balance
            const earliest = pendingFees
              .filter((f: any) => (f.amount || 0) - (f.paid_amount || 0) > 0 && f.due_date)
              .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

            if (earliest) {
              const daysUntil = Math.ceil((new Date(earliest.due_date).getTime() - Date.now()) / 86400000);
              const remaining = (earliest.amount || 0) - (earliest.paid_amount || 0);
              setFeeDueDateChip({ amount: remaining, daysUntil, dueDate: earliest.due_date });
            }
          }
        } catch (_) {
          // Gracefully skip
        }

      } catch (err) {
        console.error("Dashboard error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [schoolId]);

  const fmtDate  = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const daysLeft = (d: string) => {
    const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
    return diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : `${diff}d left`;
  };
  const gradeColor = (g: string | null) => {
    if (!g) return "text-muted-foreground";
    const n = parseInt(g);
    if (isNaN(n)) return g === "A" || g === "A+" ? "text-green-500" : g === "B" ? "text-blue-500" : "text-amber-500";
    return n >= 75 ? "text-green-500" : n >= 50 ? "text-amber-500" : "text-red-500";
  };

  const rankSuffix = (n: number) => {
    const s = ["th","st","nd","rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">
              Welcome back, {studentName || "Student"}! 👋
            </h1>
            {/* ── Class rank badge ─────────────────────────────────────── */}
            {classRank !== null && classSize !== null && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 text-xs font-semibold">
                <Trophy className="w-3.5 h-3.5" />
                #{classRank}{rankSuffix(classRank)} in class
                {classSize > 1 ? ` of ${classSize}` : ""}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <p className="text-sm text-muted-foreground">
              {className}{rollNo ? ` · Roll No. ${rollNo}` : ""} · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            {/* ── Fee due date chip ─────────────────────────────────────── */}
            {feeDueDateChip && (
              <Link
                to={`/${tenant}/student/fees`}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold transition-colors ${
                  feeDueDateChip.daysUntil < 0
                    ? "bg-red-500/10 border-red-500/30 text-red-600 hover:bg-red-500/20"
                    : feeDueDateChip.daysUntil <= 7
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-600 hover:bg-amber-500/20"
                    : "bg-muted border-border text-muted-foreground hover:bg-muted/80"
                }`}
              >
                <Wallet className="w-3 h-3" />
                ₹{feeDueDateChip.amount.toLocaleString("en-IN")} due{" "}
                {feeDueDateChip.daysUntil < 0
                  ? `${Math.abs(feeDueDateChip.daysUntil)}d overdue`
                  : feeDueDateChip.daysUntil === 0
                  ? "today"
                  : `in ${feeDueDateChip.daysUntil}d`}
              </Link>
            )}
          </div>
        </div>
        {attendancePct !== null && attendancePct < 75 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive text-xs font-medium">
            <AlertTriangle className="w-4 h-4" /> Low Attendance!
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── 4 Stat Cards ───────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link to={`/${tenant}/student/attendance`}
              className="bg-card border border-border rounded-xl p-4 hover:border-purple-500/40 hover:shadow-md transition-all group">
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3">
                <CalendarCheck className="w-4 h-4 text-purple-500" />
              </div>
              <p className={`text-2xl font-bold ${attendancePct !== null && attendancePct < 75 ? "text-destructive" : "text-foreground"}`}>
                {attendancePct !== null ? `${attendancePct}%` : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Attendance this month</p>
            </Link>

            <Link to={`/${tenant}/student/homework`}
              className="bg-card border border-border rounded-xl p-4 hover:border-pink-500/40 hover:shadow-md transition-all">
              <div className="w-9 h-9 rounded-lg bg-pink-500/10 flex items-center justify-center mb-3">
                <BookOpen className="w-4 h-4 text-pink-500" />
              </div>
              <p className="text-2xl font-bold text-foreground">{pendingHomework}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Pending Homework</p>
            </Link>

            <Link to={`/${tenant}/student/marks`}
              className="bg-card border border-border rounded-xl p-4 hover:border-amber-500/40 hover:shadow-md transition-all">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center mb-3">
                <Award className="w-4 h-4 text-amber-500" />
              </div>
              <p className={`text-2xl font-bold ${gradeColor(latestGrade)}`}>{latestGrade || "—"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{latestExam ? latestExam.slice(0,20) : "Latest Exam"}</p>
            </Link>

            <div className="bg-card border border-border rounded-xl p-4">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${
                todayAttendance === "present" ? "bg-green-500/10" :
                todayAttendance === "absent"  ? "bg-red-500/10" : "bg-blue-500/10"}`}>
                {todayAttendance === "present" ? <CheckCircle2 className="w-4 h-4 text-green-500" /> :
                 todayAttendance === "absent"  ? <XCircle className="w-4 h-4 text-red-500" /> :
                 <Clock className="w-4 h-4 text-blue-500" />}
              </div>
              <p className={`text-2xl font-bold capitalize ${
                todayAttendance === "present" ? "text-green-500" :
                todayAttendance === "absent"  ? "text-red-500" : "text-foreground"}`}>
                {todayAttendance || "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Today's Status</p>
            </div>
          </div>

          {/* ── 2nd row: Fee alert + Leave pending ─ */}
          {(pendingFee !== null && pendingFee > 0) || pendingLeave > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pendingFee !== null && pendingFee > 0 && (
                <Link to={`/${tenant}/student/fees`}
                  className="flex items-center gap-4 bg-destructive/5 border border-destructive/25 rounded-xl p-4 hover:bg-destructive/10 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-destructive/15 flex items-center justify-center flex-shrink-0">
                    <Wallet className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Fee Due: ₹{pendingFee.toLocaleString("en-IN")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Pending fee payment — click to view details</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                </Link>
              )}
              {pendingLeave > 0 && (
                <Link to={`/${tenant}/student/leaves`}
                  className="flex items-center gap-4 bg-amber-500/8 border border-amber-500/25 rounded-xl p-4 hover:bg-amber-500/12 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                    <CalendarOff className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{pendingLeave} Leave Request{pendingLeave > 1 ? "s" : ""} Pending</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Awaiting admin approval</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                </Link>
              )}
            </div>
          ) : null}

          {/* ── Main grid: Timetable + Homework ──── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Today's Timetable */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" /> Today's Classes
                </h3>
                <Link to={`/${tenant}/student/timetable`} className="text-xs text-primary hover:underline flex items-center gap-1">
                  Full schedule <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              {timetableToday.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No classes scheduled today</p>
              ) : (
                <div className="divide-y divide-border">
                  {timetableToday.slice(0, 5).map((p: any) => (
                    <div key={p.period_number} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="text-xs font-mono text-muted-foreground w-14 flex-shrink-0">
                        {p.start_time?.slice(0,5) || `P${p.period_number}`}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.subject}</p>
                        <p className="text-xs text-muted-foreground truncate">{(p.teacher as any)?.full_name || ""}</p>
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{p.end_time?.slice(0,5) || ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upcoming Homework */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <BookMarked className="w-4 h-4 text-pink-500" /> Upcoming Homework
                </h3>
                <Link to={`/${tenant}/student/homework`} className="text-xs text-primary hover:underline flex items-center gap-1">
                  All <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              {upcomingHW.length === 0 ? (
                <div className="flex flex-col items-center py-8 gap-2">
                  <CheckCircle2 className="w-8 h-8 text-green-500/50" />
                  <p className="text-sm text-muted-foreground">All caught up! No homework due soon</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {upcomingHW.map((hw: any) => (
                    <div key={hw.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-pink-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{hw.title}</p>
                        <p className="text-xs text-muted-foreground">{hw.subject}</p>
                      </div>
                      <span className={`text-xs font-medium flex-shrink-0 ${
                        daysLeft(hw.due_date) === "Today" ? "text-destructive" :
                        daysLeft(hw.due_date) === "Tomorrow" ? "text-amber-500" : "text-muted-foreground"}`}>
                        {daysLeft(hw.due_date)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Recent Exam Results ─────────────── */}
          {recentMarks.length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-500" /> Recent Exam Results
                </h3>
                <Link to={`/${tenant}/student/marks`} className="text-xs text-primary hover:underline flex items-center gap-1">
                  All marks <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-border">
                {recentMarks.map((m: any, i: number) => {
                  const pct = m.marks_obtained != null ? Math.round((m.marks_obtained / ((m.exams as any)?.total_marks || 100)) * 100) : null;
                  const grade = m.grade || (pct !== null ? `${pct}%` : "—");
                  return (
                    <div key={i} className="p-4 text-center">
                      <p className={`text-2xl font-bold ${gradeColor(grade)}`}>{grade}</p>
                      <p className="text-xs text-foreground font-medium mt-1 truncate">{(m.exams as any)?.name || "Exam"}</p>
                      {m.marks_obtained != null && (
                        <p className="text-xs text-muted-foreground mt-0.5">{m.marks_obtained}/{(m.exams as any)?.total_marks || 100}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Performance Radar ──────────────── */}
          {subjectRadarData.length >= 3 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Radar className="w-4 h-4 text-purple-500" /> Performance Radar
                </h3>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-4 p-4">
                <div className="flex-shrink-0">
                  <RadarChart subjects={subjectRadarData} />
                </div>
                <div className="flex-1 grid grid-cols-2 gap-2 min-w-0">
                  {subjectRadarData.map((s) => (
                    <div key={s.name} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-500 flex-shrink-0" />
                      <span className="text-xs text-foreground truncate flex-1">{s.name}</span>
                      <span className={`text-xs font-semibold flex-shrink-0 ${
                        s.pct >= 75 ? "text-green-500" : s.pct >= 50 ? "text-amber-500" : "text-destructive"
                      }`}>{s.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Personal Goal Tracker ──────────── */}
          {subjectRadarData.length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" /> 🎯 My Goals
                </h3>
              </div>
              <div className="p-4 space-y-4">
                {subjectRadarData.slice(0, 4).map((s) => {
                  const goalPct = goals[s.name] ?? 80;
                  const barFill = goalPct > 0 ? Math.min(100, Math.round((s.pct / goalPct) * 100)) : 100;
                  const achieved = s.pct >= goalPct;
                  const needed   = Math.max(0, goalPct - s.pct);
                  return (
                    <div key={s.name}>
                      <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                        <span className="text-sm font-medium text-foreground min-w-[80px]">{s.name}</span>
                        <div className="flex-1 min-w-[120px] h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${achieved ? "bg-green-500" : "bg-primary"}`}
                            ref={(el) => { if (el) el.style.width = `${barFill}%`; }}
                          />
                        </div>
                        <span className={`text-xs font-semibold flex-shrink-0 ${achieved ? "text-green-500" : "text-amber-500"}`}>
                          {s.pct}%
                        </span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">Goal:</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={goalPct}
                          onChange={(e) => updateGoal(s.name, Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                          title={`Goal percentage for ${s.name}`}
                          placeholder="80"
                          className="w-14 px-1.5 py-0.5 text-xs rounded border border-border bg-muted text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                      <p className={`text-xs font-medium ml-0 ${achieved ? "text-green-500" : "text-amber-500"}`}>
                        {achieved
                          ? "✓ Goal achieved!"
                          : `Need ${needed}% more for goal`}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Syllabus Progress ───────────────── */}
          {syllabusProgress.length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <BookText className="w-4 h-4 text-indigo-500" /> Syllabus Coverage
                </h3>
              </div>
              <div className="p-4 space-y-4">
                {syllabusProgress.map((s) => {
                  const pct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
                  return (
                    <div key={s.subject}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-foreground truncate max-w-[60%]">{s.subject}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {s.completed}/{s.total} topics &middot; {pct}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-blue-500" : "bg-amber-500"
                          }`}
                          ref={(el) => progressBarRef(el, pct)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Latest Notices ──────────────────── */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Bell className="w-4 h-4 text-purple-500" /> Latest Notices
              </h3>
              <Link to={`/${tenant}/student/notices`} className="text-xs text-primary hover:underline flex items-center gap-1">
                View all <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            {notices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No notices yet</p>
            ) : (
              <div className="divide-y divide-border">
                {notices.map(n => {
                  const pColor = n.priority === "high" || n.priority === "urgent" ? "bg-destructive" : n.priority === "medium" ? "bg-amber-400" : "bg-green-500";
                  return (
                    <div key={n.id} className="px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${pColor}`} />
                      <p className="text-sm font-medium flex-1">{n.title}</p>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{fmtDate(n.created_at)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Quick Actions ───────────────────── */}
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Quick Actions</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Apply Leave",    href: `/${tenant}/student/leaves`,     color: "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/20" },
                { label: "View Marks",     href: `/${tenant}/student/marks`,      color: "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 border-purple-500/20" },
                { label: "My Attendance",  href: `/${tenant}/student/attendance`, color: "bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20" },
                { label: "Pay Fees",       href: `/${tenant}/student/fees`,       color: "bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20" },
                { label: "My Documents",   href: `/${tenant}/student/documents`,  color: "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-500/20" },
                { label: "Notice Board",   href: `/${tenant}/student/notices`,    color: "bg-pink-500/10 text-pink-600 hover:bg-pink-500/20 border-pink-500/20" },
              ].map(a => (
                <Link key={a.href} to={a.href}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${a.color}`}>
                  {a.label}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
