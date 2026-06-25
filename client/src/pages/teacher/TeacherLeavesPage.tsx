import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, CalendarOff, Plus, CheckCircle2, XCircle, Clock, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Leave = {
  id: string; leave_type: string; start_date: string; end_date: string;
  reason: string; status: string; created_at: string;
};

export function TeacherLeavesPage() {
  const { tenantId: schoolId } = useTenant();
  const [leaves, setLeaves]         = useState<Leave[]>([]);
  const [loading, setLoading]       = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [cancelId, setCancelId]     = useState<string | null>(null);

  const [leaveType, setLeaveType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate]     = useState("");
  const [reason, setReason]       = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dateError, setDateError] = useState("");

  const supabase = createClient();

  useEffect(() => {
    if (!schoolId) return;
    fetchLeaves(schoolId);
  }, [schoolId]);

  async function fetchLeaves(sId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase.from("leave_applications")
        .select("*").eq("school_id", sId).eq("user_id", user?.id)
        .order("created_at", { ascending: false });
      if (data) setLeaves(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (endDate < startDate) { setDateError("End date cannot be before start date"); return; }
    setDateError("");
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("leave_applications").insert({
        school_id: schoolId!, user_id: user?.id,
        leave_type: leaveType, start_date: startDate, end_date: endDate, reason, status: "pending",
      });
      if (error) throw error;
      setLeaveType(""); setStartDate(""); setEndDate(""); setReason("");
      setIsDialogOpen(false);
      fetchLeaves(schoolId!);
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  async function handleCancel(leaveId: string) {
    try {
      const { error } = await supabase.from("leave_applications")
        .update({ status: "cancelled" }).eq("id", leaveId);
      if (error) throw error;
      setCancelId(null);
      fetchLeaves(schoolId!);
    } catch (err: any) {
      alert(`Failed to cancel: ${err.message}`);
    }
  }

  const statusIcon = (s: string) => {
    if (s === "approved")  return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
    if (s === "rejected")  return <XCircle className="w-5 h-5 text-red-400" />;
    if (s === "cancelled") return <X className="w-5 h-5 text-muted-foreground" />;
    return <Clock className="w-5 h-5 text-amber-400" />;
  };

  const statusColor = (s: string) => {
    if (s === "approved")  return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    if (s === "rejected")  return "text-red-400 bg-red-500/10 border-red-500/20";
    if (s === "cancelled") return "text-muted-foreground bg-slate-500/10 border-slate-500/20";
    return "text-amber-400 bg-amber-500/10 border-amber-500/20";
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Leave Applications</h1>
          <p className="text-sm text-muted-foreground mt-1">Submit and track your leave requests.</p>
        </div>
        <Button type="button" onClick={() => setIsDialogOpen(true)} className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20">
          <Plus className="w-4 h-4 mr-2" /> Apply for Leave
        </Button>
      </div>

      {/* Apply Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>New Leave Request</DialogTitle>
            <DialogDescription className="text-muted-foreground">Your application will be sent to the principal for approval.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleApplyLeave} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Leave Type</Label>
              <Select value={leaveType} onValueChange={setLeaveType} required>
                <SelectTrigger className="bg-background border-border text-foreground"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="casual">Casual Leave</SelectItem>
                  <SelectItem value="sick">Sick Leave</SelectItem>
                  <SelectItem value="maternity">Maternity/Paternity Leave</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From Date</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required className="bg-background border-border text-foreground" />
              </div>
              <div className="space-y-2">
                <Label>To Date</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required className="bg-background border-border text-foreground" />
              </div>
            </div>
            {dateError && <p className="text-xs text-red-400">{dateError}</p>}
            <div className="space-y-2">
              <Label>Reason</Label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} required rows={3} title="Reason" placeholder="Briefly explain your reason..."
                className="w-full flex rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" />
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

      {/* Cancel Confirm Dialog */}
      <Dialog open={!!cancelId} onOpenChange={() => setCancelId(null)}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Cancel Leave Application?</DialogTitle>
            <DialogDescription className="text-muted-foreground">This will mark your application as cancelled.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCancelId(null)} className="border-border text-foreground">Keep it</Button>
            <Button type="button" onClick={() => handleCancel(cancelId!)} className="bg-red-500 hover:bg-red-600 text-white">Yes, Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" /></div>
      ) : leaves.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border shadow-xl">
          <CalendarOff className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-bold text-foreground mb-1">No leave history</h3>
          <p className="text-muted-foreground text-sm">You haven't applied for any leaves yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {leaves.map((leave, idx) => (
              <motion.div key={leave.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}>
                <Card className="bg-card backdrop-blur-xl border-border shadow-xl hover:bg-white/[0.02] transition-colors">
                  <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center border border-border">
                        {statusIcon(leave.status)}
                      </div>
                      <div>
                        <h4 className="text-foreground font-bold capitalize mb-1">{leave.leave_type} Leave</h4>
                        <p className="text-sm text-muted-foreground">{fmt(leave.start_date)} — {fmt(leave.end_date)}</p>
                      </div>
                    </div>
                    <div className="flex-1 w-full sm:w-auto sm:max-w-md mx-4">
                      <p className="text-sm text-muted-foreground line-clamp-2 italic">"{leave.reason}"</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${statusColor(leave.status)}`}>
                        {leave.status}
                      </span>
                      {leave.status === "pending" && (
                        <Button type="button" size="sm" variant="ghost" onClick={() => setCancelId(leave.id)}
                          className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10 h-8 text-xs">
                          <X className="w-3 h-3 mr-1" /> Cancel
                        </Button>
                      )}
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
