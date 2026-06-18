import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Plus, X, Search, Printer, FileText } from "lucide-react";

type Student = { id: string; name: string; roll_number: string; class_id: string; class_name?: string; father_name?: string; date_of_birth?: string; admission_number?: string };
type Cert = {
  id: string; student_id: string; cert_number: string; cert_type: string; purpose: string;
  issue_date: string; valid_till: string | null; remarks: string;
  student_name?: string; class_name?: string; father_name?: string; date_of_birth?: string; admission_number?: string;
};

const CERT_TYPES = [
  { v: "bonafide", l: "Bonafide Certificate", desc: "Certifies the student is a bonafide student of this school" },
  { v: "character", l: "Character Certificate", desc: "Certifies the student's character and conduct" },
  { v: "study",    l: "Study Certificate",    desc: "Certifies the student is currently studying in this school" },
];
const PURPOSE_OPTIONS = ["Bank Account Opening", "Scholarship Application", "Passport / Visa", "Sports/Competition", "Government scheme", "Railway / Bus concession", "Education loan", "Job application", "Court / Legal purpose", "Other"];

function zeroPad(n: number) { return String(n).padStart(4, "0"); }

export function BonafidePage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [certs, setCerts]     = useState<Cert[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [schoolName, setSchoolName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [printCert, setPrintCert] = useState<Cert | null>(null);
  const [search, setSearch]   = useState("");
  const [saving, setSaving]   = useState(false);
  const [nextNum, setNextNum] = useState(1);
  const [form, setForm]       = useState({ student_id: "", cert_type: "bonafide", purpose: PURPOSE_OPTIONS[0], issue_date: new Date().toISOString().slice(0, 10), valid_till: "", remarks: "" });

  async function fetchData() {
    const [cRes, sRes, schRes] = await Promise.all([
      supabase.from("bonafide_certificates").select("*").eq("school_id", schoolId).order("created_at", { ascending: false }),
      supabase.from("students").select("id, name, roll_number, class_id, father_name, date_of_birth, admission_number").eq("school_id", schoolId).order("name"),
      supabase.from("schools").select("name").eq("id", schoolId).single(),
    ]);
    const classes = await supabase.from("classes").select("id, name").eq("school_id", schoolId);
    const cm = Object.fromEntries((classes.data || []).map((c: { id: string; name: string }) => [c.id, c.name]));
    const stuList = (sRes.data || []).map((s: Student) => ({ ...s, class_name: cm[s.class_id] || "" }));
    setStudents(stuList);
    setSchoolName(schRes.data?.name || "");
    const sm = Object.fromEntries(stuList.map(s => [s.id, s]));
    setCerts((cRes.data || []).map((c: Cert) => ({ ...c, ...sm[c.student_id] ? { student_name: sm[c.student_id].name, class_name: sm[c.student_id].class_name, father_name: sm[c.student_id].father_name, date_of_birth: sm[c.student_id].date_of_birth, admission_number: sm[c.student_id].admission_number } : {} })));
    setNextNum((cRes.data?.length || 0) + 1);
  }

  useEffect(() => { if (schoolId) fetchData(); }, [schoolId]);

  async function handleSave() {
    if (!form.student_id || !form.purpose) return;
    setSaving(true);
    const prefix = form.cert_type === "bonafide" ? "BC" : form.cert_type === "character" ? "CC" : "SC";
    const cert_number = `${prefix}/${new Date().getFullYear()}/${zeroPad(nextNum)}`;
    await supabase.from("bonafide_certificates").insert({ ...form, school_id: schoolId, cert_number, valid_till: form.valid_till || null });
    setSaving(false);
    setShowForm(false);
    setForm({ student_id: "", cert_type: "bonafide", purpose: PURPOSE_OPTIONS[0], issue_date: new Date().toISOString().slice(0, 10), valid_till: "", remarks: "" });
    fetchData();
  }

  function doPrint(cert: Cert) { setPrintCert(cert); setTimeout(() => window.print(), 300); }

  const filtered = certs.filter(c => !search || c.student_name?.toLowerCase().includes(search.toLowerCase()) || c.cert_number.toLowerCase().includes(search.toLowerCase()));
  const selStu = students.find(s => s.id === form.student_id);
  const certTypeLabel = CERT_TYPES.find(t => t.v === (printCert?.cert_type || form.cert_type))?.l || "Bonafide Certificate";
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div>
      <div className="no-print">
        <div className="page-header flex items-center justify-between">
          <div>
            <h1>Bonafide / Character Certificate</h1>
            <p>Issue certificates for bank account, scholarship, passport — maintain register</p>
          </div>
          <button type="button" onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> Issue Certificate
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {CERT_TYPES.map(t => (
            <div key={t.v} className="bg-card rounded-xl p-4 border border-border shadow-sm">
              <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /><p className="text-xs text-muted-foreground">{t.l}</p></div>
              <p className="text-2xl font-bold">{certs.filter(c => c.cert_type === t.v).length}</p>
            </div>
          ))}
          <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-blue">
            <p className="text-xs text-muted-foreground">Total Issued</p>
            <p className="text-2xl font-bold">{certs.length}</p>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student or cert number…"
              className="pl-9 pr-4 py-2 border border-border rounded-lg text-sm bg-background w-60" />
          </div>
          <span className="text-sm text-muted-foreground ml-auto">{filtered.length} certificates</span>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          <table className="w-full edu-table">
            <thead><tr><th>Cert Number</th><th>Student</th><th>Class</th><th>Type</th><th>Purpose</th><th>Issue Date</th><th>Valid Till</th><th></th></tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No certificates issued yet.</td></tr>}
              {filtered.map(c => (
                <tr key={c.id}>
                  <td className="font-mono text-sm font-semibold">{c.cert_number}</td>
                  <td className="font-medium">{c.student_name}</td>
                  <td className="text-sm">{c.class_name || "—"}</td>
                  <td><span className={`badge-${c.cert_type === "bonafide" ? "blue" : c.cert_type === "character" ? "green" : "purple"}`}>{CERT_TYPES.find(t => t.v === c.cert_type)?.l}</span></td>
                  <td className="text-sm text-muted-foreground">{c.purpose}</td>
                  <td className="text-sm">{new Date(c.issue_date).toLocaleDateString("en-IN")}</td>
                  <td className="text-sm">{c.valid_till ? new Date(c.valid_till).toLocaleDateString("en-IN") : "—"}</td>
                  <td>
                    <button type="button" onClick={() => doPrint(c)} className="flex items-center gap-1 text-xs text-primary hover:underline">
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
      {printCert && (
        <div className="hidden print:block print-full">
          <div style={{ fontFamily: "Arial, sans-serif", maxWidth: "680px", margin: "0 auto", border: "2px solid #000", padding: "28px", fontSize: "12px" }}>
            <div style={{ textAlign: "center", borderBottom: "2px double #000", paddingBottom: "12px", marginBottom: "18px" }}>
              <p style={{ fontSize: "18px", fontWeight: "bold", textTransform: "uppercase" }}>{schoolName}</p>
              <p style={{ fontSize: "14px", fontWeight: "bold", marginTop: "6px", textDecoration: "underline" }}>
                {CERT_TYPES.find(t => t.v === printCert.cert_type)?.l?.toUpperCase()}
              </p>
              <p style={{ fontSize: "10px", color: "#666", marginTop: "3px" }}>Cert. No: {printCert.cert_number} &nbsp;|&nbsp; Date: {new Date(printCert.issue_date).toLocaleDateString("en-IN")}</p>
            </div>

            <p style={{ lineHeight: "2", fontSize: "13px", marginBottom: "16px" }}>
              {printCert.cert_type === "bonafide" && (
                <>This is to certify that <strong>{printCert.student_name}</strong>{printCert.father_name ? `, S/o D/o ${printCert.father_name}` : ""}, is a bonafide student of this school, studying in <strong>{printCert.class_name}</strong> during the academic year <strong>{new Date().getFullYear()}-{new Date().getFullYear() + 1}</strong>.</>
              )}
              {printCert.cert_type === "character" && (
                <>This is to certify that <strong>{printCert.student_name}</strong>{printCert.father_name ? `, S/o D/o ${printCert.father_name}` : ""}, was a student of this school in Class <strong>{printCert.class_name}</strong>. During his/her stay in this institution, the student's character and conduct was found to be <strong>Good</strong>. He/she was a disciplined and well-behaved student.</>
              )}
              {printCert.cert_type === "study" && (
                <>This is to certify that <strong>{printCert.student_name}</strong>{printCert.father_name ? `, S/o D/o ${printCert.father_name}` : ""}, is currently studying in Class <strong>{printCert.class_name}</strong> at this institution during the academic year <strong>{new Date().getFullYear()}-{new Date().getFullYear() + 1}</strong>.</>
              )}
            </p>

            <div style={{ border: "1px solid #ccc", padding: "10px 14px", marginBottom: "16px", background: "#f9f9f9", fontSize: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <div><strong>Purpose:</strong> {printCert.purpose}</div>
                {printCert.admission_number && <div><strong>Adm. No:</strong> {printCert.admission_number}</div>}
                {printCert.date_of_birth && <div><strong>Date of Birth:</strong> {new Date(printCert.date_of_birth).toLocaleDateString("en-IN")}</div>}
                {printCert.valid_till && <div><strong>Valid Till:</strong> {new Date(printCert.valid_till).toLocaleDateString("en-IN")}</div>}
              </div>
            </div>

            {printCert.remarks && <p style={{ marginBottom: "14px", fontSize: "12px", fontStyle: "italic" }}>{printCert.remarks}</p>}

            <div style={{ marginTop: "40px", display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
              <div />
              <div style={{ textAlign: "center" }}>
                <div style={{ borderTop: "1px solid #000", width: "180px", paddingTop: "4px" }}>Principal / Head of Institution</div>
                <p style={{ marginTop: "4px", color: "#666" }}>{schoolName}</p>
              </div>
            </div>
            <p style={{ textAlign: "center", marginTop: "24px", fontSize: "9px", color: "#aaa", borderTop: "1px dashed #ccc", paddingTop: "6px" }}>
              This certificate is issued on the specific request of the student/parent for the above-mentioned purpose only.
            </p>
          </div>
        </div>
      )}

      {/* Issue Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 no-print">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">Issue Certificate</h2>
              <button type="button" title="Close" onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div><label className="text-xs text-muted-foreground block mb-1">Certificate Type</label>
                <div className="space-y-2">
                  {CERT_TYPES.map(t => (
                    <label key={t.v} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${form.cert_type === t.v ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"}`}>
                      <input type="radio" name="cert_type" value={t.v} checked={form.cert_type === t.v} onChange={e => f("cert_type", e.target.value)} className="mt-0.5" />
                      <div><p className="font-semibold text-sm">{t.l}</p><p className="text-xs text-muted-foreground">{t.desc}</p></div>
                    </label>
                  ))}
                </div>
              </div>
              <div><label className="text-xs text-muted-foreground block mb-1">Student *</label>
                <select title="Student" value={form.student_id} onChange={e => f("student_id", e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                  <option value="">— Select Student —</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name} {s.class_name ? `(${s.class_name})` : ""}</option>)}
                </select>
              </div>
              {selStu && (
                <div className="bg-muted/40 rounded-lg p-2.5 text-xs text-muted-foreground">
                  Adm: {selStu.admission_number || "—"} &nbsp;|&nbsp; Father: {selStu.father_name || "—"}
                </div>
              )}
              <div><label className="text-xs text-muted-foreground block mb-1">Purpose *</label>
                <select title="Purpose" value={form.purpose} onChange={e => f("purpose", e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                  {PURPOSE_OPTIONS.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Issue Date</label>
                  <input type="date" value={form.issue_date} onChange={e => f("issue_date", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Valid Till</label>
                  <input type="date" value={form.valid_till} onChange={e => f("valid_till", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              </div>
              <div><label className="text-xs text-muted-foreground block mb-1">Remarks (optional)</label>
                <textarea value={form.remarks} onChange={e => f("remarks", e.target.value)} rows={2}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none" /></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-border rounded-lg text-sm">Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving || !form.student_id || !form.purpose}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {saving ? "Issuing…" : "Issue & Print"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
