import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Printer, BarChart2 } from "lucide-react";

type Exam    = { id: string; title: string; class_id: string };
type Class   = { id: string; name: string };
type Student = { id: string; name: string; roll_number: string; father_name?: string; date_of_birth?: string; admission_number?: string };
type Mark    = { student_id: string; subject: string; marks_obtained: number; max_marks: number };

const GRADE_SCALE = [
  { min: 91, grade: "A1", gp: 10, desc: "Outstanding" },
  { min: 81, grade: "A2", gp: 9,  desc: "Excellent" },
  { min: 71, grade: "B1", gp: 8,  desc: "Very Good" },
  { min: 61, grade: "B2", gp: 7,  desc: "Good" },
  { min: 51, grade: "C1", gp: 6,  desc: "Above Average" },
  { min: 41, grade: "C2", gp: 5,  desc: "Average" },
  { min: 33, grade: "D",  gp: 4,  desc: "Satisfactory" },
  { min: 0,  grade: "E",  gp: 0,  desc: "Needs Improvement" },
];

function getGrade(pct: number) { return GRADE_SCALE.find(g => pct >= g.min) || GRADE_SCALE[GRADE_SCALE.length - 1]; }

type StudentCard = {
  student: Student;
  subjects: { name: string; obtained: number; max: number; pct: number; grade: string; gp: number }[];
  total: number; maxTotal: number; pct: number; grade: string; rank: number; passed: boolean;
};

export function ReportCardPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [exams, setExams]     = useState<Exam[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selExam, setSelExam]   = useState("");
  const [selClass, setSelClass] = useState("");
  const [cards, setCards]       = useState<StudentCard[]>([]);
  const [loading, setLoading]   = useState(false);
  const [schoolName, setSchoolName] = useState("");
  const [printAll, setPrintAll] = useState(false);
  const [printSingle, setPrintSingle] = useState<StudentCard | null>(null);
  const [teacherRemark, setTeacherRemark] = useState("Keep up the good work!");

  useEffect(() => {
    if (!schoolId) return;
    Promise.all([
      supabase.from("exams").select("id, title:name, class_id").eq("school_id", schoolId).order("created_at", { ascending: false }),
      supabase.from("classes").select("id, name").eq("school_id", schoolId).order("name"),
      supabase.from("schools").select("name").eq("id", schoolId).single(),
    ]).then(([e, c, s]) => {
      setExams(e.data as Exam[] || []);
      setClasses(c.data as Class[] || []);
      setSchoolName(s.data?.name || "");
    });
  }, [schoolId]);

  async function generateCards() {
    if (!selExam || !selClass) return;
    setLoading(true);
    const [markRes, stuRes] = await Promise.all([
      supabase.from("exam_marks").select("student_id, subject, marks_obtained, max_marks").eq("school_id", schoolId).eq("exam_id", selExam),
      supabase.from("students").select("id, name, roll_number, father_name, date_of_birth, admission_number").eq("school_id", schoolId).eq("class_id", selClass).order("roll_number"),
    ]);
    const marks = markRes.data as Mark[] || [];
    const students = stuRes.data as Student[] || [];

    const raw: StudentCard[] = students.map(stu => {
      const stuMarks = marks.filter(m => m.student_id === stu.id);
      const subjects = stuMarks.map(m => {
        const pct = m.max_marks > 0 ? Math.round((m.marks_obtained / m.max_marks) * 100) : 0;
        const g = getGrade(pct);
        return { name: m.subject, obtained: m.marks_obtained, max: m.max_marks, pct, grade: g.grade, gp: g.gp };
      }).sort((a, b) => a.name.localeCompare(b.name));
      const total    = subjects.reduce((s, x) => s + x.obtained, 0);
      const maxTotal = subjects.reduce((s, x) => s + x.max, 0);
      const pct      = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0;
      const grade    = getGrade(pct).grade;
      const passed   = subjects.every(x => x.pct >= 33);
      return { student: stu, subjects, total, maxTotal, pct, grade, rank: 0, passed };
    });

    // Rank by total marks
    const sorted = [...raw].sort((a, b) => b.total - a.total);
    sorted.forEach((c, i) => { c.rank = i + 1; });

    setCards(sorted.sort((a, b) => {
      const ra = parseInt(a.student.roll_number || "0") || 0;
      const rb = parseInt(b.student.roll_number || "0") || 0;
      return ra - rb;
    }));
    setLoading(false);
  }

  function doPrintAll() { setPrintSingle(null); setPrintAll(true); setTimeout(() => window.print(), 300); }
  function doPrintOne(c: StudentCard) { setPrintSingle(c); setPrintAll(false); setTimeout(() => window.print(), 300); }

  const className = classes.find(c => c.id === selClass)?.name || "";
  const examName  = exams.find(e => e.id === selExam)?.title || "";
  const toPrint   = printAll ? cards : printSingle ? [printSingle] : [];

  return (
    <div>
      {/* Screen */}
      <div className="no-print">
        <div className="page-header flex items-center justify-between">
          <div>
            <h1>Report Card / Mark Sheet</h1>
            <p>Generate class-wise report cards with grades, rank and remarks</p>
          </div>
          {cards.length > 0 && (
            <button type="button" onClick={doPrintAll}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
              <Printer className="w-4 h-4" /> Print All ({cards.length})
            </button>
          )}
        </div>

        {/* Selectors */}
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm mb-6 flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Exam *</label>
            <select title="Select exam" value={selExam} onChange={e => setSelExam(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-background w-52">
              <option value="">— Select Exam —</option>
              {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Class *</label>
            <select title="Select class" value={selClass} onChange={e => setSelClass(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-background w-44">
              <option value="">— Select Class —</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Teacher's Remark</label>
            <input value={teacherRemark} onChange={e => setTeacherRemark(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-background w-64" />
          </div>
          <button type="button" onClick={generateCards} disabled={!selExam || !selClass || loading}
            className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
            <BarChart2 className="w-4 h-4" /> {loading ? "Generating…" : "Generate Cards"}
          </button>
        </div>

        {/* Cards preview table */}
        {cards.length > 0 && (
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            <table className="w-full edu-table">
              <thead><tr><th>Rank</th><th>Roll</th><th>Student</th><th>Subjects</th><th>Total</th><th>%</th><th>Grade</th><th>Result</th><th></th></tr></thead>
              <tbody>
                {cards.map(card => (
                  <tr key={card.student.id}>
                    <td className="font-bold text-center">{card.rank}</td>
                    <td className="text-sm font-mono">{card.student.roll_number}</td>
                    <td className="font-medium">{card.student.name}</td>
                    <td className="text-xs text-muted-foreground">{card.subjects.length} subjects</td>
                    <td className="font-semibold">{card.total}/{card.maxTotal}</td>
                    <td className="font-semibold">{card.pct}%</td>
                    <td><span className={`badge-${card.grade.startsWith("A") ? "green" : card.grade.startsWith("B") ? "blue" : card.grade.startsWith("C") ? "yellow" : card.grade === "D" ? "orange" : "red"}`}>{card.grade}</span></td>
                    <td><span className={card.passed ? "badge-green" : "badge-red"}>{card.passed ? "PASS" : "FAIL"}</span></td>
                    <td>
                      <button type="button" onClick={() => doPrintOne(card)} className="text-xs text-primary hover:underline flex items-center gap-1">
                        <Printer className="w-3 h-3" /> Print
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {cards.length === 0 && !loading && (
          <div className="bg-card rounded-xl border border-border p-16 text-center text-muted-foreground">
            <BarChart2 className="w-10 h-10 mx-auto mb-3" />
            <p className="font-semibold">Select an exam and class to generate report cards</p>
          </div>
        )}
      </div>

      {/* PRINT VIEW */}
      {toPrint.length > 0 && (
        <div className="hidden print:block print-full">
          {toPrint.map((card, ci) => (
            <div key={card.student.id} className="print:break-before-page" style={ci === 0 ? {} : {}}>
              <div style={{ fontFamily: "Arial, sans-serif", maxWidth: "680px", margin: "0 auto", border: "2px solid #000", padding: "20px", fontSize: "11px", pageBreakAfter: "always" }}>
                {/* Header */}
                <div style={{ textAlign: "center", borderBottom: "2px double #000", paddingBottom: "10px", marginBottom: "12px" }}>
                  <p style={{ fontSize: "16px", fontWeight: "bold", textTransform: "uppercase" }}>{schoolName}</p>
                  <p style={{ fontSize: "13px", fontWeight: "bold", marginTop: "4px" }}>PROGRESS REPORT CARD</p>
                  <p style={{ fontSize: "11px", color: "#555", marginTop: "2px" }}>{examName}</p>
                </div>
                {/* Student info */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "12px", fontSize: "11px" }}>
                  <div><strong>Name:</strong> {card.student.name}</div>
                  <div><strong>Class:</strong> {className}</div>
                  <div><strong>Roll No:</strong> {card.student.roll_number}</div>
                  <div><strong>Father:</strong> {card.student.father_name || "—"}</div>
                  <div><strong>Adm. No:</strong> {card.student.admission_number || "—"}</div>
                  <div><strong>Rank:</strong> {card.rank} / {toPrint.length}</div>
                </div>
                {/* Marks table */}
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", marginBottom: "12px" }}>
                  <thead>
                    <tr style={{ background: "#f0f0f0" }}>
                      <th style={{ border: "1px solid #999", padding: "5px 8px", textAlign: "left" }}>Subject</th>
                      <th style={{ border: "1px solid #999", padding: "5px 8px", textAlign: "center" }}>Max</th>
                      <th style={{ border: "1px solid #999", padding: "5px 8px", textAlign: "center" }}>Obtained</th>
                      <th style={{ border: "1px solid #999", padding: "5px 8px", textAlign: "center" }}>%</th>
                      <th style={{ border: "1px solid #999", padding: "5px 8px", textAlign: "center" }}>Grade</th>
                      <th style={{ border: "1px solid #999", padding: "5px 8px", textAlign: "center" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {card.subjects.map(s => (
                      <tr key={s.name}>
                        <td style={{ border: "1px solid #ccc", padding: "5px 8px" }}>{s.name}</td>
                        <td style={{ border: "1px solid #ccc", padding: "5px 8px", textAlign: "center" }}>{s.max}</td>
                        <td style={{ border: "1px solid #ccc", padding: "5px 8px", textAlign: "center", fontWeight: "bold" }}>{s.obtained}</td>
                        <td style={{ border: "1px solid #ccc", padding: "5px 8px", textAlign: "center" }}>{s.pct}%</td>
                        <td style={{ border: "1px solid #ccc", padding: "5px 8px", textAlign: "center", fontWeight: "bold" }}>{s.grade}</td>
                        <td style={{ border: "1px solid #ccc", padding: "5px 8px", textAlign: "center", color: s.pct >= 33 ? "#15803d" : "#dc2626" }}>{s.pct >= 33 ? "P" : "F"}</td>
                      </tr>
                    ))}
                    <tr style={{ background: "#f9f9f9", fontWeight: "bold" }}>
                      <td style={{ border: "1px solid #999", padding: "5px 8px" }}>TOTAL</td>
                      <td style={{ border: "1px solid #999", padding: "5px 8px", textAlign: "center" }}>{card.maxTotal}</td>
                      <td style={{ border: "1px solid #999", padding: "5px 8px", textAlign: "center" }}>{card.total}</td>
                      <td style={{ border: "1px solid #999", padding: "5px 8px", textAlign: "center" }}>{card.pct}%</td>
                      <td style={{ border: "1px solid #999", padding: "5px 8px", textAlign: "center" }}>{card.grade}</td>
                      <td style={{ border: "1px solid #999", padding: "5px 8px", textAlign: "center", color: card.passed ? "#15803d" : "#dc2626" }}>{card.passed ? "PASS" : "FAIL"}</td>
                    </tr>
                  </tbody>
                </table>
                {/* Grade scale */}
                <div style={{ fontSize: "9px", color: "#666", marginBottom: "12px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {GRADE_SCALE.slice(0, -1).map(g => <span key={g.grade}>{g.grade}: {g.min}%+</span>)}
                  <span>E: Below 33% (Fail)</span>
                </div>
                {/* Remark */}
                <div style={{ border: "1px solid #ccc", padding: "6px 10px", marginBottom: "16px", fontSize: "11px" }}>
                  <strong>Teacher's Remark:</strong> {teacherRemark}
                </div>
                {/* Signatures */}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "20px", fontSize: "11px" }}>
                  <div style={{ textAlign: "center" }}><div style={{ borderTop: "1px solid #000", width: "130px", paddingTop: "4px" }}>Parent's Signature</div></div>
                  <div style={{ textAlign: "center" }}><div style={{ borderTop: "1px solid #000", width: "130px", paddingTop: "4px" }}>Class Teacher</div></div>
                  <div style={{ textAlign: "center" }}><div style={{ borderTop: "1px solid #000", width: "130px", paddingTop: "4px" }}>Principal</div></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
