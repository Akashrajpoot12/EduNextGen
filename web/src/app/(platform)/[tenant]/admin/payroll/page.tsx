"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, Wallet, IndianRupee, Search, Banknote } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function PayrollPage() {
  const params = useParams();
  const tenant = params.tenant as string;
  const [salaries, setSalaries] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [schoolId, setSchoolId] = useState("");
  
  // Form State
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [baseSalary, setBaseSalary] = useState("");
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

      // Fetch teachers who do NOT have a salary defined yet
      const { data: teachersData } = await supabase
        .from('user_roles')
        .select('user_id, users(id, full_name, email)')
        .eq('school_id', school.id)
        .eq('role', 'teacher');

      // Fetch existing salaries
      const { data: salariesData } = await supabase
        .from('salaries')
        .select('id, user_id, base_salary, users(full_name, email)')
        .eq('school_id', school.id);

      const existingUserIds = salariesData ? salariesData.map(s => s.user_id) : [];
      
      if (teachersData) {
        // Filter out teachers who already have salaries defined
        const availableTeachers = teachersData
          .map(t => t.users)
          .filter(t => t && !existingUserIds.includes(t.id));
        setTeachers(availableTeachers);
      }

      if (salariesData) setSalaries(salariesData);

    } catch (error) {
      console.error("Error fetching payroll data:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleDefineSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase.from('salaries').insert({
        school_id: schoolId,
        user_id: selectedTeacherId,
        base_salary: parseFloat(baseSalary),
      });

      if (error) throw error;
      
      setSelectedTeacherId("");
      setBaseSalary("");
      setIsDialogOpen(false);
      fetchInitialData();
      
    } catch (error: any) {
      console.error("Error defining salary:", error);
      alert(`Failed to define salary: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Payroll Management</h1>
          <p className="text-sm text-slate-400 mt-1">Manage staff salaries and generate monthly payrolls.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" />}>
              <Plus className="w-4 h-4 mr-2" /> Define Staff Salary
            </DialogTrigger>
          <DialogContent className="bg-slate-900 border-white/10 text-white sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Define Base Salary</DialogTitle>
              <DialogDescription className="text-slate-400">
                Set the base monthly salary for a teacher or staff member.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleDefineSalary} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Select Staff Member</Label>
                <select 
                  className="w-full h-10 px-3 py-2 bg-slate-950 border border-white/10 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  required
                >
                  <option value="" disabled>Select a teacher</option>
                  {teachers.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.full_name} ({t.email})</option>
                  ))}
                </select>
                {teachers.length === 0 && (
                  <p className="text-xs text-amber-500 mt-1">All current teachers already have salaries defined.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="baseSalary">Monthly Base Salary (₹)</Label>
                <Input 
                  id="baseSalary" 
                  type="number"
                  value={baseSalary} 
                  onChange={(e) => setBaseSalary(e.target.value)} 
                  placeholder="25000"
                  required 
                  className="bg-slate-950 border-white/10 text-white" 
                />
              </div>
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={isSubmitting || teachers.length === 0} className="bg-emerald-500 hover:bg-emerald-600 text-white w-full">
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wallet className="w-4 h-4 mr-2" />}
                  Save Salary Record
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-400">Monthly Payroll Estimate</p>
                <h3 className="text-3xl font-bold text-white mt-2 flex items-center">
                  <IndianRupee className="w-6 h-6 mr-1" /> 
                  {salaries.reduce((sum, s) => sum + Number(s.base_salary), 0).toLocaleString()}
                </h3>
              </div>
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <Banknote className="w-5 h-5 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" />
        </div>
      ) : salaries.length === 0 ? (
        <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-white/5">
              <Wallet className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No salaries defined</h3>
            <p className="text-slate-400 mb-6 max-w-sm">You haven't set up the payroll structure for any staff members yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="text-xs uppercase bg-slate-950/80 text-slate-400 border-b border-white/5">
                <tr>
                  <th className="px-6 py-4">Staff Name</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Base Salary</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {salaries.map((salary) => (
                    <motion.tr 
                      key={salary.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-white">{salary.users?.full_name}</td>
                      <td className="px-6 py-4 text-slate-400">{salary.users?.email}</td>
                      <td className="px-6 py-4 font-mono text-emerald-400 flex items-center">
                        <IndianRupee className="w-3 h-3 mr-1" /> {Number(salary.base_salary).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10">Pay Salary</Button>
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