// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, BookOpen, Send, Eye, Pencil, Trash2, TriangleAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function TeacherHomeworkPage() {
  const { tenantId: schoolId } = useTenant();
  const { tenantId } = useParams();
  const navigate = useNavigate();

  const [homeworks, setHomeworks] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHw, setEditingHw] = useState<any>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form State
  const [classId, setClassId] = useState("");
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (!schoolId) return;
    async function init() {
      setLoading(true);
      const { data: classesData } = await supabase
        .from('classes')
        .select('id, grade_level, section')
        .eq('school_id', schoolId)
        .order('grade_level', { ascending: true });
      if (classesData) setClasses(classesData);
      await fetchHomeworks(schoolId);
    }
    init();
  }, [schoolId]);

  async function fetchHomeworks(sId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase
        .from('homework')
        .select(`id, subject, title, description, due_date, created_at, class_id,
          classes:class_id(grade_level, section)`)
        .eq('school_id', sId)
        .eq('created_by', user?.id)
        .order('created_at', { ascending: false });
      if (data) setHomeworks(data);
    } catch (error) {
      console.error("Error fetching homework:", error);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingHw(null);
    setClassId(""); setSubject(""); setTitle(""); setDescription(""); setDueDate("");
    setIsDialogOpen(true);
  }

  function openEdit(hw: any) {
    setEditingHw(hw);
    setClassId(hw.class_id || "");
    setSubject(hw.subject || "");
    setTitle(hw.title || "");
    setDescription(hw.description || "");
    setDueDate(hw.due_date || "");
    setIsDialogOpen(true);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = { school_id: schoolId, class_id: classId, subject, title, description, due_date: dueDate };

      if (editingHw) {
        const { error } = await supabase.from('homework').update(payload).eq('id', editingHw.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('homework').insert({ ...payload, created_by: user?.id });
        if (error) throw error;

        // Notify students of this class via announcements
        const selectedClassName = classes.find((c: any) => c.id === classId);
        const clsLabel = selectedClassName
          ? `Class ${selectedClassName.grade_level}-${selectedClassName.section}`
          : "your class";

        await supabase.from("announcements").insert({
          school_id: schoolId,
          title: `📚 New Homework: ${subject} — ${title}`,
          content: `${clsLabel}: New homework assigned — "${title}" for ${subject}. Due date: ${dueDate}. ${description || ""}`.trim(),
          target_audience: "students",
          notice_type: "announcement",
          priority: "normal",
        });
      }

      setIsDialogOpen(false);
      fetchHomeworks(schoolId);
    } catch (error: any) {
      toast.error(`Failed: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  async function handleDelete(hwId: string) {
    try {
      const { error } = await supabase.from('homework').delete().eq('id', hwId);
      if (error) throw error;
      setDeleteConfirmId(null);
      fetchHomeworks(schoolId);
    } catch (error: any) {
      toast.error(`Failed to delete: ${error.message}`);
    }
  }

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Homework due within 24 hours (today or tomorrow)
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const urgentHomeworks = homeworks.filter(hw => hw.due_date === today || hw.due_date === tomorrow);

  return (
    <div className="space-y-6">
      {/* Deadline within 24h banner */}
      {!loading && urgentHomeworks.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-amber-800 dark:text-amber-300">
          <TriangleAlert className="w-5 h-5 shrink-0 text-amber-500" />
          <span className="text-sm font-medium">
            ⚠️ {urgentHomeworks.length} assignment{urgentHomeworks.length > 1 ? "s" : ""} due within 24 hours — check submissions
          </span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Assignments</h1>
          <p className="text-sm text-muted-foreground mt-1">Assign and review homework for your classes.</p>
        </div>
        <Button onClick={openCreate} className="bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20">
          <Plus className="w-4 h-4 mr-2" /> Assign Homework
        </Button>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingHw ? "Edit Assignment" : "Create Assignment"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {editingHw ? "Update the assignment details below." : "This will be instantly visible to students on their portal."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Select Class</Label>
              <Select value={classId} onValueChange={setClassId} required>
                <SelectTrigger className="bg-background border-border text-foreground">
                  <SelectValue placeholder="Choose a class" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  {classes.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>Class {c.grade_level} - Sec {c.section}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Mathematics" required className="bg-background border-border text-foreground" />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required className="bg-background border-border text-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Topic / Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Chapter 4 Exercises" required className="bg-background border-border text-foreground" />
            </div>
            <div className="space-y-2">
              <Label>Instructions</Label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} required rows={3} title="Instructions" placeholder="Write instructions for students..."
                className="w-full flex rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" />
            </div>
            <DialogFooter className="pt-4">
              <Button type="submit" disabled={isSubmitting} className="bg-blue-500 hover:bg-blue-600 text-white w-full">
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                {editingHw ? "Update Assignment" : "Dispatch Assignment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Assignment?</DialogTitle>
            <DialogDescription className="text-muted-foreground">This action cannot be undone. All submissions for this assignment will also be removed.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDeleteConfirmId(null)} className="border-border text-foreground">Cancel</Button>
            <Button type="button" onClick={() => handleDelete(deleteConfirmId!)} className="bg-red-500 hover:bg-red-600 text-white">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" /></div>
      ) : homeworks.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-bold text-foreground mb-1">No assignments created</h3>
          <p className="text-muted-foreground text-sm">Assign homework to your students and track their progress.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {homeworks.map((hw, idx) => (
              <motion.div key={hw.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                <Card className="bg-card backdrop-blur-xl border-border shadow-xl hover:border-blue-500/30 transition-all group overflow-hidden flex flex-col h-full relative">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-blue-500/20 to-transparent rounded-bl-full" />
                  <CardContent className="p-6 relative z-10 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-2">
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {hw.subject}
                      </span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(hw)} title="Edit"
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteConfirmId(hw.id)} title="Delete"
                          className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono mb-2">Due: {formatDate(hw.due_date)}</span>
                    <h3 className="text-lg font-bold text-foreground mb-2">{hw.title}</h3>
                    <p className="text-sm text-muted-foreground mb-6 line-clamp-3 flex-grow">{hw.description}</p>
                    <div className="flex justify-between items-center mt-auto pt-4 border-t border-border">
                      <div className="text-xs text-muted-foreground">Class {hw.classes?.grade_level} {hw.classes?.section}</div>
                      <Button variant="ghost" size="sm"
                        onClick={() => navigate(`/${tenantId}/teacher/submissions?homeworkId=${hw.id}`)}
                        className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 h-8 text-xs">
                        <Eye className="w-3 h-3 mr-1" /> View Submissions
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
