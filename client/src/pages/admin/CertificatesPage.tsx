import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Plus, Printer, X, Award } from "lucide-react";

type Student = {
  id: string;
  name: string;
  roll_number: string;
  admission_number: string;
  father_name: string;
  mother_name: string;
  date_of_birth: string;
  blood_group: string;
  category: string;
  gender: string;
  classes?: { name: string } | null;
};

type Certificate = {
  id: string;
  cert_type: "tc" | "bonafide" | "character";
  reference_number: string;
  issue_date: string;
  reason_leaving: string;
  last_attendance_date: string;
  purpose: string;
  conduct: string;
  remarks: string;
  created_at: string;
  students?: { name: string; admission_number: string } | null;
};

type School = {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
};

const CERT_LABELS: Record<string, string> = {
  tc: "Transfer Certificate",
  bonafide: "Bonafide Certificate",
  character: "Character Certificate",
};

const CONDUCT_OPTIONS = ["Excellent", "Very Good", "Good", "Satisfactory"];
const PURPOSE_OPTIONS = [
  "Bank Account Opening",
  "Passport Application",
  "Scholarship Application",
  "University Admission",
  "Visa Application",
  "General Purpose",
];

export function CertificatesPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [activeTab, setActiveTab] = useState<"list" | "new">("list");
  const [certTypeFilter, setCertTypeFilter] = useState("all");
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(false);
  const [printCert, setPrintCert] = useState<Certificate | null>(null);
  const [printStudent, setPrintStudent] = useState<Student | null>(null);

  const [form, setForm] = useState({
    student_id: "",
    cert_type: "bonafide" as "tc" | "bonafide" | "character",
    issue_date: new Date().toISOString().split("T")[0],
    reason_leaving: "",
    last_attendance_date: "",
    purpose: PURPOSE_OPTIONS[0],
    conduct: "Good",
    remarks: "",
  });

  async function fetchData() {
    const [certsRes, studsRes, schoolRes] = await Promise.all([
      supabase
        .from("certificates")
        .select("*, students(name, admission_number)")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false }),
      supabase
        .from("students")
        .select("id, name, roll_number, admission_number, father_name, mother_name, date_of_birth, blood_group, category, gender, classes(name)")
        .eq("school_id", schoolId)
        .order("name"),
      supabase.from("schools").select("id, name, address, phone, email").eq("id", schoolId).single(),
    ]);
    setCertificates(certsRes.data || []);
    setStudents(studsRes.data || []);
    if (schoolRes.data) setSchool(schoolRes.data as School);
  }

  useEffect(() => { if (schoolId) fetchData(); }, [schoolId]);

  async function handleIssue() {
    if (!form.student_id) return;
    setLoading(true);
    const year = new Date().getFullYear();
    const shortYear = `${String(year).slice(2)}${String(year + 1).slice(2)}`;
    const count = certificates.filter((c) => c.cert_type === form.cert_type).length + 1;
    const prefix = form.cert_type === "tc" ? "TC" : form.cert_type === "bonafide" ? "BF" : "CC";
    const reference_number = `${prefix}/${shortYear}/${String(count).padStart(4, "0")}`;

    const { data } = await supabase
      .from("certificates")
      .insert({ ...form, school_id: schoolId, reference_number })
      .select("*, students(name, admission_number)")
      .single();

    setLoading(false);
    if (!data) return;

    const student = students.find((s) => s.id === form.student_id) || null;
    await fetchData();
    setActiveTab("list");
    setForm({
      student_id: "",
      cert_type: "bonafide",
      issue_date: new Date().toISOString().split("T")[0],
      reason_leaving: "",
      last_attendance_date: "",
      purpose: PURPOSE_OPTIONS[0],
      conduct: "Good",
      remarks: "",
    });
    setPrintCert(data as Certificate);
    setPrintStudent(student);
  }

  function openPrint(cert: Certificate) {
    const sn = cert.students as { name: string; admission_number: string } | null;
    const student = students.find((s) => s.admission_number && s.admission_number === sn?.admission_number)
      || students.find((s) => s.name === sn?.name)
      || null;
    setPrintCert(cert);
    setPrintStudent(student);
  }

  const filtered = certTypeFilter === "all" ? certificates : certificates.filter((c) => c.cert_type === certTypeFilter);
  const selectedStudent = students.find((s) => s.id === form.student_id);

  const counts = { tc: 0, bonafide: 0, character: 0 };
  certificates.forEach((c) => { if (c.cert_type in counts) counts[c.cert_type as keyof typeof counts]++; });

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Certificates</h1>
          <p>Issue Transfer, Bonafide &amp; Character Certificates with printable templates</p>
        </div>
        <button
          type="button"
          onClick={() => setActiveTab("new")}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> Issue Certificate
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {(Object.entries(counts) as [string, number][]).map(([type, count]) => {
          const colors: Record<string, string> = { tc: "card-accent-blue", bonafide: "card-accent-green", character: "card-accent-purple" };
          return (
            <div key={type} className={`bg-card rounded-xl p-4 border border-border shadow-sm ${colors[type]}`}>
              <p className="text-xs text-muted-foreground">{CERT_LABELS[type]}</p>
              <p className="text-2xl font-bold mt-1">{count}</p>
            </div>
          );
        })}
      </div>

      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 mb-6 w-fit">
        {(["list", "new"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t === "list" ? "Issued Certificates" : "Issue New"}
          </button>
        ))}
      </div>

      {activeTab === "list" && (
        <div>
          <div className="flex gap-3 mb-4">
            <select
              title="Filter by type"
              value={certTypeFilter}
              onChange={(e) => setCertTypeFilter(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-background"
            >
              <option value="all">All Types</option>
              <option value="tc">Transfer Certificate</option>
              <option value="bonafide">Bonafide Certificate</option>
              <option value="character">Character Certificate</option>
            </select>
          </div>
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            <table className="w-full edu-table">
              <thead>
                <tr>
                  <th>Reference No.</th>
                  <th>Student</th>
                  <th>Type</th>
                  <th>Issue Date</th>
                  <th>Conduct</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted-foreground py-10">
                      No certificates issued yet.
                    </td>
                  </tr>
                )}
                {filtered.map((cert) => {
                  const typeColors: Record<string, string> = { tc: "badge-blue", bonafide: "badge-green", character: "badge-purple" };
                  const sn = cert.students as { name: string } | null;
                  return (
                    <tr key={cert.id}>
                      <td className="font-mono text-sm font-medium">{cert.reference_number}</td>
                      <td className="font-medium">{sn?.name || "—"}</td>
                      <td>
                        <span className={typeColors[cert.cert_type] || "badge-gray"}>{CERT_LABELS[cert.cert_type]}</span>
                      </td>
                      <td>{cert.issue_date ? new Date(cert.issue_date).toLocaleDateString("en-IN") : "—"}</td>
                      <td>{cert.conduct || "—"}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => openPrint(cert)}
                          className="flex items-center gap-1.5 text-xs text-primary hover:opacity-70 border border-primary/30 px-2 py-1 rounded"
                        >
                          <Printer className="w-3.5 h-3.5" /> Print
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "new" && (
        <div className="max-w-2xl">
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
            <h2 className="font-bold text-base">Issue New Certificate</h2>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Student *</label>
              <select
                title="Select student"
                value={form.student_id}
                onChange={(e) => setForm({ ...form, student_id: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
              >
                <option value="">Select student…</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.admission_number ? `(Adm: ${s.admission_number})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {selectedStudent && (
              <div className="p-3 bg-muted/40 rounded-lg text-xs grid grid-cols-3 gap-2">
                <span><span className="text-muted-foreground">Class:</span> {(selectedStudent.classes as { name: string } | null)?.name || "—"}</span>
                <span><span className="text-muted-foreground">Roll:</span> {selectedStudent.roll_number || "—"}</span>
                <span><span className="text-muted-foreground">Father:</span> {selectedStudent.father_name || "—"}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Certificate Type *</label>
                <select
                  title="Certificate type"
                  value={form.cert_type}
                  onChange={(e) => setForm({ ...form, cert_type: e.target.value as "tc" | "bonafide" | "character" })}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                >
                  <option value="bonafide">Bonafide Certificate</option>
                  <option value="tc">Transfer Certificate</option>
                  <option value="character">Character Certificate</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Issue Date *</label>
                <input
                  type="date"
                  title="Issue date"
                  value={form.issue_date}
                  onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Conduct</label>
              <select
                title="Conduct"
                value={form.conduct}
                onChange={(e) => setForm({ ...form, conduct: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
              >
                {CONDUCT_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {form.cert_type === "tc" && (
              <div className="space-y-3 border-t border-border pt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">TC Fields</p>
                <input
                  value={form.reason_leaving}
                  onChange={(e) => setForm({ ...form, reason_leaving: e.target.value })}
                  placeholder="Reason for leaving school"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                />
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Last Attendance Date</label>
                  <input
                    type="date"
                    title="Last attendance date"
                    value={form.last_attendance_date}
                    onChange={(e) => setForm({ ...form, last_attendance_date: e.target.value })}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                  />
                </div>
              </div>
            )}

            {form.cert_type === "bonafide" && (
              <div className="space-y-3 border-t border-border pt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bonafide Fields</p>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Purpose</label>
                  <select
                    title="Purpose"
                    value={form.purpose}
                    onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                  >
                    {PURPOSE_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            )}

            <input
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              placeholder="Additional remarks (optional)"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
            />

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setActiveTab("list")} className="flex-1 py-2.5 border border-border rounded-lg text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleIssue}
                disabled={loading || !form.student_id}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Issuing…" : "Issue & Print"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {printCert && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-800">
                {CERT_LABELS[printCert.cert_type]} — {printCert.reference_number}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                >
                  <Printer className="w-4 h-4" /> Print
                </button>
                <button type="button" title="Close" onClick={() => { setPrintCert(null); setPrintStudent(null); }}>
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="p-8">
              {printCert.cert_type === "tc" && <TCTemplate cert={printCert} student={printStudent} school={school} />}
              {printCert.cert_type === "bonafide" && <BonafideTemplate cert={printCert} student={printStudent} school={school} />}
              {printCert.cert_type === "character" && <CharacterTemplate cert={printCert} student={printStudent} school={school} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Print Template Components ────────────────────────────────────────────────

interface TemplateProps {
  cert: Certificate;
  student: Student | null;
  school: School | null;
}

function SchoolHeader({ school }: { school: School | null }) {
  return (
    <div className="text-center mb-6 border-b-2 border-gray-800 pb-4">
      <div className="flex items-center justify-center gap-3 mb-1">
        <Award className="w-8 h-8 text-blue-700" />
        <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-wide">{school?.name || "School Name"}</h1>
        <Award className="w-8 h-8 text-blue-700" />
      </div>
      {school?.address && <p className="text-sm text-gray-600 mt-0.5">{school.address}</p>}
      <div className="flex items-center justify-center gap-6 text-xs text-gray-500 mt-1">
        {school?.phone && <span>Phone: {school.phone}</span>}
        {school?.email && <span>Email: {school.email}</span>}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-baseline gap-2 mb-2.5">
      <span className="text-sm font-semibold text-gray-700 w-48 flex-shrink-0">{label}:</span>
      <span className="flex-1 border-b border-dotted border-gray-400 text-sm pb-0.5">{value || "—"}</span>
    </div>
  );
}

function SignatureRow({ school }: { school: School | null }) {
  return (
    <div className="flex justify-between mt-16">
      <div className="text-center">
        <div className="border-t border-gray-700 pt-1 w-36">
          <p className="text-xs font-semibold text-gray-700">Class Teacher</p>
        </div>
      </div>
      <div className="text-center">
        <div className="border-t border-gray-700 pt-1 w-44">
          <p className="text-xs font-semibold text-gray-700">Principal / Head</p>
          <p className="text-xs text-gray-500">{school?.name}</p>
        </div>
      </div>
    </div>
  );
}

function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

function TCTemplate({ cert, student, school }: TemplateProps) {
  const cls = (student?.classes as { name: string } | null)?.name || "—";
  return (
    <div className="font-serif text-gray-900">
      <SchoolHeader school={school} />
      <div className="text-center mb-5">
        <h2 className="text-xl font-bold uppercase tracking-widest underline">Transfer Certificate</h2>
        <p className="text-sm text-gray-500 mt-1">Ref No: <strong className="text-gray-800 font-mono">{cert.reference_number}</strong></p>
      </div>
      <Row label="Student Name" value={student?.name} />
      <Row label="Father's Name" value={student?.father_name} />
      <Row label="Mother's Name" value={student?.mother_name} />
      <Row label="Date of Birth" value={fmtDate(student?.date_of_birth)} />
      <Row label="Admission Number" value={student?.admission_number} />
      <Row label="Class / Section" value={cls} />
      <Row label="Blood Group" value={student?.blood_group} />
      <Row label="Category" value={student?.category} />
      <Row label="Reason for Leaving" value={cert.reason_leaving} />
      <Row label="Last Attendance Date" value={fmtDate(cert.last_attendance_date)} />
      <Row label="Conduct &amp; Character" value={cert.conduct} />
      {cert.remarks && <Row label="Remarks" value={cert.remarks} />}
      <Row label="Date of Issue" value={fmtDate(cert.issue_date)} />
      <p className="text-sm text-gray-700 leading-relaxed mt-5 mb-4">
        This is to certify that the above-named student was a bonafide student of this school and is
        hereby granted this Transfer Certificate. The particulars mentioned above are true to the
        best of our knowledge.
      </p>
      <SignatureRow school={school} />
      <p className="text-xs text-gray-400 text-center mt-6">Computer generated — valid without seal if issued digitally.</p>
    </div>
  );
}

function BonafideTemplate({ cert, student, school }: TemplateProps) {
  const cls = (student?.classes as { name: string } | null)?.name || "—";
  const acYear = `${new Date(cert.issue_date).getFullYear()}-${new Date(cert.issue_date).getFullYear() + 1}`;
  return (
    <div className="font-serif text-gray-900">
      <SchoolHeader school={school} />
      <div className="text-center mb-5">
        <h2 className="text-xl font-bold uppercase tracking-widest underline">Bonafide Certificate</h2>
        <p className="text-sm text-gray-500 mt-1">Ref No: <strong className="text-gray-800 font-mono">{cert.reference_number}</strong></p>
      </div>
      <p className="text-sm leading-loose text-gray-800 mb-4">
        This is to certify that <strong className="underline">{student?.name || "________________________"}</strong>
        {student?.father_name && <>, son/daughter of <strong>{student.father_name}</strong></>},
        bearing Admission Number <strong>{student?.admission_number || "________"}</strong>,
        is a bonafide student of this school, currently studying in Class <strong>{cls}</strong> during the academic year <strong>{acYear}</strong>.
      </p>
      <Row label="Date of Birth" value={fmtDate(student?.date_of_birth)} />
      <Row label="Blood Group" value={student?.blood_group} />
      <Row label="Roll Number" value={student?.roll_number} />
      <Row label="Conduct" value={cert.conduct} />
      <Row label="Purpose" value={cert.purpose} />
      {cert.remarks && <Row label="Remarks" value={cert.remarks} />}
      <Row label="Date of Issue" value={fmtDate(cert.issue_date)} />
      <p className="text-sm text-gray-700 leading-relaxed mt-5 mb-4">
        This certificate is issued on the request of the student for the purpose of <strong>{cert.purpose || "general use"}</strong>.
      </p>
      <div className="flex justify-end mt-12">
        <div className="text-center">
          <div className="border-t border-gray-700 pt-1 w-44">
            <p className="text-xs font-semibold text-gray-700">Principal / Head</p>
            <p className="text-xs text-gray-500">{school?.name}</p>
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-400 text-center mt-6">Computer generated — valid without seal if issued digitally.</p>
    </div>
  );
}

function CharacterTemplate({ cert, student, school }: TemplateProps) {
  const cls = (student?.classes as { name: string } | null)?.name || "—";
  return (
    <div className="font-serif text-gray-900">
      <SchoolHeader school={school} />
      <div className="text-center mb-5">
        <h2 className="text-xl font-bold uppercase tracking-widest underline">Character Certificate</h2>
        <p className="text-sm text-gray-500 mt-1">Ref No: <strong className="text-gray-800 font-mono">{cert.reference_number}</strong></p>
      </div>
      <p className="text-sm leading-loose text-gray-800 mb-4">
        This is to certify that <strong className="underline">{student?.name || "________________________"}</strong>
        {student?.father_name && <>, son/daughter of <strong>{student.father_name}</strong></>},
        bearing Admission Number <strong>{student?.admission_number || "________"}</strong>,
        studied in Class <strong>{cls}</strong> at this institution.
      </p>
      <p className="text-sm leading-relaxed text-gray-800 mb-4">
        During the period of study at this school, the student has shown <strong>{cert.conduct || "Good"}</strong> conduct
        and character. He/She has been regular in attendance, diligent in studies, and has maintained respectful
        behaviour towards teachers and fellow students throughout the course of study.
      </p>
      {cert.remarks && <p className="text-sm leading-relaxed text-gray-800 mb-4">{cert.remarks}</p>}
      <p className="text-sm leading-relaxed text-gray-800 mb-2">We wish him/her success in all future endeavours.</p>
      <Row label="Date of Issue" value={fmtDate(cert.issue_date)} />
      <div className="flex justify-end mt-12">
        <div className="text-center">
          <div className="border-t border-gray-700 pt-1 w-44">
            <p className="text-xs font-semibold text-gray-700">Principal / Head</p>
            <p className="text-xs text-gray-500">{school?.name}</p>
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-400 text-center mt-6">Computer generated — valid without seal if issued digitally.</p>
    </div>
  );
}
