import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Search, Printer, Download } from "lucide-react";

type Student = {
  id: string; name: string; roll_number: string; father_name?: string; mother_name?: string;
  date_of_birth?: string; phone?: string; address?: string; admission_number?: string;
  gender?: string; religion?: string; caste?: string; created_at: string;
  class_name?: string; class_id?: string;
  previous_school?: string; previous_class?: string; tc_number?: string;
};
type School = { name: string; address?: string; phone?: string };

export function AdmissionRegisterPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [students, setStudents] = useState<Student[]>([]);
  const [school, setSchool]     = useState<School>({ name: "" });
  const [search, setSearch]     = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [yearFilter, setYearFilter]   = useState("all");
  const [classes, setClasses]   = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    setLoading(true);
    Promise.all([
      supabase.from("students").select("id, name, roll_number, father_name, mother_name, date_of_birth, phone, address, admission_number, gender, created_at, class_id, previous_school").eq("school_id", schoolId).order("created_at"),
      supabase.from("classes").select("id, name").eq("school_id", schoolId).order("name"),
      supabase.from("schools").select("name, address, phone").eq("id", schoolId).single(),
    ]).then(([sRes, cRes, schRes]) => {
      const cm = Object.fromEntries((cRes.data || []).map((c: { id: string; name: string }) => [c.id, c.name]));
      setStudents((sRes.data || []).map((s: Student) => ({ ...s, class_name: cm[s.class_id || ""] || "—" })));
      setClasses(cRes.data || []);
      setSchool(schRes.data || { name: "" });
      setLoading(false);
    });
  }, [schoolId]);

  const years = [...new Set(students.map(s => s.created_at?.slice(0, 4)))].sort((a, b) => b.localeCompare(a));

  const filtered = students.filter(s => {
    const matchClass = classFilter === "all" || s.class_id === classFilter;
    const matchYear  = yearFilter === "all" || s.created_at?.startsWith(yearFilter);
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.admission_number || "").toLowerCase().includes(search.toLowerCase()) || (s.father_name || "").toLowerCase().includes(search.toLowerCase());
    return matchClass && matchYear && matchSearch;
  });

  // Sequential serial numbers based on filtered list
  function fmt(d?: string) { return d ? new Date(d).toLocaleDateString("en-IN") : "—"; }

  return (
    <div>
      {/* Screen */}
      <div className="no-print">
        <div className="page-header flex items-center justify-between">
          <div>
            <h1>Admission Register</h1>
            <p>Sequential admission register — Adm-001 onwards, for government inspections</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
              <Printer className="w-4 h-4" /> Print Register
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-blue">
            <p className="text-xs text-muted-foreground">Total Admissions</p>
            <p className="text-2xl font-bold">{students.length}</p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-green">
            <p className="text-xs text-muted-foreground">Boys</p>
            <p className="text-2xl font-bold">{students.filter(s => s.gender?.toLowerCase() === "male" || s.gender?.toLowerCase() === "m").length}</p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-pink">
            <p className="text-xs text-muted-foreground">Girls</p>
            <p className="text-2xl font-bold">{students.filter(s => s.gender?.toLowerCase() === "female" || s.gender?.toLowerCase() === "f").length}</p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-purple">
            <p className="text-xs text-muted-foreground">This Year</p>
            <p className="text-2xl font-bold">{students.filter(s => s.created_at?.startsWith(String(new Date().getFullYear()))).length}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, Adm no., father name…"
              className="pl-9 pr-4 py-2 border border-border rounded-lg text-sm bg-background w-64" />
          </div>
          <select title="Class filter" value={classFilter} onChange={e => setClassFilter(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
            <option value="all">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select title="Year filter" value={yearFilter} onChange={e => setYearFilter(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
            <option value="all">All Years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <span className="text-sm text-muted-foreground ml-auto">{filtered.length} entries</span>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border border-border overflow-x-auto shadow-sm">
          <table className="w-full edu-table">
            <thead>
              <tr>
                <th>Sr.</th><th>Adm. No.</th><th>Student Name</th><th>Father's Name</th>
                <th>Gender</th><th>DOB</th><th>Class</th><th>Adm. Date</th>
                <th>Phone</th><th>Previous School</th><th>TC No.</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={11} className="text-center py-12 text-muted-foreground">Loading…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={11} className="text-center py-12 text-muted-foreground">No students found.</td></tr>}
              {filtered.map((s, i) => (
                <tr key={s.id}>
                  <td className="text-muted-foreground text-xs font-mono">{String(i + 1).padStart(3, "0")}</td>
                  <td className="font-mono text-sm font-semibold">{s.admission_number || `ADM-${String(i + 1).padStart(4, "0")}`}</td>
                  <td className="font-medium">{s.name}</td>
                  <td className="text-sm">{s.father_name || "—"}</td>
                  <td className="text-sm capitalize">{s.gender || "—"}</td>
                  <td className="text-sm">{fmt(s.date_of_birth)}</td>
                  <td className="text-sm">{s.class_name}</td>
                  <td className="text-sm">{fmt(s.created_at)}</td>
                  <td className="text-sm font-mono">{s.phone || "—"}</td>
                  <td className="text-sm text-muted-foreground">{s.previous_school || "—"}</td>
                  <td className="text-sm font-mono">{s.tc_number || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PRINT VIEW — formal register format */}
      <div className="hidden print:block print-full">
        <div style={{ fontFamily: "Arial, sans-serif", fontSize: "10px" }}>
          {/* Header */}
          <div style={{ textAlign: "center", borderBottom: "3px double #000", paddingBottom: "10px", marginBottom: "14px" }}>
            <p style={{ fontSize: "16px", fontWeight: "bold", textTransform: "uppercase" }}>{school.name}</p>
            {school.address && <p style={{ fontSize: "10px", marginTop: "2px" }}>{school.address} {school.phone ? `· Ph: ${school.phone}` : ""}</p>}
            <p style={{ fontSize: "13px", fontWeight: "bold", marginTop: "6px", textDecoration: "underline" }}>ADMISSION REGISTER</p>
            <p style={{ fontSize: "10px", color: "#666", marginTop: "2px" }}>
              {classFilter !== "all" ? `Class: ${classes.find(c => c.id === classFilter)?.name}` : "All Classes"}
              {yearFilter !== "all" ? ` · Year: ${yearFilter}` : ""} · Total Entries: {filtered.length}
            </p>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px" }}>
            <thead>
              <tr style={{ background: "#e8e8e8" }}>
                {["Sr.", "Adm No.", "Name", "Father's Name", "Mother's Name", "DOB", "Gender", "Religion", "Class", "Adm. Date", "Phone / Address", "Prev. School", "TC No."].map(h => (
                  <th key={h} style={{ border: "1px solid #888", padding: "4px 5px", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s.id} style={{ borderBottom: "1px solid #ccc" }}>
                  <td style={{ border: "1px solid #ccc", padding: "3px 5px", textAlign: "center" }}>{i + 1}</td>
                  <td style={{ border: "1px solid #ccc", padding: "3px 5px", fontFamily: "monospace", fontWeight: "bold" }}>{s.admission_number || `ADM-${String(i + 1).padStart(4, "0")}`}</td>
                  <td style={{ border: "1px solid #ccc", padding: "3px 5px", fontWeight: "500" }}>{s.name}</td>
                  <td style={{ border: "1px solid #ccc", padding: "3px 5px" }}>{s.father_name || ""}</td>
                  <td style={{ border: "1px solid #ccc", padding: "3px 5px" }}>{s.mother_name || ""}</td>
                  <td style={{ border: "1px solid #ccc", padding: "3px 5px", whiteSpace: "nowrap" }}>{fmt(s.date_of_birth)}</td>
                  <td style={{ border: "1px solid #ccc", padding: "3px 5px", textTransform: "capitalize" }}>{s.gender || ""}</td>
                  <td style={{ border: "1px solid #ccc", padding: "3px 5px" }}>{s.religion || ""}</td>
                  <td style={{ border: "1px solid #ccc", padding: "3px 5px" }}>{s.class_name}</td>
                  <td style={{ border: "1px solid #ccc", padding: "3px 5px", whiteSpace: "nowrap" }}>{fmt(s.created_at)}</td>
                  <td style={{ border: "1px solid #ccc", padding: "3px 5px", fontSize: "8px" }}>
                    {s.phone || ""}{s.address ? (s.phone ? `\n${s.address}` : s.address) : ""}
                  </td>
                  <td style={{ border: "1px solid #ccc", padding: "3px 5px", fontSize: "8px" }}>{s.previous_school || ""}{s.previous_class ? ` (${s.previous_class})` : ""}</td>
                  <td style={{ border: "1px solid #ccc", padding: "3px 5px", fontFamily: "monospace" }}>{s.tc_number || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Signature row */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px", fontSize: "10px" }}>
            <p>Entries verified: {filtered.length}</p>
            <div style={{ textAlign: "center" }}>
              <div style={{ borderTop: "1px solid #000", width: "180px", paddingTop: "4px" }}>Principal / Head of Institution</div>
            </div>
            <p>Printed: {new Date().toLocaleDateString("en-IN")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
