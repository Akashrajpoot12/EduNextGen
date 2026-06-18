import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Plus, X, Search, AlertCircle, CheckCircle, Clock, Printer } from "lucide-react";

type Student = { id: string; name: string; class_name?: string };
type Complaint = {
  id: string; complaint_number: string; complainant_name: string; complainant_type: string;
  complainant_phone: string; student_id: string | null; complaint_type: string; description: string;
  priority: string; status: string; assigned_to: string; resolution_note: string;
  received_date: string; resolved_date: string | null;
  student_name?: string;
};

const COMPLAINT_TYPES = ["Fee related", "Teacher behaviour", "Bullying / Harassment", "Infrastructure", "Food / Canteen", "Transport", "Academic performance", "Admission / TC", "Staff behaviour", "Other"];
const PRIORITY_COLOR: Record<string, string> = { low: "badge-green", medium: "badge-yellow", high: "badge-red" };
const STATUS_COLOR: Record<string, string>   = { pending: "badge-yellow", in_progress: "badge-blue", resolved: "badge-green", closed: "badge-gray" };

function zeroPad(n: number) { return String(n).padStart(4, "0"); }

const EMPTY = { complainant_name: "", complainant_type: "parent", complainant_phone: "", student_id: "", complaint_type: COMPLAINT_TYPES[0], description: "", priority: "medium", status: "pending", assigned_to: "", resolution_note: "", received_date: new Date().toISOString().slice(0, 10), resolved_date: "" };

export function ComplaintPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [students, setStudents]     = useState<Student[]>([]);
  const [showForm, setShowForm]     = useState(false);
  const [selected, setSelected]     = useState<Complaint | null>(null);
  const [form, setForm]             = useState({ ...EMPTY });
  const [saving, setSaving]         = useState(false);
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [nextNum, setNextNum]       = useState(1);

  async function fetchData() {
    const [cRes, sRes] = await Promise.all([
      supabase.from("complaints").select("*").eq("school_id", schoolId).order("received_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("students").select("id, name, class_id").eq("school_id", schoolId).order("name"),
    ]);
    const classes = await supabase.from("classes").select("id, name").eq("school_id", schoolId);
    const cm = Object.fromEntries((classes.data || []).map((c: { id: string; name: string }) => [c.id, c.name]));
    const stuList: Student[] = (sRes.data || []).map((s: { id: string; name: string; class_id: string }) => ({ id: s.id, name: s.name, class_name: cm[s.class_id] }));
    setStudents(stuList);
    const sm = Object.fromEntries(stuList.map(s => [s.id, s.name]));
    setComplaints((cRes.data || []).map((c: Complaint) => ({ ...c, student_name: c.student_id ? sm[c.student_id] : undefined })));
    setNextNum((cRes.data?.length || 0) + 1);
  }

  useEffect(() => { if (schoolId) fetchData(); }, [schoolId]);

  async function handleSave() {
    if (!form.complainant_name || !form.description) return;
    setSaving(true);
    const complaint_number = `CMP/${new Date().getFullYear()}/${zeroPad(nextNum)}`;
    const payload = { ...form, school_id: schoolId, complaint_number, student_id: form.student_id || null, resolved_date: form.resolved_date || null };
    if (selected) {
      await supabase.from("complaints").update(payload).eq("id", selected.id);
    } else {
      await supabase.from("complaints").insert(payload);
    }
    setSaving(false);
    setShowForm(false);
    setSelected(null);
    setForm({ ...EMPTY });
    fetchData();
  }

  function openEdit(c: Complaint) {
    setSelected(c);
    setForm({ complainant_name: c.complainant_name, complainant_type: c.complainant_type, complainant_phone: c.complainant_phone || "", student_id: c.student_id || "", complaint_type: c.complaint_type, description: c.description, priority: c.priority, status: c.status, assigned_to: c.assigned_to || "", resolution_note: c.resolution_note || "", received_date: c.received_date, resolved_date: c.resolved_date || "" });
    setShowForm(true);
  }

  async function quickResolve(id: string) {
    await supabase.from("complaints").update({ status: "resolved", resolved_date: new Date().toISOString().slice(0, 10) }).eq("id", id);
    fetchData();
  }

  const filtered = complaints.filter(c => {
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    const matchSearch = !search || c.complainant_name.toLowerCase().includes(search.toLowerCase()) || c.complaint_number.toLowerCase().includes(search.toLowerCase()) || c.complaint_type.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const pending = complaints.filter(c => c.status === "pending").length;
  const high = complaints.filter(c => c.priority === "high" && c.status !== "resolved" && c.status !== "closed").length;
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Complaint Register</h1>
          <p>Log and track parent/student complaints — assign, resolve, close</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted no-print">
            <Printer className="w-4 h-4" /> Print Register
          </button>
          <button type="button" onClick={() => { setSelected(null); setForm({ ...EMPTY }); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> Log Complaint
          </button>
        </div>
      </div>

      {/* High priority alert */}
      {high > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-5 flex items-center gap-3 no-print">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-800"><strong>{high} high-priority</strong> complaint{high > 1 ? "s" : ""} pending resolution.</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6 no-print">
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-blue">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{complaints.length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-yellow">
          <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-yellow-500" /><p className="text-xs text-muted-foreground">Pending</p></div>
          <p className="text-2xl font-bold">{pending}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-green">
          <div className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-green-500" /><p className="text-xs text-muted-foreground">Resolved</p></div>
          <p className="text-2xl font-bold">{complaints.filter(c => c.status === "resolved").length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-red">
          <div className="flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5 text-red-500" /><p className="text-xs text-muted-foreground">High Priority</p></div>
          <p className="text-2xl font-bold">{complaints.filter(c => c.priority === "high").length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4 no-print">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, number, type…"
            className="pl-9 pr-4 py-2 border border-border rounded-lg text-sm bg-background w-60" />
        </div>
        <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
          {["all", "pending", "in_progress", "resolved", "closed"].map(s => (
            <button key={s} type="button" onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === s ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {s === "all" ? "All" : s === "in_progress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block mb-4">
        <p className="text-xl font-bold text-center">COMPLAINT REGISTER</p>
        <p className="text-sm text-center text-muted-foreground">Printed on {new Date().toLocaleDateString("en-IN")}</p>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <table className="w-full edu-table">
          <thead><tr><th>No.</th><th>Complainant</th><th>Type</th><th>Description</th><th>Student</th><th>Priority</th><th>Assigned To</th><th>Status</th><th>Date</th><th className="no-print"></th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={10} className="text-center py-12 text-muted-foreground">No complaints found.</td></tr>}
            {filtered.map(c => (
              <tr key={c.id} className={c.priority === "high" && c.status === "pending" ? "bg-red-50/20" : ""}>
                <td className="font-mono text-xs">{c.complaint_number}</td>
                <td>
                  <div className="font-medium text-sm">{c.complainant_name}</div>
                  <div className="text-xs text-muted-foreground capitalize">{c.complainant_type} {c.complainant_phone ? `· ${c.complainant_phone}` : ""}</div>
                </td>
                <td className="text-sm">{c.complaint_type}</td>
                <td className="text-sm text-muted-foreground max-w-xs">
                  <div className="truncate" title={c.description}>{c.description}</div>
                  {c.resolution_note && <div className="text-xs text-green-600 truncate">✓ {c.resolution_note}</div>}
                </td>
                <td className="text-sm">{c.student_name || "—"}</td>
                <td><span className={`${PRIORITY_COLOR[c.priority] || "badge-gray"} capitalize`}>{c.priority}</span></td>
                <td className="text-sm text-muted-foreground">{c.assigned_to || "—"}</td>
                <td><span className={`${STATUS_COLOR[c.status] || "badge-gray"} capitalize`}>{c.status.replace("_", " ")}</span></td>
                <td className="text-sm">{c.received_date ? new Date(c.received_date).toLocaleDateString("en-IN") : "—"}</td>
                <td className="no-print">
                  <div className="flex gap-1.5">
                    {c.status === "pending" && (
                      <button type="button" onClick={() => quickResolve(c.id)} className="text-xs bg-green-600 text-white px-2 py-0.5 rounded hover:bg-green-700">Resolve</button>
                    )}
                    <button type="button" onClick={() => openEdit(c)} className="text-xs text-primary hover:underline">Edit</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 no-print">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">{selected ? "Edit Complaint" : "Log New Complaint"}</h2>
              <button type="button" title="Close" onClick={() => { setShowForm(false); setSelected(null); }}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Complainant Name *</label>
                  <input value={form.complainant_name} onChange={e => f("complainant_name", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Type</label>
                  <select title="Type" value={form.complainant_type} onChange={e => f("complainant_type", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                    {["parent", "student", "staff", "other"].map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Phone</label>
                  <input value={form.complainant_phone} onChange={e => f("complainant_phone", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Student (if related)</label>
                  <select title="Student" value={form.student_id} onChange={e => f("student_id", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                    <option value="">— None —</option>
                    {students.map(s => <option key={s.id} value={s.id}>{s.name} {s.class_name ? `(${s.class_name})` : ""}</option>)}
                  </select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Complaint Type *</label>
                  <select title="Complaint type" value={form.complaint_type} onChange={e => f("complaint_type", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                    {COMPLAINT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Priority</label>
                  <select title="Priority" value={form.priority} onChange={e => f("priority", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                    {["low", "medium", "high"].map(p => <option key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                  </select></div>
              </div>
              <div><label className="text-xs text-muted-foreground block mb-1">Description *</label>
                <textarea value={form.description} onChange={e => f("description", e.target.value)} rows={3}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Assigned To</label>
                  <input value={form.assigned_to} onChange={e => f("assigned_to", e.target.value)} placeholder="Staff name / department"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Status</label>
                  <select title="Status" value={form.status} onChange={e => f("status", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                    {["pending", "in_progress", "resolved", "closed"].map(s => <option key={s} value={s}>{s === "in_progress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select></div>
              </div>
              {(form.status === "resolved" || form.status === "closed") && (
                <>
                  <div><label className="text-xs text-muted-foreground block mb-1">Resolution Note</label>
                    <textarea value={form.resolution_note} onChange={e => f("resolution_note", e.target.value)} rows={2} placeholder="How was it resolved?"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none" /></div>
                  <div><label className="text-xs text-muted-foreground block mb-1">Resolved Date</label>
                    <input type="date" value={form.resolved_date} onChange={e => f("resolved_date", e.target.value)}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
                </>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => { setShowForm(false); setSelected(null); }} className="flex-1 py-2.5 border border-border rounded-lg text-sm">Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving || !form.complainant_name || !form.description}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {saving ? "Saving…" : selected ? "Update" : "Log Complaint"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
