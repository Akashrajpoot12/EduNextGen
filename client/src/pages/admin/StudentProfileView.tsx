// @ts-nocheck
import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import {
  ArrowLeft, User, Phone, Mail, MapPin, BookOpen, CheckSquare,
  Wallet, Calendar, FileText, TrendingUp, AlertTriangle, CheckCircle2,
  Clock, XCircle, Loader2, BarChart3, ClipboardList
} from "lucide-react";

const STATUS_COLOR: Record<string, string> = {
  present:  "bg-emerald-100 text-emerald-700",
  absent:   "bg-red-100 text-red-700",
  late:     "bg-amber-100 text-amber-700",
  half_day: "bg-orange-100 text-orange-700",
};

const GRADE_SCALE = [
  { min: 91, grade: "A1" }, { min: 81, grade: "A2" }, { min: 71, grade: "B1" },
  { min: 61, grade: "B2" }, { min: 51, grade: "C1" }, { min: 41, grade: "C2" },
  { min: 33, grade: "D"  }, { min: 0,  grade: "E"  },
];
function getGrade(pct: number) { return GRADE_SCALE.find(g => pct >= g.min)?.grade || "E"; }

export function StudentProfileView() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [marks, setMarks] = useState<any[]>([]);
  const [fees, setFees] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [homework, setHomework] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"overview"|"attendance"|"marks"|"fees"|"leaves">("overview");

  useEffect(() => { if (schoolId && studentId) init(); }, [schoolId, studentId]);

  async function init() {
    setLoading(true);
    const [
      { data: stu },
      { data: att },
      { data: mrk },
      { data: fee },
      { data: lv },
      { data: hw },
    ] = await Promise.all([
      supabase.from("students")
        .select(`*, classes:class_id(grade_level,section), users:user_id(full_name,email)`)
        .eq("id", studentId).eq("school_id", schoolId).single(),
      supabase.from("daily_attendance")
        .select("date, status").eq("student_id", studentId)
        .order("date", { ascending: false }).limit(60),
      supabase.from("exam_marks")
        .select("marks_obtained, max_marks, subject_name, exams:exam_id(title)")
        .eq("student_id", studentId).eq("school_id", schoolId)
        .order("created_at", { ascending: false }).limit(30),
      supabase.from("student_fee_assignments")
        .select("amount, due_date, status, fee_structure:fee_structure_id(name)")
        .eq("student_id", studentId).eq("school_id", schoolId)
        .order("due_date", { ascending: false }),
      supabase.from("leave_requests")
        .select("from_date, to_date, leave_type, reason, status, created_at")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false }).limit(10),
      supabase.from("homework")
        .select("title, subject, due_date, created_at")
        .eq("class_id", stu?.data?.class_id || "")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false }).limit(10),
    ]);

    setStudent(stu);
    setAttendance(att || []);
    setMarks(mrk || []);
    setFees(fee || []);
    setLeaves(lv || []);
    setHomework(hw || []);
    setLoading(false);
  }

  // ── Computed stats ──
  const totalDays     = attendance.length;
  const presentDays   = attendance.filter(a => a.status === "present").length;
  const absentDays    = attendance.filter(a => a.status === "absent").length;
  const attendancePct = totalDays ? Math.round((presentDays / totalDays) * 100) : 0;

  const fmtMoney = (n: number) => `₹${(n||0).toLocaleString("en-IN")}`;
  const totalFees   = fees.reduce((s, f) => s + (f.amount||0), 0);
  const paidFees    = fees.filter(f => f.status === "paid").reduce((s, f) => s + (f.amount||0), 0);
  const pendingFees = totalFees - paidFees;
  const overdueFees = fees.filter(f => f.status === "pending" && new Date(f.due_date) < new Date()).length;

  const avgPct = marks.length
    ? Math.round(marks.reduce((s, m) => s + (m.marks_obtained / (m.max_marks||100)) * 100, 0) / marks.length)
    : null;

  if (loading) return (
    <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
  );
  if (!student) return (
    <div className="text-center py-24 text-muted-foreground">Student not found</div>
  );

  const TABS = [
    { key: "overview",    label: "Overview",    icon: User },
    { key: "attendance",  label: "Attendance",  icon: CheckSquare },
    { key: "marks",       label: "Marks",       icon: BarChart3 },
    { key: "fees",        label: "Fees",        icon: Wallet },
    { key: "leaves",      label: "Leaves",      icon: Calendar },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Back */}
      <button type="button" onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Students
      </button>

      {/* Header Card */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-purple-700 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
            {student.first_name?.[0]}{student.last_name?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold">{student.first_name} {student.last_name}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {student.enrollment_number} · Class {student.classes?.grade_level}-{student.classes?.section}
              {student.roll_number && ` · Roll ${student.roll_number}`}
            </p>
            <div className="flex flex-wrap gap-4 mt-3 text-sm">
              {student.date_of_birth && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(student.date_of_birth).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              )}
              {student.gender && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <User className="w-3.5 h-3.5" /> {student.gender}
                </span>
              )}
              {student.blood_group && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                  {student.blood_group}
                </span>
              )}
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3 flex-shrink-0">
            <div className="text-center">
              <p className={`text-2xl font-bold ${attendancePct >= 75 ? "text-emerald-600" : "text-red-500"}`}>
                {attendancePct}%
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Attendance</p>
            </div>
            <div className="text-center">
              <p className={`text-2xl font-bold ${avgPct !== null ? (avgPct >= 60 ? "text-emerald-600" : "text-red-500") : "text-muted-foreground"}`}>
                {avgPct !== null ? `${avgPct}%` : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Avg Marks</p>
            </div>
            <div className="text-center">
              <p className={`text-2xl font-bold ${pendingFees > 0 ? "text-red-500" : "text-emerald-600"}`}>
                {pendingFees > 0 ? fmtMoney(pendingFees) : "Clear"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Dues</p>
            </div>
          </div>
        </div>

        {/* Parent + contact info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-5 border-t border-border">
          {student.father_name && (
            <div>
              <p className="text-xs text-muted-foreground">Father</p>
              <p className="text-sm font-medium mt-0.5">{student.father_name}</p>
            </div>
          )}
          {student.mother_name && (
            <div>
              <p className="text-xs text-muted-foreground">Mother</p>
              <p className="text-sm font-medium mt-0.5">{student.mother_name}</p>
            </div>
          )}
          {student.phone && (
            <div className="flex items-start gap-1.5">
              <Phone className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="text-sm font-medium">{student.phone}</p>
              </div>
            </div>
          )}
          {student.address && (
            <div className="flex items-start gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Address</p>
                <p className="text-sm font-medium line-clamp-1">{student.address}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === key ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Attendance summary */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-emerald-500" /> Attendance (Last 60 days)
            </h3>
            <div className="flex gap-4">
              {[
                { label: "Present", count: presentDays, color: "text-emerald-600" },
                { label: "Absent",  count: absentDays,  color: "text-red-500" },
                { label: "Total",   count: totalDays,   color: "text-slate-600" },
              ].map(({ label, count, color }) => (
                <div key={label} className="flex-1 text-center">
                  <p className={`text-2xl font-bold ${color}`}>{count}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 bg-muted rounded-full h-2 overflow-hidden">
              <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${attendancePct}%` }} />
            </div>
            <p className={`text-xs mt-1 text-right font-semibold ${attendancePct < 75 ? "text-red-500" : "text-emerald-600"}`}>
              {attendancePct}% {attendancePct < 75 && "⚠ Below 75%"}
            </p>
          </div>

          {/* Marks summary */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-500" /> Recent Performance
            </h3>
            {marks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No exam records yet</p>
            ) : (
              <div className="space-y-2">
                {marks.slice(0, 4).map((m, i) => {
                  const pct = Math.round((m.marks_obtained / (m.max_marks || 100)) * 100);
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <p className="text-xs text-muted-foreground w-24 truncate">{m.subject_name || m.exams?.title}</p>
                      <div className="flex-1 bg-muted rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-semibold w-16 text-right">
                        {m.marks_obtained}/{m.max_marks} ({getGrade(pct)})
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Fee summary */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-amber-500" /> Fee Status
            </h3>
            <div className="flex gap-4">
              <div className="flex-1 text-center">
                <p className="text-xl font-bold text-emerald-600">{fmtMoney(paidFees)}</p>
                <p className="text-xs text-muted-foreground">Paid</p>
              </div>
              <div className="flex-1 text-center">
                <p className={`text-xl font-bold ${pendingFees > 0 ? "text-red-500" : "text-emerald-600"}`}>
                  {fmtMoney(pendingFees)}
                </p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              {overdueFees > 0 && (
                <div className="flex-1 text-center">
                  <p className="text-xl font-bold text-red-600">{overdueFees}</p>
                  <p className="text-xs text-muted-foreground">Overdue</p>
                </div>
              )}
            </div>
            {overdueFees > 0 && (
              <div className="mt-3 flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5" /> {overdueFees} fee(s) overdue — action needed
              </div>
            )}
          </div>

          {/* Leave summary */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-500" /> Leave History
            </h3>
            {leaves.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leave records</p>
            ) : (
              <div className="space-y-2">
                {leaves.slice(0, 4).map((l, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{l.leave_type} · {l.from_date} to {l.to_date}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      l.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                      l.status === "rejected" ? "bg-red-100 text-red-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>{l.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ATTENDANCE TAB ── */}
      {activeTab === "attendance" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold">Attendance Record</h3>
            <span className={`text-sm font-bold ${attendancePct < 75 ? "text-red-500" : "text-emerald-600"}`}>
              {attendancePct}% overall
            </span>
          </div>
          <div className="divide-y divide-border max-h-96 overflow-y-auto">
            {attendance.length === 0 ? (
              <p className="text-center py-10 text-muted-foreground text-sm">No attendance records</p>
            ) : attendance.map((a, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="text-muted-foreground">
                  {new Date(a.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_COLOR[a.status] || "bg-muted text-muted-foreground"}`}>
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MARKS TAB ── */}
      {activeTab === "marks" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-semibold">Exam Marks</h3>
          </div>
          {marks.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground text-sm">No exam records</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Exam</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Subject</th>
                  <th className="text-center px-5 py-3 font-medium text-muted-foreground">Marks</th>
                  <th className="text-center px-5 py-3 font-medium text-muted-foreground">%</th>
                  <th className="text-center px-5 py-3 font-medium text-muted-foreground">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {marks.map((m, i) => {
                  const pct = Math.round((m.marks_obtained / (m.max_marks || 100)) * 100);
                  return (
                    <tr key={i}>
                      <td className="px-5 py-3 text-muted-foreground">{m.exams?.title || "—"}</td>
                      <td className="px-5 py-3 font-medium">{m.subject_name}</td>
                      <td className="px-5 py-3 text-center">{m.marks_obtained}/{m.max_marks}</td>
                      <td className="px-5 py-3 text-center">
                        <span className={pct >= 75 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-500"}>
                          {pct}%
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center font-bold">{getGrade(pct)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── FEES TAB ── */}
      {activeTab === "fees" && (
        <div className="space-y-3">
          {fees.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground text-sm">No fee records</p>
          ) : fees.map((f, i) => {
            const isOverdue = f.status === "pending" && new Date(f.due_date) < new Date();
            return (
              <div key={i} className="bg-card border border-border rounded-xl px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{f.fee_structure?.name || "School Fee"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Due: {f.due_date}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-bold">{fmtMoney(f.amount)}</p>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
                    f.status === "paid"    ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                    isOverdue             ? "bg-red-100 text-red-700 border-red-200" :
                    "bg-amber-100 text-amber-700 border-amber-200"
                  }`}>
                    {isOverdue ? "overdue" : f.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── LEAVES TAB ── */}
      {activeTab === "leaves" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-semibold">Leave Requests</h3>
          </div>
          {leaves.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground text-sm">No leave records</p>
          ) : (
            <div className="divide-y divide-border">
              {leaves.map((l, i) => (
                <div key={i} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm">{l.leave_type}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {l.from_date} → {l.to_date}
                      </p>
                      {l.reason && <p className="text-xs text-muted-foreground mt-1 italic">{l.reason}</p>}
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ${
                      l.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                      l.status === "rejected" ? "bg-red-100 text-red-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>{l.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
