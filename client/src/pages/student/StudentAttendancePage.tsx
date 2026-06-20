import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { CalendarCheck, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

type DayRecord = { date: string; status: string };

export function StudentAttendancePage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().getMonth());
  const [year] = useState(new Date().getFullYear());

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const endDate   = `${year}-${String(month + 1).padStart(2, "0")}-${new Date(year, month + 1, 0).getDate()}`;

      const { data } = await supabase
        .from("daily_attendance")
        .select("date, status")
        .eq("student_id", user.id)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true });

      setRecords(data || []);
      setLoading(false);
    })();
  }, [schoolId, month]);

  const present = records.filter(r => r.status === "present").length;
  const absent  = records.filter(r => r.status === "absent").length;
  const total   = records.length;
  const pct     = total ? Math.round((present / total) * 100) : 0;

  const pieData = [
    { name: "Present", value: present, color: "#10b981" },
    { name: "Absent",  value: absent,  color: "#ef4444" },
  ].filter(d => d.value > 0);

  // Build calendar grid for the month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay    = new Date(year, month, 1).getDay(); // 0=Sun
  const recordMap: Record<string, string> = {};
  records.forEach(r => { recordMap[r.date] = r.status; });

  const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Attendance</h1>
        <p className="text-sm text-muted-foreground mt-1">Monthly attendance record</p>
      </div>

      {/* Month selector */}
      <select value={month} onChange={e => setMonth(Number(e.target.value))}
        className="h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 w-48">
        {MONTHS.map((m, i) => <option key={i} value={i}>{m} {year}</option>)}
      </select>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Stats */}
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

          {/* Alert if below 75% */}
          {total > 0 && pct < 75 && (
            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-600">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">Your attendance is below 75%. Please attend classes regularly to avoid academic issues.</p>
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-4">
            {/* Pie chart */}
            {total > 0 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold mb-3">Overview</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={60}
                      label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                      {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4 mt-2 text-xs">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />Present</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />Absent</span>
                </div>
              </div>
            )}

            {/* Calendar */}
            <div className={`bg-card border border-border rounded-xl p-5 ${total > 0 ? "md:col-span-2" : "md:col-span-3"}`}>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-purple-500" /> {MONTHS[month]} {year} Calendar
              </h3>
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {dayNames.map(d => (
                  <div key={d} className="py-1 font-semibold text-muted-foreground">{d}</div>
                ))}
                {/* Empty cells before first day */}
                {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                {/* Day cells */}
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
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-muted inline-block" /> No record</span>
              </div>
            </div>
          </div>

          {total === 0 && (
            <div className="text-center py-16 bg-card border border-border rounded-xl">
              <CalendarCheck className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="font-medium">No attendance records for {MONTHS[month]} {year}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
