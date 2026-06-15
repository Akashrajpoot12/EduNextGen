"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, XCircle, Search, Save } from "lucide-react";

export default function TeacherAttendancePage() {
  const params = useParams();
  const tenant = params.tenant as string;
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [schoolId, setSchoolId] = useState("");

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

      // In a real scenario, we'd filter classes assigned to THIS teacher.
      // For this MVP UI, we'll fetch all classes for demo purposes.
      const { data: classesData } = await supabase
        .from('classes')
        .select('id, grade_level, section')
        .eq('school_id', school.id)
        .order('grade_level', { ascending: true });

      if (classesData) setClasses(classesData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }

  const fetchStudents = async (classId: string) => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('students')
        .select('user_id, enrollment_number, users(full_name)')
        .eq('class_id', classId);

      if (data) {
        setStudents(data);
        // Default everyone to present
        const defaultAtt: Record<string, string> = {};
        data.forEach((s) => {
          defaultAtt[s.user_id] = 'present';
        });
        setAttendance(defaultAtt);
      }
    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClassChange = (val: string) => {
    setSelectedClass(val);
    fetchStudents(val);
  };

  const toggleAttendance = (studentId: string, status: string) => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const saveAttendance = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const today = new Date().toISOString().split('T')[0];

      const records = students.map(s => ({
        school_id: schoolId,
        student_id: s.user_id,
        class_id: selectedClass,
        date: today,
        status: attendance[s.user_id],
        marked_by: user?.id
      }));

      const { error } = await supabase.from('daily_attendance').insert(records);
      
      if (error) {
        if (error.code === '23505') { // Unique violation
          alert("Attendance already marked for this class today.");
        } else {
          throw error;
        }
      } else {
        alert("Attendance saved successfully!");
      }
    } catch (error: any) {
      console.error("Error saving attendance:", error);
      alert("Failed to save: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Class Attendance</h1>
          <p className="text-sm text-slate-400 mt-1">Mark daily attendance for your assigned classes.</p>
        </div>
      </div>

      <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="w-full md:w-1/3">
              <label className="text-sm text-slate-400 mb-2 block">Select Class</label>
              <Select value={selectedClass} onValueChange={handleClassChange}>
                <SelectTrigger className="bg-slate-950 border-white/10 text-white w-full">
                  <SelectValue placeholder="Choose a class..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-white">
                  {classes.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.grade_level} - Sec {c.section}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {students.length > 0 && (
              <Button 
                onClick={saveAttendance} 
                disabled={isSaving}
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Submit Attendance
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {loading && !selectedClass ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" />
        </div>
      ) : students.length > 0 ? (
        <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="text-xs uppercase bg-slate-950/80 text-slate-400 border-b border-white/5">
                <tr>
                  <th className="px-6 py-4">Roll No.</th>
                  <th className="px-6 py-4">Student Name</th>
                  <th className="px-6 py-4 text-right">Mark Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.user_id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-6 py-4 font-mono text-slate-500">{student.enrollment_number}</td>
                    <td className="px-6 py-4 font-medium text-white">{student.users?.full_name}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant={attendance[student.user_id] === 'present' ? 'default' : 'outline'}
                          className={attendance[student.user_id] === 'present' ? 'bg-emerald-500 text-white' : 'border-white/10 text-slate-400'}
                          onClick={() => toggleAttendance(student.user_id, 'present')}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" /> P
                        </Button>
                        <Button
                          size="sm"
                          variant={attendance[student.user_id] === 'absent' ? 'default' : 'outline'}
                          className={attendance[student.user_id] === 'absent' ? 'bg-red-500 text-white' : 'border-white/10 text-slate-400'}
                          onClick={() => toggleAttendance(student.user_id, 'absent')}
                        >
                          <XCircle className="w-4 h-4 mr-1" /> A
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : selectedClass && !loading ? (
        <div className="text-center py-12 text-slate-500">
          No students found in this class.
        </div>
      ) : null}
    </div>
  );
}
