"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, UserPlus, CheckCircle2, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AdmissionsPage() {
  const params = useParams();
  const tenant = params.tenant as string;
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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

      fetchRequests(school.id);
    } catch (error) {
      console.error("Error fetching initial data:", error);
      setLoading(false);
    }
  }

  async function fetchRequests(sId: string) {
    try {
      const { data } = await supabase
        .from('registration_requests')
        .select('*')
        .eq('school_id', sId)
        .order('created_at', { ascending: false });

      if (data) setRequests(data);
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('registration_requests')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      
      fetchRequests(schoolId);
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
          <h1 className="text-3xl font-bold tracking-tight text-white">Admissions & Inquiries</h1>
          <p className="text-sm text-slate-400 mt-1">Manage new student registration requests and inquiries.</p>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input placeholder="Search applicant name..." className="pl-9 bg-slate-900/50 border-white/10 text-white" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" />
        </div>
      ) : requests.length === 0 ? (
        <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-white/5">
              <UserPlus className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No new admission requests</h3>
            <p className="text-slate-400 mb-6 max-w-sm">When parents submit the online registration form, they will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {requests.map((req, idx) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl hover:border-amber-500/30 transition-all group overflow-hidden flex flex-col h-full relative">
                  <CardContent className="p-6 relative z-10 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-white mb-1">{req.student_name}</h3>
                        <p className="text-xs text-slate-400">Class: {req.grade_level}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold border ${getStatusColor(req.status)}`}>
                        {req.status}
                      </span>
                    </div>
                    
                    <div className="space-y-2 mb-6">
                      <div className="flex items-center text-sm text-slate-300">
                        <span className="text-slate-500 w-24">Parent Name:</span>
                        {req.parent_name}
                      </div>
                      <div className="flex items-center text-sm text-slate-300">
                        <span className="text-slate-500 w-24">Email:</span>
                        {req.parent_email}
                      </div>
                      <div className="flex items-center text-sm text-slate-300">
                        <span className="text-slate-500 w-24">Phone:</span>
                        {req.parent_phone}
                      </div>
                      <div className="flex items-center text-sm text-slate-300">
                        <span className="text-slate-500 w-24">Applied On:</span>
                        {formatDate(req.created_at)}
                      </div>
                    </div>
                    
                    {req.status.toLowerCase() === 'pending' && (
                      <div className="grid grid-cols-2 gap-2 mt-auto pt-4 border-t border-white/5">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleUpdateStatus(req.id, 'rejected')}
                          className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                        >
                          <XCircle className="w-4 h-4 mr-1" /> Reject
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleUpdateStatus(req.id, 'approved')}
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