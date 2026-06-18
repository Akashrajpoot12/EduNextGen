// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, CalendarOff, Plus, CheckCircle2, XCircle, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function TeacherLeavesPage() {
  const params = useParams();
  const tenant = params.tenantId as string;
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [schoolId, setSchoolId] = useState("");
  
  // Form State
  const [leaveType, setLeaveType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
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

      fetchLeaves(school.id);
    } catch (error) {
      console.error("Error fetching initial data:", error);
      setLoading(false);
    }
  }

  async function fetchLeaves(sId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data } = await supabase
        .from('leave_applications')
        .select('*')
        .eq('school_id', sId)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (data) setLeaves(data);
    } catch (error) {
      console.error("Error fetching leaves:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from('leave_applications').insert({
        school_id: schoolId,
        user_id: user?.id,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason,
        status: 'pending'
      });

      if (error) throw error;
      
      setLeaveType("");
      setStartDate("");
      setEndDate("");
      setReason("");
      setIsDialogOpen(false);
      fetchLeaves(schoolId);
      
    } catch (error: any) {
      console.error("Error applying for leave:", error);
      alert(`Failed to apply: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === 'approved') return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
    if (status === 'rejected') return <XCircle className="w-5 h-5 text-red-400" />;
    return <Clock className="w-5 h-5 text-amber-400" />;
  };

  const getStatusColor = (status: string) => {
    if (status === 'approved') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (status === 'rejected') return 'text-red-400 bg-red-500/10 border-red-500/20';
    return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
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
          <h1 className="text-3xl font-bold tracking-tight text-white">Leave Applications</h1>
          <p className="text-sm text-slate-400 mt-1">Submit and track your leave requests.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" />}>
            <Plus className="w-4 h-4 mr-2" /> Apply for Leave
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-white/10 text-white sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>New Leave Request</DialogTitle>
              <DialogDescription className="text-slate-400">
                Your application will be sent to the principal for approval.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleApplyLeave} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="type">Leave Type</Label>
                <Select value={leaveType} onValueChange={setLeaveType} required>
                  <SelectTrigger className="bg-slate-950 border-white/10 text-white">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10 text-white">
                    <SelectItem value="casual">Casual Leave</SelectItem>
                    <SelectItem value="sick">Sick Leave</SelectItem>
                    <SelectItem value="maternity">Maternity/Paternity Leave</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">From Date</Label>
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
                  <Label htmlFor="endDate">To Date</Label>
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
              <div className="space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <textarea 
                  id="reason" 
                  value={reason} 
                  onChange={(e) => setReason(e.target.value)} 
                  required 
                  rows={3}
                  className="w-full flex rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                />
              </div>
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={isSubmitting} className="bg-emerald-500 hover:bg-emerald-600 text-white w-full">
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CalendarOff className="w-4 h-4 mr-2" />}
                  Submit Application
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" />
        </div>
      ) : leaves.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/50 rounded-xl border border-white/10 shadow-xl">
          <CalendarOff className="w-12 h-12 text-slate-500 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-bold text-white mb-1">No leave history</h3>
          <p className="text-slate-400 text-sm">You haven't applied for any leaves yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {leaves.map((leave, idx) => (
              <motion.div
                key={leave.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl hover:bg-white/[0.02] transition-colors">
                  <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center border border-white/5">
                        {getStatusIcon(leave.status)}
                      </div>
                      <div>
                        <h4 className="text-white font-bold capitalize mb-1">{leave.leave_type} Leave</h4>
                        <p className="text-sm text-slate-400">{formatDate(leave.start_date)} — {formatDate(leave.end_date)}</p>
                      </div>
                    </div>
                    
                    <div className="flex-1 w-full sm:w-auto sm:max-w-md mx-4">
                      <p className="text-sm text-slate-300 line-clamp-2 italic">"{leave.reason}"</p>
                    </div>

                    <div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${getStatusColor(leave.status)}`}>
                        {leave.status}
                      </span>
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
