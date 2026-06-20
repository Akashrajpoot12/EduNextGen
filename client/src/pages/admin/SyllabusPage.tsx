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
import { Loader2, Plus, LayoutList, Search, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function SyllabusPage() {
  const { tenantId: schoolId } = useTenant();
  const [syllabi, setSyllabi] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Form State
  const [classId, setClassId] = useState("");
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (schoolId) fetchInitialData();
  }, [schoolId]);

  async function fetchInitialData() {
    setLoading(true);
    try {
      const [{ data: classesData }, { data: syllabusData }] = await Promise.all([
        supabase.from('classes').select('id, grade_level, section').eq('school_id', schoolId).order('grade_level'),
        supabase.from('syllabus').select(`id, subject, title, status, created_at, classes:class_id(grade_level, section)`).eq('school_id', schoolId).order('created_at', { ascending: false }),
      ]);
      if (classesData) setClasses(classesData);
      if (syllabusData) setSyllabi(syllabusData);
    } catch (error) {
      console.error("Error fetching syllabus:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleAddSyllabus = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase.from('syllabus').insert({
        school_id: schoolId,
        class_id: classId,
        subject,
        title,
      });

      if (error) throw error;
      
      setClassId("");
      setSubject("");
      setTitle("");
      setIsDialogOpen(false);
      fetchInitialData();
      
    } catch (error: any) {
      console.error("Error adding syllabus:", error);
      alert(`Failed to add syllabus: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status.toLowerCase()) {
      case 'completed': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'ongoing': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Curriculum & Syllabus</h1>
          <p className="text-sm text-slate-400 mt-1">Track course coverage and manage class syllabus.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" />}>
            <Plus className="w-4 h-4 mr-2" /> Add Curriculum
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-white/10 text-white sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Syllabus Entry</DialogTitle>
              <DialogDescription className="text-slate-400">
                Define curriculum units for a specific class.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddSyllabus} className="space-y-4 pt-4">
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input 
                    id="subject" 
                    value={subject} 
                    onChange={(e) => setSubject(e.target.value)} 
                    placeholder="e.g. Science"
                    required 
                    className="bg-slate-950 border-white/10 text-white" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Unit / Chapter Title</Label>
                  <Input 
                    id="title" 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)} 
                    placeholder="e.g. Force & Motion"
                    required 
                    className="bg-slate-950 border-white/10 text-white" 
                  />
                </div>
              </div>
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={isSubmitting} className="bg-emerald-500 hover:bg-emerald-600 text-white w-full">
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LayoutList className="w-4 h-4 mr-2" />}
                  Save to Curriculum
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input placeholder="Search syllabus..." className="pl-9 bg-slate-900/50 border-white/10 text-white" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" />
        </div>
      ) : syllabi.length === 0 ? (
        <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-white/5">
              <LayoutList className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No syllabus defined</h3>
            <p className="text-slate-400 mb-6 max-w-sm">Create units and chapters to start tracking the curriculum.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="text-xs uppercase bg-slate-950/80 text-slate-400 border-b border-white/5">
                <tr>
                  <th className="px-6 py-4">Unit Title</th>
                  <th className="px-6 py-4">Subject</th>
                  <th className="px-6 py-4">Class</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {syllabi.map((item) => (
                    <motion.tr 
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-white flex items-center">
                        <FileText className="w-4 h-4 mr-2 text-slate-500" />
                        {item.title}
                      </td>
                      <td className="px-6 py-4 text-slate-300">{item.subject}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded bg-slate-800 text-slate-300 border border-white/10 text-xs">
                          {item.classes ? `${item.classes.grade_level} ${item.classes.section}` : 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold border ${getStatusColor(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10">Mark Complete</Button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
