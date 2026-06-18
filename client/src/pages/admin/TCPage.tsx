import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Plus, X, Search, Printer, FileText, CheckCircle } from "lucide-react";

type Student = { id: string; name: string; roll_number: string; class_id: string; class_name?: string; father_name?: string; date_of_birth?: string; admission_number?: string };
type TC = {
  id: string; student_id: string; tc_number: string; issue_date: string; leaving_date: string;
  reason: string; conduct: string; last_class: string; last_exam: string; fee_cleared: boolean; remarks: string;
  student_name?: string; class_name?: string; father_name?: string; admission_number?: string; date_of_birth?: string;
};

const CONDUCT_OPTIONS = ["Excellent", "Very Good", "Good", "Satisfactory", "Fair"];
const REASON_OPTIONS = ["Parent's transfer", "Family relocation", "Admission to another school", "Higher studies", "Personal reasons", "Other"];

function zeroPad(n: number) { return n < 1000 ? String(n).padStart(4, "0") : String(n); }

export function TCPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [tcs, setTcs] = useState<TC[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [schoolName, setSchoolName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [printTC, setPrintTC] = useState<TC | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [nextNum, setNextNum] = useState(1);

  const [form, setForm] = useState({
    student_id: "", issue_date: new Date().toISOString().slice(0, 10),
    leaving_date: "", reason: REASON_OPTIONS[0], conduct: "Good",
    last_class: "", last_exam: "", fee_cleared: true, remarks: "",
  });

  async function fetchData() {
    const [tcRes, stuRes, schRes] = await Promise.all([
      supabase.from("transfer_certificates").select("*").eq("school_id", schoolId).order("created_at", { ascending: false }),
      supabase.from("students").select("id, name, roll_number, class_id, father_name, date_of_birth, admission_number").eq("school_id", schoolId).order("name"),
      supabase.from("schools").select("name").eq("id", schoolId).single(),
    ]);
    const classes = await supabase.from("classes").select("id, name").eq("school_id", schoolId);
    const classMap = Object.fromEntries((classes.data || []).map((c: { id: string; name: string }) => [c.id, c.name]));
    const stuList = (stuRes.data || []).map((s: Student) => ({ ...s, class_name: classMap[s.class_id] || "" }));
    setStudents(stuList);
    setSchoolName(schRes.data?.name || "");
    const stuMap = Object.fromEntries(stuList.map(s => [s.id, s]));
    const tcList = (tcRes.data || []).map((t: TC) => ({
      ...t, student_name: stuMap[t.student_id]?.name, class_name: stuMap[t.student_id]?.class_name,
      father_name: stuMap[t.student_id]?.father_name, admission_number: stuMap[t.student_id]?.admission_number,
      date_of_birth: stuMap[t.student_id]?.date_of_birth,
    }));
    setTcs(tcList);
    setNextNum((tcRes.data?.length || 0) + 1);
  }

  useEffect(() => { if (schoolId) fetchData(); }, [schoolId]);

  async function handleSave() {
    if (!form.student_id) return;
    setSaving(true);
    const tc_number = `TC/${new Date().getFullYear()}/${zeroPad(nextNum)}`;
    await supabase.from("transfer_certificates").insert({ ...form, school_id: schoolId, tc_number });
    setSaving(false);
    setShowForm(false);
    fetchData();
  }

  function openPrint(tc: TC) { setPrintTC(tc); setTimeout(() => window.print(), 300); }

  const filtered = tcs.filter(t => !search || t.student_name?.toLowerCase().includes(search.toLowerCase()) || t.tc_number.toLowerCase().includes(search.toLowerCase()));
  const selStudent = students.find(s => s.id === form.student_id);
  const f = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div>
      {/* Screen */}
      <div className="no-print">
        <div className="page-header flex items-center justify-between">
          <div>
            <h1>Transfer Certificate (TC)</h1>
            <p>Issue TC to leaving students — maintain TC register with serial numbers</p>
          </div>
          <button type="button" onClick={() => { setForm({ student_id: "", issue_date: new Date().toISOString().slice(0, 10), leaving_date: "", reason: REASON_OPTIONS[0], conduct: "Good", last_class: "", last_exam: "", fee_cleared: true, remarks: "" }); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> Issue TC
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-blue">
            <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-blue-500" /><p className="text-xs text-muted-foreground">Total TCs Issued</p></div>
            <p className="text-2xl font-bold">{tcs.length}</p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-green">
            <p className="text-xs text-muted-foreground">This Year</p>
            <p className="text-2xl font-bold">{tcs.filter(t => t.issue_date?.startsWith(String(new Date().getFullYear()))).length}</p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-orange">
            <p className="text-xs text-muted-foreground">Next TC Number</p>
            <p className="text-lg font-bold font-mono">TC/{new Date().getFullYear()}/{zeroPad(nextNum)}</p>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student or TC number…"
              className="pl-9 pr-4 py-2 border border-border rounded-lg text-sm bg-background w-64" />
          </div>
          <span className="text-sm text-muted-foreground ml-auto">{filtered.length} records</span>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          <table className="w-full edu-table">
            <thead><tr><th>TC Number</th><th>Student</th><th>Class</th><th>Issue Date</th><th>Leaving Date</th><th>Reason</th><th>Conduct</th><th>Fee</th><th></th></tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">No TCs issued yet. Click "Issue TC" to start.</td></tr>}
              {filtered.map(tc => (
                <tr key={tc.id}>
                  <td className="font-mono font-semibold text-sm">{tc.tc_number}</td>
                  <td>
                    <div className="font-medium">{tc.student_name}</div>
                    {tc.admission_number && <div className="text-xs text-muted-foreground">{tc.admission_number}</div>}
                  </td>
                  <td>{tc.class_name || tc.last_class || "—"}</td>
                  <td className="text-sm">{tc.issue_date ? new Date(tc.issue_date).toLocaleDateString("en-IN") : "—"}</td>
                  <td className="text-sm">{tc.leaving_date ? new Date(tc.leaving_date).toLocaleDateString("en-IN") : "—"}</td>
                  <td className="text-sm text-muted-foreground max-w-xs truncate">{tc.reason || "—"}</td>
                  <td><span className={`badge-${tc.conduct === "Excellent" ? "green" : tc.conduct === "Good" || tc.conduct === "Very Good" ? "blue" : "yellow"}`}>{tc.conduct}</span></td>
                  <td>{tc.fee_cleared ? <span className="badge-green flex items-center gap-1 w-fit"><CheckCircle className="w-3 h-3" /> Cleared</span> : <span className="badge-red">Pending</span>}</td>
                  <td>
                    <button type="button" onClick={() => openPrint(tc)} className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <Printer className="w-3 h-3" /> Print
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PRINT VIEW */}
      {printTC && (
        <div className="hidden print:block print-full">
          <div style={{ fontFamily: "Arial, sans-serif", maxWidth: "680px", margin: "0 auto", border: "2px solid #000", padding: "24px", fontSize: "12px" }}>
            <div style={{ textAlign: "center", borderBottom: "2px double #000", paddingBottom: "12px", marginBottom: "16px" }}>
              <p style={{ fontSize: "18px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "2px" }}>{schoolName}</p>
              <p style={{ fontSize: "13px", marginTop: "4px", fontWeight: "bold" }}>TRANSFER CERTIFICATE</p>
              <p style={{ fontSize: "11px", color: "#555", marginTop: "2px" }}>TC No: {printTC.tc_number}</p>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              {[
                ["1.", "Name of Student", printTC.student_name || ""],
                ["2.", "Father's / Guardian's Name", printTC.father_name || ""],
                ["3.", "Admission Number", printTC.admission_number || ""],
                ["4.", "Date of Birth", printTC.date_of_birth ? new Date(printTC.date_of_birth).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : ""],
                ["5.", "Class in which studying", printTC.class_name || printTC.last_class || ""],
                ["6.", "Last Exam Appeared", printTC.last_exam || ""],
                ["7.", "Whether failed in previous class", "No"],
                ["8.", "Date of Leaving", printTC.leaving_date ? new Date(printTC.leaving_date).toLocaleDateString("en-IN") : ""],
                ["9.", "Reason for Leaving", printTC.reason || ""],
                ["10.", "Character & Conduct", printTC.conduct || "Good"],
                ["11.", "Fee/Dues Cleared", printTC.fee_cleared ? "Yes, all dues cleared" : "No — dues pending"],
                ["12.", "Remarks", printTC.remarks || "—"],
              ].map(([num, label, value]) => (
                <tr key={label as string} style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: "6px 4px", width: "24px", verticalAlign: "top", color: "#555" }}>{num}</td>
                  <td style={{ padding: "6px 8px", width: "220px", verticalAlign: "top", fontWeight: "500" }}>{label}</td>
                  <td style={{ padding: "6px 8px", verticalAlign: "top" }}>: &nbsp; {value}</td>
                </tr>
              ))}
            </table>
            <div style={{ marginTop: "32px", display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ borderTop: "1px solid #000", width: "150px", paddingTop: "4px" }}>Class Teacher</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ marginBottom: "4px" }}>Date: {printTC.issue_date ? new Date(printTC.issue_date).toLocaleDateString("en-IN") : ""}</p>
                <div style={{ borderTop: "1px solid #000", width: "180px", paddingTop: "4px" }}>Principal / Head of Institution</div>
              </div>
            </div>
            <p style={{ textAlign: "center", marginTop: "20px", fontSize: "10px", color: "#888", borderTop: "1px dashed #ccc", paddingTop: "8px" }}>
              This certificate is issued on the request of the parent/guardian. — {schoolName}
            </p>
          </div>
        </div>
      )}

      {/* Issue TC Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 no-print">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-bold text-lg">Issue Transfer Certificate</h2>
                <p className="text-xs text-muted-foreground">TC No: TC/{new Date().getFullYear()}/{zeroPad(nextNum)}</p>
              </div>
              <button type="button" title="Close" onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Student *</label>
                <select title="Select student" value={form.student_id} onChange={e => { f("student_id", e.target.value); const s = students.find(x => x.id === e.target.value); if (s) f("last_class", s.class_name || ""); }}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                  <option value="">— Select Student —</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name} {s.class_name ? `(${s.class_name})` : ""}</option>)}
                </select>
              </div>
              {selStudent && (
                <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground grid grid-cols-2 gap-1">
                  <span>Father: {selStudent.father_name || "—"}</span>
                  <span>Admission No: {selStudent.admission_number || "—"}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Issue Date</label>
                  <input type="date" value={form.issue_date} onChange={e => f("issue_date", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Last Working Day</label>
                  <input type="date" value={form.leaving_date} onChange={e => f("leaving_date", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              </div>
              <div><label className="text-xs text-muted-foreground block mb-1">Reason for Leaving</label>
                <select title="Reason" value={form.reason} onChange={e => f("reason", e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                  {REASON_OPTIONS.map(r => <option key={r}>{r}</option>)}
                </select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Conduct</label>
                  <select title="Conduct" value={form.conduct} onChange={e => f("conduct", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                    {CONDUCT_OPTIONS.map(c => <option key={c}>{c}</option>)}
                  </select></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Last Exam Appeared</label>
                  <input value={form.last_exam} onChange={e => f("last_exam", e.target.value)} placeholder="e.g. Annual Exam 2025"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="fee_cleared" checked={form.fee_cleared} onChange={e => f("fee_cleared", e.target.checked)}
                  className="w-4 h-4 rounded" />
                <label htmlFor="fee_cleared" className="text-sm">All fees/dues cleared</label>
              </div>
              <div><label className="text-xs text-muted-foreground block mb-1">Remarks (optional)</label>
                <textarea value={form.remarks} onChange={e => f("remarks", e.target.value)} rows={2}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none" /></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-border rounded-lg text-sm">Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving || !form.student_id}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {saving ? "Issuing…" : "Issue TC"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
