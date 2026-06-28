// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Users, GraduationCap, CalendarDays } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function ClassesPage() {
  const { tenantId: schoolId } = useTenant();
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Form State
  const [gradeLevel, setGradeLevel] = useState("");
  const [section, setSection] = useState("");
  const [teacherId, setTeacherId] = useState("unassigned");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (schoolId) fetchData();
  }, [schoolId]);

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch classes
      const { data: classesData } = await supabase
        .from('classes')
        .select(`id, grade_level, section, created_at, users:class_teacher_id(id, full_name, email)`)
        .eq('school_id', schoolId)
        .order('grade_level', { ascending: true });

      if (classesData) setClasses(classesData);

      // Fetch teachers for the dropdown
      const { data: teachersData } = await supabase
        .from('users')
        .select('id, email, name, full_name')
        .eq('school_id', schoolId)
        .eq('role', 'teacher');

      if (teachersData) setTeachers(teachersData);
    } catch (error) {
      console.error("Error fetching classes:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const insertData: any = {
        school_id: schoolId,
        grade_level: gradeLevel,
        section: section,
      };

      if (teacherId !== "unassigned") {
        insertData.class_teacher_id = teacherId;
      }

      const { data: newClass, error } = await supabase
        .from('classes')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      // Notify the assigned teacher via announcements
      if (teacherId !== "unassigned" && newClass) {
        await supabase.from('announcements').insert({
          school_id: schoolId,
          title: `Class Assignment: Grade ${gradeLevel}-${section}`,
          content: `You have been assigned as Class Teacher for Grade ${gradeLevel}, Section ${section}. Please check your dashboard for student list and timetable.`,
          target_audience: 'teachers',
          notice_type: 'announcement',
          priority: 'high',
        });
      }

      // Reset form and reload
      setGradeLevel("");
      setSection("");
      setTeacherId("unassigned");
      setIsDialogOpen(false);
      fetchData();
      
    } catch (error) {
      console.error("Error adding class:", error);
      toast.error("Failed to add class. Check console.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Classes & Sections</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage grade levels, sections, and class teachers.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" />}>
              <Plus className="w-4 h-4 mr-2" /> Add Class
            </DialogTrigger>
          <DialogContent className="bg-card border-border text-foreground sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Class</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Create a new class section and assign a class teacher.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddClass} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="gradeLevel">Grade Level</Label>
                <Input 
                  id="gradeLevel" 
                  placeholder="e.g. 10th Grade" 
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  required
                  className="bg-background border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="section">Section</Label>
                <Input 
                  id="section" 
                  placeholder="e.g. A" 
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  required
                  className="bg-background border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="teacher">Class Teacher</Label>
                <Select value={teacherId} onValueChange={setTeacherId}>
                  <SelectTrigger className="bg-background border-border text-foreground">
                    <SelectValue placeholder="Select a teacher" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground">
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {teachers.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={isSubmitting} className="bg-emerald-500 hover:bg-emerald-600 text-white w-full">
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Save Class
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
      ) : classes.length === 0 ? (
        <Card className="bg-card backdrop-blur-xl border-border shadow-xl">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <CalendarDays className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">No classes found</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">You haven't created any classes yet. Click the button above to add your first class.</p>
            <Button onClick={() => setIsDialogOpen(true)} className="bg-white/10 hover:bg-white/20 text-foreground border-0">
              Create First Class
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {classes.map((cls, idx) => (
              <motion.div
                key={cls.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="bg-card backdrop-blur-xl border-border shadow-xl overflow-hidden group hover:border-emerald-500/30 transition-all duration-300">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <CardHeader className="pb-2 border-b border-border relative z-10">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                          {cls.grade_level} 
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-xs tracking-widest font-mono">
                            SEC {cls.section}
                          </span>
                        </CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 relative z-10">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center border border-border">
                        <GraduationCap className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Class Teacher</p>
                        <p className="text-foreground font-medium">
                          {cls.users ? cls.users.full_name : "Unassigned"}
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="w-4 h-4" />
                        <span>0 Students</span>
                      </div>
                      <Button variant="ghost" size="sm" className="h-8 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10">
                        View Details
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

