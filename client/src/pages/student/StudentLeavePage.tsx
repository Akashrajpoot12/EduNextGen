// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CalendarOff, CheckCircle2, XCircle, Clock, Plus, X } from "lucide-react";

const LEAVE_TYPES = ["Sick Leave", "Family Emergency", "Personal", "Medical Appointment", "Other"];

export function StudentLeavePage() {
  const params = useParams();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [student, setStudent] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ from_date: "", to_date: "", leave_type: "Sick Leave", reason: "" });
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: studentRec } = await supabase
        .from("students")
        .select("id, school_id, class_id, first_name, last_name")
        .eq("user_id", user.id)
        .maybeSingle();

      setStudent({ ...studentRec, user_id: user.id });

      if (studentRec) {
        const { data } = await supabase
          .from("leave_requests")
          .select("id, from_date, to_date, leave_type, reason, status, created_at")
          .eq("student_id", studentRec.id)
          .order("created_at", { ascending: false });
        setLeaves(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!student) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const { error } = await supabase.from("leave_requests").insert({
        student_id: student.id,
        school_id: student.school_id,
        class_id: student.class_id,
        from_date: form.from_date,
        to_date: form.to_date || form.from_date,
        leave_type: form.leave_type,
        reason: form.reason,
        status: "pending",
      });
      if (error) throw error;
      setMsg({ type: "success", text: "Leave request submitted successfully!" });
      setForm({ from_date: "", to_date: "", leave_type: "Sick Leave", reason: "" });
      setShowForm(false);
      fetchData();
    } catch (e: any) {
      setMsg({ type: "error", text: e.message || "Failed to submit leave request." });
    } finally {
      setSubmitting(false);
    }
  }

  const statusStyle = (s: string) => {
    if (s === "approved") return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    if (s === "rejected") return "text-red-400 bg-red-500/10 border-red-500/20";
    return "text-amber-400 bg-amber-500/10 border-amber-500/20";
  };

  const StatusIcon = ({ s }: { s: string }) => {
    if (s === "approved") return <CheckCircle2 className="w-3.5 h-3.5" />;
    if (s === "rejected") return <XCircle className="w-3.5 h-3.5" />;
    return <Clock className="w-3.5 h-3.5" />;
  };

  const dayCount = (from: string, to: string) => {
    const d1 = new Date(from), d2 = new Date(to || from);
    return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Leave Requests</h1>
          <p className="text-sm text-muted-foreground mt-1">Apply for leave and track approvals.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/20">
          {showForm ? <><X className="w-4 h-4 mr-2" /> Cancel</> : <><Plus className="w-4 h-4 mr-2" /> Apply Leave</>}
        </Button>
      </div>

      {msg && (
        <div className={`p-4 rounded-xl text-sm border ${msg.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
          {msg.text}
        </div>
      )}

      {/* Apply form */}
      {showForm && (
        <Card className="bg-card border-purple-500/30 shadow-xl shadow-purple-500/5">
          <CardHeader><CardTitle className="text-foreground text-lg">New Leave Application</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground/80">From Date *</Label>
                <Input type="date" required value={form.from_date} onChange={e => setForm(f => ({ ...f, from_date: e.target.value }))}
                  min={new Date().toISOString().slice(0, 10)}
                  className="bg-muted border-border text-foreground" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground/80">To Date</Label>
                <Input type="date" value={form.to_date} onChange={e => setForm(f => ({ ...f, to_date: e.target.value }))}
                  min={form.from_date || new Date().toISOString().slice(0, 10)}
                  className="bg-muted border-border text-foreground" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground/80">Leave Type *</Label>
                <select required value={form.leave_type} onChange={e => setForm(f => ({ ...f, leave_type: e.target.value }))}
                  className="w-full rounded-md bg-muted border border-border text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50">
                  {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-foreground/80">Reason *</Label>
                <textarea required value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  rows={3} placeholder="Brief reason for leave..."
                  className="w-full rounded-md bg-muted border border-border text-foreground px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" disabled={submitting} className="bg-purple-600 hover:bg-purple-700 text-white">
                  {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</> : "Submit Application"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Leave history */}
      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-purple-500/50" /></div>
      ) : leaves.length === 0 ? (
        <Card className="bg-gradient-to-br from-fuchsia-500/10 via-purple-500/5 to-orange-500/10 rounded-2xl border border-fuchsia-500/20 shadow-xl">
          <CardContent className="p-12 text-center">
            <CalendarOff className="w-12 h-12 text-fuchsia-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-foreground mb-1">No leave requests yet</h3>
            <p className="text-muted-foreground text-sm">Click "Apply Leave" above to submit your first request.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {leaves.map(leave => (
            <Card key={leave.id} className="bg-card border-border shadow-xl hover:bg-muted/30 transition-all">
              <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold uppercase text-purple-400">{leave.leave_type}</span>
                    <span className="text-muted-foreground/60">·</span>
                    <span className="text-xs text-muted-foreground">{dayCount(leave.from_date, leave.to_date)} day{dayCount(leave.from_date, leave.to_date) > 1 ? "s" : ""}</span>
                  </div>
                  <p className="text-foreground text-sm font-medium">{leave.reason}</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    {new Date(leave.from_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    {leave.to_date && leave.to_date !== leave.from_date ? ` → ${new Date(leave.to_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}` : ""}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${statusStyle(leave.status)}`}>
                  <StatusIcon s={leave.status} />
                  {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
