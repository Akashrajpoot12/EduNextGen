import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Printer } from "lucide-react";

type Exam = { id: string; name: string; start_date: string; end_date: string };
type Student = { id: string; name: string; roll_number: string; admission_number: string; father_name: string; date_of_birth: string; blood_group: string; classes?: { name: string } | null };
type ExamMark = { subject: string; max_marks: number };
type School = { name: string; address?: string; phone?: string };

export function HallTicketPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<ExamMark[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [selectedExam, setSelectedExam] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [instructions, setInstructions] = useState("1. Candidates must bring this Hall Ticket to the examination hall.\n2. Mobile phones are strictly prohibited.\n3. Report 15 minutes before the exam.\n4. Write your Roll Number clearly on the answer sheet.");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    Promise.all([
      supabase.from("exams").select("id, name, start_date, end_date").eq("school_id", schoolId).order("start_date", { ascending: false }),
      supabase.from("classes").select("id, name").eq("school_id", schoolId).order("name"),
      supabase.from("schools").select("name, address, phone").eq("id", schoolId).single(),
    ]).then(([eRes, cRes, scRes]) => {
      setExams(eRes.data || []);
      setClasses(cRes.data || []);
      if (scRes.data) setSchool(scRes.data as School);
    });
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId || !selectedClass) { setStudents([]); return; }
    setLoading(true);
    supabase.from("students")
      .select("id, name, roll_number, admission_number, father_name, date_of_birth, blood_group, classes(name)")
      .eq("school_id", schoolId).eq("class_id", selectedClass).order("roll_number")
      .then(({ data }) => { setStudents(data || []); setSelectedIds(new Set((data || []).map((s: Student) => s.id))); setLoading(false); });
  }, [schoolId, selectedClass]);

  useEffect(() => {
    if (!schoolId || !selectedExam || !selectedClass) { setSubjects([]); return; }
    supabase.from("exam_marks").select("subject, max_marks")
      .eq("school_id", schoolId).eq("exam_id", selectedExam)
      .then(({ data }) => {
        if (!data) return;
        const seen = new Set<string>();
        const unique = data.filter((m: ExamMark) => { if (seen.has(m.subject)) return false; seen.add(m.subject); return true; });
        setSubjects(unique);
      });
  }, [schoolId, selectedExam, selectedClass]);

  const exam = exams.find(e => e.id === selectedExam);
  const printStudents = students.filter(s => selectedIds.has(s.id));
  const canPrint = selectedExam && selectedClass && printStudents.length > 0;

  function toggle(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Exam Hall Tickets</h1>
          <p>Generate and print admit cards for students before examinations</p>
        </div>
        <button type="button" onClick={() => window.print()} disabled={!canPrint}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
          <Printer className="w-4 h-4" /> Print {printStudents.length > 0 ? `${printStudents.length} Hall Tickets` : "Hall Tickets"}
        </button>
      </div>

      {/* Controls */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm mb-6 no-print">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Exam *</label>
            <select title="Select exam" value={selectedExam} onChange={e => setSelectedExam(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
              <option value="">Select exam…</option>
              {exams.map(e => <option key={e.id} value={e.id}>{e.name} ({fmtDate(e.start_date)})</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Class *</label>
            <select title="Select class" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
              <option value="">Select class…</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Selected</label>
            <div className="border border-border rounded-lg px-3 py-2 text-sm bg-muted/30">
              {selectedIds.size} of {students.length} students
            </div>
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Instructions (printed on ticket)</label>
          <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={3}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none" />
        </div>
      </div>

      {/* Student list */}
      {selectedClass && (
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm no-print">
          <div className="flex items-center justify-between p-3 border-b border-border">
            <p className="text-sm font-medium">{loading ? "Loading…" : `${students.length} students`}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setSelectedIds(new Set(students.map(s => s.id)))} className="text-xs border border-border px-2 py-1 rounded hover:bg-muted">All</button>
              <button type="button" onClick={() => setSelectedIds(new Set())} className="text-xs border border-border px-2 py-1 rounded hover:bg-muted">None</button>
            </div>
          </div>
          <table className="w-full edu-table">
            <thead><tr><th className="w-8"></th><th>Name</th><th>Roll No</th><th>Adm No</th></tr></thead>
            <tbody>
              {students.map(s => (
                <tr key={s.id} className={selectedIds.has(s.id) ? "bg-primary/5" : ""}>
                  <td><input type="checkbox" title="Select" checked={selectedIds.has(s.id)} onChange={() => toggle(s.id)} /></td>
                  <td className="font-medium">{s.name}</td>
                  <td>{s.roll_number || "—"}</td>
                  <td className="font-mono text-sm">{s.admission_number || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── PRINT LAYOUT ─── */}
      {canPrint && (
        <div className="hidden print:block print-full">
          {printStudents.map((s, idx) => {
            const cls = (s.classes as { name: string } | null)?.name || "";
            return (
              <div key={s.id} className={`${idx > 0 ? "print:break-before-page" : ""}`}>
                {/* Two tickets per page — repeat same student for 2-up layout */}
                {[0, 1].map(copy => (
                  <div key={copy} className={`border-2 border-gray-800 rounded-lg mx-8 p-5 ${copy === 0 ? "mt-6 mb-3" : "mt-3 mb-6 border-t-2 border-dashed border-gray-400"}`}>
                    {copy === 1 && <p className="text-[9px] text-gray-400 text-center -mt-1 mb-2">— Office Copy —</p>}
                    {/* Header */}
                    <div className="flex items-start justify-between border-b-2 border-gray-700 pb-3 mb-3">
                      <div>
                        <h1 className="text-base font-bold uppercase tracking-wide">{school?.name || "School"}</h1>
                        {school?.address && <p className="text-[10px] text-gray-600">{school.address}</p>}
                        <p className="text-xs font-bold mt-1 uppercase text-blue-700">Examination Hall Ticket / Admit Card</p>
                      </div>
                      <div className="border-2 border-gray-400 w-16 h-20 flex items-center justify-center text-[9px] text-gray-400 text-center rounded">
                        Photo<br />Here
                      </div>
                    </div>
                    {/* Student details */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs mb-3">
                      <div><span className="text-gray-500">Name:</span> <strong>{s.name}</strong></div>
                      <div><span className="text-gray-500">Roll No:</span> <strong>{s.roll_number || "—"}</strong></div>
                      <div><span className="text-gray-500">Class:</span> <strong>{cls}</strong></div>
                      <div><span className="text-gray-500">Adm No:</span> <strong>{s.admission_number || "—"}</strong></div>
                      {s.father_name && <div><span className="text-gray-500">Father:</span> <strong>{s.father_name}</strong></div>}
                      {s.date_of_birth && <div><span className="text-gray-500">DOB:</span> <strong>{fmtDate(s.date_of_birth)}</strong></div>}
                    </div>
                    {/* Exam details */}
                    <div className="bg-blue-50 border border-blue-200 rounded px-3 py-1.5 text-xs mb-3">
                      <span className="font-bold text-blue-700">{exam?.name}</span>
                      <span className="text-gray-500 ml-3">From:</span> <strong>{exam ? fmtDate(exam.start_date) : ""}</strong>
                      <span className="text-gray-500 ml-3">To:</span> <strong>{exam ? fmtDate(exam.end_date) : ""}</strong>
                    </div>
                    {/* Subjects */}
                    {subjects.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] font-bold text-gray-600 uppercase mb-1">Subjects / Papers:</p>
                        <div className="grid grid-cols-3 gap-1">
                          {subjects.map((sub, i) => (
                            <div key={i} className="border border-gray-200 rounded px-2 py-1 text-[10px]">
                              <span className="font-medium">{sub.subject}</span>
                              <span className="text-gray-500 ml-1">(MM: {sub.max_marks})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Instructions */}
                    <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[9px] text-gray-600 mb-3">
                      <p className="font-bold text-gray-700 mb-1">Instructions:</p>
                      {instructions.split("\n").filter(Boolean).map((line, i) => <p key={i}>{line}</p>)}
                    </div>
                    {/* Signatures */}
                    <div className="flex justify-between text-[10px] mt-1">
                      <div className="text-center"><div className="border-t border-gray-600 pt-1 w-32"><p className="font-semibold">Student Signature</p></div></div>
                      <div className="text-center"><div className="border-t border-gray-600 pt-1 w-36"><p className="font-semibold">Principal / Controller of Exams</p><p className="text-gray-500">{school?.name}</p></div></div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
