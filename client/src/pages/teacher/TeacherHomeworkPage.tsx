// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, BookOpen, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function TeacherHomeworkPage() {
  const params = useParams();
  const tenant = params.tenantId as string;
  const [homeworks, setHomeworks] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [schoolId, setSchoolId] = useState("");
  
  // Form State
  const [classId, setClassId] = useState("");
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchInitialData();
  }, [tenant]);

  async function fetchInitialData() {
    setLoading(true);
    try {
      const { data: school } = await supabase
        .from('schools')
        .select('id')
        .eq('subdomain', tenant)
        .single();

      if (!school) return;
      setSchoolId(school.id);

      const { data: classesData } = await supabase
        .from('classes')
        .select('id, grade_level, section')
        .eq('school_id', school.id)
        .order('grade_level', { ascending: true });

      if (classesData) setClasses(classesData);

      fetchHomeworks(school.id);
    } catch (error) {
      console.error("Error fetching initial data:", error);
      setLoading(false);
    }
  }

  async function fetchHomeworks(sId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // Normally filter by created_by = user.id. 
      // Assuming teacher can see homework they created.
      const { data } = await supabase
        .from('homework')
        .select(`
          id, subject, title, description, due_date, created_at,
          classes:class_id(grade_level, section)
        `)
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

  const handleAddHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from('homework').insert({
        school_id: schoolId,
        class_id: classId,
        subject,
        title,
        description,
        due_date: dueDate,
        created_by: user?.id,
      });

      if (error) throw error;
      
      setClassId("");
      setSubject("");
      setTitle("");
      setDescription("");
      setDueDate("");
      setIsDialogOpen(false);
      fetchHomeworks(schoolId);
      
    } catch (error: any) {
      console.error("Error adding homework:", error);
      alert(`Failed to add homework: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Assignments</h1>
          <p className="text-sm text-slate-400 mt-1">Assign and review homework for your classes.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button className="bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20" />}>
            <Plus className="w-4 h-4 mr-2" /> Assign Homework
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-white/10 text-white sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Assignment</DialogTitle>
              <DialogDescription className="text-slate-400">
                This will be instantly visible to students on their portal.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddHomework} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="class">Select Class</Label>
                <Select value={classId} onValueChange={setClassId} required>
                  <SelectTrigger className="bg-slate-950 border-white/10 text-white">
                    <SelectValue placeholder="Choose a class" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10 text-white">
                    {classes.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.grade_level} - Sec {c.section}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input 
                    id="subject" 
                    value={subject} 
                    onChange={(e) => setSubject(e.target.value)} 
                    placeholder="e.g. Mathematics"
                    required 
                    className="bg-slate-950 border-white/10 text-white" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input 
                    id="dueDate" 
                    type="date"
                    value={dueDate} 
                    onChange={(e) => setDueDate(e.target.value)} 
                    required 
                    className="bg-slate-950 border-white/10 text-white [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Topic / Title</Label>
                <Input 
                  id="title" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  placeholder="e.g. Chapter 4 Exercises"
                  required 
                  className="bg-slate-950 border-white/10 text-white" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Instructions</Label>
                <textarea 
                  id="desc" 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                  required 
                  rows={3}
                  className="w-full flex rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                />
              </div>
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={isSubmitting} className="bg-blue-500 hover:bg-blue-600 text-white w-full">
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  Dispatch Assignment
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" />
        </div>
      ) : homeworks.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/50 rounded-xl border border-white/10">
          <BookOpen className="w-12 h-12 text-slate-500 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-bold text-white mb-1">No assignments created</h3>
          <p className="text-slate-400 text-sm">Assign homework to your students and track their progress.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {homeworks.map((hw, idx) => (
              <motion.div
                key={hw.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl hover:border-blue-500/30 transition-all group overflow-hidden flex flex-col h-full relative">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-blue-500/20 to-transparent rounded-bl-full" />
                  <CardContent className="p-6 relative z-10 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-2">
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {hw.subject}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        Due: {formatDate(hw.due_date)}
                      </span>
                    </div>
                    
                    <h3 className="text-lg font-bold text-white mb-2">{hw.title}</h3>
                    <p className="text-sm text-slate-400 mb-6 line-clamp-3 flex-grow">{hw.description}</p>
                    
                    <div className="flex justify-between items-center mt-auto pt-4 border-t border-white/5">
                      <div className="text-xs text-slate-500">
                        Class {hw.classes?.grade_level} {hw.classes?.section}
                      </div>
                      <Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 h-8 text-xs">
                        View Submissions
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
