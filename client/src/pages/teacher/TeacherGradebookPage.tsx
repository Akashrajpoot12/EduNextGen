import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Save, BookOpen, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type Exam = { id: string; name: string; subject?: string; total_marks?: number };
type Student = { id: string; name: string; roll_number?: string };
type Class = { id: string; name: string };
type MarkEntry = { marks: string; remarks: string; error?: string };

export function TeacherGradebookPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [classes, setClasses]         = useState<Class[]>([]);
  const [exams, setExams]             = useState<Exam[]>([]);
  const [students, setStudents]       = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedExam, setSelectedExam]   = useState("");
  const [marks, setMarks]             = useState<Record<string, MarkEntry>>({});
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [currentExam, setCurrentExam] = useState<Exam | null>(null);
  const [teacherId, setTeacherId]     = useState("");

  useEffect(() => {
    if (!schoolId) return;
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setTeacherId(user.id);
      const [{ data: cls }, { data: ex }] = await Promise.all([
        supabase.from("classes").select("id, name").eq("school_id", schoolId).order("name"),
        supabase.from("exams").select("id, name, subject, total_marks").eq("school_id", schoolId).order("created_at", { ascending: false }),
      ]);
      setClasses(cls || []);
      setExams(ex || []);
    };
    init();
  }, [schoolId]);

  useEffect(() => {
    if (!selectedClass || !selectedExam || !schoolId) return;
    const load = async () => {
      const [{ data: stuData }, { data: existingMarks }] = await Promise.all([
        supabase.from("students").select("id, name, roll_number").eq("school_id", schoolId).eq("class_id", selectedClass).order("roll_number"),
        supabase.from("exam_marks").select("student_id, marks_obtained, remarks").eq("exam_id", selectedExam).eq("school_id", schoolId),
      ]);
      setStudents(stuData || []);
      const ex = exams.find(e => e.id === selectedExam) || null;
      setCurrentExam(ex);
      const m: Record<string, MarkEntry> = {};
      (stuData || []).forEach(s => {
        const existing = (existingMarks || []).find(em => em.student_id === s.id);
        m[s.id] = { marks: existing ? String(existing.marks_obtained) : "", remarks: existing?.remarks || "" };
      });
      setMarks(m);
    };
    load();
  }, [selectedClass, selectedExam]);

  const totalMarks = currentExam?.total_marks || 100;

  function updateMark(studentId: string, value: string) {
    const num = value === "" ? null : Number(value);
    let error: string | undefined;
    if (num !== null && num < 0) error = "Cannot be negative";
    else if (num !== null && num > totalMarks) error = `Max: ${totalMarks}`;
    setMarks(prev => ({ ...prev, [studentId]: { ...prev[studentId], marks: value, error } }));
  }

  const hasErrors = Object.values(marks).some(m => !!m.error);

  async function handleSave() {
    if (!selectedExam || !teacherId || hasErrors) return;
    setSaving(true);
    const rows = students.map(s => ({
      school_id: schoolId,
      exam_id: selectedExam,
      student_id: s.id,
      class_id: selectedClass,
      teacher_id: teacherId,
      marks_obtained: marks[s.id]?.marks ? Number(marks[s.id].marks) : null,
      remarks: marks[s.id]?.remarks || null,
    })).filter(r => r.marks_obtained !== null);

    await supabase.from("exam_marks").upsert(rows, { onConflict: "exam_id,student_id" });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    toast.success("Marks saved!");

    // Trigger WhatsApp to parents for exam results
    try {
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
            type: "exam_result",
            schoolId,
            data: { examId: selectedExam },
          }),
        }
      ).then(() => toast.info("Result WhatsApp sent to parents"))
       .catch(() => {});
    } catch {}
  }

  const entered = Object.values(marks).filter(m => m.marks !== "").length;

  return (
    <div>
      <div className="page-header">
        <h1>Gradebook — Marks Entry</h1>
        <p>Select exam and class, enter marks for each student</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Select Exam</label>
          <select title="Exam" value={selectedExam} onChange={e => setSelectedExam(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
            <option value="">— Choose Exam —</option>
            {exams.map(e => <option key={e.id} value={e.id}>{e.name}{e.subject ? ` — ${e.subject}` : ""} {e.total_marks ? `(/${e.total_marks})` : ""}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Select Class</label>
          <select title="Class" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
            <option value="">— Choose Class —</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {selectedExam && selectedClass ? (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">{entered}/{students.length} students marked · Max marks: {totalMarks}</p>
              {hasErrors && (
                <span className="flex items-center gap-1 text-xs text-red-500">
                  <AlertCircle className="w-3.5 h-3.5" /> Fix errors before saving
                </span>
              )}
            </div>
            <button type="button" onClick={handleSave} disabled={saving || entered === 0 || hasErrors}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {saved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : saving ? "Saving…" : <><Save className="w-4 h-4" /> Save Marks</>}
            </button>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full edu-table">
              <thead><tr><th>Roll No.</th><th>Student Name</th><th>Marks (/{totalMarks})</th><th>Percentage</th><th>Remarks</th></tr></thead>
              <tbody>
                {students.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">No students in this class.</td></tr>}
                {students.map((s, i) => {
                  const m = marks[s.id] || { marks: "", remarks: "" };
                  const numVal = m.marks !== "" ? Number(m.marks) : null;
                  const pct = numVal !== null ? Math.round((numVal / totalMarks) * 100) : null;
                  const isInvalid = !!m.error;
                  return (
                    <tr key={s.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                      <td className="font-mono text-sm">{s.roll_number || String(i + 1).padStart(2, "0")}</td>
                      <td className="font-medium">{s.name}</td>
                      <td>
                        <div className="flex flex-col gap-0.5">
                          <input type="number" min={0} max={totalMarks} step="any" title="Marks"
                            value={m.marks} onChange={e => updateMark(s.id, e.target.value)}
                            placeholder="—"
                            className={`w-20 border rounded px-2 py-1 text-sm text-center bg-background focus:ring-2 focus:ring-primary ${isInvalid ? "border-red-500 focus:ring-red-500" : "border-border"}`} />
                          {isInvalid && <span className="text-[10px] text-red-500">{m.error}</span>}
                        </div>
                      </td>
                      <td>
                        {pct !== null && !isInvalid ? (
                          <span className={`text-sm font-semibold ${pct >= 75 ? "text-green-600" : pct >= 50 ? "text-amber-600" : "text-red-500"}`}>
                            {pct}%
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td>
                        <input type="text" title="Remarks"
                          value={m.remarks} onChange={e => setMarks(p => ({ ...p, [s.id]: { ...p[s.id], remarks: e.target.value } }))}
                          placeholder="Optional remarks"
                          className="w-40 border border-border rounded px-2 py-1 text-sm bg-background" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="bg-card border border-border rounded-xl p-16 text-center text-muted-foreground">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Select an exam and class to start entering marks</p>
        </div>
      )}
    </div>
  );
}
