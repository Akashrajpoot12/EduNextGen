import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Printer, Search, CalendarCheck } from "lucide-react";

type Exam = {
  id: string; name: string; subject?: string; class_id?: string; class_name?: string;
  exam_date?: string; start_time?: string; end_time?: string; room?: string;
  duration_minutes?: number; total_marks?: number; academic_year?: string;
};

export function ExamDateSheetPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [exams, setExams]           = useState<Exam[]>([]);
  const [classes, setClasses]       = useState<{ id: string; name: string }[]>([]);
  const [school, setSchool]         = useState<{ name: string; address?: string }>({ name: "" });
  const [classFilter, setClassFilter] = useState("all");
  const [yearFilter, setYearFilter]   = useState("all");
  const [search, setSearch]           = useState("");

  useEffect(() => {
    if (!schoolId) return;
    Promise.all([
      supabase.from("exams").select("*").eq("school_id", schoolId).order("start_date"),
      supabase.from("classes").select("id, name").eq("school_id", schoolId).order("name"),
      supabase.from("schools").select("name, address").eq("id", schoolId).single(),
    ]).then(([eRes, cRes, schRes]) => {
      const cm = Object.fromEntries((cRes.data || []).map((c: { id: string; name: string }) => [c.id, c.name]));
      setExams((eRes.data || []).map((e: Exam) => ({ ...e, class_name: cm[e.class_id || ""] || "—" })));
      setClasses(cRes.data || []);
      setSchool(schRes.data || { name: "" });
    });
  }, [schoolId]);

  const years = [...new Set(exams.map(e => e.academic_year).filter(Boolean))].sort((a, b) => (b || "").localeCompare(a || ""));

  const filtered = exams.filter(e => {
    const matchClass  = classFilter === "all" || e.class_id === classFilter;
    const matchYear   = yearFilter === "all" || e.academic_year === yearFilter;
    const matchSearch = !search || (e.name || "").toLowerCase().includes(search.toLowerCase()) || (e.subject || "").toLowerCase().includes(search.toLowerCase());
    return matchClass && matchYear && matchSearch;
  });

  // Group by exam name (exam series) then by date
  const examSeries = [...new Set(filtered.map(e => e.name))];

  // Group by date for date-sheet view
  const byDate: Record<string, Exam[]> = {};
  filtered.forEach(e => {
    const d = e.exam_date || e.start_date;
    if (!d) return;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(e);
  });
  const sortedDates = Object.keys(byDate).sort();

  function fmt(d?: string) {
    if (!d) return "—";
    return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }
  function fmtShort(d?: string) {
    if (!d) return "—";
    return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  }
  function fmtTime(t?: string) {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hh = h % 12 || 12;
    return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
  }

  return (
    <div>
      {/* Screen */}
      <div className="no-print">
        <div className="page-header flex items-center justify-between">
          <div>
            <h1>Exam Date Sheet</h1>
            <p>Class-wise exam schedule — print for notice board or send to parents</p>
          </div>
          <button type="button" onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
            <Printer className="w-4 h-4" /> Print Date Sheet
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-blue">
            <div className="flex items-center gap-2"><CalendarCheck className="w-4 h-4 text-blue-500" /><p className="text-xs text-muted-foreground">Total Exams</p></div>
            <p className="text-2xl font-bold">{exams.length}</p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-green">
            <p className="text-xs text-muted-foreground">Exam Series</p>
            <p className="text-2xl font-bold">{examSeries.length}</p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-orange">
            <p className="text-xs text-muted-foreground">Upcoming</p>
            <p className="text-2xl font-bold">{exams.filter(e => e.exam_date && e.exam_date >= new Date().toISOString().slice(0, 10)).length}</p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-purple">
            <p className="text-xs text-muted-foreground">Classes Covered</p>
            <p className="text-2xl font-bold">{new Set(exams.map(e => e.class_id)).size}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search exam or subject…"
              className="pl-9 pr-4 py-2 border border-border rounded-lg text-sm bg-background w-56" />
          </div>
          <select title="Class" value={classFilter} onChange={e => setClassFilter(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
            <option value="all">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select title="Year" value={yearFilter} onChange={e => setYearFilter(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
            <option value="all">All Years</option>
            {years.map(y => <option key={y} value={y || ""}>{y}</option>)}
          </select>
          <span className="text-sm text-muted-foreground ml-auto">{filtered.length} exam slots</span>
        </div>

        {/* Date-wise schedule */}
        {sortedDates.length === 0 && (
          <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
            No exams found. Add exams from the Exams section first.
          </div>
        )}
        {sortedDates.map(date => (
          <div key={date} className="bg-card border border-border rounded-xl mb-3 overflow-hidden shadow-sm">
            <div className={`px-4 py-2.5 border-b border-border flex items-center justify-between ${date < new Date().toISOString().slice(0, 10) ? "bg-muted/50" : "bg-blue-50 dark:bg-blue-950/20"}`}>
              <p className="font-semibold text-sm">{fmt(date)}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${date < new Date().toISOString().slice(0, 10) ? "badge-gray" : date === new Date().toISOString().slice(0, 10) ? "badge-green" : "badge-blue"}`}>
                {date < new Date().toISOString().slice(0, 10) ? "Completed" : date === new Date().toISOString().slice(0, 10) ? "Today" : "Upcoming"}
              </span>
            </div>
            <table className="w-full edu-table">
              <thead><tr><th>Exam</th><th>Subject</th><th>Class</th><th>Time</th><th>Duration</th><th>Max Marks</th><th>Room</th></tr></thead>
              <tbody>
                {byDate[date].map(e => (
                  <tr key={e.id}>
                    <td className="font-medium text-sm">{e.name}</td>
                    <td className="font-medium">{e.subject || "—"}</td>
                    <td><span className="badge-blue text-xs">{e.class_name}</span></td>
                    <td className="text-sm font-mono">
                      {e.start_time ? fmtTime(e.start_time) : "—"}
                      {e.end_time ? ` – ${fmtTime(e.end_time)}` : ""}
                    </td>
                    <td className="text-sm">{e.duration_minutes ? `${e.duration_minutes} min` : "—"}</td>
                    <td className="text-sm font-semibold">{e.total_marks ?? "—"}</td>
                    <td className="text-sm">{e.room || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* PRINT VIEW */}
      <div className="hidden print:block print-full">
        <div style={{ fontFamily: "Arial, sans-serif", fontSize: "11px" }}>
          {/* Header */}
          <div style={{ textAlign: "center", borderBottom: "3px double #000", paddingBottom: "10px", marginBottom: "16px" }}>
            <p style={{ fontSize: "18px", fontWeight: "bold", textTransform: "uppercase" }}>{school.name}</p>
            {school.address && <p style={{ fontSize: "10px", marginTop: "2px" }}>{school.address}</p>}
            <p style={{ fontSize: "15px", fontWeight: "bold", textDecoration: "underline", marginTop: "8px" }}>EXAMINATION DATE SHEET</p>
            {(classFilter !== "all" || yearFilter !== "all") && (
              <p style={{ fontSize: "10px", color: "#555", marginTop: "4px" }}>
                {classFilter !== "all" ? `Class: ${classes.find(c => c.id === classFilter)?.name}` : "All Classes"}
                {yearFilter !== "all" ? ` · Academic Year: ${yearFilter}` : ""}
              </p>
            )}
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
            <thead>
              <tr style={{ background: "#e8e8e8" }}>
                {["Sr.", "Date", "Day", "Subject", "Class", "Time", "Duration", "Max Marks", "Room / Venue"].map(h => (
                  <th key={h} style={{ border: "1px solid #888", padding: "5px 6px", textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => (
                <tr key={e.id} style={{ borderBottom: "1px solid #ccc" }}>
                  <td style={{ border: "1px solid #ccc", padding: "4px 6px", textAlign: "center" }}>{i + 1}</td>
                  <td style={{ border: "1px solid #ccc", padding: "4px 6px", whiteSpace: "nowrap" }}>{e.exam_date ? new Date(e.exam_date + "T00:00:00").toLocaleDateString("en-IN") : "—"}</td>
                  <td style={{ border: "1px solid #ccc", padding: "4px 6px" }}>{e.exam_date ? new Date(e.exam_date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" }) : "—"}</td>
                  <td style={{ border: "1px solid #ccc", padding: "4px 6px", fontWeight: "bold" }}>{e.subject || e.name}</td>
                  <td style={{ border: "1px solid #ccc", padding: "4px 6px" }}>{e.class_name}</td>
                  <td style={{ border: "1px solid #ccc", padding: "4px 6px", whiteSpace: "nowrap" }}>
                    {e.start_time ? fmtTime(e.start_time) : "—"}{e.end_time ? ` – ${fmtTime(e.end_time)}` : ""}
                  </td>
                  <td style={{ border: "1px solid #ccc", padding: "4px 6px" }}>{e.duration_minutes ? `${e.duration_minutes} min` : "—"}</td>
                  <td style={{ border: "1px solid #ccc", padding: "4px 6px", textAlign: "center" }}>{e.total_marks ?? "—"}</td>
                  <td style={{ border: "1px solid #ccc", padding: "4px 6px" }}>{e.room || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ fontSize: "9px", color: "#666" }}>
              <p>* Students must bring their hall ticket and admit card.</p>
              <p>* Mobile phones are strictly prohibited in exam hall.</p>
              <p>* Report 15 minutes before the exam time.</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ borderTop: "1px solid #000", width: "180px", paddingTop: "4px" }}>Principal / Exam Controller</div>
            </div>
            <p style={{ fontSize: "9px", color: "#666" }}>Issued: {new Date().toLocaleDateString("en-IN")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
