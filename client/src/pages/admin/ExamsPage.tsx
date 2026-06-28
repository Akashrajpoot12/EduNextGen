import { useState, useEffect } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Plus, Search, Printer, X, Save } from "lucide-react";

type Exam = { id: string; name: string; exam_type: string; start_date: string; end_date: string; class_id?: string; is_published: boolean; class_name?: string };
type ClassItem = { id: string; grade_level: string; section: string };
const classLabel = (c?: { grade_level?: string; section?: string } | null) =>
  c ? `${c.grade_level ?? ""}${c.section ? " - " + c.section : ""}`.trim() || "—" : "—";
type Student = { id: string; name: string; roll_number?: string; class_id?: string };
type Mark = { student_id: string; subject: string; max_marks: number; marks_obtained: number | null; is_absent: boolean };

const EXAM_TYPE_COLORS: Record<string, string> = {
  unit_test: "badge-blue", midterm: "badge-purple", final: "badge-red",
  quarterly: "badge-green", half_yearly: "badge-yellow", annual: "badge-orange",
};

function calcGrade(marks: number | null, max: number, absent: boolean): string {
  if (absent) return "AB";
  if (marks === null || max === 0) return "—";
  const pct = (marks / max) * 100;
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  if (pct >= 40) return "D";
  return "F";
}

const SUBJECTS = ["Hindi", "English", "Mathematics", "Science", "Social Science", "Computer"];

export function ExamsPage() {
  const { tenantId: schoolId } = useTenant();
  const [tab, setTab] = useState<"exams" | "marks" | "reports">("exams");
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", exam_type: "unit_test", start_date: "", end_date: "", class_id: "" });

  const [selExam, setSelExam] = useState("");
  const [selClass, setSelClass] = useState("");
  const [subjects, setSubjects] = useState<string[]>(SUBJECTS);
  const [newSubject, setNewSubject] = useState("");
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [maxMarks, setMaxMarks] = useState<Record<string, number>>({});

  const [reportStudent, setReportStudent] = useState("");
  const [reportExam, setReportExam] = useState("");
  const [reportMarks, setReportMarks] = useState<Mark[]>([]);

  // Bulk report card state
  const [reportMode, setReportMode] = useState<"single" | "bulk">("single");
  const [bulkExam, setBulkExam] = useState("");
  const [bulkClass, setBulkClass] = useState("");
  const [bulkMarks, setBulkMarks] = useState<Record<string, Mark[]>>({});
  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => { if (schoolId) fetchAll(); }, [schoolId]);

  async function fetchAll() {
    setLoading(true);
    const supabase = createClient();
    const [e, c, st] = await Promise.all([
      supabase.from("exams").select("*").eq("school_id", schoolId).order("start_date", { ascending: false }),
      supabase.from("classes").select("id, grade_level, section").eq("school_id", schoolId),
      supabase.from("students").select("id, name, roll_number, class_id").eq("school_id", schoolId),
    ]);
    const classMap = Object.fromEntries((c.data || []).map((x: ClassItem) => [x.id, classLabel(x)]));
    const enrichedExams = (e.data || []).map((x: Exam) => ({ ...x, class_name: x.class_id ? classMap[x.class_id] || "All Classes" : "All Classes" }));
    setExams(enrichedExams);
    setClasses(c.data || []);
    setStudents(st.data || []);
    setLoading(false);
  }

  async function saveExam(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    const supabase = createClient();
    await supabase.from("exams").insert({ school_id: schoolId, name: addForm.name, exam_type: addForm.exam_type, start_date: addForm.start_date, end_date: addForm.end_date, class_id: addForm.class_id || null, is_published: false });
    setSaving(false); setShowAdd(false);
    setAddForm({ name: "", exam_type: "unit_test", start_date: "", end_date: "", class_id: "" });
    fetchAll();
  }

  async function togglePublish(exam: Exam) {
    const supabase = createClient();
    await supabase.from("exams").update({ is_published: !exam.is_published }).eq("id", exam.id);
    fetchAll();
  }

  async function deleteExam(id: string) {
    if (!confirm("Delete this exam?")) return;
    const supabase = createClient();
    await supabase.from("exams").delete().eq("id", id);
    fetchAll();
  }

  const classStudents = students.filter(s => !selClass || s.class_id === selClass);

  async function loadMarks() {
    if (!selExam || !selClass) return;
    const supabase = createClient();
    const { data } = await supabase.from("exam_marks").select("*").eq("school_id", schoolId).eq("exam_id", selExam).in("student_id", classStudents.map(s => s.id));
    const m: Record<string, Mark> = {};
    const mx: Record<string, number> = {};
    (data || []).forEach((row: Mark & { exam_id: string }) => {
      const key = `${row.student_id}__${row.subject}`;
      m[key] = row;
      mx[row.subject] = row.max_marks;
    });
    setMarks(m);
    setMaxMarks(mx);
  }

  useEffect(() => { if (selExam && selClass) loadMarks(); }, [selExam, selClass]);

  function setMark(studentId: string, subject: string, field: "marks_obtained" | "is_absent" | "max_marks", value: number | boolean) {
    if (field === "max_marks") {
      setMaxMarks(p => ({ ...p, [subject]: value as number }));
    } else {
      const key = `${studentId}__${subject}`;
      setMarks(p => ({ ...p, [key]: { ...p[key], student_id: studentId, subject, max_marks: maxMarks[subject] || 100, ...{ [field]: value } } }));
    }
  }

  async function saveAllMarks() {
    if (!selExam || !selClass) return;
    setSaving(true);
    const supabase = createClient();
    const upserts = Object.values(marks).map(m => ({
      school_id: schoolId, exam_id: selExam, student_id: m.student_id, subject: m.subject,
      max_marks: maxMarks[m.subject] || 100,
      marks_obtained: m.is_absent ? null : m.marks_obtained,
      is_absent: m.is_absent || false,
      grade: calcGrade(m.is_absent ? null : m.marks_obtained, maxMarks[m.subject] || 100, m.is_absent || false),
      class_id: selClass,
    }));
    if (upserts.length > 0) {
      await supabase.from("exam_marks").upsert(upserts, { onConflict: "exam_id,student_id,subject" });
    }
    setSaving(false);
    toast.success("Marks saved successfully!");
  }

  async function loadReport() {
    if (!reportStudent || !reportExam) return;
    const supabase = createClient();
    const { data } = await supabase.from("exam_marks").select("*").eq("school_id", schoolId).eq("student_id", reportStudent).eq("exam_id", reportExam);
    setReportMarks(data || []);
  }

  useEffect(() => { if (reportStudent && reportExam) loadReport(); }, [reportStudent, reportExam]);

  async function loadBulkReport() {
    if (!bulkExam || !bulkClass) return;
    setBulkLoading(true);
    const supabase = createClient();
    const classStuds = students.filter(s => s.class_id === bulkClass);
    const { data } = await supabase.from("exam_marks").select("*").eq("school_id", schoolId).eq("exam_id", bulkExam).in("student_id", classStuds.map(s => s.id));
    const grouped: Record<string, Mark[]> = {};
    classStuds.forEach(s => { grouped[s.id] = []; });
    (data || []).forEach((m: Mark) => { if (grouped[m.student_id]) grouped[m.student_id].push(m); });
    setBulkMarks(grouped);
    setBulkLoading(false);
  }

  useEffect(() => { if (bulkExam && bulkClass) loadBulkReport(); }, [bulkExam, bulkClass]);

  const reportStudentObj = students.find(s => s.id === reportStudent);
  const reportExamObj = exams.find(e => e.id === reportExam);
  const reportTotal = reportMarks.reduce((s, m) => s + (m.marks_obtained || 0), 0);
  const reportMax = reportMarks.reduce((s, m) => s + (m.max_marks || 100), 0);
  const reportPct = reportMax > 0 ? ((reportTotal / reportMax) * 100).toFixed(1) : "0";
  const overallGrade = calcGrade(reportTotal, reportMax, false);

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading exams…</div>;

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div><h1>Exams & Marks</h1><p>Schedule exams, enter marks, generate report cards</p></div>
        {tab === "exams" && (
          <button type="button" onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> Add Exam
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 mb-6 w-fit">
        {(["exams", "marks", "reports"] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${tab === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {t === "exams" ? "Exams" : t === "marks" ? "Marks Entry" : "Report Cards"}
          </button>
        ))}
      </div>

      {tab === "exams" && (
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          <table className="w-full edu-table">
            <thead><tr><th>Exam Name</th><th>Type</th><th>Class</th><th>Dates</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {exams.length === 0 && <tr><td colSpan={6} className="text-center text-muted-foreground py-12">No exams yet. Add one to get started.</td></tr>}
              {exams.map(ex => (
                <tr key={ex.id}>
                  <td className="font-medium">{ex.name}</td>
                  <td><span className={EXAM_TYPE_COLORS[ex.exam_type] || "badge-gray"}>{ex.exam_type.replace("_", " ")}</span></td>
                  <td>{ex.class_name}</td>
                  <td className="text-sm text-muted-foreground">
                    {new Date(ex.start_date).toLocaleDateString("en-IN")}
                    {ex.end_date && ex.end_date !== ex.start_date && ` – ${new Date(ex.end_date).toLocaleDateString("en-IN")}`}
                  </td>
                  <td>
                    <button type="button" onClick={() => togglePublish(ex)} className={ex.is_published ? "badge-green cursor-pointer" : "badge-yellow cursor-pointer"}>
                      {ex.is_published ? "Published" : "Draft"}
                    </button>
                  </td>
                  <td className="flex gap-2">
                    <button type="button" onClick={() => { setSelExam(ex.id); setSelClass(ex.class_id || ""); setTab("marks"); }} className="text-xs text-primary hover:underline">Enter Marks</button>
                    <button type="button" onClick={() => deleteExam(ex.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "marks" && (
        <div>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <select title="Select exam" value={selExam} onChange={e => setSelExam(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
              <option value="">Select Exam</option>
              {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
            </select>
            <select title="Select class" value={selClass} onChange={e => setSelClass(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
              <option value="">Select Class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}
            </select>
            <div className="flex items-center gap-2">
              <input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Add subject" title="New subject name" className="border border-border rounded-lg px-3 py-2 text-sm bg-background w-40" />
              <button type="button" onClick={() => { if (newSubject.trim() && !subjects.includes(newSubject.trim())) { setSubjects(p => [...p, newSubject.trim()]); setNewSubject(""); } }} className="px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted">+ Add</button>
            </div>
            {selExam && selClass && (
              <button type="button" onClick={saveAllMarks} disabled={saving} className="ml-auto flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                <Save className="w-4 h-4" />{saving ? "Saving…" : "Save All Marks"}
              </button>
            )}
          </div>

          {(!selExam || !selClass) ? (
            <div className="bg-card rounded-xl border border-border p-12 text-center text-muted-foreground">Select an exam and class to enter marks.</div>
          ) : (
            <div className="bg-card rounded-xl border border-border overflow-x-auto shadow-sm">
              <table className="w-full edu-table text-sm">
                <thead>
                  <tr>
                    <th className="w-48">Student</th>
                    {subjects.map(sub => (
                      <th key={sub} className="min-w-[120px]">
                        <div>{sub}</div>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[10px] font-normal text-muted-foreground">Max:</span>
                          <input type="number" title={`Max marks for ${sub}`} value={maxMarks[sub] || 100} onChange={e => setMark("", sub, "max_marks", Number(e.target.value))} className="w-12 border border-border rounded px-1 py-0.5 text-xs bg-background font-normal" />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {classStudents.length === 0 && <tr><td colSpan={subjects.length + 1} className="text-center text-muted-foreground py-8">No students in this class.</td></tr>}
                  {classStudents.map(stu => (
                    <tr key={stu.id}>
                      <td>
                        <div className="font-medium">{stu.name}</div>
                        {stu.roll_number && <div className="text-xs text-muted-foreground">Roll: {stu.roll_number}</div>}
                      </td>
                      {subjects.map(sub => {
                        const key = `${stu.id}__${sub}`;
                        const m = marks[key];
                        const absent = m?.is_absent || false;
                        const val = m?.marks_obtained ?? "";
                        const grade = calcGrade(absent ? null : (val === "" ? null : Number(val)), maxMarks[sub] || 100, absent);
                        return (
                          <td key={sub}>
                            <div className="flex items-center gap-1">
                              <input
                                type="number" title={`${stu.name} - ${sub}`}
                                disabled={absent}
                                value={absent ? "" : val}
                                onChange={e => setMark(stu.id, sub, "marks_obtained", Number(e.target.value))}
                                className="w-14 border border-border rounded px-1.5 py-1 text-sm bg-background disabled:opacity-30"
                                min={0} max={maxMarks[sub] || 100}
                              />
                              <span className={`text-xs font-bold w-6 ${grade === "A+" || grade === "A" ? "text-emerald-500" : grade === "F" || grade === "AB" ? "text-red-500" : "text-amber-500"}`}>{grade}</span>
                            </div>
                            <label className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground cursor-pointer">
                              <input type="checkbox" checked={absent} onChange={e => setMark(stu.id, sub, "is_absent", e.target.checked)} />Absent
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "reports" && (
        <div>
          {/* Single / Bulk mode toggle */}
          <div className="flex gap-1 bg-muted/50 rounded-xl p-1 mb-5 w-fit">
            {(["single", "bulk"] as const).map(m => (
              <button key={m} type="button" onClick={() => setReportMode(m)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${reportMode === m ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {m === "single" ? "Single Student" : "Bulk Print (Class)"}
              </button>
            ))}
          </div>

          {/* ── Single mode ── */}
          {reportMode === "single" && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <select title="Select student" value={reportStudent} onChange={e => setReportStudent(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
                  <option value="">Select Student</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select title="Select exam" value={reportExam} onChange={e => setReportExam(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
                  <option value="">Select Exam</option>
                  {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                </select>
                {reportMarks.length > 0 && (
                  <button type="button" onClick={() => window.print()} className="ml-auto flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">
                    <Printer className="w-4 h-4" /> Print
                  </button>
                )}
              </div>
              {reportMarks.length === 0 ? (
                <div className="bg-card rounded-xl border border-border p-12 text-center text-muted-foreground">Select a student and exam to view report card.</div>
              ) : (
                <div className="bg-card rounded-xl border border-border p-8 max-w-2xl shadow-sm print-full">
                  <ReportCardView student={reportStudentObj} exam={reportExamObj} marks={reportMarks} />
                </div>
              )}
            </div>
          )}

          {/* ── Bulk mode ── */}
          {reportMode === "bulk" && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <select title="Select class" value={bulkClass} onChange={e => setBulkClass(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
                  <option value="">Select Class</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}
                </select>
                <select title="Select exam" value={bulkExam} onChange={e => setBulkExam(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
                  <option value="">Select Exam</option>
                  {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                </select>
                {bulkClass && bulkExam && Object.keys(bulkMarks).length > 0 && (
                  <button type="button" onClick={() => window.print()} className="ml-auto flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
                    <Printer className="w-4 h-4" /> Print All ({students.filter(s => s.class_id === bulkClass).length}) Report Cards
                  </button>
                )}
              </div>

              {!bulkClass || !bulkExam ? (
                <div className="bg-card rounded-xl border border-border p-12 text-center text-muted-foreground">Select a class and exam to generate bulk report cards.</div>
              ) : bulkLoading ? (
                <div className="text-center text-muted-foreground py-12">Loading marks…</div>
              ) : (
                <div className="space-y-6 print-full">
                  {students.filter(s => s.class_id === bulkClass).map((stu, idx) => {
                    const stuMarks = bulkMarks[stu.id] || [];
                    const examObj = exams.find(e => e.id === bulkExam);
                    return (
                      <div key={stu.id} className={`bg-card rounded-xl border border-border p-6 shadow-sm ${idx > 0 ? "print:break-before-page" : ""}`}>
                        <ReportCardView student={stu} exam={examObj} marks={stuMarks} />
                      </div>
                    );
                  })}
                  {students.filter(s => s.class_id === bulkClass).length === 0 && (
                    <div className="bg-card rounded-xl border border-border p-12 text-center text-muted-foreground">No students in this class.</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Add Exam</h2>
              <button type="button" title="Close" onClick={() => setShowAdd(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={saveExam} className="space-y-3">
              <input required value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))} placeholder="Exam Name (e.g. Mid-Term 2024)" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
              <div className="grid grid-cols-2 gap-3">
                <select title="Exam type" value={addForm.exam_type} onChange={e => setAddForm(p => ({ ...p, exam_type: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                  <option value="unit_test">Unit Test</option>
                  <option value="midterm">Midterm</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="half_yearly">Half Yearly</option>
                  <option value="final">Final</option>
                  <option value="annual">Annual</option>
                </select>
                <select title="Class" value={addForm.class_id} onChange={e => setAddForm(p => ({ ...p, class_id: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                  <option value="">All Classes</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Start Date</label><input required type="date" title="Start date" value={addForm.start_date} onChange={e => setAddForm(p => ({ ...p, start_date: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">End Date</label><input required type="date" title="End date" value={addForm.end_date} onChange={e => setAddForm(p => ({ ...p, end_date: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              </div>
              <button type="submit" disabled={saving} className="w-full py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-50">{saving ? "Saving…" : "Create Exam"}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared Report Card View ───────────────────────────────────────────────────
function ReportCardView({ student, exam, marks }: { student: Student | undefined; exam: Exam | undefined; marks: Mark[] }) {
  const total = marks.reduce((s, m) => s + (m.is_absent ? 0 : (m.marks_obtained || 0)), 0);
  const max = marks.reduce((s, m) => s + (m.max_marks || 100), 0);
  const pct = max > 0 ? ((total / max) * 100).toFixed(1) : "0";
  const grade = calcGrade(total, max, false);
  const gradeColor = grade === "A+" || grade === "A" ? "text-emerald-600" : grade === "F" ? "text-red-600" : "text-amber-600";

  return (
    <div>
      <div className="text-center mb-5 border-b border-border pb-4">
        <h2 className="text-xl font-black">Report Card</h2>
        <p className="text-muted-foreground mt-1 text-sm">{exam?.name || "—"}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-5 text-sm bg-muted/30 rounded-xl p-4">
        <div><span className="text-muted-foreground">Student Name:</span> <span className="font-semibold ml-1">{student?.name || "—"}</span></div>
        <div><span className="text-muted-foreground">Roll No:</span> <span className="font-semibold ml-1">{student?.roll_number || "—"}</span></div>
        <div><span className="text-muted-foreground">Exam Type:</span> <span className="font-semibold ml-1 capitalize">{exam?.exam_type?.replace("_", " ") || "—"}</span></div>
        <div><span className="text-muted-foreground">Date:</span> <span className="font-semibold ml-1">{exam?.start_date ? new Date(exam.start_date).toLocaleDateString("en-IN") : "—"}</span></div>
      </div>
      {marks.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No marks entered for this student.</p>
      ) : (
        <>
          <table className="w-full edu-table mb-5">
            <thead><tr><th>Subject</th><th>Max</th><th>Obtained</th><th>%</th><th>Grade</th></tr></thead>
            <tbody>
              {marks.map(m => {
                const mpct = m.is_absent ? "AB" : m.marks_obtained !== null ? ((Number(m.marks_obtained) / m.max_marks) * 100).toFixed(1) + "%" : "—";
                const mg = calcGrade(m.is_absent ? null : m.marks_obtained, m.max_marks, m.is_absent);
                return (
                  <tr key={m.subject}>
                    <td className="font-medium">{m.subject}</td>
                    <td>{m.max_marks}</td>
                    <td>{m.is_absent ? "Absent" : (m.marks_obtained ?? "—")}</td>
                    <td>{mpct}</td>
                    <td><span className={`font-bold text-sm ${mg === "A+" || mg === "A" ? "text-emerald-600" : mg === "F" || mg === "AB" ? "text-red-600" : "text-amber-600"}`}>{mg}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="bg-muted/50 rounded-xl p-4 flex items-center justify-between">
            <div><p className="text-xs text-muted-foreground">Total Marks</p><p className="text-lg font-bold">{total} / {max}</p></div>
            <div><p className="text-xs text-muted-foreground">Percentage</p><p className="text-lg font-bold">{pct}%</p></div>
            <div><p className="text-xs text-muted-foreground">Overall Grade</p><p className={`text-3xl font-black ${gradeColor}`}>{grade}</p></div>
          </div>
        </>
      )}
    </div>
  );
}
