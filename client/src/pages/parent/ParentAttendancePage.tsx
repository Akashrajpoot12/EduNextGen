import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { CalendarCheck, AlertTriangle, CheckCircle2, XCircle, Users } from "lucide-react";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function ParentAttendancePage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().getMonth());
  const [year] = useState(new Date().getFullYear());
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState("");
  const [records, setRecords] = useState<{ date: string; status: string }[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Try to find children linked to this parent via students.parent_user_id
      const { data: kids } = await supabase
        .from("students")
        .select("id, user_id, enrollment_number, users:user_id(full_name), classes:class_id(grade_level, section)")
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
    loadAttendance();
  }, [selectedChild, month]);

  async function loadAttendance() {
    setLoadingRecords(true);
    const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endDate   = `${year}-${String(month + 1).padStart(2, "0")}-${new Date(year, month + 1, 0).getDate()}`;
    const { data } = await supabase
      .from("daily_attendance")
      .select("date, status")
      .eq("student_id", selectedChild)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true });
    setRecords(data || []);
    setLoadingRecords(false);
  }

  const present = records.filter(r => r.status === "present").length;
  const absent  = records.filter(r => r.status === "absent").length;
  const total   = records.length;
  const pct     = total ? Math.round((present / total) * 100) : 0;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay    = new Date(year, month, 1).getDay();
  const recordMap: Record<string, string> = {};
  records.forEach(r => { recordMap[r.date] = r.status; });
  const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

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
        <h1 className="text-2xl font-bold">Child's Attendance</h1>
        <p className="text-sm text-muted-foreground mt-1">Monthly attendance tracking</p>
      </div>

      <div className="flex flex-wrap gap-3">
        {children.length > 1 && (
          <select value={selectedChild} onChange={e => setSelectedChild(e.target.value)}
            className="h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
            {children.map(c => (
              <option key={c.id} value={c.id}>
                {(c.users as any)?.full_name} — Class {(c.classes as any)?.grade_level}-{(c.classes as any)?.section}
              </option>
            ))}
          </select>
        )}
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          className="h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
          {MONTHS.map((m, i) => <option key={i} value={i}>{m} {year}</option>)}
        </select>
      </div>

      {selectedChildData && (
        <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center font-bold text-amber-600">
            {((selectedChildData.users as any)?.full_name || "?")[0]}
          </div>
          <div>
            <p className="font-semibold">{(selectedChildData.users as any)?.full_name}</p>
            <p className="text-xs text-muted-foreground">
              Class {(selectedChildData.classes as any)?.grade_level} - {(selectedChildData.classes as any)?.section}
              {selectedChildData.enrollment_number ? ` · Roll: ${selectedChildData.enrollment_number}` : ""}
            </p>
          </div>
        </div>
      )}

      {loadingRecords ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Present Days", value: present, color: "text-emerald-500" },
              { label: "Absent Days",  value: absent,  color: "text-red-500" },
              { label: "Total Days",   value: total,   color: "text-blue-500" },
              { label: "Attendance %", value: `${pct}%`, color: pct >= 75 ? "text-emerald-500" : pct >= 50 ? "text-amber-500" : "text-red-500" },
            ].map(s => (
              <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {total > 0 && pct < 75 && (
            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-600">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">Attendance below 75%. Please ensure your child attends school regularly.</p>
            </div>
          )}

          {/* Calendar */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-amber-500" /> {MONTHS[month]} {year}
            </h3>
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {dayNames.map(d => (
                <div key={d} className="py-1 font-semibold text-muted-foreground">{d}</div>
              ))}
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const status = recordMap[dateStr];
                return (
                  <div key={day} className={`aspect-square flex items-center justify-center rounded-lg text-xs font-medium
                    ${status === "present" ? "bg-emerald-500/20 text-emerald-600" :
                      status === "absent"  ? "bg-red-500/20 text-red-600" :
                      "bg-muted/50 text-muted-foreground"}`}>
                    {status === "present" ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                     status === "absent"  ? <XCircle className="w-3.5 h-3.5" /> :
                     <span>{day}</span>}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Present</span>
              <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-500" /> Absent</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
