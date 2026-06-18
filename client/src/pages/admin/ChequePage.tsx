import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Plus, X, Search, AlertTriangle, CheckCircle, Clock, XCircle, IndianRupee } from "lucide-react";

type Cheque = {
  id: string; student_id: string | null; cheque_number: string; bank_name: string; branch: string;
  amount: number; cheque_date: string; deposit_date: string | null; status: string;
  bounce_reason: string; remarks: string; created_at: string;
  student_name?: string;
};
type Student = { id: string; name: string; class_name?: string };

const STATUS_OPTIONS = ["pending", "deposited", "cleared", "bounced"];
const STATUS_BADGE: Record<string, string> = { pending: "badge-yellow", deposited: "badge-blue", cleared: "badge-green", bounced: "badge-red" };
const STATUS_ICON: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3 h-3" />,
  deposited: <IndianRupee className="w-3 h-3" />,
  cleared: <CheckCircle className="w-3 h-3" />,
  bounced: <XCircle className="w-3 h-3" />,
};

const EMPTY = { student_id: "", cheque_number: "", bank_name: "", branch: "", amount: "", cheque_date: "", deposit_date: "", status: "pending", bounce_reason: "", remarks: "" };

export function ChequePage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  async function fetchData() {
    const [cRes, sRes] = await Promise.all([
      supabase.from("cheque_payments").select("*").eq("school_id", schoolId).order("cheque_date", { ascending: false }),
      supabase.from("students").select("id, name, class_id").eq("school_id", schoolId).order("name"),
    ]);
    const classes = await supabase.from("classes").select("id, name").eq("school_id", schoolId);
    const cm = Object.fromEntries((classes.data || []).map((c: { id: string; name: string }) => [c.id, c.name]));
    const stuList: Student[] = (sRes.data || []).map((s: { id: string; name: string; class_id: string }) => ({ id: s.id, name: s.name, class_name: cm[s.class_id] || "" }));
    setStudents(stuList);
    const stuMap = Object.fromEntries(stuList.map(s => [s.id, s.name]));
    setCheques((cRes.data || []).map((c: Cheque) => ({ ...c, student_name: c.student_id ? stuMap[c.student_id] || "—" : "—" })));
  }

  useEffect(() => { if (schoolId) fetchData(); }, [schoolId]);

  async function handleSave() {
    if (!form.cheque_number || !form.bank_name || !form.amount || !form.cheque_date) return;
    setSaving(true);
    const payload = { ...form, school_id: schoolId, amount: Number(form.amount), student_id: form.student_id || null, deposit_date: form.deposit_date || null };
    if (editId) {
      await supabase.from("cheque_payments").update(payload).eq("id", editId);
    } else {
      await supabase.from("cheque_payments").insert(payload);
    }
    setSaving(false);
    setShowForm(false);
    setEditId(null);
    setForm({ ...EMPTY });
    fetchData();
  }

  function openEdit(c: Cheque) {
    setEditId(c.id);
    setForm({ student_id: c.student_id || "", cheque_number: c.cheque_number, bank_name: c.bank_name, branch: c.branch || "", amount: String(c.amount), cheque_date: c.cheque_date, deposit_date: c.deposit_date || "", status: c.status, bounce_reason: c.bounce_reason || "", remarks: c.remarks || "" });
    setShowForm(true);
  }

  async function quickStatus(id: string, status: string) {
    await supabase.from("cheque_payments").update({ status, ...(status === "deposited" ? { deposit_date: new Date().toISOString().slice(0, 10) } : {}) }).eq("id", id);
    fetchData();
  }

  const filtered = cheques.filter(c => {
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    const matchSearch = !search || c.cheque_number.toLowerCase().includes(search.toLowerCase()) || c.student_name?.toLowerCase().includes(search.toLowerCase()) || c.bank_name.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const total = filtered.reduce((s, c) => s + c.amount, 0);
  const bounced = cheques.filter(c => c.status === "bounced");
  const pending = cheques.filter(c => c.status === "pending");

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Cheque Management</h1>
          <p>Track fee payments by cheque — deposit status, bounced cheque alerts</p>
        </div>
        <button type="button" onClick={() => { setEditId(null); setForm({ ...EMPTY }); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" /> Add Cheque
        </button>
      </div>

      {/* Bounced alert */}
      {bounced.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800">{bounced.length} Bounced Cheque{bounced.length > 1 ? "s" : ""}!</p>
            <p className="text-sm text-red-700 mt-0.5">{bounced.map(c => `${c.student_name} — ₹${c.amount.toLocaleString("en-IN")} (${c.cheque_number})`).join(" · ")}</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-blue">
          <p className="text-xs text-muted-foreground">Total Cheques</p>
          <p className="text-2xl font-bold">{cheques.length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-yellow">
          <p className="text-xs text-muted-foreground">Pending Deposit</p>
          <p className="text-2xl font-bold">{pending.length}</p>
          <p className="text-xs text-muted-foreground">₹{pending.reduce((s, c) => s + c.amount, 0).toLocaleString("en-IN")}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-green">
          <p className="text-xs text-muted-foreground">Cleared</p>
          <p className="text-2xl font-bold">{cheques.filter(c => c.status === "cleared").length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-red">
          <p className="text-xs text-muted-foreground">Bounced</p>
          <p className="text-2xl font-bold">{bounced.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search cheque no., student, bank…"
            className="pl-9 pr-4 py-2 border border-border rounded-lg text-sm bg-background w-64" />
        </div>
        <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
          {["all", ...STATUS_OPTIONS].map(s => (
            <button key={s} type="button" onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${statusFilter === s ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {s === "all" ? `All (${cheques.length})` : `${s} (${cheques.filter(c => c.status === s).length})`}
            </button>
          ))}
        </div>
        <span className="text-sm text-muted-foreground ml-auto">Total: ₹{total.toLocaleString("en-IN")}</span>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <table className="w-full edu-table">
          <thead><tr><th>Cheque No.</th><th>Student</th><th>Bank / Branch</th><th>Amount</th><th>Cheque Date</th><th>Deposit Date</th><th>Status</th><th>Bounce Reason</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">No cheque entries found.</td></tr>}
            {filtered.map(c => (
              <tr key={c.id} className={c.status === "bounced" ? "bg-red-50/30" : ""}>
                <td className="font-mono font-semibold text-sm">{c.cheque_number}</td>
                <td className="font-medium">{c.student_name}</td>
                <td>
                  <div className="text-sm">{c.bank_name}</div>
                  {c.branch && <div className="text-xs text-muted-foreground">{c.branch}</div>}
                </td>
                <td className="font-semibold">₹{c.amount.toLocaleString("en-IN")}</td>
                <td className="text-sm">{c.cheque_date ? new Date(c.cheque_date).toLocaleDateString("en-IN") : "—"}</td>
                <td className="text-sm">{c.deposit_date ? new Date(c.deposit_date).toLocaleDateString("en-IN") : "—"}</td>
                <td>
                  <span className={`${STATUS_BADGE[c.status] || "badge-gray"} flex items-center gap-1 w-fit capitalize`}>
                    {STATUS_ICON[c.status]} {c.status}
                  </span>
                </td>
                <td className="text-sm text-red-600">{c.bounce_reason || "—"}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {c.status === "pending" && (
                      <button type="button" onClick={() => quickStatus(c.id, "deposited")} className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded hover:bg-blue-700">Deposit</button>
                    )}
                    {c.status === "deposited" && (
                      <>
                        <button type="button" onClick={() => quickStatus(c.id, "cleared")} className="text-xs bg-green-600 text-white px-2 py-0.5 rounded hover:bg-green-700">Clear</button>
                        <button type="button" onClick={() => openEdit(c)} className="text-xs border border-red-300 text-red-600 px-2 py-0.5 rounded hover:bg-red-50">Bounce</button>
                      </>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">{editId ? "Edit Cheque" : "Add Cheque Entry"}</h2>
              <button type="button" title="Close" onClick={() => { setShowForm(false); setEditId(null); }}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div><label className="text-xs text-muted-foreground block mb-1">Student (optional)</label>
                <select title="Student" value={form.student_id} onChange={e => f("student_id", e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                  <option value="">— Select Student —</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name} {s.class_name ? `(${s.class_name})` : ""}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Cheque Number *</label>
                  <input value={form.cheque_number} onChange={e => f("cheque_number", e.target.value)} placeholder="123456"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background font-mono" /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Amount (₹) *</label>
                  <input type="number" value={form.amount} onChange={e => f("amount", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Bank Name *</label>
                  <input value={form.bank_name} onChange={e => f("bank_name", e.target.value)} placeholder="SBI / HDFC / PNB…"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Branch</label>
                  <input value={form.branch} onChange={e => f("branch", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Cheque Date *</label>
                  <input type="date" value={form.cheque_date} onChange={e => f("cheque_date", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Deposit Date</label>
                  <input type="date" value={form.deposit_date} onChange={e => f("deposit_date", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              </div>
              <div><label className="text-xs text-muted-foreground block mb-1">Status</label>
                <select title="Status" value={form.status} onChange={e => f("status", e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                  {STATUS_OPTIONS.map(s => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              {form.status === "bounced" && (
                <div><label className="text-xs text-muted-foreground block mb-1">Bounce Reason</label>
                  <input value={form.bounce_reason} onChange={e => f("bounce_reason", e.target.value)} placeholder="Insufficient funds / Account closed…"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              )}
              <div><label className="text-xs text-muted-foreground block mb-1">Remarks</label>
                <textarea value={form.remarks} onChange={e => f("remarks", e.target.value)} rows={2}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none" /></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} className="flex-1 py-2.5 border border-border rounded-lg text-sm">Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving || !form.cheque_number || !form.bank_name || !form.amount || !form.cheque_date}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {saving ? "Saving…" : editId ? "Update" : "Add Cheque"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
