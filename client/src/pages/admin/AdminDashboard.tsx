import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Users, GraduationCap, Banknote, CalendarDays, TrendingUp, Clock, Cake, AlertTriangle, MessageCircle, ShieldAlert, Bus, HeartPulse, Receipt, X, Printer, Trophy } from "lucide-react";
import { toast } from "sonner";

type DashboardStats = {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  todayPresent: number;
  todayAbsent: number;
  todayTotal: number;
  pendingFees: number;
  pendingFeesCount: number;
  upcomingExams: { title: string; exam_date: string; class_id: string }[];
  recentAdmissions: { student_name: string; applying_for_class: string; applied_at: string; status: string }[];
  recentStudents: { name: string; admission_number: string; created_at: string }[];
};

type BirthdayPerson = { name: string; type: "student" | "teacher" };
type FeeCollectionData = { todayCollected: number };
type AttendanceFlagData = { below75Count: number };
type ImmediateExam = { title: string; exam_date: string; daysLeft: number };
type AdmissionSparkPoint = { date: string; count: number };

// Feature 3: Receipt
type RecentPayment = {
  id: string;
  student_name: string;
  amount: number;
  created_at: string;
  payment_mode?: string;
};

// Feature 5: Health expiry
type HealthExpiryStudent = { id: string; name: string; health_record_expiry?: string };

export function AdminDashboard() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalTeachers: 0,
    totalClasses: 0,
    todayPresent: 0,
    todayAbsent: 0,
    todayTotal: 0,
    pendingFees: 0,
    pendingFeesCount: 0,
    upcomingExams: [],
    recentAdmissions: [],
    recentStudents: [],
  });
  const [loading, setLoading] = useState(true);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  // New high-impact states
  const [birthdays, setBirthdays] = useState<BirthdayPerson[]>([]);
  const [feeCollection, setFeeCollection] = useState<FeeCollectionData>({ todayCollected: 0 });
  const [attendanceFlag, setAttendanceFlag] = useState<AttendanceFlagData>({ below75Count: 0 });
  const [immediateExam, setImmediateExam] = useState<ImmediateExam | null>(null);

  // Medium-impact states
  const [admissionSparkline, setAdmissionSparkline] = useState<AdmissionSparkPoint[]>([]);
  const [staffOnLeaveCount, setStaffOnLeaveCount] = useState<number>(0);
  const [feeDueThisWeekCount, setFeeDueThisWeekCount] = useState<number>(0);

  // Feature 3: Receipt
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  const [receiptPayment, setReceiptPayment] = useState<RecentPayment | null>(null);
  const [schoolName, setSchoolName] = useState<string>("");

  // Feature 4: Bus alert
  const [busMessage, setBusMessage] = useState("");
  const [sendingBusAlert, setSendingBusAlert] = useState(false);

  // Feature 5: Health expiry
  const [healthExpiryStudents, setHealthExpiryStudents] = useState<HealthExpiryStudent[]>([]);
  const [healthColumnExists, setHealthColumnExists] = useState(true);

  // Topper of the Month
  type TopperData = { name: string; avg: number };
  const [topper, setTopper] = useState<TopperData | null>(null);
  const [announcingTopper, setAnnouncingTopper] = useState(false);

  // Delight Feature 2: confetti flag
  const confettiFiredRef = useRef(false);

  // Delight Feature 3: admissions card pulse ref
  const admissionsCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!schoolId) return;
    async function fetchStats() {
      setLoading(true);
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const todayMonth = String(now.getMonth() + 1).padStart(2, "0");
      const todayDay = String(now.getDate()).padStart(2, "0");

      const [
        studentsRes,
        teachersRes,
        classesRes,
        attendancePresentRes,
        attendanceAbsentRes,
        attendanceTotalRes,
        pendingFeesRes,
        upcomingExamsRes,
        recentAdmissionsRes,
        recentStudentsRes,
        // New fetches
        studentBirthdaysRes,
        teacherBirthdaysRes,
        todayFeeRes,
        allAttendanceRes,
        immediateExamsRes,
        // Feature 3: recent payments
        recentPaymentsRes,
        // school name
        schoolRes,
      ] = await Promise.all([
        supabase.from("students").select("*", { count: "exact", head: true }).eq("school_id", schoolId),
        supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("school_id", schoolId).eq("role", "teacher"),
        supabase.from("classes").select("*", { count: "exact", head: true }).eq("school_id", schoolId),
        supabase.from("daily_attendance").select("*", { count: "exact", head: true }).eq("school_id", schoolId).eq("date", today).eq("status", "present"),
        supabase.from("daily_attendance").select("*", { count: "exact", head: true }).eq("school_id", schoolId).eq("date", today).eq("status", "absent"),
        supabase.from("daily_attendance").select("*", { count: "exact", head: true }).eq("school_id", schoolId).eq("date", today),
        supabase.rpc("pending_fees_summary", { p_school: schoolId }),
        supabase.from("exams").select("title, exam_date, class_id").eq("school_id", schoolId).gte("exam_date", today).lte("exam_date", in7Days).order("exam_date").limit(5),
        supabase.from("admission_applications").select("student_name, applying_for_class, applied_at, status").eq("school_id", schoolId).order("applied_at", { ascending: false }).limit(5),
        supabase.from("students").select("name, admission_number, created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(5),
        // Birthdays: students with a birthday TODAY (computed in DB, no 1000-row cap)
        supabase.rpc("students_birthdays_today", { p_school: schoolId }),
        // Birthdays: teachers (via profiles joined through user_roles)
        supabase.from("user_roles").select("user_id, profiles(full_name, date_of_birth)").eq("school_id", schoolId).eq("role", "teacher"),
        // Today's fee payments
        supabase.from("fee_payments").select("amount").eq("school_id", schoolId).gte("created_at", `${today}T00:00:00`).lte("created_at", `${today}T23:59:59`),
        // Below-75% count computed in the DB (handles 1M+ attendance rows)
        supabase.rpc("students_below_attendance", { p_school: schoolId, p_threshold: 0.75, p_days: 30 }),
        // Immediate exams (within 3 days)
        supabase.from("exams").select("title, exam_date").eq("school_id", schoolId).gte("exam_date", today).lte("exam_date", in3Days).order("exam_date").limit(1),
        // Feature 3: recent payments with student names
        supabase.from("fee_payments").select("id, amount, created_at, payment_mode, student_id, students(name)").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(5),
        // school name
        supabase.from("schools").select("name").eq("id", schoolId).maybeSingle(),
      ]);

      const pendingTotal = Number(pendingFeesRes.data?.[0]?.total || 0);
      const pendingFeesCnt = Number(pendingFeesRes.data?.[0]?.cnt || 0);

      setStats({
        totalStudents: studentsRes.count || 0,
        totalTeachers: teachersRes.count || 0,
        totalClasses: classesRes.count || 0,
        todayPresent: attendancePresentRes.count || 0,
        todayAbsent: attendanceAbsentRes.count || 0,
        todayTotal: attendanceTotalRes.count || 0,
        pendingFees: pendingTotal,
        pendingFeesCount: pendingFeesCnt,
        upcomingExams: (upcomingExamsRes.data || []) as DashboardStats["upcomingExams"],
        recentAdmissions: (recentAdmissionsRes.data || []) as DashboardStats["recentAdmissions"],
        recentStudents: (recentStudentsRes.data || []) as DashboardStats["recentStudents"],
      });

      // Process birthdays — students already filtered to today by the RPC
      const bdayList: BirthdayPerson[] = [];
      for (const s of studentBirthdaysRes.data || []) {
        bdayList.push({ name: s.name, type: "student" });
      }
      for (const tr of teacherBirthdaysRes.data || []) {
        const profile = (tr as any).profiles;
        if (!profile?.date_of_birth) continue;
        const dob = new Date(profile.date_of_birth);
        const m = String(dob.getMonth() + 1).padStart(2, "0");
        const d = String(dob.getDate()).padStart(2, "0");
        if (m === todayMonth && d === todayDay) bdayList.push({ name: profile.full_name || "Teacher", type: "teacher" });
      }
      setBirthdays(bdayList);

      // Fee collection
      const todayCollected = (todayFeeRes.data || []).reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
      setFeeCollection({ todayCollected });

      // Below-75% attendance flag (computed server-side via RPC)
      setAttendanceFlag({ below75Count: Number(allAttendanceRes.data || 0) });

      // Immediate exam alert
      const exams = immediateExamsRes.data || [];
      if (exams.length > 0) {
        const ex = exams[0];
        const examDate = new Date(ex.exam_date);
        const msLeft = examDate.getTime() - now.getTime();
        const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
        setImmediateExam({ title: ex.title, exam_date: ex.exam_date, daysLeft: Math.max(0, daysLeft) });
      } else {
        setImmediateExam(null);
      }

      // Feature 3: set recent payments
      const payments = (recentPaymentsRes.data || []).map((p: any) => ({
        id: p.id,
        student_name: p.students?.name || "Unknown Student",
        amount: p.amount || 0,
        created_at: p.created_at,
        payment_mode: p.payment_mode || "Cash",
      }));
      setRecentPayments(payments);

      // School name
      if (schoolRes.data?.name) setSchoolName(schoolRes.data.name);

      // Delight Feature 2: confetti when all fees are cleared
      const pendingCount = pendingFeesCnt;
      const totalStudentCount = studentsRes.count || 0;
      if (pendingCount === 0 && totalStudentCount > 0 && !confettiFiredRef.current) {
        confettiFiredRef.current = true;
        launchConfetti();
        toast.success("🎉 All fees cleared! Amazing!");
      }

      setLoading(false);
    }
    fetchStats();
  }, [schoolId]);

  // Topper of the Month fetch
  useEffect(() => {
    if (!schoolId) return;
    async function fetchTopper() {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

      const { data: results } = await supabase
        .from("exam_results")
        .select("student_id, marks_obtained, max_marks")
        .eq("school_id", schoolId)
        .gte("created_at", `${monthStart}T00:00:00`)
        .lte("created_at", `${monthEnd}T23:59:59`);

      if (!results || results.length === 0) return;

      const studentMap: Record<string, { total: number; count: number }> = {};
      for (const r of results) {
        const pct = (r.marks_obtained / (r.max_marks || 100)) * 100;
        if (!studentMap[r.student_id]) studentMap[r.student_id] = { total: 0, count: 0 };
        studentMap[r.student_id].total += pct;
        studentMap[r.student_id].count += 1;
      }

      let topStudentId = "";
      let topAvg = -1;
      for (const [sid, data] of Object.entries(studentMap)) {
        const avg = data.total / data.count;
        if (avg > topAvg) { topAvg = avg; topStudentId = sid; }
      }

      if (!topStudentId) return;

      const { data: student } = await supabase
        .from("students")
        .select("name")
        .eq("id", topStudentId)
        .maybeSingle();

      if (student?.name) {
        setTopper({ name: student.name, avg: Math.round(topAvg) });
      }
    }
    fetchTopper();
  }, [schoolId]);

  async function handleAnnounceTopper() {
    if (!topper) return;
    setAnnouncingTopper(true);
    try {
      const { error } = await supabase.from("announcements").insert({
        school_id: schoolId,
        title: `🏆 Topper of the Month: ${topper.name}`,
        content: `${topper.name} scored ${topper.avg}% average this month — Congratulations!`,
        audience: "all",
      });
      if (error) throw error;
      toast.success("Announcement sent!");
    } catch {
      toast.error("Failed to send announcement.");
    } finally {
      setAnnouncingTopper(false);
    }
  }

  // Medium-impact features fetch
  useEffect(() => {
    if (!schoolId) return;
    async function fetchMediumStats() {
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const ago7Days = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const [admissionsRes, leavesRes, feeDueRes] = await Promise.all([
        // Admissions in last 7 days
        supabase
          .from("admission_applications")
          .select("applied_at")
          .eq("school_id", schoolId)
          .gte("applied_at", `${ago7Days}T00:00:00`),
        // Staff on leave today (try teacher_leaves first)
        supabase
          .from("teacher_leaves")
          .select("id", { count: "exact", head: true })
          .eq("school_id", schoolId)
          .eq("status", "approved")
          .lte("start_date", today)
          .gte("end_date", today),
        // Fee due this week
        supabase
          .from("student_fee_assignments")
          .select("id", { count: "exact", head: true })
          .eq("school_id", schoolId)
          .eq("status", "pending")
          .gte("due_date", today)
          .lte("due_date", in7Days),
      ]);

      // Build 7-day sparkline
      const days: AdmissionSparkPoint[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        days.push({ date: d, count: 0 });
      }
      for (const row of admissionsRes.data || []) {
        const d = (row.applied_at as string).split("T")[0];
        const point = days.find(p => p.date === d);
        if (point) point.count += 1;
      }
      setAdmissionSparkline(days);

      setStaffOnLeaveCount(leavesRes.count || 0);
      setFeeDueThisWeekCount(feeDueRes.count || 0);

      // Feature 5: health record expiry
      try {
        const { data: healthData, error: healthErr } = await supabase
          .from("students")
          .select("id, name, health_record_expiry")
          .eq("school_id", schoolId)
          .not("health_record_expiry", "is", null)
          .gte("health_record_expiry", today)
          .lte("health_record_expiry", in30Days)
          .order("health_record_expiry");

        if (healthErr && (healthErr.message?.includes("column") || healthErr.code === "42703")) {
          setHealthColumnExists(false);
        } else {
          setHealthColumnExists(true);
          setHealthExpiryStudents((healthData || []) as HealthExpiryStudent[]);
        }
      } catch {
        setHealthColumnExists(false);
      }
    }
    fetchMediumStats();
  }, [schoolId]);

  // Delight Feature 3: Realtime new admission ping
  useEffect(() => {
    if (!schoolId) return;
    const channel = supabase
      .channel(`admissions-realtime-${schoolId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "admission_applications",
          filter: `school_id=eq.${schoolId}`,
        },
        (payload) => {
          const name = (payload.new as any)?.student_name || "a student";
          toast.info(`🔔 New admission application from ${name}!`);
          // Flash the admissions card
          const card = admissionsCardRef.current;
          if (card) {
            card.classList.add("animate-pulse");
            setTimeout(() => card.classList.remove("animate-pulse"), 2000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [schoolId]);

  const attendancePct = stats.todayTotal > 0 ? Math.round((stats.todayPresent / stats.todayTotal) * 100) : null;
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const todayIso = new Date().toISOString().split("T")[0];

  // Delight Feature 1: time-based greeting
  const currentHour = new Date().getHours();
  const greetingWord =
    currentHour >= 5 && currentHour < 12
      ? "Good Morning"
      : currentHour >= 12 && currentHour < 17
      ? "Good Afternoon"
      : currentHour >= 17 && currentHour < 21
      ? "Good Evening"
      : "Welcome";
  const greetingEmoji =
    currentHour >= 5 && currentHour < 12
      ? "🌤️"
      : currentHour >= 12 && currentHour < 17
      ? "☀️"
      : currentHour >= 17 && currentHour < 21
      ? "🌆"
      : "🌙";

  async function handleSendWhatsApp() {
    setSendingWhatsApp(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ type: "absent_alert", schoolId, data: { date: todayIso } }),
      });
      if (res.ok) {
        toast.success(`WhatsApp alerts sent to parents of ${stats.todayAbsent} absent student(s).`);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.message || "Failed to send WhatsApp alerts.");
      }
    } catch {
      toast.error("Network error while sending WhatsApp alerts.");
    } finally {
      setSendingWhatsApp(false);
    }
  }

  // Feature 4: Bus delay alert
  async function handleSendBusAlert() {
    if (!busMessage.trim()) {
      toast.error("Please enter a delay message.");
      return;
    }
    setSendingBusAlert(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ type: "bus_delay", schoolId, data: { message: busMessage } }),
      });
      if (res.ok) {
        toast.success("Bus delay alert sent to all parents!");
        setBusMessage("");
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.message || "Failed to send bus alert.");
      }
    } catch {
      toast.error("Network error while sending bus alert.");
    } finally {
      setSendingBusAlert(false);
    }
  }

  return (
    <div>
      {/* Confetti CSS keyframes — injected once, no inline styles in JSX */}
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(-20px) rotate(0deg);   opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .confetti-piece {
          position: fixed;
          width: 8px;
          height: 8px;
          border-radius: 2px;
          pointer-events: none;
          z-index: 9999;
          animation: confetti-fall 3s ease-in forwards;
        }
      `}</style>

      <div className="page-header">
        <div>
          {schoolName ? (
            <h1 className="text-2xl font-bold">
              <span className="bg-gradient-to-r from-fuchsia-400 to-orange-400 bg-clip-text text-transparent">
                {greetingWord}, {schoolName}!
              </span>
              {" "}{greetingEmoji}
            </h1>
          ) : (
            <h1>Dashboard</h1>
          )}
          <p className="text-muted-foreground text-sm mt-0.5">{today}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Loading dashboard…</div>
      ) : (
        <>
          {/* Exam Alert Banner */}
          {immediateExam && (
            <div
              className={`mb-5 flex items-center gap-3 rounded-xl border px-5 py-3 ${
                immediateExam.daysLeft <= 1
                  ? "bg-red-500/[0.08] border-red-500/40"
                  : "bg-amber-400/10 border-amber-400/50"
              }`}
            >
              <AlertTriangle
                className={`w-5 h-5 flex-shrink-0 ${immediateExam.daysLeft <= 1 ? "text-red-500" : "text-amber-500"}`}
              />
              <div className="flex-1 min-w-0">
                <span className={`font-semibold text-sm ${immediateExam.daysLeft <= 1 ? "text-red-500" : "text-amber-700"}`}>
                  {immediateExam.daysLeft === 0 ? "Exam today!" : immediateExam.daysLeft === 1 ? "Exam tomorrow!" : `Exam in ${immediateExam.daysLeft} days:`}
                </span>{" "}
                <span className="text-sm text-foreground font-medium">{immediateExam.title}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  ({new Date(immediateExam.exam_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })})
                </span>
              </div>
            </div>
          )}

          {/* Top stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Total Students"
              value={stats.totalStudents.toLocaleString("en-IN")}
              icon={<Users className="w-5 h-5 text-blue-500" />}
              accent="card-accent-blue"
            />
            <StatCard
              label="Teachers"
              value={stats.totalTeachers.toLocaleString("en-IN")}
              icon={<GraduationCap className="w-5 h-5 text-emerald-500" />}
              accent="card-accent-green"
            />
            <StatCard
              label="Classes"
              value={stats.totalClasses.toLocaleString("en-IN")}
              icon={<CalendarDays className="w-5 h-5 text-purple-500" />}
              accent="card-accent-purple"
            />
            <StatCard
              label="Pending Fees"
              value={`₹${stats.pendingFees.toLocaleString("en-IN")}`}
              sub={`${stats.pendingFeesCount} students`}
              icon={<Banknote className="w-5 h-5 text-amber-500" />}
              accent="card-accent-orange"
            />
          </div>

          {/* High-impact row: Birthdays + Fee Progress + Absent WhatsApp + Low Attendance */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Birthdays */}
            <div className="bg-card rounded-xl border border-border p-5 shadow-sm flex flex-col gap-2">
              <div className="flex items-center gap-2 mb-1">
                <Cake className="w-4 h-4 text-pink-500" />
                <h2 className="font-semibold text-sm">Today's Birthdays</h2>
              </div>
              {birthdays.length === 0 ? (
                <p className="text-xs text-muted-foreground">No birthdays today.</p>
              ) : (
                <div className="space-y-1.5">
                  {birthdays.map((b, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-base">🎂</span>
                      <div>
                        <p className="text-sm font-medium leading-tight">{b.name}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{b.type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Daily Fee Collection */}
            <div className="bg-card rounded-xl border border-border p-5 shadow-sm flex flex-col gap-2">
              <div className="flex items-center gap-2 mb-1">
                <Banknote className="w-4 h-4 text-green-500" />
                <h2 className="font-semibold text-sm">Today's Fee Collection</h2>
              </div>
              <p className="text-2xl font-bold">₹{feeCollection.todayCollected.toLocaleString("en-IN")}</p>
              {stats.pendingFees > 0 ? (
                <>
                  <FeeProgressBar collected={feeCollection.todayCollected} pending={stats.pendingFees} />
                  <p className="text-xs text-muted-foreground">
                    {Math.min(100, Math.round((feeCollection.todayCollected / (feeCollection.todayCollected + stats.pendingFees)) * 100))}% of total collected
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Collected today</p>
              )}
            </div>

            {/* Absent Students + WhatsApp */}
            <div className="bg-card rounded-xl border border-border p-5 shadow-sm flex flex-col gap-2">
              <div className="flex items-center gap-2 mb-1">
                <MessageCircle className="w-4 h-4 text-orange-500" />
                <h2 className="font-semibold text-sm">Absent Today</h2>
              </div>
              <p className="text-2xl font-bold text-red-500">{stats.todayAbsent}</p>
              <p className="text-xs text-muted-foreground mb-1">student(s) absent</p>
              <button
                type="button"
                onClick={handleSendWhatsApp}
                disabled={sendingWhatsApp || stats.todayAbsent === 0}
                className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity disabled:opacity-50 bg-[#25D366] text-white"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                {sendingWhatsApp ? "Sending…" : "Send WhatsApp to Parents"}
              </button>
            </div>

            {/* Below 75% Attendance Flag */}
            <div className="bg-card rounded-xl border border-border p-5 shadow-sm flex flex-col gap-2">
              <div className="flex items-center gap-2 mb-1">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                <h2 className="font-semibold text-sm">Low Attendance</h2>
              </div>
              {attendanceFlag.below75Count === 0 ? (
                <>
                  <p className="text-2xl font-bold text-emerald-500">0</p>
                  <p className="text-xs text-muted-foreground">All students above 75% (last 30 days)</p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-amber-500">{attendanceFlag.below75Count}</p>
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold w-fit bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    <AlertTriangle className="w-3 h-3" />
                    Below 75% (last 30 days)
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Today's Attendance + Upcoming Exams + Recent Admissions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div className="bg-card rounded-xl border border-border p-5 shadow-sm lg:col-span-1">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm">Today's Attendance</h2>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </div>
              {stats.todayTotal === 0 ? (
                <p className="text-sm text-muted-foreground">No attendance marked today.</p>
              ) : (
                <>
                  <div className="text-3xl font-bold mb-3">{attendancePct}%</div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-emerald-50 rounded-lg p-2 border border-emerald-100">
                      <p className="text-lg font-bold text-emerald-700">{stats.todayPresent}</p>
                      <p className="text-[10px] text-emerald-600 font-medium">Present</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-2 border border-red-100">
                      <p className="text-lg font-bold text-red-600">{stats.todayAbsent}</p>
                      <p className="text-[10px] text-red-500 font-medium">Absent</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2 border border-border">
                      <p className="text-lg font-bold">{stats.todayTotal}</p>
                      <p className="text-[10px] text-muted-foreground font-medium">Total</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Upcoming Exams */}
            <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm">Upcoming Exams (7 days)</h2>
                <Clock className="w-4 h-4 text-muted-foreground" />
              </div>
              {stats.upcomingExams.length === 0 ? (
                <p className="text-sm text-muted-foreground">No exams in the next 7 days.</p>
              ) : (
                <div className="space-y-2">
                  {stats.upcomingExams.map((ex, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate flex-1">{ex.title}</span>
                      <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                        {new Date(ex.exam_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Admissions */}
            <div ref={admissionsCardRef} className="bg-card rounded-xl border border-border p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm">Recent Applications</h2>
                <Users className="w-4 h-4 text-muted-foreground" />
              </div>
              {stats.recentAdmissions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent applications.</p>
              ) : (
                <div className="space-y-2">
                  {stats.recentAdmissions.map((app, i) => {
                    const sc: Record<string, string> = { pending: "badge-yellow", admitted: "badge-green", rejected: "badge-red", called: "badge-blue" };
                    return (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{app.student_name}</p>
                          <p className="text-xs text-muted-foreground">Class {app.applying_for_class}</p>
                        </div>
                        <span className={`${sc[app.status] || "badge-gray"} ml-2 flex-shrink-0`}>{app.status}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Medium-impact row: Admissions Sparkline + Staff on Leave + Fee Due This Week */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {/* Admissions this week sparkline */}
            <div className="bg-card rounded-xl border border-border p-5 shadow-sm flex flex-col gap-2">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                <h2 className="font-semibold text-sm">Admissions this week</h2>
              </div>
              <AdmissionSparklineChart data={admissionSparkline} />
              <p className="text-xs text-muted-foreground">
                {admissionSparkline.reduce((s, p) => s + p.count, 0)} total in last 7 days
              </p>
            </div>

            {/* Staff on leave today */}
            <div className="bg-card rounded-xl border border-border p-5 shadow-sm flex flex-col gap-2">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-orange-500" />
                <h2 className="font-semibold text-sm">Staff on Leave Today</h2>
              </div>
              <p className="text-3xl font-bold">{staffOnLeaveCount}</p>
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold w-fit bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                Staff on Leave Today: {staffOnLeaveCount}
              </span>
            </div>

            {/* Fee due this week */}
            <div className="bg-card rounded-xl border border-border p-5 shadow-sm flex flex-col gap-2">
              <div className="flex items-center gap-2 mb-1">
                <Banknote className="w-4 h-4 text-amber-500" />
                <h2 className="font-semibold text-sm">Fee Due This Week</h2>
              </div>
              <p className="text-3xl font-bold">{feeDueThisWeekCount}</p>
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold w-fit bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                {feeDueThisWeekCount} fees due this week
              </span>
            </div>
          </div>

          {/* NEW: Feature 3 + 4 + 5 row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

            {/* Feature 3: Recent Payments with Generate Receipt */}
            <div className="bg-card rounded-xl border border-border p-5 shadow-sm flex flex-col gap-3">
              <div className="flex items-center gap-2 mb-1">
                <Receipt className="w-4 h-4 text-emerald-500" />
                <h2 className="font-semibold text-sm">Recent Payments</h2>
              </div>
              {recentPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent payments recorded.</p>
              ) : (
                <div className="space-y-2">
                  {recentPayments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.student_name}</p>
                        <p className="text-xs text-muted-foreground">
                          ₹{p.amount.toLocaleString("en-IN")} · {new Date(p.created_at).toLocaleDateString("en-IN")}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReceiptPayment(p)}
                        className="flex-shrink-0 flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-border hover:bg-muted/50 text-emerald-600"
                      >
                        <Printer className="w-3 h-3" />
                        Receipt
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Feature 4: Bus Delay Alert */}
            <div className="bg-card rounded-xl border border-border p-5 shadow-sm flex flex-col gap-3">
              <div className="flex items-center gap-2 mb-1">
                <Bus className="w-4 h-4 text-blue-500" />
                <h2 className="font-semibold text-sm">Bus Delay Alert</h2>
              </div>
              <p className="text-xs text-muted-foreground">Send a WhatsApp delay notice to all parents instantly.</p>
              <textarea
                value={busMessage}
                onChange={(e) => setBusMessage(e.target.value)}
                placeholder="e.g. Bus Route 3 delayed by 20 min due to traffic"
                rows={3}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none"
              />
              <button
                type="button"
                onClick={handleSendBusAlert}
                disabled={sendingBusAlert || !busMessage.trim()}
                className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-opacity disabled:opacity-50 bg-[#25D366] text-white"
              >
                <MessageCircle className="w-4 h-4" />
                {sendingBusAlert ? "Sending…" : "Send WhatsApp Alert to All Parents"}
              </button>
            </div>

            {/* Feature 5: Health Record Expiry Reminder */}
            <div className="bg-card rounded-xl border border-border p-5 shadow-sm flex flex-col gap-3">
              <div className="flex items-center gap-2 mb-1">
                <HeartPulse className="w-4 h-4 text-rose-500" />
                <h2 className="font-semibold text-sm">Health Record Expiry</h2>
              </div>
              {!healthColumnExists ? (
                <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
                  <p className="text-xs text-muted-foreground">Health expiry tracking not set up.</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Add a <span className="font-mono">health_record_expiry</span> column to students table to enable.</p>
                </div>
              ) : healthExpiryStudents.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
                  <span className="text-2xl mb-1">✅</span>
                  <p className="text-xs text-muted-foreground">No health records expiring in the next 30 days.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 px-3 py-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                    <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">
                      {healthExpiryStudents.length} student{healthExpiryStudents.length > 1 ? "s" : ""} expiring soon
                    </p>
                  </div>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {healthExpiryStudents.map((s) => (
                      <div key={s.id} className="flex items-center justify-between text-xs">
                        <span className="font-medium truncate flex-1">{s.name}</span>
                        <span className="text-muted-foreground flex-shrink-0 ml-2">
                          {s.health_record_expiry ? new Date(s.health_record_expiry).toLocaleDateString("en-IN") : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Topper of the Month */}
          {topper && (
            <div className="rounded-xl border border-amber-400/50 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-5 mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Trophy className="w-8 h-8 text-amber-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-0.5">🏆 Topper of the Month</p>
                  <p className="text-xl font-bold text-foreground truncate">{topper.name}</p>
                  <p className="text-sm text-muted-foreground">Class avg: {topper.avg}%</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAnnounceTopper}
                disabled={announcingTopper}
                className="flex-shrink-0 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                {announcingTopper ? "Announcing…" : "📢 Announce to School"}
              </button>
            </div>
          )}

          {/* Recently Enrolled Students */}
          <div className="bg-card rounded-xl border border-border shadow-sm">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-sm">Recently Enrolled Students</h2>
            </div>
            <table className="w-full edu-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Admission No.</th>
                  <th>Enrolled On</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentStudents.length === 0 && (
                  <tr><td colSpan={3} className="text-center text-muted-foreground py-8">No students enrolled yet.</td></tr>
                )}
                {stats.recentStudents.map((s, i) => (
                  <tr key={i}>
                    <td className="font-medium">{s.name}</td>
                    <td className="font-mono text-sm">{s.admission_number || "—"}</td>
                    <td className="text-sm text-muted-foreground">{s.created_at ? new Date(s.created_at).toLocaleDateString("en-IN") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Feature 3: Receipt Modal */}
      {receiptPayment && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 print:bg-transparent">
          <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-sm overflow-hidden print:shadow-none">
            {/* Receipt header */}
            <div className="bg-emerald-600 px-6 py-4 text-white flex items-center justify-between print:hidden">
              <h2 className="font-bold text-base">Fee Receipt</h2>
              <button type="button" title="Close receipt" onClick={() => setReceiptPayment(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5">
              {/* School name */}
              <p className="text-center font-bold text-base text-foreground mb-0.5">{schoolName || "School"}</p>
              <p className="text-center text-xs text-muted-foreground mb-4">Fee Payment Receipt</p>

              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Student</span>
                  <span className="font-semibold text-foreground">{receiptPayment.student_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-bold text-emerald-600">₹{receiptPayment.amount.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">{new Date(receiptPayment.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mode</span>
                  <span className="font-medium">{receiptPayment.payment_mode || "Cash"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Receipt ID</span>
                  <span className="font-mono text-xs text-foreground">{receiptPayment.id.slice(0, 8).toUpperCase()}</span>
                </div>
              </div>

              {/* PAID stamp */}
              <div className="mt-4 flex justify-center">
                <span className="inline-block border-4 border-emerald-500 text-emerald-600 font-black text-xl px-6 py-1 rounded-lg tracking-widest rotate-[-6deg]">
                  PAID
                </span>
              </div>
            </div>

            <div className="px-6 pb-5 flex gap-3 print:hidden">
              <button
                type="button"
                onClick={() => setReceiptPayment(null)}
                className="flex-1 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted/50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:opacity-90 flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function launchConfetti() {
  const colors = ["#e879f9", "#fb923c", "#a855f7", "#f59e0b", "#f472b6", "#fbbf24"];
  const pieces: HTMLDivElement[] = [];

  for (let i = 0; i < 50; i++) {
    const el = document.createElement("div");
    el.className = "confetti-piece";
    // Use DOM properties instead of inline style attributes in JSX
    el.style.left = `${Math.random() * 100}vw`;
    el.style.top = "-20px";
    el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    el.style.animationDelay = `${Math.random() * 1.5}s`;
    el.style.animationDuration = `${2 + Math.random() * 1.5}s`;
    document.body.appendChild(el);
    pieces.push(el);
  }

  setTimeout(() => {
    pieces.forEach((el) => el.remove());
  }, 3500);
}

function FeeProgressBar({ collected, pending }: { collected: number; pending: number }) {
  const pct = Math.min(100, Math.round((collected / (collected + pending)) * 100));
  // Use useEffect to set width so no inline style attribute appears in JSX
  const barRef = (el: HTMLDivElement | null) => {
    if (el) el.style.width = `${pct}%`;
  };
  return (
    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
      <div ref={barRef} className="h-2 rounded-full bg-green-500 transition-all" />
    </div>
  );
}

function StatCard({ label, value, sub, icon, accent }: { label: string; value: string; sub?: string; icon: React.ReactNode; accent: string }) {
  return (
    <div className={`bg-card rounded-xl p-5 border border-border shadow-sm ${accent}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        {icon}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function AdmissionSparklineChart({ data }: { data: AdmissionSparkPoint[] }) {
  if (data.length === 0) {
    return <div className="w-[120px] h-[40px] bg-muted rounded" />;
  }

  const W = 120;
  const H = 40;
  const counts = data.map(d => d.count);
  const maxVal = Math.max(...counts, 1);
  const minVal = Math.min(...counts, 0);
  const range = maxVal - minVal || 1;
  const pad = 4;

  const points = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (W - pad * 2);
    const y = pad + (1 - (d.count - minVal) / range) * (H - pad * 2);
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-label="Admissions sparkline">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        className="text-blue-500"
      />
      {data.map((d, i) => {
        const x = pad + (i / (data.length - 1)) * (W - pad * 2);
        const y = pad + (1 - (d.count - minVal) / range) * (H - pad * 2);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="2.5"
            className="fill-blue-500"
          />
        );
      })}
    </svg>
  );
}
