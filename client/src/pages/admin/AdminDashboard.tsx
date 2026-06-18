import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Users, GraduationCap, Banknote, CalendarDays, TrendingUp, Clock } from "lucide-react";

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

  useEffect(() => {
    if (!schoolId) return;
    async function fetchStats() {
      setLoading(true);
      const today = new Date().toISOString().split("T")[0];
      const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

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
      ] = await Promise.all([
        supabase.from("students").select("*", { count: "exact", head: true }).eq("school_id", schoolId),
        supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("school_id", schoolId).eq("role", "teacher"),
        supabase.from("classes").select("*", { count: "exact", head: true }).eq("school_id", schoolId),
        supabase.from("daily_attendance").select("*", { count: "exact", head: true }).eq("school_id", schoolId).eq("date", today).eq("status", "present"),
        supabase.from("daily_attendance").select("*", { count: "exact", head: true }).eq("school_id", schoolId).eq("date", today).eq("status", "absent"),
        supabase.from("daily_attendance").select("*", { count: "exact", head: true }).eq("school_id", schoolId).eq("date", today),
        supabase.from("student_fee_assignments").select("amount").eq("school_id", schoolId).eq("status", "pending"),
        supabase.from("exams").select("title, exam_date, class_id").eq("school_id", schoolId).gte("exam_date", today).lte("exam_date", in7Days).order("exam_date").limit(5),
        supabase.from("admission_applications").select("student_name, applying_for_class, applied_at, status").eq("school_id", schoolId).order("applied_at", { ascending: false }).limit(5),
        supabase.from("students").select("name, admission_number, created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(5),
      ]);

      const pendingTotal = (pendingFeesRes.data || []).reduce((sum, r) => sum + (r.amount || 0), 0);

      setStats({
        totalStudents: studentsRes.count || 0,
        totalTeachers: teachersRes.count || 0,
        totalClasses: classesRes.count || 0,
        todayPresent: attendancePresentRes.count || 0,
        todayAbsent: attendanceAbsentRes.count || 0,
        todayTotal: attendanceTotalRes.count || 0,
        pendingFees: pendingTotal,
        pendingFeesCount: (pendingFeesRes.data || []).length,
        upcomingExams: (upcomingExamsRes.data || []) as DashboardStats["upcomingExams"],
        recentAdmissions: (recentAdmissionsRes.data || []) as DashboardStats["recentAdmissions"],
        recentStudents: (recentStudentsRes.data || []) as DashboardStats["recentStudents"],
      });
      setLoading(false);
    }
    fetchStats();
  }, [schoolId]);

  const attendancePct = stats.todayTotal > 0 ? Math.round((stats.todayPresent / stats.todayTotal) * 100) : null;
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p className="text-muted-foreground text-sm">{today}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Loading dashboard…</div>
      ) : (
        <>
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

          {/* Today's Attendance */}
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
            <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
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
