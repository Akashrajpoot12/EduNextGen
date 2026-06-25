// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, Wallet, IndianRupee, Search, Banknote, Printer, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function PayrollPage() {
  const { tenantId: schoolId } = useTenant();
  const [salaries, setSalaries] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Form State
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [baseSalary, setBaseSalary] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();
  const [printSalary, setPrintSalary] = useState<any>(null);
  const [schoolName, setSchoolName] = useState("");
  const [payMonth, setPayMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    if (schoolId) {
      fetchInitialData();
      supabase.from("schools").select("name").eq("id", schoolId).maybeSingle().then(({ data }) => {
        if (data) setSchoolName(data.name);
      });
    }
  }, [schoolId]);

  async function fetchInitialData() {
    setLoading(true);
    try {
      // Fetch teachers who do NOT have a salary defined yet
      const { data: teachersData } = await supabase
        .from('users')
        .select('id, name, full_name, email')
        .eq('school_id', schoolId)
        .eq('role', 'teacher');

      // Fetch existing salaries
      const { data: salariesData } = await supabase
        .from('salaries')
        .select('id, user_id, base_salary, users(full_name, email)')
        .eq('school_id', schoolId);

      const existingUserIds = salariesData ? salariesData.map(s => s.user_id) : [];

      if (teachersData) {
        const availableTeachers = teachersData.filter(t => t && !existingUserIds.includes(t.id));
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
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Payroll Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage staff salaries and generate monthly payrolls.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" />}>
              <Plus className="w-4 h-4 mr-2" /> Define Staff Salary
            </DialogTrigger>
          <DialogContent className="bg-card border-border text-foreground sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Define Base Salary</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Set the base monthly salary for a teacher or staff member.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleDefineSalary} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Select Staff Member</Label>
                <select 
                  className="w-full h-10 px-3 py-2 bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                  className="bg-background border-border text-foreground" 
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
        <Card className="bg-card backdrop-blur-xl border-border shadow-xl">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Monthly Payroll Estimate</p>
                <h3 className="text-3xl font-bold text-foreground mt-2 flex items-center">
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
        <Card className="bg-card backdrop-blur-xl border-border shadow-xl">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 border border-border">
              <Wallet className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">No salaries defined</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">You haven't set up the payroll structure for any staff members yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card backdrop-blur-xl border-border shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-muted-foreground">
              <thead className="text-xs uppercase bg-muted text-muted-foreground border-b border-border">
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
                      className="border-b border-border hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-foreground">{salary.users?.full_name}</td>
                      <td className="px-6 py-4 text-muted-foreground">{salary.users?.email}</td>
                      <td className="px-6 py-4 font-mono text-emerald-400 flex items-center">
                        <IndianRupee className="w-3 h-3 mr-1" /> {Number(salary.base_salary).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setPrintSalary(salary)} className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10">
                          <Printer className="w-3.5 h-3.5 mr-1" /> Payslip
                        </Button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {/* Payslip Print Modal */}
      {printSalary && (() => {
        const gross = Number(printSalary.base_salary);
        const hra   = Math.round(gross * 0.2);
        const ta    = Math.round(gross * 0.1);
        const basic = gross - hra - ta;
        const pf    = Math.round(gross * 0.12);
        const tds   = Math.round(gross * 0.05);
        const net   = gross - pf - tds;
        const [yr, mo] = payMonth.split("-");
        const monthName = new Date(Number(yr), Number(mo) - 1).toLocaleString("en-IN", { month: "long", year: "numeric" });

        return (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg text-slate-900">
              <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b">
                <div>
                  <h2 className="font-bold text-lg">{schoolName || "School"}</h2>
                  <p className="text-xs text-muted-foreground">Salary Slip — {monthName}</p>
                </div>
                <button type="button" title="Close" onClick={() => setPrintSalary(null)} className="text-muted-foreground hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-6 py-4 space-y-4">
                {/* Employee details */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{printSalary.users?.full_name}</span></div>
                  <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{printSalary.users?.email}</span></div>
                  <div><span className="text-muted-foreground">Pay Period:</span> <span className="font-medium">{monthName}</span></div>
                </div>

                {/* Month picker */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Change month:</span>
                  <input type="month" value={payMonth} onChange={e => setPayMonth(e.target.value)}
                    title="Pay month" placeholder="YYYY-MM"
                    className="text-xs border border-slate-200 rounded px-2 py-1" />
                </div>

                {/* Earnings */}
                <div>
                  <h3 className="font-semibold text-sm mb-2 text-slate-700">Earnings</h3>
                  <table className="w-full text-sm">
                    <tbody>
                      {[["Basic Salary", basic], ["HRA (20%)", hra], ["Travel Allowance (10%)", ta]].map(([l, v]) => (
                        <tr key={l as string} className="border-t border-slate-100">
                          <td className="py-1.5 text-slate-600">{l}</td>
                          <td className="py-1.5 text-right font-medium">₹{(v as number).toLocaleString("en-IN")}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-slate-300 font-semibold">
                        <td className="py-2">Gross Salary</td>
                        <td className="py-2 text-right text-emerald-700">₹{gross.toLocaleString("en-IN")}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Deductions */}
                <div>
                  <h3 className="font-semibold text-sm mb-2 text-slate-700">Deductions</h3>
                  <table className="w-full text-sm">
                    <tbody>
                      {[["PF (12%)", pf], ["TDS (5%)", tds]].map(([l, v]) => (
                        <tr key={l as string} className="border-t border-slate-100">
                          <td className="py-1.5 text-slate-600">{l}</td>
                          <td className="py-1.5 text-right font-medium text-red-600">-₹{(v as number).toLocaleString("en-IN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Net */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex justify-between items-center">
                  <span className="font-bold text-slate-700">Net Pay</span>
                  <span className="text-2xl font-bold text-emerald-700">₹{net.toLocaleString("en-IN")}</span>
                </div>
              </div>

              <div className="px-6 pb-5 flex justify-end">
                <button type="button" onClick={() => window.print()}
                  className="flex items-center gap-2 bg-muted hover:bg-muted text-foreground text-sm font-medium px-5 py-2 rounded-lg transition-colors">
                  <Printer className="w-4 h-4" /> Print / Save PDF
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
