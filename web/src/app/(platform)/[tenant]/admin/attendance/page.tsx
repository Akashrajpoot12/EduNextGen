"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, XCircle, Clock, Save, Fingerprint } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AttendancePage() {
  const params = useParams();
  const tenant = params.tenant as string;
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [schoolId, setSchoolId] = useState("");
  
  // Selection State
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Data State
  const [students, setStudents] = useState<any[]>([]);
  const [attendanceData, setAttendanceData] = useState<Record<string, string>>({});
  const [isFetchingStudents, setIsFetchingStudents] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchInitialData();
  }, [tenant]);

  useEffect(() => {
    if (selectedClassId && selectedDate) {
      fetchStudentsAndAttendance();
    } else {
      setStudents([]);
    }
  }, [selectedClassId, selectedDate]);

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
    } catch (error) {
      console.error("Error fetching initial data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchStudentsAndAttendance() {
    setIsFetchingStudents(true);
    try {
      // 1. Fetch Students
      const { data: studentsData } = await supabase
        .from('students')
        .select(`
          id, roll_number,
          users:user_id(full_name)
        `)
        .eq('class_id', selectedClassId)
        .order('roll_number', { ascending: true });

      if (studentsData) setStudents(studentsData);

      // 2. Fetch Existing Attendance
      const { data: existingAttendance } = await supabase
        .from('daily_attendance')
        .select('student_id, status')
        .eq('class_id', selectedClassId)
        .eq('date', selectedDate);

      const attMap: Record<string, string> = {};
      if (existingAttendance) {
        existingAttendance.forEach((record: any) => {
          attMap[record.student_id] = record.status;
        });
      }
      
      // Fill defaults for unmarked students
      if (studentsData) {
        studentsData.forEach((st: any) => {
          if (!attMap[st.id]) {
            attMap[st.id] = 'present'; // Default to present
          }
        });
      }

      setAttendanceData(attMap);
    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setIsFetchingStudents(false);
    }
  }

  const handleStatusChange = (studentId: string, status: string) => {
    setAttendanceData(prev => ({ ...prev, [studentId]: status }));
  };

  const handleSaveAttendance = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const records = Object.keys(attendanceData).map(studentId => ({
        school_id: schoolId,
        student_id: studentId,
        class_id: selectedClassId,
        date: selectedDate,
        status: attendanceData[studentId],
        marked_by: user.id
      }));

      // Upsert records (requires unique constraint on student_id + date)
      // Since we don't have a strict upsert setup defined, we can delete existing and insert new
      await supabase
        .from('daily_attendance')
        .delete()
        .eq('class_id', selectedClassId)
        .eq('date', selectedDate);

      const { error } = await supabase
        .from('daily_attendance')
        .insert(records);

      if (error) throw error;
      
      alert("Attendance saved successfully!");
    } catch (error: any) {
      console.error("Error saving attendance:", error);
      alert(`Failed to save: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const markAll = (status: string) => {
    const newAtt = { ...attendanceData };
    students.forEach(st => {
      newAtt[st.id] = status;
    });
    setAttendanceData(newAtt);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Daily Attendance</h1>
          <p className="text-sm text-slate-400 mt-1">Mark and monitor student attendance.</p>
        </div>
        
        <Button variant="outline" className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
          <Fingerprint className="w-4 h-4 mr-2" /> AI Face Attendance
        </Button>
      </div>

      <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label className="text-slate-300">Select Date</Label>
              <Input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-slate-950 border-white/10 text-white [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]" 
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Select Class</Label>
              <Select value={selectedClassId} onValueChange={(val) => setSelectedClassId(val || "")}>
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
            <div className="flex items-end justify-end">
              {students.length > 0 && (
                <Button 
                  onClick={handleSaveAttendance} 
                  disabled={isSaving}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 w-full md:w-auto"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Attendance
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" />
        </div>
      ) : !selectedClassId ? (
        <div className="text-center p-12 border border-white/5 rounded-xl bg-slate-900/20">
          <p className="text-slate-400">Please select a class to view and mark attendance.</p>
        </div>
      ) : isFetchingStudents ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" />
        </div>
      ) : students.length === 0 ? (
        <div className="text-center p-12 border border-white/5 rounded-xl bg-slate-900/20">
          <p className="text-slate-400">No students found in this class.</p>
        </div>
      ) : (
        <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden">
          <div className="p-4 border-b border-white/5 flex justify-between items-center bg-slate-950/50">
            <h3 className="font-medium text-white flex items-center">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
              Marking attendance for {students.length} students
            </h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-8 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" onClick={() => markAll('present')}>
                All Present
              </Button>
              <Button size="sm" variant="outline" className="h-8 border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={() => markAll('absent')}>
                All Absent
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="text-xs uppercase bg-slate-950/80 text-slate-400 border-b border-white/5">
                <tr>
                  <th className="px-6 py-4">Roll No.</th>
                  <th className="px-6 py-4">Student Name</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {students.map((student) => (
                    <motion.tr 
                      key={student.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-6 py-4 font-mono text-slate-400">{student.roll_number}</td>
                      <td className="px-6 py-4 font-medium text-white">
                        {student.users ? student.users.full_name : 'Unknown'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant={attendanceData[student.id] === 'present' ? 'default' : 'outline'}
                            className={`h-8 px-3 transition-all ${attendanceData[student.id] === 'present' ? 'bg-emerald-500 hover:bg-emerald-600 border-emerald-500 shadow-lg shadow-emerald-500/20 text-white' : 'border-white/10 hover:bg-white/10'}`}
                            onClick={() => handleStatusChange(student.id, 'present')}
                          >
                            <CheckCircle2 className={`w-4 h-4 ${attendanceData[student.id] === 'present' ? 'mr-1' : ''}`} />
                            {attendanceData[student.id] === 'present' && <span>Present</span>}
                          </Button>
                          
                          <Button 
                            size="sm" 
                            variant={attendanceData[student.id] === 'absent' ? 'default' : 'outline'}
                            className={`h-8 px-3 transition-all ${attendanceData[student.id] === 'absent' ? 'bg-red-500 hover:bg-red-600 border-red-500 shadow-lg shadow-red-500/20 text-white' : 'border-white/10 hover:bg-white/10'}`}
                            onClick={() => handleStatusChange(student.id, 'absent')}
                          >
                            <XCircle className={`w-4 h-4 ${attendanceData[student.id] === 'absent' ? 'mr-1' : ''}`} />
                            {attendanceData[student.id] === 'absent' && <span>Absent</span>}
                          </Button>

                          <Button 
                            size="sm" 
                            variant={attendanceData[student.id] === 'late' ? 'default' : 'outline'}
                            className={`h-8 px-3 transition-all ${attendanceData[student.id] === 'late' ? 'bg-amber-500 hover:bg-amber-600 border-amber-500 shadow-lg shadow-amber-500/20 text-white' : 'border-white/10 hover:bg-white/10'}`}
                            onClick={() => handleStatusChange(student.id, 'late')}
                          >
                            <Clock className={`w-4 h-4 ${attendanceData[student.id] === 'late' ? 'mr-1' : ''}`} />
                            {attendanceData[student.id] === 'late' && <span>Late</span>}
                          </Button>
                        </div>
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