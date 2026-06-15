"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { GraduationCap, Search, Plus, Loader2, Mail } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createTeacher } from "@/app/actions/user-actions";

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [schoolId, setSchoolId] = useState("");
  
  // Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const params = useParams();
  const tenant = params.tenant as string;
  const supabase = createClient();

  useEffect(() => {
    fetchTeachers();
  }, [tenant]);

  const fetchTeachers = async () => {
    setLoading(true);
    const { data: schoolData } = await supabase
      .from('schools')
      .select('id')
      .eq('subdomain', tenant)
      .single();

    if (!schoolData) {
      setLoading(false);
      return;
    }
    setSchoolId(schoolData.id);

    const { data: teachersData } = await supabase
      .from('user_roles')
      .select('user_id, role, users(id, email, full_name, created_at)')
      .eq('school_id', schoolData.id)
      .eq('role', 'teacher')
      .order('user_id', { ascending: false });

    if (teachersData) {
      const formattedTeachers = teachersData.map((tr: any) => {
         const user = tr.users || {};
         const nameParts = (user.full_name || "Unknown Teacher").split(" ");
         return {
            id: user.id,
            email: user.email,
            role: tr.role,
            first_name: nameParts[0],
            last_name: nameParts.slice(1).join(" ") || "",
            created_at: user.created_at
         };
      });
      setTeachers(formattedTeachers);
    }
    setLoading(false);
  };

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const result = await createTeacher({
        school_id: schoolId,
        email,
        first_name: firstName,
        last_name: lastName,
        tenant_path: tenant
      });

      if (!result.success) throw new Error(result.error);
      
      setFirstName("");
      setLastName("");
      setEmail("");
      setIsDialogOpen(false);
      fetchTeachers();
    } catch (error: any) {
      console.error("Error adding teacher:", error);
      alert(`Failed to add teacher: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Teachers Directory</h1>
          <p className="text-sm text-slate-400 mt-1">Manage your teaching staff, schedules, and assignments.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" />}>
            <Plus className="w-4 h-4 mr-2" /> Add Teacher
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-white/10 text-white sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Teacher</DialogTitle>
              <DialogDescription className="text-slate-400">
                Securely provision a new Teacher role in the database under your school.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddTeacher} className="space-y-4 pt-4">
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
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={isSubmitting} className="bg-emerald-500 hover:bg-emerald-600 text-white w-full">
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Provision Teacher
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input placeholder="Search staff by name or email..." className="pl-9 bg-slate-900/50 border-white/10 text-white" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" />
        </div>
      ) : teachers.length === 0 ? (
        <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <GraduationCap className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No teachers found</h3>
            <p className="text-slate-400 mb-6 max-w-sm">Get started by adding your first teacher.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="text-xs uppercase bg-slate-950/50 text-slate-400 border-b border-white/5">
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Email / Login ID</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {teachers.map((teacher) => (
                    <motion.tr 
                      key={teacher.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-white flex items-center">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold mr-3 border border-emerald-500/30">
                          {teacher.first_name?.[0]}{teacher.last_name?.[0]}
                        </div>
                        {teacher.first_name} {teacher.last_name}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center text-slate-400">
                          <Mail className="w-4 h-4 mr-2" /> {teacher.email}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-full text-[10px] uppercase font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {teacher.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10">Schedule</Button>
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