import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { useSearchParams } from "react-router-dom";
import { BookOpen, CheckCircle, ChevronDown, ChevronUp, Star, Clock, ExternalLink } from "lucide-react";

type HW = { id: string; title: string; subject: string; due_date: string; class_name: string; total: number; submitted: number };
type Submission = { id: string; submitted_at: string; notes?: string; student_name: string; grade?: number; feedback?: string; attachment_url?: string };
type GradeState = { marks: string; feedback: string; saving: boolean; saved: boolean };

export function TeacherSubmissionsPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();
  const [searchParams] = useSearchParams();
  const focusHwId = searchParams.get("homeworkId");

  const [homeworks, setHomeworks] = useState<HW[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState<string | null>(focusHwId);
  const [submissions, setSubmissions] = useState<Record<string, Submission[]>>({});
  const [grading, setGrading]     = useState<Record<string, GradeState>>({});

  useEffect(() => {
    if (!schoolId) return;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: hws } = await supabase
        .from("homework")
        .select("id, title, subject, due_date, classes:class_id(name, id)")
        .eq("school_id", schoolId)
        .eq("created_by", user?.id)
        .order("created_at", { ascending: false });

      if (!hws) { setLoading(false); return; }

      const hwWithCounts = await Promise.all(hws.map(async (hw: any) => {
        const { count: total } = await supabase.from("students")
          .select("*", { count: "exact", head: true }).eq("class_id", hw.classes?.id);
        const { count: submitted } = await supabase.from("homework_submissions")
          .select("*", { count: "exact", head: true }).eq("homework_id", hw.id);
        return {
          id: hw.id, title: hw.title, subject: hw.subject,
          due_date: hw.due_date, class_name: hw.classes?.name || "—",
          total: total || 0, submitted: submitted || 0,
        };
      }));
      setHomeworks(hwWithCounts);
      setLoading(false);

      // Auto-load submissions if focusHwId is set
      if (focusHwId) loadSubmissions(focusHwId);
    }
    load();
  }, [schoolId]);

  async function loadSubmissions(hwId: string) {
    if (submissions[hwId]) return;
    const { data } = await supabase
      .from("homework_submissions")
      .select("id, submitted_at, submission_text, grade, teacher_remarks, attachment_url, students:student_id(name)")
      .eq("homework_id", hwId)
      .order("submitted_at", { ascending: false });

    const mapped: Submission[] = (data || []).map((s: any) => ({
      id: s.id,
      submitted_at: s.submitted_at,
      notes: s.submission_text,
      grade: s.grade,
      feedback: s.teacher_remarks,
      attachment_url: s.attachment_url,
      student_name: s.students?.name || "Unknown",
    }));
    setSubmissions(prev => ({ ...prev, [hwId]: mapped }));
  }

  // Homework bucket is private — open student files via a short-lived signed URL.
  async function openAttachment(pathOrUrl?: string) {
    if (!pathOrUrl) return;
    if (pathOrUrl.startsWith("http")) { window.open(pathOrUrl, "_blank"); return; }
    const { data } = await supabase.storage.from("homework").createSignedUrl(pathOrUrl, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function toggleExpand(hwId: string) {
    if (expanded === hwId) { setExpanded(null); return; }
    setExpanded(hwId);
    loadSubmissions(hwId);
  }

  function setGradeField(subId: string, field: keyof GradeState, value: string | boolean) {
    setGrading(prev => ({ ...prev, [subId]: { marks: "", feedback: "", saving: false, saved: false, ...prev[subId], [field]: value } }));
  }

  async function saveGrade(subId: string, hwId: string) {
    const g = grading[subId];
    if (!g?.marks) return;
    setGradeField(subId, "saving", true);
    try {
      await supabase.from("homework_submissions").update({
        grade: g.marks,
        teacher_remarks: g.feedback || null,
        status: "graded",
      } as any).eq("id", subId);

      // Refresh submissions for this hw
      setSubmissions(prev => ({
        ...prev,
        [hwId]: (prev[hwId] || []).map(s => s.id === subId ? { ...s, grade: Number(g.marks), feedback: g.feedback } : s),
      }));
      setGradeField(subId, "saved", true);
      setTimeout(() => setGradeField(subId, "saved", false), 2000);
    } catch (err) {
      console.error("Grade save error:", err);
    } finally {
      setGradeField(subId, "saving", false);
    }
  }

  if (loading) return <div className="flex justify-center items-center h-48"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Homework Submissions</h1>
        <p className="text-sm text-muted-foreground mt-1">Track and grade student submissions</p>
      </div>

      {homeworks.length === 0
        ? <div className="text-center py-16 bg-card border border-border rounded-xl">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="font-medium">No homework assigned yet</p>
          </div>
        : <div className="space-y-3">
          {homeworks.map(hw => {
            const pct = hw.total > 0 ? Math.round((hw.submitted / hw.total) * 100) : 0;
            const isOpen = expanded === hw.id;
            return (
              <div key={hw.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <button type="button" onClick={() => toggleExpand(hw.id)}
                  className="w-full p-4 flex items-center gap-4 hover:bg-muted/40 transition-colors text-left">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{hw.title}</p>
                    <p className="text-xs text-muted-foreground">{hw.subject} · Class {hw.class_name} · Due: {new Date(hw.due_date).toLocaleDateString("en-IN")}</p>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-bold">{hw.submitted}/{hw.total}</p>
                      <p className="text-xs text-muted-foreground">submitted</p>
                    </div>
                    <div className="w-16">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-center mt-0.5 text-muted-foreground">{pct}%</p>
                    </div>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-border p-4">
                    {!submissions[hw.id] ? (
                      <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
                    ) : submissions[hw.id].length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No submissions yet</p>
                    ) : (
                      <div className="space-y-3">
                        {submissions[hw.id].map((s) => {
                          const g = grading[s.id] || { marks: String(s.grade || ""), feedback: s.feedback || "", saving: false, saved: false };
                          const isGraded = s.grade !== null && s.grade !== undefined;
                          return (
                            <div key={s.id} className="border border-border rounded-lg p-3 space-y-2">
                              <div className="flex items-center gap-3">
                                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                <span className="text-sm font-medium flex-1">{s.student_name}</span>
                                <span className="text-xs text-muted-foreground">{new Date(s.submitted_at).toLocaleDateString("en-IN")}</span>
                                {isGraded
                                  ? <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                      <Star className="w-3 h-3" /> {s.grade} marks
                                    </span>
                                  : <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                      <Clock className="w-3 h-3" /> Not graded
                                    </span>
                                }
                              </div>
                              {s.notes && <p className="text-xs text-muted-foreground italic pl-7">"{s.notes}"</p>}
                              {s.attachment_url && (
                                <button type="button" onClick={() => openAttachment(s.attachment_url)}
                                  className="ml-7 text-xs flex items-center gap-1 text-primary hover:underline">
                                  <ExternalLink className="w-3 h-3" /> View submitted file
                                </button>
                              )}
                              {s.feedback && isGraded && <p className="text-xs text-blue-600 dark:text-blue-400 pl-7">Feedback: {s.feedback}</p>}

                              {/* Grading form */}
                              <div className="pl-7 flex flex-wrap gap-2 items-center">
                                <input type="number" min={0} title="Marks" placeholder="Marks"
                                  value={g.marks}
                                  onChange={e => setGradeField(s.id, "marks", e.target.value)}
                                  className="w-20 h-8 border border-border rounded px-2 text-sm bg-background focus:ring-2 focus:ring-primary" />
                                <input type="text" title="Feedback" placeholder="Feedback (optional)"
                                  value={g.feedback}
                                  onChange={e => setGradeField(s.id, "feedback", e.target.value)}
                                  className="flex-1 min-w-[140px] h-8 border border-border rounded px-2 text-sm bg-background focus:ring-2 focus:ring-primary" />
                                <button type="button" onClick={() => saveGrade(s.id, hw.id)}
                                  disabled={!g.marks || g.saving}
                                  className="h-8 px-3 text-xs font-medium rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity">
                                  {g.saved ? "Saved ✓" : g.saving ? "Saving…" : isGraded ? "Update" : "Grade"}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      }
    </div>
  );
}
