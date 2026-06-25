import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  CalendarCheck,
  Wallet,
  Award,
  Bell,
  ChevronRight,
  Users,
  BookOpen,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  Calendar,
  MessageSquare,
  FileText,
  LogIn,
  Trophy,
  CalendarOff,
  CheckCircle2,
  X,
  Download,
} from "lucide-react";

export function ParentDashboard() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();
  const params = useParams();
  const tenant = params.tenantId as string;

  const [loading, setLoading] = useState(true);
  const [parentName, setParentName] = useState("");
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<any>(null);

  // Existing stats
  const [attendancePct, setAttendancePct] = useState<number | null>(null);
  const [lastMonthPct, setLastMonthPct] = useState<number | null>(null);
  const [pendingFees, setPendingFees] = useState<number | null>(null);
  const [feeDueDate, setFeeDueDate] = useState<string | null>(null);
  const [latestGrade, setLatestGrade] = useState<string | null>(null);
  const [pendingHw, setPendingHw] = useState<number | null>(null);
  const [notices, setNotices] = useState<any[]>([]);

  // New high-impact states
  const [todayAttendance, setTodayAttendance] = useState<"present" | "absent" | "not_marked">("not_marked");
  const [overdueHw, setOverdueHw] = useState<number | null>(null);
  const [nextPtmDays, setNextPtmDays] = useState<number | null>(null);
  const [feeAssignment, setFeeAssignment] = useState<{ amount: number; due_date: string } | null>(null);

  // Delight: push notifications
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");
  const realtimeChannelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  // Delight: exam results for report card
  const [examResults, setExamResults] = useState<{ subject: string; marks: number; maxMarks: number }[]>([]);

  // Medium-impact: rank & fee-due-soon & leave form
  const [rankPrev, setRankPrev] = useState<number | null>(null);
  const [rankCurr, setRankCurr] = useState<number | null>(null);
  const [feeDueSoon, setFeeDueSoon] = useState<{ amount: number; daysUntil: number } | null>(null);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveToast, setLeaveToast] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Parent name
      const { data: profile } = await supabase
        .from("users")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      if (profile) setParentName(profile.full_name || "");

      // Children — fetch name fields directly from students table, fallback chain
      const { data: kids } = await supabase
        .from("students")
        .select("id, user_id, class_id, enrollment_number, first_name, last_name, name, classes:class_id(grade_level, section)")
        .eq("school_id", schoolId)
        .eq("parent_user_id", user.id);

      if (kids && kids.length > 0) {
        // Resolve display name for each child
        const enriched = kids.map((k: any) => ({
          ...k,
          displayName:
            k.first_name && k.last_name
              ? `${k.first_name} ${k.last_name}`.trim()
              : k.first_name || k.last_name || k.name || k.enrollment_number || "Child",
        }));
        setChildren(enriched);
        setSelectedChild(enriched[0]);
      }

      // Notices
      const { data: noticeData } = await supabase
        .from("announcements")
        .select("id, title, type, created_at")
        .eq("school_id", schoolId)
        .in("audience", ["all", "parents"])
        .order("created_at", { ascending: false })
        .limit(4);
      setNotices(noticeData || []);

      setLoading(false);
    })();
  }, [schoolId]);

  useEffect(() => {
    if (!selectedChild || !schoolId) return;
    loadChildStats(selectedChild);
    loadExamResults(selectedChild);
  }, [selectedChild]);

  // Request notification permission once on mount
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission !== "denied") {
      Notification.requestPermission().then((perm) => setNotifPermission(perm));
    } else if (typeof Notification !== "undefined") {
      setNotifPermission(Notification.permission);
    }
  }, []);

  // Subscribe to realtime exam_results for the selected child
  useEffect(() => {
    if (!selectedChild) return;
    const childId = selectedChild.id;  // child tables key on students.id
    const childName = selectedChild.displayName;

    // Tear down previous channel
    if (realtimeChannelRef.current) {
      realtimeChannelRef.current.unsubscribe();
    }

    const channel = supabase
      .channel(`exam-results-${childId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "exam_marks",
          filter: `student_id=eq.${childId}`,
        },
        (payload: any) => {
          const { marks, max_marks, subject } = payload.new || {};
          const body = `${childName} scored ${marks}/${max_marks} in ${subject}!`;

          // Browser push notification
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification("🎉 New Exam Result!", {
              body,
              icon: "/favicon.ico",
            });
          }

          // In-app toast
          toast.success(`🎉 New Exam Result! ${body}`);
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [selectedChild]);

  async function loadChildStats(child: any) {
    const childId = child.id;  // child tables key on students.id
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // Current month range
    const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    // Last month range
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStart = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}-01`;
    const lastMonthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`; // exclusive

    const [
      { count: totalThis },
      { count: presentThis },
      { count: totalLast },
      { count: presentLast },
      { data: todayRecord },
      { data: lastMark },
    ] = await Promise.all([
      supabase.from("daily_attendance").select("*", { count: "exact", head: true }).eq("student_id", childId).gte("date", thisMonthStart),
      supabase.from("daily_attendance").select("*", { count: "exact", head: true }).eq("student_id", childId).eq("status", "present").gte("date", thisMonthStart),
      supabase.from("daily_attendance").select("*", { count: "exact", head: true }).eq("student_id", childId).gte("date", lastMonthStart).lt("date", lastMonthEnd),
      supabase.from("daily_attendance").select("*", { count: "exact", head: true }).eq("student_id", childId).eq("status", "present").gte("date", lastMonthStart).lt("date", lastMonthEnd),
      supabase.from("daily_attendance").select("status").eq("student_id", childId).eq("date", today).maybeSingle(),
      supabase.from("exam_marks").select("grade, marks_obtained, exams:exam_id(total_marks)").eq("student_id", childId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    // Today's attendance status
    if (todayRecord) {
      setTodayAttendance(todayRecord.status === "present" ? "present" : "absent");
    } else {
      setTodayAttendance("not_marked");
    }

    // This month attendance %
    if (totalThis) {
      setAttendancePct(Math.round(((presentThis || 0) / totalThis) * 100));
    }

    // Last month attendance %
    if (totalLast) {
      setLastMonthPct(Math.round(((presentLast || 0) / totalLast) * 100));
    } else {
      setLastMonthPct(null);
    }

    if (lastMark) {
      setLatestGrade(
        lastMark.grade ||
          `${Math.round((lastMark.marks_obtained / ((lastMark.exams as any)?.total_marks || 100)) * 100)}%`
      );
    }

    // Pending fees from fee_payments
    const { data: fees } = await supabase
      .from("fee_payments")
      .select("amount")
      .eq("school_id", schoolId)
      .eq("student_id", childId)
      .eq("status", "pending");
    const totalPending = (fees || []).reduce((s: number, f: any) => s + (f.amount || 0), 0);
    setPendingFees(totalPending);

    // Fee assignment due date chip
    const { data: feeAssignData } = await supabase
      .from("student_fee_assignments")
      .select("amount, due_date")
      .eq("student_id", childId)
      .eq("status", "pending")
      .order("due_date", { ascending: true })
      .limit(1)
      .maybeSingle();
    setFeeAssignment(feeAssignData || null);

    // Homework: active (due today or future) + overdue
    if (child.class_id) {
      const [{ count: activeHw }, { count: overdueCount }] = await Promise.all([
        supabase.from("homework")
          .select("*", { count: "exact", head: true })
          .eq("class_id", child.class_id)
          .eq("school_id", schoolId)
          .gte("due_date", today),
        supabase.from("homework")
          .select("*", { count: "exact", head: true })
          .eq("class_id", child.class_id)
          .eq("school_id", schoolId)
          .lt("due_date", today),
      ]);
      setPendingHw(activeHw || 0);
      setOverdueHw(overdueCount || 0);
    }

    // Next PTM
    const { data: ptm } = await supabase
      .from("ptm_meetings")
      .select("date")
      .eq("school_id", schoolId)
      .eq("status", "scheduled")
      .gt("date", today)
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (ptm?.date) {
      const diff = Math.ceil((new Date(ptm.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      setNextPtmDays(diff);
    } else {
      setNextPtmDays(null);
    }

    // ── Child rank: compare last 2 exams ─────────────────────────────────
    try {
      if (child.class_id) {
        // Get last 2 distinct exam_ids for this class
        const { data: studentIds } = await supabase
          .from("students")
          .select("id")
          .eq("class_id", child.class_id)
          .eq("school_id", schoolId);
        if (studentIds && studentIds.length > 1) {
          const ids = studentIds.map((s: any) => s.id);
          // Get marks for last 2 exams (by exam_id desc)
          const { data: allExamMarks } = await supabase
            .from("exam_marks")
            .select("student_id, exam_id, marks_obtained")
            .in("student_id", ids)
            .order("exam_id", { ascending: false });

          if (allExamMarks && allExamMarks.length > 0) {
            // Group by exam_id, get top 2
            const examIds: string[] = [];
            for (const row of allExamMarks) {
              if (!examIds.includes(row.exam_id)) examIds.push(row.exam_id);
              if (examIds.length === 2) break;
            }

            const rankForExam = (examId: string): number | null => {
              const examRows = allExamMarks.filter((r) => r.exam_id === examId);
              const myRow = examRows.find((r) => r.student_id === child.id);
              if (!myRow) return null;
              const myScore = myRow.marks_obtained || 0;
              return examRows.filter((r) => (r.marks_obtained || 0) > myScore).length + 1;
            };

            if (examIds.length >= 1) setRankCurr(rankForExam(examIds[0]));
            if (examIds.length >= 2) setRankPrev(rankForExam(examIds[1]));
            else setRankPrev(null);
          }
        }
      }
    } catch (_) {}

    // ── Fee due within 5 days ─────────────────────────────────────────────
    try {
      const fiveDaysLater = new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0];
      const { data: soonFees } = await supabase
        .from("student_fee_assignments")
        .select("amount, paid_amount, due_date")
        .eq("student_id", child.id)
        .eq("status", "pending")
        .lte("due_date", fiveDaysLater)
        .order("due_date", { ascending: true });
      if (soonFees && soonFees.length > 0) {
        const earliest = soonFees[0];
        const remaining = (earliest.amount || 0) - (earliest.paid_amount || 0);
        if (remaining > 0) {
          const daysUntil = Math.ceil((new Date(earliest.due_date).getTime() - Date.now()) / 86400000);
          setFeeDueSoon({ amount: remaining, daysUntil });
        } else {
          setFeeDueSoon(null);
        }
      } else {
        setFeeDueSoon(null);
      }
    } catch (_) {}
  }

  async function loadExamResults(child: any) {
    const childId = child.id;  // exam_marks keys on students.id
    const { data } = await supabase
      .from("exam_marks")
      .select("marks_obtained, exams:exam_id(subject, total_marks)")
      .eq("student_id", childId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (data && data.length > 0) {
      const rows = data.map((r: any) => ({
        subject: r.exams?.subject || "—",
        marks: r.marks_obtained || 0,
        maxMarks: r.exams?.total_marks || 100,
      }));
      setExamResults(rows);
    }
  }

  function getGrade(pct: number): string {
    if (pct >= 90) return "A+";
    if (pct >= 80) return "A";
    if (pct >= 70) return "B+";
    if (pct >= 60) return "B";
    return "C";
  }

  function downloadReportCard() {
    if (!selectedChild) return;
    const childName = selectedChild.displayName;
    const cls = selectedChild.classes as any;
    const className = cls ? `${cls.grade_level} - ${cls.section}` : "—";

    const examRows =
      examResults.length > 0
        ? examResults
            .map((r) => {
              const pct = Math.round((r.marks / r.maxMarks) * 100);
              return `<tr><td>${r.subject}</td><td>${r.marks}</td><td>${r.maxMarks}</td><td>${pct}%</td><td>${getGrade(pct)}</td></tr>`;
            })
            .join("")
        : '<tr><td colspan="5" style="text-align:center;color:#999">No exam records found</td></tr>';

    const attendanceStr = attendancePct !== null ? `${attendancePct}` : "—";

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Report Card - ${childName}</title>
      <style>
        body { font-family: Arial; padding: 40px; }
        h1 { color: #C44BC4; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f5f5f5; }
        .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
      </style></head>
      <body>
        <div class="header">
          <div><h1>Report Card</h1><p>Academic Year 2024-25</p></div>
          <div><h2>${childName}</h2><p>Class: ${className}</p></div>
        </div>
        <table>
          <tr><th>Subject</th><th>Marks</th><th>Max</th><th>%</th><th>Grade</th></tr>
          ${examRows}
        </table>
        <p style="margin-top:20px">Attendance: ${attendanceStr}%</p>
      </body></html>
    `);
    win.document.close();
    win.print();
  }

  async function submitLeave() {
    if (!selectedChild || !schoolId || !leaveFrom || !leaveTo || !leaveReason.trim()) return;
    setLeaveSubmitting(true);
    try {
      const { error } = await supabase.from("leave_requests").insert({
        student_id: selectedChild.id,
        school_id: schoolId,
        class_id: selectedChild.class_id,
        from_date: leaveFrom,
        to_date: leaveTo,
        reason: leaveReason.trim(),
        status: "pending",
      });
      if (error) throw error;
      setLeaveToast({ ok: true, msg: "Leave applied successfully!" });
      setShowLeaveForm(false);
      setLeaveFrom(""); setLeaveTo(""); setLeaveReason("");
    } catch (e: any) {
      setLeaveToast({ ok: false, msg: e?.message || "Failed to submit leave." });
    } finally {
      setLeaveSubmitting(false);
      setTimeout(() => setLeaveToast(null), 4000);
    }
  }

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  // Attendance trend
  const attendanceDiff =
    attendancePct !== null && lastMonthPct !== null ? attendancePct - lastMonthPct : null;

  const TrendIcon =
    attendanceDiff === null ? null : attendanceDiff > 0 ? TrendingUp : attendanceDiff < 0 ? TrendingDown : Minus;

  const trendColor =
    attendanceDiff === null
      ? ""
      : attendanceDiff > 0
      ? "text-[hsl(var(--chart-2))]"
      : attendanceDiff < 0
      ? "text-destructive"
      : "text-muted-foreground";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {parentName || "Parent"}! 👋</h1>
          <p className="text-sm text-muted-foreground mt-1">Track your child's progress at a glance</p>
        </div>
        {notifPermission === "granted" && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-green-500/10 text-green-600 border border-green-500/30 self-center">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            🔔 Notifications enabled
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : children.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="font-medium">No children linked to your account</p>
          <p className="text-sm text-muted-foreground mt-1">Contact school admin to link your child's profile</p>
        </div>
      ) : (
        <>
          {/* Child selector */}
          {children.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {children.map((c) => (
                <button
                  key={c.user_id}
                  type="button"
                  onClick={() => setSelectedChild(c)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    selectedChild?.user_id === c.user_id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {c.displayName}
                </button>
              ))}
            </div>
          )}

          {selectedChild && (
            <div className="bg-card border border-border rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
                {(selectedChild.displayName || "?")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{selectedChild.displayName}</p>
                <p className="text-xs text-muted-foreground">
                  Class {(selectedChild.classes as any)?.grade_level} -{" "}
                  {(selectedChild.classes as any)?.section}
                </p>
              </div>

              {/* Today attendance badge */}
              {todayAttendance === "present" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[hsl(var(--chart-2)/0.15)] text-[hsl(var(--chart-2))] border border-[hsl(var(--chart-2)/0.3)]">
                  <span className="w-2 h-2 rounded-full bg-[hsl(var(--chart-2))] animate-pulse" />
                  ✓ In School Today
                </span>
              )}
              {todayAttendance === "absent" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/30">
                  <span className="w-2 h-2 rounded-full bg-destructive" />
                  ✗ Absent Today
                </span>
              )}
              {todayAttendance === "not_marked" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                  Not Yet Marked
                </span>
              )}
            </div>
          )}

          {/* Alert chips row */}
          <div className="flex flex-wrap gap-2">
            {/* Overdue homework alert */}
            {overdueHw !== null && overdueHw > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/30">
                <AlertCircle className="w-3.5 h-3.5" />
                {overdueHw} Homework Overdue
              </span>
            )}

            {/* Next PTM countdown */}
            {nextPtmDays !== null && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[hsl(var(--chart-3)/0.15)] text-[hsl(var(--chart-3))] border border-[hsl(var(--chart-3)/0.3)]">
                <Calendar className="w-3.5 h-3.5" />
                PTM in {nextPtmDays} day{nextPtmDays !== 1 ? "s" : ""}
              </span>
            )}

            {/* Fee due chip (existing — any pending) */}
            {feeAssignment && !feeDueSoon && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/50">
                <Wallet className="w-3.5 h-3.5" />
                ₹{feeAssignment.amount.toLocaleString("en-IN")} due by{" "}
                {fmtDate(feeAssignment.due_date)}
              </span>
            )}

            {/* Fee due within 5 days — amber/red chip */}
            {feeDueSoon && (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                feeDueSoon.daysUntil < 0
                  ? "bg-destructive/10 text-destructive border-destructive/50"
                  : "bg-amber-500/10 text-amber-600 border-amber-500/40"
              }`}>
                <Wallet className="w-3.5 h-3.5" />
                {feeDueSoon.daysUntil < 0
                  ? `⚠️ Fee overdue — ₹${feeDueSoon.amount.toLocaleString("en-IN")}`
                  : feeDueSoon.daysUntil === 0
                  ? `⚠️ Fee due today — ₹${feeDueSoon.amount.toLocaleString("en-IN")}`
                  : `⚠️ Fee due in ${feeDueSoon.daysUntil} day${feeDueSoon.daysUntil !== 1 ? "s" : ""} — ₹${feeDueSoon.amount.toLocaleString("en-IN")}`}
              </span>
            )}

            {/* Rank chip */}
            {rankCurr !== null && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/30">
                <Trophy className="w-3.5 h-3.5" />
                Rank: {rankPrev !== null ? (
                  <>
                    #{rankPrev} → #{rankCurr}
                    {rankCurr < rankPrev ? " ↑" : rankCurr > rankPrev ? " ↓" : " →"}
                  </>
                ) : (
                  `#${rankCurr}`
                )}
              </span>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link
              to={`/${tenant}/parent/attendance`}
              className="bg-card border border-border rounded-xl p-5 hover:border-primary/50 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <CalendarCheck className="w-5 h-5 text-primary" />
              </div>
              <div className="flex items-end gap-2">
                <p className="text-2xl font-bold">
                  {attendancePct !== null ? `${attendancePct}%` : "—"}
                </p>
                {TrendIcon && (
                  <span className={`flex items-center gap-0.5 text-xs font-semibold mb-1 ${trendColor}`}>
                    <TrendIcon className="w-3.5 h-3.5" />
                    {Math.abs(attendanceDiff!)}%
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Attendance (this month)</p>
              {lastMonthPct !== null && (
                <p className="text-xs text-muted-foreground mt-0.5">Last month: {lastMonthPct}%</p>
              )}
              {attendancePct !== null && attendancePct < 75 && (
                <p className="text-xs text-destructive mt-1 font-medium">⚠ Below 75%</p>
              )}
            </Link>

            <Link
              to={`/${tenant}/parent/fees`}
              className="bg-card border border-border rounded-xl p-5 hover:border-destructive/50 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center mb-3">
                <Wallet className="w-5 h-5 text-destructive" />
              </div>
              <p className="text-2xl font-bold">
                {pendingFees !== null
                  ? pendingFees > 0
                    ? `₹${pendingFees.toLocaleString("en-IN")}`
                    : "Paid ✓"
                  : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Pending Fees</p>
            </Link>

            <Link
              to={`/${tenant}/parent/marks`}
              className="bg-card border border-border rounded-xl p-5 hover:border-[hsl(var(--chart-2)/0.5)] transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-[hsl(var(--chart-2)/0.1)] flex items-center justify-center mb-3">
                <Award className="w-5 h-5 text-[hsl(var(--chart-2))]" />
              </div>
              <p className="text-2xl font-bold">{latestGrade || "—"}</p>
              <p className="text-xs text-muted-foreground mt-1">Latest Exam Grade</p>
            </Link>

            <div className="bg-card border border-border rounded-xl p-5">
              <div className="w-10 h-10 rounded-lg bg-[hsl(var(--chart-1)/0.1)] flex items-center justify-center mb-3">
                <BookOpen className="w-5 h-5 text-[hsl(var(--chart-1))]" />
              </div>
              <p className="text-2xl font-bold">{pendingHw !== null ? pendingHw : "—"}</p>
              <p className="text-xs text-muted-foreground mt-1">Active Homework</p>
              {overdueHw !== null && overdueHw > 0 && (
                <p className="text-xs text-destructive mt-1 font-medium">{overdueHw} overdue</p>
              )}
            </div>
          </div>

          {/* Quick actions row */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              Quick Actions
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              <Link
                to={`/${tenant}/parent/attendance`}
                className="flex flex-col items-center gap-2 p-4 bg-card border border-border rounded-xl hover:border-primary/40 hover:bg-muted/40 transition-colors text-center"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CalendarCheck className="w-4 h-4 text-primary" />
                </div>
                <span className="text-xs font-medium leading-tight">View Attendance</span>
              </Link>

              <Link
                to={`/${tenant}/parent/fees`}
                className="flex flex-col items-center gap-2 p-4 bg-card border border-border rounded-xl hover:border-destructive/40 hover:bg-muted/40 transition-colors text-center"
              >
                <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-destructive" />
                </div>
                <span className="text-xs font-medium leading-tight">Pay Fees</span>
              </Link>

              <Link
                to={`/${tenant}/parent/marks`}
                className="flex flex-col items-center gap-2 p-4 bg-card border border-border rounded-xl hover:border-[hsl(var(--chart-2)/0.4)] hover:bg-muted/40 transition-colors text-center"
              >
                <div className="w-9 h-9 rounded-lg bg-[hsl(var(--chart-2)/0.1)] flex items-center justify-center">
                  <Award className="w-4 h-4 text-[hsl(var(--chart-2))]" />
                </div>
                <span className="text-xs font-medium leading-tight">View Marks</span>
              </Link>

              <Link
                to={`/${tenant}/parent/leave`}
                className="flex flex-col items-center gap-2 p-4 bg-card border border-border rounded-xl hover:border-[hsl(var(--chart-3)/0.4)] hover:bg-muted/40 transition-colors text-center"
              >
                <div className="w-9 h-9 rounded-lg bg-[hsl(var(--chart-3)/0.1)] flex items-center justify-center">
                  <LogIn className="w-4 h-4 text-[hsl(var(--chart-3))]" />
                </div>
                <span className="text-xs font-medium leading-tight">Apply Leave</span>
              </Link>

              <Link
                to={`/${tenant}/parent/inbox`}
                className="flex flex-col items-center gap-2 p-4 bg-card border border-border rounded-xl hover:border-[hsl(var(--chart-4)/0.4)] hover:bg-muted/40 transition-colors text-center"
              >
                <div className="w-9 h-9 rounded-lg bg-[hsl(var(--chart-4)/0.1)] flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-[hsl(var(--chart-4))]" />
                </div>
                <span className="text-xs font-medium leading-tight">Messages</span>
              </Link>

              <button
                type="button"
                onClick={downloadReportCard}
                className="flex flex-col items-center gap-2 p-4 bg-card border border-border rounded-xl hover:border-purple-500/40 hover:bg-muted/40 transition-colors text-center"
              >
                <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Download className="w-4 h-4 text-purple-500" />
                </div>
                <span className="text-xs font-medium leading-tight">Download Report Card</span>
              </button>
            </div>
          </div>

          {/* ── Apply Leave ─────────────────────────────────────────────── */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <CalendarOff className="w-4 h-4 text-amber-500" /> Apply Leave for {selectedChild?.displayName}
              </h3>
              <button
                type="button"
                onClick={() => setShowLeaveForm((v) => !v)}
                className="text-xs font-semibold px-3 py-1 rounded-lg bg-amber-500/10 text-amber-600 border border-amber-500/25 hover:bg-amber-500/20 transition-colors"
              >
                {showLeaveForm ? "Cancel" : "Apply Leave"}
              </button>
            </div>
            {showLeaveForm && (
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">From Date</label>
                    <input
                      type="date"
                      value={leaveFrom}
                      placeholder="YYYY-MM-DD"
                      title="Leave from date"
                      onChange={(e) => setLeaveFrom(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">To Date</label>
                    <input
                      type="date"
                      value={leaveTo}
                      placeholder="YYYY-MM-DD"
                      title="Leave to date"
                      onChange={(e) => setLeaveTo(e.target.value)}
                      min={leaveFrom}
                      className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Reason</label>
                  <input
                    type="text"
                    placeholder="e.g. Family function, Medical appointment…"
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <button
                  type="button"
                  disabled={leaveSubmitting || !leaveFrom || !leaveTo || !leaveReason.trim()}
                  onClick={submitLeave}
                  className="px-4 py-2 rounded-lg bg-amber-500 text-foreground text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {leaveSubmitting ? "Submitting…" : "Submit Leave Request"}
                </button>
              </div>
            )}
          </div>

          {/* Toast */}
          {leaveToast && (
            <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium ${
              leaveToast.ok
                ? "bg-card border-green-500/40 text-green-600"
                : "bg-card border-destructive/40 text-destructive"
            }`}>
              {leaveToast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {leaveToast.msg}
              <button type="button" title="Dismiss" onClick={() => setLeaveToast(null)} className="ml-1 opacity-60 hover:opacity-100">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Notices */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" /> School Notices
              </h3>
              <Link
                to={`/${tenant}/parent/inbox`}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                View all <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            {notices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No notices yet</p>
            ) : (
              <div className="divide-y divide-border">
                {notices.map((n) => (
                  <div
                    key={n.id}
                    className="px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">{n.title}</p>
                      {n.type && (
                        <span className="text-xs text-muted-foreground capitalize">{n.type}</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {fmtDate(n.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
