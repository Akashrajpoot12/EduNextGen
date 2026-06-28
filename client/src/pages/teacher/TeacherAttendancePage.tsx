import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, XCircle, Save, CheckSquare, XSquare, Phone, AlertTriangle, MessageCircle } from "lucide-react";
import { toast } from "sonner";

interface Student {
  id: string;
  user_id: string;
  enrollment_number: string;
  roll_number: string | null;
  first_name: string;
  last_name: string;
  parent_phone: string | null;
  users: { full_name: string } | null;
}

const TOP_BADGES = ["⭐", "🥈", "🥉"];

// Returns true if date string (YYYY-MM-DD) is a weekday (Mon-Fri)
function isSchoolDay(dateStr: string): boolean {
  const d = new Date(dateStr);
  const day = d.getDay();
  return day >= 1 && day <= 5;
}

// Get all school days (Mon-Fri) in the current month up to today
function getSchoolDaysThisMonth(): string[] {
  const now = new Date();
  const days: string[] = [];
  for (let d = 1; d <= now.getDate(); d++) {
    const dt = new Date(now.getFullYear(), now.getMonth(), d);
    if (dt.getDay() >= 1 && dt.getDay() <= 5) {
      days.push(dt.toISOString().split("T")[0]);
    }
  }
  return days;
}

interface MoodInfo {
  score: number;
  emoji: string;
  label: string;
  colorClass: string;
  badgeClass: string;
}

function computeMoodBadge(presentPct: number, streak: number): MoodInfo {
  const rawScore = presentPct * (streak / 10);
  const score = Math.min(100, Math.round(rawScore));

  if (score >= 80) {
    return { score, emoji: "😄", label: "Excellent Mood — Class is on fire!", colorClass: "text-emerald-700 dark:text-emerald-300", badgeClass: "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700" };
  } else if (score >= 60) {
    return { score, emoji: "🙂", label: "Good Mood", colorClass: "text-blue-700 dark:text-blue-300", badgeClass: "bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700" };
  } else if (score >= 40) {
    return { score, emoji: "😐", label: "Average Mood", colorClass: "text-amber-700 dark:text-amber-300", badgeClass: "bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700" };
  } else {
    return { score, emoji: "😟", label: "Needs Attention", colorClass: "text-red-700 dark:text-red-300", badgeClass: "bg-red-100 dark:bg-red-900/40 border-red-300 dark:border-red-700" };
  }
}

export function TeacherAttendancePage() {
  const { tenantId: schoolId } = useTenant();
  const [loading, setLoading]             = useState(false);
  const [classes, setClasses]             = useState<{ id: string; grade_level: string; section: string }[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [students, setStudents]           = useState<Student[]>([]);
  const [attendance, setAttendance]       = useState<Record<string, string>>({});
  const [isSaving, setIsSaving]           = useState(false);

  // Yesterday's absentees
  const [yesterdayAbsent, setYesterdayAbsent]           = useState<{ name: string }[]>([]);
  const [showAbsentDropdown, setShowAbsentDropdown]     = useState(false);
  const absentChipRef                                   = useRef<HTMLDivElement>(null);

  // Monthly avg
  const [monthAvgPercent, setMonthAvgPercent] = useState<number | null>(null);

  // Top 3 scorers: map of user_id -> rank (0,1,2)
  const [topScorerRanks, setTopScorerRanks] = useState<Record<string, number>>({});

  // Class Mood Score
  const [classMood, setClassMood] = useState<MoodInfo | null>(null);

  const supabase = createClient();

  // Close absent dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (absentChipRef.current && !absentChipRef.current.contains(e.target as Node)) {
        setShowAbsentDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!schoolId) return;
    setLoading(true);
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: tt } = await supabase.from("timetables")
        .select("class_id").eq("school_id", schoolId).eq("teacher_id", user?.id);
      const classIds = [...new Set((tt || []).map((t: any) => t.class_id))];
      if (classIds.length === 0) { setClasses([]); setLoading(false); return; }
      const { data } = await supabase.from("classes")
        .select("id, grade_level, section")
        .in("id", classIds).order("grade_level", { ascending: true });
      if (data) setClasses(data);

      // Fetch yesterday's absentees across all teacher's classes
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      const { data: absentData } = await supabase
        .from("daily_attendance")
        .select("student_id, students:student_id(first_name, last_name, users:user_id(full_name))")
        .eq("school_id", schoolId)
        .eq("date", yesterdayStr)
        .eq("status", "absent")
        .in("class_id", classIds);
      if (absentData) {
        const names = (absentData as any[]).map(row => {
          const s = row.students;
          const name = s?.users?.full_name || `${s?.first_name ?? ""} ${s?.last_name ?? ""}`.trim();
          return { name };
        });
        setYesterdayAbsent(names);
      }

      setLoading(false);
    })();
  }, [schoolId]);

  const fetchMonthAvg = async (classId: string) => {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const today = now.toISOString().split("T")[0];
    const { data } = await supabase
      .from("daily_attendance")
      .select("status")
      .eq("school_id", schoolId)
      .eq("class_id", classId)
      .gte("date", firstOfMonth)
      .lte("date", today);
    if (data && data.length > 0) {
      const presentCount = (data as any[]).filter(r => r.status === "present").length;
      const pct = Math.round((presentCount / data.length) * 100);
      setMonthAvgPercent(pct);
    } else {
      setMonthAvgPercent(null);
    }
  };

  const fetchClassMood = async (classId: string, studentList: Student[]) => {
    if (studentList.length === 0) { setClassMood(null); return; }
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const today = now.toISOString().split("T")[0];

    const { data } = await supabase
      .from("daily_attendance")
      .select("student_id, date, status")
      .eq("school_id", schoolId)
      .eq("class_id", classId)
      .gte("date", firstOfMonth)
      .lte("date", today);

    if (!data || data.length === 0) { setClassMood(null); return; }

    const totalCount = data.length;
    const presentCount = (data as any[]).filter(r => r.status === "present").length;
    const presentPct = totalCount > 0 ? (presentCount / totalCount) * 100 : 0;

    // Calculate streak: consecutive school days where ALL students were >= 80% present
    const schoolDays = getSchoolDaysThisMonth();
    const studentIds = studentList.map(s => s.user_id);

    // Group by date: attendance records per date
    const byDate: Record<string, { present: number; total: number }> = {};
    for (const row of data as any[]) {
      if (!isSchoolDay(row.date)) continue;
      if (!byDate[row.date]) byDate[row.date] = { present: 0, total: 0 };
      byDate[row.date].total += 1;
      if (row.status === "present") byDate[row.date].present += 1;
    }

    // Walk backwards from the most recent day to find streak
    let streak = 0;
    for (let i = schoolDays.length - 1; i >= 0; i--) {
      const day = schoolDays[i];
      const rec = byDate[day];
      if (!rec || rec.total === 0) break;
      const dayPct = (rec.present / rec.total) * 100;
      if (dayPct >= 80) {
        streak += 1;
      } else {
        break;
      }
    }

    const mood = computeMoodBadge(presentPct, streak);
    setClassMood(mood);
  };

  const fetchTopScorers = async (studentList: Student[]) => {
    if (studentList.length === 0) { setTopScorerRanks({}); return; }
    const studentIds = studentList.map(s => s.id);
    const { data: examData } = await supabase
      .from("exam_marks")
      .select("student_id, marks_obtained, max_marks")
      .in("student_id", studentIds)
      .eq("school_id", schoolId);

    if (!examData || examData.length === 0) { setTopScorerRanks({}); return; }

    // Sum marks per student
    const totals: Record<string, { obtained: number; max: number }> = {};
    (examData as any[]).forEach(r => {
      if (!totals[r.student_id]) totals[r.student_id] = { obtained: 0, max: 0 };
      totals[r.student_id].obtained += r.marks_obtained;
      totals[r.student_id].max += r.max_marks || 100;
    });

    const sorted = Object.entries(totals)
      .map(([id, t]) => ({ id, pct: t.max > 0 ? t.obtained / t.max : 0 }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3);

    const ranks: Record<string, number> = {};
    sorted.forEach((s, i) => { ranks[s.id] = i; });
    setTopScorerRanks(ranks);
  };

  const fetchStudents = async (classId: string) => {
    setLoading(true);
    setMonthAvgPercent(null);
    setTopScorerRanks({});
    setClassMood(null);
    const { data } = await supabase
      .from("students")
      .select("id, user_id, enrollment_number, roll_number, first_name, last_name, parent_phone, users:user_id(full_name)")
      .eq("class_id", classId);
    if (data) {
      setStudents(data as any);
      const defaultAtt: Record<string, string> = {};
      data.forEach((s: any) => { defaultAtt[s.user_id] = "present"; });
      setAttendance(defaultAtt);
      fetchTopScorers(data as any);
      fetchClassMood(classId, data as any);
    }
    setLoading(false);
    fetchMonthAvg(classId);
  };

  const handleClassChange = (val: string) => { setSelectedClass(val); fetchStudents(val); };
  const toggle = (id: string, status: string) => setAttendance(prev => ({ ...prev, [id]: status }));

  const markAll = (status: string) => {
    const all: Record<string, string> = {};
    students.forEach(s => { all[s.user_id] = status; });
    setAttendance(all);
  };

  const copyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone).then(() => toast.success(`Copied ${phone}`)).catch(() => {});
  };

  const openWhatsApp = (phone: string, studentName: string) => {
    const url = `https://wa.me/91${phone}?text=${encodeURIComponent(`Hello, this is regarding your child ${studentName}`)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const presentCount = Object.values(attendance).filter(s => s === "present").length;
  const absentCount  = Object.values(attendance).filter(s => s === "absent").length;
  const totalCount   = students.length;

  const saveAttendance = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const today = new Date().toISOString().split("T")[0];
      const records = students.map(s => ({
        school_id: schoolId!,
        // Persist canonical students.id (matches the FK + admin/report pages).
        student_id: s.id,
        class_id: selectedClass,
        date: today,
        status: attendance[s.user_id],
        marked_by: user?.id,
      }));
      const { error } = await supabase.from("daily_attendance").insert(records);
      if (error) {
        if (error.code === "23505") toast.error("Attendance already marked for today.");
        else throw error;
      } else {
        toast.success("Attendance saved!");

        const absentStudentIds = students
          .filter(s => attendance[s.user_id] === "absent")
          .map(s => s.user_id);

        if (absentStudentIds.length > 0) {
          const { data: { session } } = await supabase.auth.getSession();
          fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session?.access_token}`,
                apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              },
              body: JSON.stringify({
                type: "absent_alert",
                schoolId,
                data: { date: today, studentIds: absentStudentIds },
              }),
            }
          ).then(() => toast.info(`WhatsApp sent to ${absentStudentIds.length} parent(s)`))
           .catch(() => {});
        }
      }
    } catch (err: any) {
      toast.error("Failed to save: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Class Attendance</h1>
        <p className="text-sm text-muted-foreground mt-1">Mark daily attendance for your assigned classes.</p>
      </div>

      {/* Yesterday's absentees chip */}
      {yesterdayAbsent.length > 0 && (
        <div ref={absentChipRef} className="relative inline-block">
          <button
            type="button"
            onClick={() => setShowAbsentDropdown(prev => !prev)}
            className="inline-flex items-center gap-2 rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700 text-sm font-medium px-4 py-1.5 hover:bg-yellow-200 dark:hover:bg-yellow-800/60 transition-colors cursor-pointer"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {yesterdayAbsent.length} student{yesterdayAbsent.length > 1 ? "s" : ""} were absent yesterday
            <span className="ml-1 text-yellow-600 dark:text-yellow-400 text-xs">{showAbsentDropdown ? "▲" : "▼"}</span>
          </button>
          {showAbsentDropdown && (
            <div className="absolute top-full left-0 mt-2 z-30 min-w-[220px] rounded-xl border border-border bg-popover text-popover-foreground shadow-xl p-3 space-y-1">
              <p className="text-xs text-muted-foreground font-semibold uppercase mb-2">Absent yesterday</p>
              {yesterdayAbsent.map((s, i) => (
                <div key={i} className="text-sm py-1 px-2 rounded hover:bg-muted">{s.name || "Unknown"}</div>
              ))}
            </div>
          )}
        </div>
      )}

      <Card className="bg-card border-border shadow-xl">
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="w-full md:w-64">
              <label className="text-sm text-muted-foreground mb-2 block">Select Class</label>
              <Select value={selectedClass} onValueChange={handleClassChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a class..." />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.grade_level} - Sec {c.section}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Monthly avg progress bar */}
              {monthAvgPercent !== null && (
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>Class avg this month</span>
                    <span className="font-semibold text-foreground">{monthAvgPercent}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={[
                        "h-full rounded-full transition-all duration-500",
                        monthAvgPercent >= 85 ? "bg-emerald-500" :
                        monthAvgPercent >= 65 ? "bg-yellow-500" : "bg-red-500"
                      ].join(" ")}
                      ref={el => { if (el) el.style.width = `${monthAvgPercent}%`; }}
                    />
                  </div>
                </div>
              )}
            </div>

            {students.length > 0 && (
              <>
                <Button type="button" variant="outline" onClick={() => markAll("present")}
                  className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10">
                  <CheckSquare className="w-4 h-4 mr-2" /> Mark All Present
                </Button>
                <Button type="button" variant="outline" onClick={() => markAll("absent")}
                  className="border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10">
                  <XSquare className="w-4 h-4 mr-2" /> Mark All Absent
                </Button>
                <Button type="button" onClick={saveAttendance} disabled={isSaving}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white ml-auto">
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Submit Attendance
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Live summary bar */}
      {students.length > 0 && (
        <div className="flex flex-wrap gap-3 items-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-sm font-semibold px-4 py-1.5">
            <CheckCircle2 className="w-4 h-4" /> Present {presentCount}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-sm font-semibold px-4 py-1.5">
            <XCircle className="w-4 h-4" /> Absent {absentCount}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted text-muted-foreground text-sm font-semibold px-4 py-1.5">
            Total {totalCount}
          </span>
          {Object.keys(topScorerRanks).length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-medium px-3 py-1.5">
              ⭐ Top 3 scorers highlighted below
            </span>
          )}
        </div>
      )}

      {/* Class Mood Score badge */}
      {classMood !== null && students.length > 0 && (
        <div className={`inline-flex items-center gap-2.5 rounded-full border px-4 py-2 text-sm font-semibold ${classMood.badgeClass} ${classMood.colorClass}`}>
          <span className="text-xl leading-none" aria-hidden="true">{classMood.emoji}</span>
          <span>{classMood.label}</span>
          <span className="ml-1 text-xs font-bold opacity-70">{classMood.score}/100</span>
        </div>
      )}

      {loading && !selectedClass ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" /></div>
      ) : students.length > 0 ? (
        <Card className="bg-card border-border shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-foreground">
              <thead className="text-xs uppercase bg-muted text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-6 py-4">Roll No.</th>
                  <th className="px-6 py-4">Student Name</th>
                  <th className="px-6 py-4">Parent Contact</th>
                  <th className="px-6 py-4 text-right">Mark Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map(student => {
                  const isAbsent = attendance[student.user_id] === "absent";
                  const fullName = student.users?.full_name
                    ?? `${student.first_name} ${student.last_name}`.trim();
                  const rank = topScorerRanks[student.id];
                  const isTopScorer = rank !== undefined;
                  return (
                    <tr
                      key={student.user_id}
                      className={[
                        "border-b border-border hover:bg-muted/50",
                        isTopScorer && rank === 0 ? "bg-amber-500/8" :
                        isTopScorer && rank === 1 ? "bg-zinc-400/8" :
                        isTopScorer && rank === 2 ? "bg-orange-500/8" : ""
                      ].join(" ")}
                    >
                      <td className="px-6 py-4 font-mono text-muted-foreground">
                        {student.roll_number ?? student.enrollment_number}
                      </td>
                      <td className="px-6 py-4 font-medium text-foreground">
                        <span className="flex items-center gap-1.5">
                          {isTopScorer && (
                            <span
                              title="Top scorer this exam"
                              className="cursor-default select-none text-base leading-none"
                            >
                              {TOP_BADGES[rank]}
                            </span>
                          )}
                          {fullName}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isAbsent && student.parent_phone ? (
                            <button
                              type="button"
                              onClick={() => copyPhone(student.parent_phone!)}
                              title="Click to copy phone number"
                              className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-medium px-2.5 py-1 hover:bg-amber-200 dark:hover:bg-amber-800/60 transition-colors cursor-pointer select-none"
                            >
                              <Phone className="w-3 h-3" />
                              {student.parent_phone}
                            </button>
                          ) : isAbsent ? (
                            <span className="text-muted-foreground text-xs">No phone</span>
                          ) : null}

                          {/* WhatsApp direct button */}
                          {student.parent_phone && (
                            <button
                              type="button"
                              title={`WhatsApp parent of ${fullName}`}
                              onClick={() => openWhatsApp(student.parent_phone!, fullName)}
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-medium px-2.5 py-1 hover:bg-emerald-200 dark:hover:bg-emerald-800/60 transition-colors cursor-pointer select-none"
                            >
                              <MessageCircle className="w-3 h-3" />
                              WA
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm"
                            className={attendance[student.user_id] === "present"
                              ? "bg-emerald-500 text-white hover:bg-emerald-600"
                              : "border border-border text-muted-foreground bg-transparent hover:bg-muted"}
                            onClick={() => toggle(student.user_id, "present")}>
                            <CheckCircle2 className="w-4 h-4 mr-1" /> P
                          </Button>
                          <Button type="button" size="sm"
                            className={attendance[student.user_id] === "absent"
                              ? "bg-red-500 text-white hover:bg-red-600"
                              : "border border-border text-muted-foreground bg-transparent hover:bg-muted"}
                            onClick={() => toggle(student.user_id, "absent")}>
                            <XCircle className="w-4 h-4 mr-1" /> A
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : selectedClass && !loading ? (
        <div className="text-center py-12 text-muted-foreground">No students found in this class.</div>
      ) : null}
    </div>
  );
}
