// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, BookOpen, Clock, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function HomeworkPage() {
  const { tenantId: schoolId } = useTenant();
  const [homeworks, setHomeworks] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Form State
  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (schoolId) fetchInitialData();
  }, [schoolId]);

  async function fetchInitialData() {
    setLoading(true);
    try {
      const { data: classesData } = await supabase
        .from('classes')
        .select('id, grade_level, section')
        .eq('school_id', schoolId)
        .order('grade_level', { ascending: true });

      if (classesData) setClasses(classesData);

      const { data } = await supabase
        .from('homework')
        .select(`id, title, description, due_date, created_at, classes:class_id(grade_level, section), users:teacher_id(full_name)`)
        .eq('school_id', schoolId)
        .order('due_date', { ascending: false });

      if (data) setHomeworks(data);
    } catch (error) {
      console.error("Error fetching homework:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleAssignHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from('homework').insert({
        school_id: schoolId,
        class_id: classId,
        teacher_id: user.id,
        title,
        description,
        due_date: dueDate,
      });

      if (error) throw error;
      
      setClassId("");
      setTitle("");
      setDescription("");
      setDueDate("");
      setIsDialogOpen(false);
      fetchInitialData();
      
    } catch (error: any) {
      console.error("Error assigning homework:", error);
      alert(`Failed to assign homework: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Homework & Assignments</h1>
          <p className="text-sm text-slate-400 mt-1">Assign tasks and track student submissions.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" />}>
            <Plus className="w-4 h-4 mr-2" /> Assign Homework
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-white/10 text-white sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Assign New Homework</DialogTitle>
              <DialogDescription className="text-slate-400">
                Create a new assignment for a specific class.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAssignHomework} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="class">Select Class</Label>
                <Select value={classId} onValueChange={setClassId} required>
                  <SelectTrigger className="bg-slate-950 border-white/10 text-white">
                    <SelectValue placeholder="Select a class" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10 text-white">
                    {classes.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.grade_level} - Sec {c.section}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Assignment Title</Label>
                <Input 
                  id="title" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  placeholder="e.g. Chapter 4 Exercise"
                  required 
                  className="bg-slate-950 border-white/10 text-white" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Instructions / Description</Label>
                <textarea 
                  id="description" 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                  required 
                  rows={4}
                  className="w-full flex rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
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
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={isSubmitting} className="bg-emerald-500 hover:bg-emerald-600 text-white w-full">
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BookOpen className="w-4 h-4 mr-2" />}
                  Assign to Class
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
        <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-white/5">
              <BookOpen className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No homework assigned</h3>
            <p className="text-slate-400 mb-6 max-w-sm">There are no active assignments currently. Create one to get started.</p>
          </CardContent>
        </Card>
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
                <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl hover:border-emerald-500/30 transition-all group overflow-hidden flex flex-col h-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <CardContent className="p-6 relative z-10 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                        <FileText className="w-5 h-5 text-emerald-400" />
                      </div>
                      <span className="px-2 py-1 rounded bg-slate-950/80 border border-white/10 text-xs text-slate-300 font-medium">
                        {hw.classes?.grade_level} {hw.classes?.section}
                      </span>
                    </div>
                    
                    <h3 className="text-lg font-bold text-white mb-2 line-clamp-1">{hw.title}</h3>
                    <p className="text-sm text-slate-400 mb-6 line-clamp-2 flex-grow">{hw.description}</p>
                    
                    <div className="space-y-3 pt-4 border-t border-white/5 mt-auto">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Assigned by:</span>
                        <span className="text-slate-300 font-medium">{hw.users?.full_name || 'Teacher'}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Due Date:</span>
                        <span className={`font-medium flex items-center ${new Date(hw.due_date) < new Date() ? 'text-red-400' : 'text-amber-400'}`}>
                          <Clock className="w-3 h-3 mr-1" /> {formatDate(hw.due_date)}
                        </span>
                      </div>
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
