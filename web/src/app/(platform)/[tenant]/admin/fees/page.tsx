"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, Receipt, IndianRupee, CreditCard, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function FeesPage() {
  const params = useParams();
  const tenant = params.tenant as string;
  const [fees, setFees] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [schoolId, setSchoolId] = useState("");
  
  // Form State
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [classId, setClassId] = useState("");
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

      const { data: classesData } = await supabase
        .from('classes')
        .select('id, grade_level, section')
        .eq('school_id', school.id)
        .order('grade_level', { ascending: true });

      if (classesData) setClasses(classesData);

      fetchFees(school.id);
    } catch (error) {
      console.error("Error fetching initial data:", error);
    }
  }

  async function fetchFees(sId: string) {
    try {
      const { data: feesData } = await supabase
        .from('fees')
        .select(`
          id, title, amount, due_date,
          classes:class_id(grade_level, section)
        `)
        .eq('school_id', sId)
        .order('due_date', { ascending: false });

      if (feesData) setFees(feesData);
    } catch (error) {
      console.error("Error fetching fees:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleCreateFee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase.from('fees').insert({
        school_id: schoolId,
        class_id: classId,
        title,
        amount: parseFloat(amount),
        due_date: dueDate,
      });

      if (error) throw error;
      
      setTitle("");
      setAmount("");
      setDueDate("");
      setClassId("");
      setIsDialogOpen(false);
      fetchFees(schoolId);
      
    } catch (error: any) {
      console.error("Error creating fee:", error);
      alert(`Failed to create fee: ${error.message}`);
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
          <h1 className="text-3xl font-bold tracking-tight text-white">Fees Management</h1>
          <p className="text-sm text-slate-400 mt-1">Create fee structures and track student payments.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" />}>
              <Plus className="w-4 h-4 mr-2" /> Add Fee Structure
            </DialogTrigger>
          <DialogContent className="bg-slate-900 border-white/10 text-white sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Fee</DialogTitle>
              <DialogDescription className="text-slate-400">
                Define a new fee structure for a specific class.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateFee} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="title">Fee Title</Label>
                <Input 
                  id="title" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  placeholder="e.g. Term 1 Tuition Fee"
                  required 
                  className="bg-slate-950 border-white/10 text-white" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class">Target Class</Label>
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
                  <Label htmlFor="amount">Amount (₹)</Label>
                  <Input 
                    id="amount" 
                    type="number"
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                    placeholder="5000"
                    required 
                    className="bg-slate-950 border-white/10 text-white" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input 
                    id="dueDate" 
                    type="date"
                    value={dueDate} 
                    onChange={(e) => setDueDate(e.target.value)} 
                    required 
                    className="bg-slate-950 border-white/10 text-white [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]" 
                  />
                </div>
              </div>
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={isSubmitting} className="bg-emerald-500 hover:bg-emerald-600 text-white w-full">
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Receipt className="w-4 h-4 mr-2" />}
                  Create Fee
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="bg-emerald-500/10 border-emerald-500/20 shadow-lg">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-emerald-400">Total Collection (This Month)</p>
                <h3 className="text-3xl font-bold text-emerald-500 mt-2 flex items-center">
                  <IndianRupee className="w-6 h-6 mr-1" /> 0.00
                </h3>
              </div>
              <div className="p-3 bg-emerald-500/20 rounded-lg">
                <CreditCard className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input placeholder="Search fees..." className="pl-9 bg-slate-900/50 border-white/10 text-white" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" />
        </div>
      ) : fees.length === 0 ? (
        <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-white/5">
              <Receipt className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No fees defined</h3>
            <p className="text-slate-400 mb-6 max-w-sm">Create fee structures for classes to start collecting payments.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="text-xs uppercase bg-slate-950/80 text-slate-400 border-b border-white/5">
                <tr>
                  <th className="px-6 py-4">Fee Title</th>
                  <th className="px-6 py-4">Class</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Due Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {fees.map((fee) => (
                    <motion.tr 
                      key={fee.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-white">{fee.title}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded bg-slate-800 text-slate-300 border border-white/10 text-xs">
                          {fee.classes ? `${fee.classes.grade_level} ${fee.classes.section}` : 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-emerald-400 flex items-center">
                        <IndianRupee className="w-3 h-3 mr-1" /> {fee.amount}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs border ${new Date(fee.due_date) < new Date() ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-slate-800 text-slate-300 border-white/10'}`}>
                          {formatDate(fee.due_date)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10">Collect Payment</Button>
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