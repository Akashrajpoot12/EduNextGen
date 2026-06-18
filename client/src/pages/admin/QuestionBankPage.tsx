import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Plus, X, Printer, BookOpen, FileText, Trash2 } from "lucide-react";

type Paper = {
  id: string; title: string; subject: string; class_name: string; exam_type: string;
  total_marks: number; duration_min: number; instructions: string; academic_year: string;
};
type Question = {
  id: string; paper_id: string; section_name: string; q_type: string; q_number: number;
  question: string; options: string[] | null; correct_answer: string; marks: number;
};

const EMPTY_PAPER = { title: "", subject: "", class_name: "", exam_type: "Unit Test", total_marks: 100, duration_min: 180, instructions: "All questions are compulsory. Write answers in neat handwriting.", academic_year: "2025-26" };
const EMPTY_Q = { section_name: "Section A", q_type: "mcq", q_number: 1, question: "", options: ["", "", "", ""], correct_answer: "", marks: 1 };
const Q_TYPES = [{ v: "mcq", l: "MCQ" }, { v: "short", l: "Short Answer" }, { v: "long", l: "Long Answer" }, { v: "fill", l: "Fill in the Blank" }, { v: "true_false", l: "True / False" }];

export function QuestionBankPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [papers, setPapers] = useState<Paper[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [showPaperForm, setShowPaperForm] = useState(false);
  const [showQForm, setShowQForm] = useState(false);
  const [paperForm, setPaperForm] = useState({ ...EMPTY_PAPER });
  const [qForm, setQForm] = useState({ ...EMPTY_Q, options: ["", "", "", ""] as string[] });
  const [savingPaper, setSavingPaper] = useState(false);
  const [savingQ, setSavingQ] = useState(false);
  const [printMode, setPrintMode] = useState(false);

  async function fetchPapers() {
    const { data } = await supabase.from("question_papers").select("*").eq("school_id", schoolId).order("created_at", { ascending: false });
    setPapers(data as Paper[] || []);
  }

  async function fetchQuestions(paperId: string) {
    const { data } = await supabase.from("questions").select("*").eq("school_id", schoolId).eq("paper_id", paperId).order("section_name").order("q_number");
    setQuestions(data as Question[] || []);
  }

  useEffect(() => { if (schoolId) fetchPapers(); }, [schoolId]);
  useEffect(() => { if (selectedPaper) fetchQuestions(selectedPaper.id); }, [selectedPaper]);

  async function savePaper() {
    if (!paperForm.title || !paperForm.subject) return;
    setSavingPaper(true);
    await supabase.from("question_papers").insert({ ...paperForm, school_id: schoolId });
    setSavingPaper(false);
    setShowPaperForm(false);
    setPaperForm({ ...EMPTY_PAPER });
    fetchPapers();
  }

  async function deletePaper(id: string) {
    if (!confirm("Delete this question paper and all its questions?")) return;
    await supabase.from("questions").delete().eq("paper_id", id);
    await supabase.from("question_papers").delete().eq("id", id);
    if (selectedPaper?.id === id) { setSelectedPaper(null); setQuestions([]); }
    fetchPapers();
  }

  async function saveQuestion() {
    if (!selectedPaper || !qForm.question.trim()) return;
    setSavingQ(true);
    const payload: Record<string, unknown> = {
      school_id: schoolId, paper_id: selectedPaper.id,
      section_name: qForm.section_name, q_type: qForm.q_type,
      q_number: qForm.q_number, question: qForm.question,
      marks: qForm.marks, correct_answer: qForm.correct_answer,
    };
    if (qForm.q_type === "mcq") payload.options = qForm.options.filter(o => o.trim());
    await supabase.from("questions").insert(payload);
    setSavingQ(false);
    setShowQForm(false);
    setQForm({ ...EMPTY_Q, options: ["", "", "", ""], q_number: qForm.q_number + 1 });
    fetchQuestions(selectedPaper.id);
  }

  async function deleteQuestion(id: string) {
    await supabase.from("questions").delete().eq("id", id);
    if (selectedPaper) fetchQuestions(selectedPaper.id);
  }

  // Group questions by section for display and print
  const sections = [...new Set(questions.map(q => q.section_name))];
  const bySection = (sec: string) => questions.filter(q => q.section_name === sec);
  const totalMarks = questions.reduce((s, q) => s + (q.marks || 0), 0);

  const pf = (k: keyof typeof paperForm, v: string | number) => setPaperForm(p => ({ ...p, [k]: v }));
  const qf = (k: string, v: string | number) => setQForm(p => ({ ...p, [k]: v }));

  return (
    <div>
      {/* Screen view */}
      <div className="no-print">
        <div className="page-header flex items-center justify-between">
          <div>
            <h1>Question Bank</h1>
            <p>Create question papers, add questions by section, print formatted paper</p>
          </div>
          <button type="button" onClick={() => { setPaperForm({ ...EMPTY_PAPER }); setShowPaperForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> New Paper
          </button>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Papers list */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase px-1">Question Papers ({papers.length})</h3>
            {papers.length === 0 && (
              <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground text-sm">
                No papers yet. Create your first question paper.
              </div>
            )}
            {papers.map(p => (
              <button key={p.id} type="button" onClick={() => setSelectedPaper(p)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all ${selectedPaper?.id === p.id ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border bg-card hover:bg-muted/30"}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{p.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.subject} · {p.class_name}</p>
                    <div className="flex gap-2 mt-1.5">
                      <span className="badge-blue text-xs">{p.exam_type}</span>
                      <span className="text-xs text-muted-foreground">{p.total_marks}M · {p.duration_min}min</span>
                    </div>
                  </div>
                  <button type="button" onClick={e => { e.stopPropagation(); deletePaper(p.id); }} className="text-muted-foreground hover:text-red-500 ml-2 mt-0.5">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </button>
            ))}
          </div>

          {/* Questions panel */}
          <div className="col-span-2">
            {!selectedPaper ? (
              <div className="bg-card rounded-xl border border-border p-16 text-center text-muted-foreground">
                <BookOpen className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="font-semibold">Select a question paper</p>
                <p className="text-sm mt-1">Choose a paper from the left to view and add questions</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-bold text-base">{selectedPaper.title}</h2>
                    <p className="text-sm text-muted-foreground">{selectedPaper.subject} · {selectedPaper.class_name} · {questions.length} questions · {totalMarks}/{selectedPaper.total_marks} marks assigned</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setPrintMode(true)}
                      className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted">
                      <Printer className="w-4 h-4" /> Print Paper
                    </button>
                    <button type="button" onClick={() => { setQForm({ ...EMPTY_Q, options: ["", "", "", ""], q_number: questions.length + 1 }); setShowQForm(true); }}
                      className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90">
                      <Plus className="w-4 h-4" /> Add Question
                    </button>
                  </div>
                </div>

                {questions.length === 0 ? (
                  <div className="bg-card rounded-xl border border-border p-12 text-center text-muted-foreground">
                    <FileText className="w-8 h-8 mx-auto mb-3" />
                    <p>No questions yet. Add your first question.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sections.map(sec => (
                      <div key={sec} className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                        <div className="bg-muted/50 px-4 py-2.5 border-b border-border flex items-center justify-between">
                          <span className="font-semibold text-sm">{sec}</span>
                          <span className="text-xs text-muted-foreground">{bySection(sec).length} questions · {bySection(sec).reduce((s, q) => s + q.marks, 0)} marks</span>
                        </div>
                        <div className="divide-y divide-border">
                          {bySection(sec).map((q, i) => (
                            <div key={q.id} className="px-4 py-3 flex gap-3">
                              <span className="text-sm font-semibold text-muted-foreground w-6 flex-shrink-0">{q.q_number}.</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm">{q.question}</p>
                                {q.options && q.options.length > 0 && (
                                  <div className="grid grid-cols-2 gap-1 mt-1.5">
                                    {q.options.map((opt, oi) => (
                                      <span key={oi} className={`text-xs px-2 py-1 rounded ${opt === q.correct_answer ? "bg-green-50 text-green-700 border border-green-200" : "bg-muted text-muted-foreground"}`}>
                                        ({String.fromCharCode(65 + oi)}) {opt}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <div className="flex gap-3 mt-1.5">
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${q.q_type === "mcq" ? "bg-blue-100 text-blue-700" : q.q_type === "long" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>
                                    {Q_TYPES.find(t => t.v === q.q_type)?.l || q.q_type}
                                  </span>
                                  <span className="text-xs text-muted-foreground">{q.marks} mark{q.marks !== 1 ? "s" : ""}</span>
                                </div>
                              </div>
                              <button type="button" onClick={() => deleteQuestion(q.id)} className="text-muted-foreground hover:text-red-500 flex-shrink-0 mt-0.5">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PRINT VIEW */}
      {printMode && selectedPaper && (
        <div className="hidden print:block print-full">
          <div style={{ fontFamily: "Arial, sans-serif", maxWidth: "700px", margin: "0 auto", fontSize: "12px" }}>
            {/* Header */}
            <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: "10px", marginBottom: "12px" }}>
              <p style={{ fontSize: "16px", fontWeight: "bold", textTransform: "uppercase" }}>{selectedPaper.title}</p>
              <p style={{ fontSize: "13px", marginTop: "4px" }}>Subject: {selectedPaper.subject} &nbsp;|&nbsp; Class: {selectedPaper.class_name} &nbsp;|&nbsp; {selectedPaper.exam_type}</p>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontSize: "11px" }}>
                <span>Max. Marks: {selectedPaper.total_marks}</span>
                <span>Time: {selectedPaper.duration_min} minutes</span>
                <span>Academic Year: {selectedPaper.academic_year}</span>
              </div>
            </div>
            {/* Student info */}
            <div style={{ display: "flex", gap: "20px", marginBottom: "8px", fontSize: "11px" }}>
              <span>Name: _______________________________</span>
              <span>Roll No: __________</span>
              <span>Date: __________</span>
            </div>
            {/* Instructions */}
            {selectedPaper.instructions && (
              <div style={{ border: "1px solid #ccc", padding: "6px 10px", marginBottom: "12px", fontSize: "11px", background: "#f9f9f9" }}>
                <strong>Instructions:</strong> {selectedPaper.instructions}
              </div>
            )}
            {/* Questions by section */}
            {sections.map(sec => (
              <div key={sec} style={{ marginBottom: "16px" }}>
                <p style={{ fontWeight: "bold", fontSize: "13px", borderBottom: "1px solid #000", paddingBottom: "3px", marginBottom: "8px" }}>
                  {sec} &nbsp;[{bySection(sec).reduce((s, q) => s + q.marks, 0)} Marks]
                </p>
                {bySection(sec).map(q => (
                  <div key={q.id} style={{ marginBottom: "10px" }}>
                    <p style={{ fontWeight: "500" }}>
                      Q{q.q_number}. {q.question}
                      <span style={{ fontStyle: "italic", color: "#555", marginLeft: "6px" }}>[{q.marks} M]</span>
                    </p>
                    {q.options && q.options.length > 0 && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px", marginTop: "4px", marginLeft: "20px" }}>
                        {q.options.map((opt, oi) => (
                          <span key={oi}>({String.fromCharCode(65 + oi)}) {opt}</span>
                        ))}
                      </div>
                    )}
                    {(q.q_type === "short" || q.q_type === "fill") && (
                      <div style={{ borderBottom: "1px dashed #ccc", marginTop: "16px", marginLeft: "20px" }} />
                    )}
                    {q.q_type === "long" && (
                      <div style={{ marginTop: "4px", marginLeft: "20px" }}>
                        {[1, 2, 3, 4].map(l => <div key={l} style={{ borderBottom: "1px dashed #ccc", height: "22px" }} />)}
                      </div>
                    )}
                    {q.q_type === "true_false" && (
                      <p style={{ marginLeft: "20px", marginTop: "4px" }}>True &nbsp;&nbsp;&nbsp; / &nbsp;&nbsp;&nbsp; False</p>
                    )}
                  </div>
                ))}
              </div>
            ))}
            <div style={{ textAlign: "center", borderTop: "1px solid #ccc", paddingTop: "8px", marginTop: "16px", fontSize: "11px", color: "#555" }}>
              — End of Question Paper —
            </div>
          </div>
        </div>
      )}

      {/* Print trigger button */}
      {printMode && (
        <div className="fixed bottom-6 right-6 z-50 no-print flex gap-3">
          <button type="button" onClick={() => setPrintMode(false)} className="px-4 py-2 border border-border bg-card rounded-lg text-sm hover:bg-muted shadow-lg">Cancel</button>
          <button type="button" onClick={() => window.print()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 shadow-lg flex items-center gap-2">
            <Printer className="w-4 h-4" /> Print Now
          </button>
        </div>
      )}

      {/* New Paper Modal */}
      {showPaperForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 no-print">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">Create Question Paper</h2>
              <button type="button" title="Close" onClick={() => setShowPaperForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div><label className="text-xs text-muted-foreground block mb-1">Paper Title *</label>
                <input value={paperForm.title} onChange={e => pf("title", e.target.value)} placeholder="e.g. Science Mid-Term 2025"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Subject *</label>
                  <input value={paperForm.subject} onChange={e => pf("subject", e.target.value)} placeholder="Science"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Class</label>
                  <input value={paperForm.class_name} onChange={e => pf("class_name", e.target.value)} placeholder="Class 9"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Exam Type</label>
                  <select title="Exam type" value={paperForm.exam_type} onChange={e => pf("exam_type", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                    {["Unit Test", "Mid-Term", "Final", "Practice", "Board Mock"].map(t => <option key={t}>{t}</option>)}
                  </select></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Max Marks</label>
                  <input type="number" value={paperForm.total_marks} onChange={e => pf("total_marks", Number(e.target.value))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Duration (min)</label>
                  <input type="number" value={paperForm.duration_min} onChange={e => pf("duration_min", Number(e.target.value))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              </div>
              <div><label className="text-xs text-muted-foreground block mb-1">Academic Year</label>
                <input value={paperForm.academic_year} onChange={e => pf("academic_year", e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              <div><label className="text-xs text-muted-foreground block mb-1">Instructions</label>
                <textarea value={paperForm.instructions} onChange={e => pf("instructions", e.target.value)} rows={2}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none" /></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => setShowPaperForm(false)} className="flex-1 py-2.5 border border-border rounded-lg text-sm">Cancel</button>
              <button type="button" onClick={savePaper} disabled={savingPaper || !paperForm.title || !paperForm.subject}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {savingPaper ? "Creating…" : "Create Paper"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Question Modal */}
      {showQForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 no-print">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">Add Question</h2>
              <button type="button" title="Close" onClick={() => setShowQForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Section</label>
                  <input value={qForm.section_name} onChange={e => qf("section_name", e.target.value)} placeholder="Section A"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Q. Number</label>
                  <input type="number" value={qForm.q_number} onChange={e => qf("q_number", Number(e.target.value))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Type</label>
                  <select title="Question type" value={qForm.q_type} onChange={e => qf("q_type", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                    {Q_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                  </select></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Marks</label>
                  <input type="number" value={qForm.marks} onChange={e => qf("marks", Number(e.target.value))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              </div>
              <div><label className="text-xs text-muted-foreground block mb-1">Question *</label>
                <textarea value={qForm.question} onChange={e => qf("question", e.target.value)} rows={3} placeholder="Write your question here…"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none" /></div>
              {qForm.q_type === "mcq" && (
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Options (A, B, C, D)</label>
                  <div className="space-y-2">
                    {qForm.options.map((opt, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <span className="text-xs font-semibold w-5 text-center">({String.fromCharCode(65 + i)})</span>
                        <input value={opt} onChange={e => { const opts = [...qForm.options]; opts[i] = e.target.value; setQForm(p => ({ ...p, options: opts })); }}
                          placeholder={`Option ${String.fromCharCode(65 + i)}`}
                          className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm bg-background" />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2"><label className="text-xs text-muted-foreground block mb-1">Correct Answer</label>
                    <input value={qForm.correct_answer} onChange={e => qf("correct_answer", e.target.value)} placeholder="e.g. option text or A/B/C/D"
                      className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-background" /></div>
                </div>
              )}
              {qForm.q_type === "true_false" && (
                <div><label className="text-xs text-muted-foreground block mb-1">Correct Answer</label>
                  <select title="Correct answer" value={qForm.correct_answer} onChange={e => qf("correct_answer", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                    <option value="">Select…</option>
                    <option value="True">True</option>
                    <option value="False">False</option>
                  </select></div>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => setShowQForm(false)} className="flex-1 py-2.5 border border-border rounded-lg text-sm">Cancel</button>
              <button type="button" onClick={saveQuestion} disabled={savingQ || !qForm.question.trim()}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {savingQ ? "Saving…" : "Add Question"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
