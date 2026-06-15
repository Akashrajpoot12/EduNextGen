"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, Calendar as CalendarIcon, FileText, Search, Trophy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ExamsPage() {
  const params = useParams();
  const tenant = params.tenant as string;
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [schoolId, setSchoolId] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  
  // Form State
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
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

      // Get or create academic year
      let { data: acadYear } = await supabase
        .from('academic_years')
        .select('id')
        .eq('school_id', school.id)
        .eq('is_current', true)
        .single();

      if (!acadYear) {
        // Create one for 2026
        const { data: newYear, error } = await supabase.from('academic_years').insert({
          school_id: school.id,
          name: "2026-2027",
          start_date: "2026-04-01",
          end_date: "2027-03-31",
          is_current: true
        }).select('id').single();
        
        if (newYear) acadYear = newYear;
      }

      if (acadYear) {
        setAcademicYearId(acadYear.id);
        fetchExams(school.id, acadYear.id);
      }
    } catch (error) {
      console.error("Error fetching initial data:", error);
      setLoading(false);
    }
  }

  async function fetchExams(sId: string, aId: string) {
    try {
      const { data: examsData } = await supabase
        .from('exams')
        .select('*')
        .eq('school_id', sId)
        .eq('academic_year_id', aId)
        .order('start_date', { ascending: false });

      if (examsData) setExams(examsData);
    } catch (error) {
      console.error("Error fetching exams:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      if (!academicYearId) throw new Error("Academic Year not initialized");

      const { error } = await supabase.from('exams').insert({
        school_id: schoolId,
        academic_year_id: academicYearId,
        name,
        start_date: startDate,
        end_date: endDate,
      });

      if (error) throw error;
      
      setName("");
      setStartDate("");
      setEndDate("");
      setIsDialogOpen(false);
      fetchExams(schoolId, academicYearId);
      
    } catch (error: any) {
      console.error("Error creating exam:", error);
      alert(`Failed to create exam: ${error.message}`);
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
          <h1 className="text-3xl font-bold tracking-tight text-white">Examinations</h1>
          <p className="text-sm text-slate-400 mt-1">Schedule tests and manage examination terms.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" />}>
              <Plus className="w-4 h-4 mr-2" /> Schedule Exam
            </DialogTrigger>
          <DialogContent className="bg-slate-900 border-white/10 text-white sm:max-max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Exam Schedule</DialogTitle>
              <DialogDescription className="text-slate-400">
                Define the title and duration for the upcoming examination block.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateExam} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Exam Title</Label>
                <Input 
                  id="name" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="e.g. Mid-Term Examinations"
                  required 
                  className="bg-slate-950 border-white/10 text-white" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input 
                    id="startDate" 
                    type="date"
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)} 
                    required 
                    className="bg-slate-950 border-white/10 text-white [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input 
                    id="endDate" 
                    type="date"
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)} 
                    required 
                    className="bg-slate-950 border-white/10 text-white [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]" 
                  />
                </div>
              </div>
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={isSubmitting} className="bg-emerald-500 hover:bg-emerald-600 text-white w-full">
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CalendarIcon className="w-4 h-4 mr-2" />}
                  Save Schedule
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input placeholder="Search examinations..." className="pl-9 bg-slate-900/50 border-white/10 text-white" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" />
        </div>
      ) : exams.length === 0 ? (
        <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-white/5">
              <FileText className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No exams scheduled</h3>
            <p className="text-slate-400 mb-6 max-w-sm">You haven't defined any examination schedules yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {exams.map((exam, idx) => (
              <motion.div
                key={exam.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden hover:border-emerald-500/30 transition-all group">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <CardContent className="p-6 relative z-10">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center mb-4 border border-purple-500/30">
                      <Trophy className="w-5 h-5 text-purple-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-1">{exam.name}</h3>
                    <p className="text-xs text-slate-400 mb-4 flex items-center">
                      <CalendarIcon className="w-3 h-3 mr-1" />
                      {formatDate(exam.start_date)} - {formatDate(exam.end_date)}
                    </p>
                    
                    <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-white/5">
                      <Button variant="outline" size="sm" className="w-full border-white/10 bg-slate-950/50 hover:bg-white/10 text-slate-300">
                        Timetable
                      </Button>
                      <Button variant="outline" size="sm" className="w-full border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
                        Results
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