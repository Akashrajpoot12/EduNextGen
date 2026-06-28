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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, CalendarDays, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

export function TimetablePage() {
  const { tenantId: schoolId } = useTenant();

  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [timetable, setTimetable] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Selection
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [isFetchingTimetable, setIsFetchingTimetable] = useState(false);

  // Form State
  const [day, setDay] = useState("");
  const [period, setPeriod] = useState("");
  const [subject, setSubject] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (schoolId) fetchInitialData();
  }, [schoolId]);

  useEffect(() => {
    if (selectedClassId) {
      fetchTimetable();
    } else {
      setTimetable([]);
    }
  }, [selectedClassId]);

  async function fetchInitialData() {
    setLoading(true);
    try {
      const [{ data: classesData }, { data: teachersData }] = await Promise.all([
        supabase.from('classes').select('id, grade_level, section').eq('school_id', schoolId).order('grade_level'),
        supabase.from('users').select('id, name, full_name').eq('school_id', schoolId).eq('role', 'teacher'),
      ]);
      if (classesData) setClasses(classesData);
      if (teachersData) setTeachers(teachersData.map(t => ({ id: t.id, name: t.name || t.full_name })));
    } catch (error) {
      console.error("Error fetching initial data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchTimetable() {
    setIsFetchingTimetable(true);
    try {
      const { data } = await supabase
        .from('timetables')
        .select(`
          id, day_of_week, period_number, subject, start_time, end_time,
          users:teacher_id(full_name)
        `)
        .eq('class_id', selectedClassId);

      if (data) setTimetable(data);
    } catch (error) {
      console.error("Error fetching timetable:", error);
    } finally {
      setIsFetchingTimetable(false);
    }
  }

  const handleAssignPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Upsert logic based on class, day, period
      // First delete existing period for this class/day/period combination
      await supabase
        .from('timetables')
        .delete()
        .eq('class_id', selectedClassId)
        .eq('day_of_week', parseInt(day))
        .eq('period_number', parseInt(period));

      const { error } = await supabase.from('timetables').insert({
        school_id: schoolId,
        class_id: selectedClassId,
        day_of_week: parseInt(day),
        period_number: parseInt(period),
        subject,
        teacher_id: teacherId,
        start_time: startTime || null,
        end_time: endTime || null,
      });

      if (error) throw error;
      
      setIsDialogOpen(false);
      fetchTimetable();
      
    } catch (error: any) {
      console.error("Error saving period:", error);
      toast.error(`Failed to save: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCellData = (dIdx: number, pNum: number) => {
    return timetable.find(t => t.day_of_week === dIdx && t.period_number === pNum);
  };

  const openAssignModal = (dIdx: number, pNum: number) => {
    setDay(dIdx.toString());
    setPeriod(pNum.toString());
    const existing = getCellData(dIdx, pNum);
    if (existing) {
      setSubject(existing.subject || "");
      // can't easily prefill teacherId without matching id, we'll leave it empty for simplicity or fetch if needed
    } else {
      setSubject("");
    }
    setStartTime("");
    setEndTime("");
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Class Timetable</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage weekly schedules for classes and assign teachers.</p>
        </div>
      </div>

      <Card className="bg-card backdrop-blur-xl border-border shadow-xl">
        <CardContent className="p-6">
          <div className="max-w-md space-y-2">
            <Label className="text-muted-foreground">Select Class</Label>
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger className="bg-background border-border text-foreground">
                <SelectValue placeholder="Select a class to view timetable" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                {classes.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.grade_level} - Sec {c.section}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Assign Class Period</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Assign a subject and teacher for {DAYS_OF_WEEK[parseInt(day)]}, Period {period}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAssignPeriod} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input 
                id="subject" 
                value={subject} 
                onChange={(e) => setSubject(e.target.value)} 
                placeholder="e.g. Mathematics"
                required 
                className="bg-background border-border text-foreground" 
              />
            </div>
            <div className="space-y-2">
              <Label>Assign Teacher</Label>
              <select 
                className="w-full h-10 px-3 py-2 bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                required
              >
                <option value="" disabled>Select a teacher</option>
                {teachers.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time (Optional)</Label>
                <Input 
                  id="startTime" 
                  type="time"
                  value={startTime} 
                  onChange={(e) => setStartTime(e.target.value)} 
                  className="bg-background border-border text-foreground [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time (Optional)</Label>
                <Input 
                  id="endTime" 
                  type="time"
                  value={endTime} 
                  onChange={(e) => setEndTime(e.target.value)} 
                  className="bg-background border-border text-foreground [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]" 
                />
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="submit" disabled={isSubmitting} className="bg-emerald-500 hover:bg-emerald-600 text-white w-full">
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CalendarDays className="w-4 h-4 mr-2" />}
                Save Period
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" />
        </div>
      ) : !selectedClassId ? (
        <div className="text-center p-12 border border-border rounded-xl bg-card/20">
          <p className="text-muted-foreground">Please select a class to view its timetable.</p>
        </div>
      ) : isFetchingTimetable ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" />
        </div>
      ) : (
        <Card className="bg-card backdrop-blur-xl border-border shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-muted-foreground">
              <thead className="text-xs uppercase bg-muted text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-6 py-4 w-32 border-r border-border">Day / Period</th>
                  {PERIODS.map(p => (
                    <th key={p} className="px-4 py-4 text-center min-w-[120px]">Period {p}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS_OF_WEEK.map((dayName, dIdx) => (
                  <tr key={dayName} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-foreground border-r border-border bg-background/30">
                      {dayName}
                    </td>
                    {PERIODS.map(pNum => {
                      const cell = getCellData(dIdx, pNum);
                      return (
                        <td key={pNum} className="px-2 py-2 text-center align-top group relative border-r border-border last:border-0 hover:bg-muted/50">
                          {cell ? (
                            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-md h-full flex flex-col justify-center cursor-pointer" onClick={() => openAssignModal(dIdx, pNum)}>
                              <p className="font-bold text-emerald-400 text-xs truncate">{cell.subject}</p>
                              <p className="text-[10px] text-muted-foreground truncate mt-1">{cell.users?.full_name}</p>
                            </div>
                          ) : (
                            <div className="p-2 border border-dashed border-border rounded-md h-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => openAssignModal(dIdx, pNum)}>
                              <Plus className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
