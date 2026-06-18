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
import { motion, AnimatePresence } from "framer-motion";

export function LeavesPage() {
  const { tenantId: schoolId } = useTenant();
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
      const { data } = await supabase
        .from('leave_applications')
        .select(`
          id, leave_type, start_date, end_date, reason, status, created_at,
          users:user_id(full_name, email)
        `)
        .eq('school_id', sId)
        .order('created_at', { ascending: false });

      if (data) setLeaves(data);
    } catch (error) {
      console.error("Error fetching leaves:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('leave_applications')
        .update({ status, reviewed_by: user?.id })
        .eq('id', id);

      if (error) throw error;
      
      fetchLeaves(schoolId);
    } catch (error: any) {
      console.error("Error updating status:", error);
      alert("Failed to update status: " + error.message);
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
          <h1 className="text-3xl font-bold tracking-tight text-white">Leave Management</h1>
          <p className="text-sm text-slate-400 mt-1">Review and approve leave applications from staff and teachers.</p>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input placeholder="Search applications..." className="pl-9 bg-slate-900/50 border-white/10 text-white" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" />
        </div>
      ) : leaves.length === 0 ? (
        <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-white/5">
              <CalendarOff className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No leave applications</h3>
            <p className="text-slate-400 mb-6 max-w-sm">You're all caught up. There are no pending leave requests.</p>
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
                <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl hover:border-amber-500/30 transition-all group overflow-hidden flex flex-col h-full relative">
                  <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-${leave.status === 'approved' ? 'emerald' : leave.status === 'rejected' ? 'red' : 'amber'}-500/10 to-transparent rounded-bl-full`} />
                  <CardContent className="p-6 relative z-10 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-white mb-1">{leave.users?.full_name || 'Unknown User'}</h3>
                        <p className="text-xs text-slate-400">{leave.users?.email}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold border ${getStatusColor(leave.status)}`}>
                        {leave.status}
                      </span>
                    </div>
                    
                    <div className="bg-slate-950/50 rounded-lg p-3 border border-white/5 mb-4">
                      <p className="text-xs text-slate-500 mb-1 uppercase font-bold tracking-wider">Leave Period</p>
                      <p className="text-sm text-slate-300 font-medium">
                        {formatDate(leave.start_date)} - {formatDate(leave.end_date)}
                      </p>
                      <p className="text-xs text-amber-400 mt-1 capitalize">{leave.leave_type}</p>
                    </div>

                    <p className="text-sm text-slate-400 mb-6 line-clamp-3 italic flex-grow">"{leave.reason}"</p>
                    
                    {leave.status.toLowerCase() === 'pending' && (
                      <div className="grid grid-cols-2 gap-2 mt-auto pt-4 border-t border-white/5">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleUpdateStatus(leave.id, 'rejected')}
                          className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                        >
                          <XCircle className="w-4 h-4 mr-1" /> Reject
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleUpdateStatus(leave.id, 'approved')}
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
