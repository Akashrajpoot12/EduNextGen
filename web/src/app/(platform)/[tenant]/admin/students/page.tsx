"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Users, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createStudent } from "@/app/actions/user-actions";

export default function StudentsPage() {
  const params = useParams();
  const tenant = params.tenant as string;
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [schoolId, setSchoolId] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [classId, setClassId] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [admissionNum, setAdmissionNum] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, [tenant]);

  async function fetchData() {
    setLoading(true);
    try {
      // 1. Get school ID
      const { data: school } = await supabase
        .from('schools')
        .select('id')
        .eq('subdomain', tenant)
        .single();

      if (!school) return;
      setSchoolId(school.id);

      // 2. Fetch classes for dropdown
      const { data: classesData } = await supabase
        .from('classes')
        .select('id, grade_level, section')
        .eq('school_id', school.id)
        .order('grade_level', { ascending: true });

      if (classesData) setClasses(classesData);

      // 3. Fetch students
      const { data: studentsData } = await supabase
        .from('students')
        .select(`
          id, roll_number, admission_number,
          users:user_id(full_name, email),
          classes:class_id(grade_level, section)
        `)
        .eq('school_id', school.id);

      if (studentsData) setStudents(studentsData);

    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId) {
      alert("Please select a class");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const result = await createStudent({
        school_id: schoolId,
        email,
        first_name: firstName,
        last_name: lastName,
        class_id: classId,
        roll_number: rollNumber,
        admission_number: admissionNum,
        tenant_path: tenant
      });

      if (!result.success) {
        throw new Error(result.error);
      }
      
      // Reset form and reload
      setFirstName("");
      setLastName("");
      setEmail("");
      setClassId("");
      setRollNumber("");
      setAdmissionNum("");
      setIsDialogOpen(false);
      fetchData();
      
    } catch (error: any) {
      console.error("Error enrolling student:", error);
      alert(`Failed to enroll student: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Students</h1>
          <p className="text-sm text-slate-400 mt-1">Manage enrollments, profiles, and assignments.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" />}>
              <Plus className="w-4 h-4 mr-2" /> Enroll Student
            </DialogTrigger>
          <DialogContent className="bg-slate-900 border-white/10 text-white sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Enroll New Student</DialogTitle>
              <DialogDescription className="text-slate-400">
                Create a new student profile. They will receive an email to set their password.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEnrollStudent} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="bg-slate-950 border-white/10 text-white" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="bg-slate-950 border-white/10 text-white" />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-slate-950 border-white/10 text-white" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="class">Assign Class</Label>
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
                  <Label htmlFor="rollNum">Roll Number</Label>
                  <Input id="rollNum" value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} required className="bg-slate-950 border-white/10 text-white" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminNum">Admission Number</Label>
                  <Input id="adminNum" value={admissionNum} onChange={(e) => setAdmissionNum(e.target.value)} required className="bg-slate-950 border-white/10 text-white" />
                </div>
              </div>
              
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={isSubmitting} className="bg-emerald-500 hover:bg-emerald-600 text-white w-full">
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Complete Enrollment
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input placeholder="Search students by name or admission number..." className="pl-9 bg-slate-900/50 border-white/10 text-white" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" />
        </div>
      ) : students.length === 0 ? (
        <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No students enrolled</h3>
            <p className="text-slate-400 mb-6 max-w-sm">You haven't enrolled any students yet. Add classes first, then enroll students.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="text-xs uppercase bg-slate-950/50 text-slate-400 border-b border-white/5">
                <tr>
                  <th className="px-6 py-4">Student Name</th>
                  <th className="px-6 py-4">Roll No.</th>
                  <th className="px-6 py-4">Class & Section</th>
                  <th className="px-6 py-4">Admission No.</th>
                  <th className="px-6 py-4 text-right">Actions</th>
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
                      <td className="px-6 py-4 font-medium text-white">
                        {student.users ? student.users.full_name : 'Unknown'}
                        <div className="text-xs text-slate-500 font-normal">{student.users ? student.users.email : ''}</div>
                      </td>
                      <td className="px-6 py-4">{student.roll_number}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded bg-slate-800 text-slate-300 border border-white/10 text-xs">
                          {student.classes ? `${student.classes.grade_level} ${student.classes.section}` : 'Unassigned'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400">{student.admission_number}</td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10">View Profile</Button>
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
