// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, BookOpen, Upload, CheckCircle2, Paperclip, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export function StudentHomeworkPage() {
  const params = useParams();
  const tenant = params.tenantId as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<any>(null);
  const [homeworks, setHomeworks] = useState<any[]>([]);
  const [subs, setSubs] = useState<Record<string, any>>({}); // homework_id -> submission

  // submit modal
  const [activeHw, setActiveHw] = useState<any>(null);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchHomework();
  }, [tenant]);

  async function fetchHomework() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: studentRecord } = await supabase
        .from('students')
        .select('id, class_id, school_id')
        .eq('user_id', user.id)
        .single();
      if (!studentRecord) return;
      setStudent(studentRecord);

      const [{ data: hwData }, { data: subData }] = await Promise.all([
        supabase
          .from('homework')
          .select(`id, subject, title, description, due_date, created_at, teacher:created_by(full_name)`)
          .eq('school_id', studentRecord.school_id)
          .eq('class_id', studentRecord.class_id)
          .order('due_date', { ascending: true }),
        supabase
          .from('homework_submissions')
          .select('*')
          .eq('student_id', studentRecord.id),
      ]);

      setHomeworks(hwData || []);
      const map: Record<string, any> = {};
      (subData || []).forEach((s: any) => { map[s.homework_id] = s; });
      setSubs(map);
    } catch (error) {
      console.error("Error fetching homework:", error);
    } finally {
      setLoading(false);
    }
  }

  function openSubmit(hw: any) {
    setActiveHw(hw);
    const existing = subs[hw.id];
    setText(existing?.submission_text || "");
    setFile(null);
  }

  async function handleSubmit() {
    if (!activeHw || !student) return;
    if (!text.trim() && !file) {
      toast.error("Add a note or attach a file.");
      return;
    }
    setSubmitting(true);
    const toastId = toast.loading("Submitting your work...");
    try {
      // Store the storage PATH (bucket is private; we generate signed URLs on read).
      let attachment_url = subs[activeHw.id]?.attachment_url || null;

      if (file) {
        const ext = file.name.split(".").pop();
        const path = `${student.school_id}/${activeHw.id}/${student.id}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("homework").upload(path, file, { upsert: true });
        if (upErr) throw upErr;
        attachment_url = path;
      }

      const overdue = new Date(activeHw.due_date) < new Date(new Date().toDateString());
      const { error } = await supabase.from("homework_submissions").upsert({
        school_id: student.school_id,
        homework_id: activeHw.id,
        student_id: student.id,
        submission_text: text.trim() || null,
        attachment_url,
        status: overdue ? "late" : "submitted",
        submitted_at: new Date().toISOString(),
      }, { onConflict: "homework_id,student_id" });
      if (error) throw error;

      toast.success("Homework submitted!", { id: toastId });
      setActiveHw(null);
      fetchHomework();
    } catch (err: any) {
      toast.error("Failed: " + err.message, { id: toastId });
    } finally {
      setSubmitting(false);
    }
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  // Bucket is private — open via a short-lived signed URL. Handles legacy rows
  // that stored a full public URL too.
  async function openAttachment(pathOrUrl: string) {
    if (!pathOrUrl) return;
    if (pathOrUrl.startsWith("http")) { window.open(pathOrUrl, "_blank"); return; }
    const { data, error } = await supabase.storage.from("homework").createSignedUrl(pathOrUrl, 60);
    if (error || !data?.signedUrl) { toast.error("Could not open file."); return; }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">My Homework</h1>
          <p className="text-sm text-muted-foreground mt-1">View assignments and submit your work.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500/50" />
        </div>
      ) : homeworks.length === 0 ? (
        <div className="text-center py-16 bg-gradient-to-br from-fuchsia-500/10 via-purple-500/5 to-orange-500/10 rounded-2xl border border-fuchsia-500/20 shadow-xl relative overflow-hidden">
          <div className="relative z-10">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-purple-600/20 border border-fuchsia-400/30 flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-fuchsia-400" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">No homework assigned</h3>
            <p className="text-muted-foreground text-sm">You are all caught up! Enjoy your free time.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {homeworks.map((hw, idx) => {
              const sub = subs[hw.id];
              const submitted = !!sub;
              return (
                <motion.div key={hw.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                  <Card className={`bg-card backdrop-blur-xl border-border shadow-xl hover:bg-muted/30 transition-all relative overflow-hidden ${submitted ? "opacity-95" : ""}`}>
                    {submitted && <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-500/20 to-transparent rounded-bl-full pointer-events-none" />}
                    <CardContent className="p-6 flex flex-col md:flex-row gap-6 relative z-10">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="px-2.5 py-1 rounded-full text-[10px] uppercase font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">{hw.subject}</span>
                          {submitted && (
                            <span className={`flex items-center text-xs font-medium ${sub.status === "graded" ? "text-blue-400" : sub.status === "late" ? "text-amber-400" : "text-emerald-400"}`}>
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              {sub.status === "graded" ? `Graded: ${sub.grade ?? ""}` : sub.status === "late" ? "Submitted (late)" : "Submitted"}
                            </span>
                          )}
                          <span className={`text-xs font-mono ml-auto ${submitted ? "text-muted-foreground" : "text-amber-400"}`}>Due: {formatDate(hw.due_date)}</span>
                        </div>
                        <h3 className="text-xl font-bold text-foreground mb-2">{hw.title}</h3>
                        <p className="text-sm text-foreground/80 mb-4">{hw.description}</p>
                        {sub?.teacher_remarks && (
                          <p className="text-xs text-blue-400 mb-2">Teacher: {sub.teacher_remarks}</p>
                        )}
                        <div className="text-xs text-muted-foreground">Assigned by: {hw.teacher?.full_name || "Teacher"}</div>
                      </div>

                      <div className="flex items-center md:border-l md:border-border md:pl-6 gap-2">
                        {submitted && sub.attachment_url && (
                          <button type="button" onClick={() => openAttachment(sub.attachment_url)}
                            className="text-xs flex items-center gap-1 border border-border px-3 py-2 rounded-lg hover:bg-muted">
                            <ExternalLink className="w-3.5 h-3.5" /> File
                          </button>
                        )}
                        <Button onClick={() => openSubmit(hw)}
                          className={submitted
                            ? "border border-emerald-500/30 bg-transparent text-emerald-400 hover:bg-emerald-500/10"
                            : "bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/20"}>
                          <Upload className="w-4 h-4 mr-2" /> {submitted ? "Update" : "Upload Work"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Submit modal */}
      <Dialog open={!!activeHw} onOpenChange={(o) => !o && setActiveHw(null)}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{subs[activeHw?.id] ? "Update Submission" : "Submit Homework"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <p className="text-sm font-semibold">{activeHw?.title}</p>
              <p className="text-xs text-muted-foreground">{activeHw?.subject} · Due {activeHw && formatDate(activeHw.due_date)}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Note (optional)</label>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
                placeholder="Write a note for your teacher..."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground flex items-center gap-1"><Paperclip className="w-3 h-3" /> Attachment (PDF / image / doc)</label>
              <input type="file" title="Attach your work" onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-purple-600 file:text-white file:px-3 file:py-1.5 file:text-xs" />
              {file && <p className="text-xs text-muted-foreground">Selected: {file.name}</p>}
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button onClick={handleSubmit} disabled={submitting} className="w-full bg-purple-600 hover:bg-purple-700 text-white">
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              {subs[activeHw?.id] ? "Update Submission" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
