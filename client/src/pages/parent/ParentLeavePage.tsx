import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { CalendarOff, Users, Plus, X } from "lucide-react";
import { toast } from "sonner";

const LEAVE_TYPES = ["Sick Leave", "Family Emergency", "Personal", "Festival", "Other"];

const statusColor: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600",
  approved: "bg-emerald-500/10 text-emerald-600",
  rejected: "bg-red-500/10 text-red-600",
};

export function ParentLeavePage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();
  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [leaves, setLeaves] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ from_date: "", to_date: "", leave_type: "Sick Leave", reason: "" });

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: kids } = await supabase
        .from("students")
        .select("id, user_id, users:user_id(full_name), classes:class_id(grade_level, section)")
        .eq("school_id", schoolId)
        .eq("parent_user_id", user.id);
      if (kids && kids.length > 0) {
        setChildren(kids);
        setSelectedChildId(kids[0].id);
      }
      setLoading(false);
    })();
  }, [schoolId]);

  useEffect(() => {
    if (!selectedChildId) return;
    loadLeaves();
  }, [selectedChildId]);

  async function loadLeaves() {
    const { data } = await supabase
      .from("leave_requests")
      .select("id, from_date, to_date, leave_type, reason, status, created_at")
      .eq("student_id", selectedChildId)
      .order("created_at", { ascending: false });
    setLeaves(data || []);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedChildId) return;
    setSubmitting(true);
    const { error } = await supabase.from("leave_requests").insert({
      student_id: selectedChildId,
      school_id: schoolId,
      from_date: form.from_date,
      to_date: form.to_date,
      leave_type: form.leave_type,
      reason: form.reason,
      status: "pending",
    });
    setSubmitting(false);
    if (error) { toast.error("Failed to submit leave request"); return; }
    toast.success("Leave request submitted!");
    setShowForm(false);
    setForm({ from_date: "", to_date: "", leave_type: "Sick Leave", reason: "" });
    loadLeaves();
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const dayCount = (from: string, to: string) => {
    const diff = new Date(to).getTime() - new Date(from).getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  };

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (children.length === 0) return (
    <div className="text-center py-16 bg-card border border-border rounded-xl">
      <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
      <p className="font-medium">No children linked to your account</p>
    </div>
  );

  const selectedChild = children.find(c => c.id === selectedChildId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leave Requests</h1>
          <p className="text-sm text-muted-foreground mt-1">Apply and track leave for your child</p>
        </div>
        <button type="button" onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "Cancel" : "Apply Leave"}
        </button>
      </div>

      {children.length > 1 && (
        <select value={selectedChildId} onChange={e => setSelectedChildId(e.target.value)}
          className="h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
          {children.map(c => (
            <option key={c.id} value={c.id}>
              {(c.users as any)?.full_name} — Class {(c.classes as any)?.grade_level}-{(c.classes as any)?.section}
            </option>
          ))}
        </select>
      )}

      {selectedChild && (
        <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center font-bold text-amber-600">
            {((selectedChild.users as any)?.full_name || "?")[0]}
          </div>
          <p className="font-semibold">{(selectedChild.users as any)?.full_name}</p>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <CalendarOff className="w-4 h-4 text-amber-500" /> New Leave Application
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">From Date</label>
              <input type="date" required value={form.from_date}
                onChange={e => setForm(f => ({ ...f, from_date: e.target.value }))}
                className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">To Date</label>
              <input type="date" required value={form.to_date}
                onChange={e => setForm(f => ({ ...f, to_date: e.target.value }))}
                className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1">Leave Type</label>
            <select value={form.leave_type} onChange={e => setForm(f => ({ ...f, leave_type: e.target.value }))}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
              {LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1">Reason</label>
            <textarea required value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              rows={3} placeholder="Briefly explain the reason for leave..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none" />
          </div>
          <button type="submit" disabled={submitting}
            className="w-full h-10 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
            {submitting ? "Submitting..." : "Submit Leave Request"}
          </button>
        </form>
      )}

      <div className="space-y-3">
        <h3 className="font-semibold">Leave History</h3>
        {leaves.length === 0 ? (
          <div className="text-center py-12 bg-card border border-border rounded-xl">
            <CalendarOff className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground">No leave requests yet</p>
          </div>
        ) : (
          leaves.map(l => (
            <div key={l.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-semibold text-sm">{l.leave_type}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {fmtDate(l.from_date)} – {fmtDate(l.to_date)}
                    {l.from_date && l.to_date && ` (${dayCount(l.from_date, l.to_date)} days)`}
                  </span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${statusColor[l.status] || "bg-muted text-muted-foreground"}`}>
                  {l.status}
                </span>
              </div>
              {l.reason && <p className="text-sm text-muted-foreground">{l.reason}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
