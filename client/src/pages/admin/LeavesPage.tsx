// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, CalendarOff, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export function LeavesPage() {
  const { tenantId: schoolId } = useTenant();
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    if (schoolId) fetchLeaves();
  }, [schoolId]);

  async function fetchLeaves() {
    setLoading(true);
    try {
      // Staff/teacher leaves AND student/parent leaves come from two tables — merge both.
      const [staffRes, studentRes] = await Promise.all([
        supabase.from('leave_applications')
          .select(`id, leave_type, start_date, end_date, reason, status, created_at, users:user_id(full_name, email)`)
          .eq('school_id', schoolId).order('created_at', { ascending: false }),
        supabase.from('leave_requests')
          .select(`id, leave_type, from_date, to_date, reason, status, created_at, students:student_id(name)`)
          .eq('school_id', schoolId).order('created_at', { ascending: false }),
      ]);

      const staff = (staffRes.data || []).map((l: any) => ({
        id: l.id, kind: 'staff', name: l.users?.full_name || 'Unknown', email: l.users?.email || '',
        leave_type: l.leave_type, start_date: l.start_date, end_date: l.end_date,
        reason: l.reason, status: l.status, created_at: l.created_at,
      }));
      const students = (studentRes.data || []).map((l: any) => ({
        id: l.id, kind: 'student', name: l.students?.name || 'Student', email: 'Student / Parent',
        leave_type: l.leave_type, start_date: l.from_date, end_date: l.to_date,
        reason: l.reason, status: l.status, created_at: l.created_at,
      }));
      setLeaves([...staff, ...students].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')));
    } catch (error) {
      console.error("Error fetching leaves:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleUpdateStatus = async (id: string, status: string, kind: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const leave = leaves.find(l => l.id === id);
      const table = kind === 'student' ? 'leave_requests' : 'leave_applications';

      const { error } = await supabase
        .from(table)
        .update({ status, reviewed_by: user?.id })
        .eq('id', id);

      if (error) throw error;

      toast.success(`Leave ${status}`);

      // Notify the applicant's group via announcements
      if (leave) {
        const emoji = status === "approved" ? "✅" : "❌";
        await supabase.from("announcements").insert({
          school_id: schoolId,
          title: `${emoji} Leave ${status.charAt(0).toUpperCase() + status.slice(1)}: ${leave.leave_type}`,
          content: `A leave request from ${leave.start_date} to ${leave.end_date} has been ${status} by the administration.`,
          target_audience: kind === 'student' ? "students" : "teachers",
          notice_type: "announcement",
          priority: status === "approved" ? "normal" : "high",
        });
      }

      fetchLeaves();
    } catch (error: any) {
      toast.error("Failed to update status: " + error.message);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status.toLowerCase()) {
      case 'approved': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'rejected': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
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
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Leave Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Review and approve leave applications from staff, teachers, students and parents.</p>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search applications..." className="pl-9 bg-card border-border text-foreground" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" />
        </div>
      ) : leaves.length === 0 ? (
        <Card className="bg-card backdrop-blur-xl border-border shadow-xl">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 border border-border">
              <CalendarOff className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">No leave applications</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">You're all caught up. There are no pending leave requests.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {leaves.map((leave, idx) => (
              <motion.div
                key={leave.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="bg-card backdrop-blur-xl border-border shadow-xl hover:border-amber-500/30 transition-all group overflow-hidden flex flex-col h-full relative">
                  <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-${leave.status === 'approved' ? 'emerald' : leave.status === 'rejected' ? 'red' : 'amber'}-500/10 to-transparent rounded-bl-full`} />
                  <CardContent className="p-6 relative z-10 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-foreground mb-1">{leave.name}</h3>
                        <p className="text-xs text-muted-foreground">{leave.email}</p>
                        <span className={`inline-block mt-1 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${leave.kind === 'student' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                          {leave.kind === 'student' ? 'Student' : 'Staff'}
                        </span>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold border ${getStatusColor(leave.status)}`}>
                        {leave.status}
                      </span>
                    </div>
                    
                    <div className="bg-muted rounded-lg p-3 border border-border mb-4">
                      <p className="text-xs text-muted-foreground mb-1 uppercase font-bold tracking-wider">Leave Period</p>
                      <p className="text-sm text-muted-foreground font-medium">
                        {formatDate(leave.start_date)} - {formatDate(leave.end_date)}
                      </p>
                      <p className="text-xs text-amber-400 mt-1 capitalize">{leave.leave_type}</p>
                    </div>

                    <p className="text-sm text-muted-foreground mb-6 line-clamp-3 italic flex-grow">"{leave.reason}"</p>
                    
                    {leave.status.toLowerCase() === 'pending' && (
                      <div className="grid grid-cols-2 gap-2 mt-auto pt-4 border-t border-border">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleUpdateStatus(leave.id, 'rejected', leave.kind)}
                          className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                        >
                          <XCircle className="w-4 h-4 mr-1" /> Reject
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleUpdateStatus(leave.id, 'approved', leave.kind)}
                          className="w-full border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                        </Button>
                      </div>
                    )}
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
