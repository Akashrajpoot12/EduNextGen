import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Plus, X, Search, Printer, HeartHandshake, IndianRupee, AlertCircle } from "lucide-react";

type Student = { id: string; name: string; class_name?: string; admission_number?: string };
type Scholarship = {
  id: string; student_id: string; scholarship_name: string; provider: string;
  provider_type: string; amount: number; frequency: string; academic_year: string;
  start_date: string; end_date: string; account_number: string; ifsc_code: string;
  bank_name: string; status: string; documents: string; remarks: string;
  student_name?: string; class_name?: string;
};

const PROVIDER_TYPES = ["government", "private", "ngo", "trust", "other"];
const FREQUENCIES     = ["annual", "monthly", "one-time", "quarterly"];
const STATUS_BADGE: Record<string, string> = { active: "badge-green", expired: "badge-red", pending: "badge-yellow" };

const EMPTY = {
  student_id: "", scholarship_name: "", provider: "", provider_type: "government",
  amount: "", frequency: "annual", academic_year: "2025-26",
  start_date: "", end_date: "", account_number: "", ifsc_code: "", bank_name: "",
  status: "active", documents: "", remarks: "",
};

export function ScholarshipPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [students, setStudents]         = useState<Student[]>([]);
  const [showForm, setShowForm]         = useState(false);
  const [editing, setEditing]           = useState<Scholarship | null>(null);
  const [form, setForm]                 = useState({ ...EMPTY });
  const [saving, setSaving]             = useState(false);
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [yearFilter, setYearFilter]     = useState("all");

  async function fetchData() {
    const [schRes, stuRes] = await Promise.all([
      supabase.from("scholarships").select("*").eq("school_id", schoolId).order("created_at", { ascending: false }),
      supabase.from("students").select("id, name, class_id, admission_number").eq("school_id", schoolId).order("name"),
    ]);
    const classes = await supabase.from("classes").select("id, name").eq("school_id", schoolId);
    const cm = Object.fromEntries((classes.data || []).map((c: { id: string; name: string }) => [c.id, c.name]));
    const stuList: Student[] = (stuRes.data || []).map((s: Student & { class_id: string }) => ({ ...s, class_name: cm[s.class_id] || "" }));
    setStudents(stuList);
    const sm = Object.fromEntries(stuList.map(s => [s.id, s]));
    setScholarships((schRes.data || []).map((s: Scholarship) => ({
      ...s,
      student_name: sm[s.student_id]?.name || "—",
      class_name:   sm[s.student_id]?.class_name || "—",
    })));
  }

  useEffect(() => { if (schoolId) fetchData(); }, [schoolId]);

  async function handleSave() {
    if (!form.student_id || !form.scholarship_name || !form.provider || !form.amount) return;
    setSaving(true);
    const payload = { ...form, school_id: schoolId, amount: Number(form.amount), start_date: form.start_date || null, end_date: form.end_date || null };
    if (editing) {
      await supabase.from("scholarships").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("scholarships").insert(payload);
    }
    setSaving(false);
    setShowForm(false);
    setEditing(null);
    setForm({ ...EMPTY });
    fetchData();
  }

  function openEdit(s: Scholarship) {
    setEditing(s);
    setForm({ student_id: s.student_id, scholarship_name: s.scholarship_name, provider: s.provider, provider_type: s.provider_type, amount: String(s.amount), frequency: s.frequency, academic_year: s.academic_year, start_date: s.start_date || "", end_date: s.end_date || "", account_number: s.account_number || "", ifsc_code: s.ifsc_code || "", bank_name: s.bank_name || "", status: s.status, documents: s.documents || "", remarks: s.remarks || "" });
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this scholarship record?")) return;
    await supabase.from("scholarships").delete().eq("id", id);
    fetchData();
  }

  const years = [...new Set(scholarships.map(s => s.academic_year))].sort((a, b) => b.localeCompare(a));
  const filtered = scholarships.filter(s => {
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    const matchYear   = yearFilter === "all" || s.academic_year === yearFilter;
    const matchSearch = !search || s.student_name?.toLowerCase().includes(search.toLowerCase()) || s.scholarship_name.toLowerCase().includes(search.toLowerCase()) || s.provider.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchYear && matchSearch;
  });

  const totalAmt    = filtered.reduce((s, x) => s + (x.amount || 0), 0);
  const expiringSoon = scholarships.filter(s => s.status === "active" && s.end_date && new Date(s.end_date) <= new Date(Date.now() + 30 * 86400000));
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div>
      <div className="page-header flex items-center justify-between no-print">
        <div>
          <h1>Scholarship Register</h1>
          <p>Track govt & private scholarships — student bank details, renewal dates</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button type="button" onClick={() => { setEditing(null); setForm({ ...EMPTY }); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> Add Scholarship
          </button>
        </div>
      </div>

      {/* Expiry alert */}
      {expiringSoon.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 flex items-center gap-3 no-print">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            <strong>{expiringSoon.length} scholarship{expiringSoon.length > 1 ? "s" : ""}</strong> expiring within 30 days —{" "}
            {expiringSoon.map(s => s.student_name).join(", ")}
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6 no-print">
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-blue">
          <div className="flex items-center gap-2"><HeartHandshake className="w-4 h-4 text-blue-500" /><p className="text-xs text-muted-foreground">Total Scholarships</p></div>
          <p className="text-2xl font-bold">{scholarships.length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-green">
          <p className="text-xs text-muted-foreground">Active</p>
          <p className="text-2xl font-bold">{scholarships.filter(s => s.status === "active").length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-orange">
          <p className="text-xs text-muted-foreground">Expiring Soon</p>
          <p className="text-2xl font-bold">{expiringSoon.length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-purple">
          <div className="flex items-center gap-2"><IndianRupee className="w-4 h-4 text-purple-500" /><p className="text-xs text-muted-foreground">Total Amount</p></div>
          <p className="text-xl font-bold">₹{totalAmt.toLocaleString("en-IN")}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4 no-print">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student, scholarship, provider…"
            className="pl-9 pr-4 py-2 border border-border rounded-lg text-sm bg-background w-64" />
        </div>
        <select title="Status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
          <option value="all">All Status</option>
          {["active", "pending", "expired"].map(s => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select title="Year" value={yearFilter} onChange={e => setYearFilter(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
          <option value="all">All Years</option>
          {years.map(y => <option key={y}>{y}</option>)}
        </select>
        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} records · ₹{totalAmt.toLocaleString("en-IN")}</span>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <table className="w-full edu-table">
          <thead><tr><th>Student</th><th>Scholarship</th><th>Provider</th><th>Amount</th><th>Frequency</th><th>Bank Details</th><th>Valid Till</th><th>Status</th><th className="no-print"></th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">No scholarship records found.</td></tr>}
            {filtered.map(s => (
              <tr key={s.id} className={s.status === "active" && s.end_date && new Date(s.end_date) <= new Date(Date.now() + 30 * 86400000) ? "bg-amber-50/20" : ""}>
                <td>
                  <div className="font-medium">{s.student_name}</div>
                  <div className="text-xs text-muted-foreground">{s.class_name}</div>
                </td>
                <td>
                  <div className="font-medium text-sm">{s.scholarship_name}</div>
                  <div className="text-xs text-muted-foreground">{s.academic_year}</div>
                </td>
                <td>
                  <div className="text-sm">{s.provider}</div>
                  <div className="text-xs capitalize text-muted-foreground">{s.provider_type}</div>
                </td>
                <td className="font-semibold">₹{(s.amount || 0).toLocaleString("en-IN")}</td>
                <td className="text-sm capitalize">{s.frequency}</td>
                <td className="text-xs">
                  {s.bank_name && <div>{s.bank_name}</div>}
                  {s.account_number && <div className="font-mono">{s.account_number}</div>}
                  {s.ifsc_code && <div className="text-muted-foreground">{s.ifsc_code}</div>}
                </td>
                <td className="text-sm">{s.end_date ? new Date(s.end_date).toLocaleDateString("en-IN") : "—"}</td>
                <td><span className={STATUS_BADGE[s.status] || "badge-gray"}>{s.status}</span></td>
                <td className="no-print">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => openEdit(s)} className="text-xs text-primary hover:underline">Edit</button>
                    <button type="button" onClick={() => handleDelete(s.id)} className="text-xs text-red-500 hover:text-red-700">Del</button>
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
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">{editing ? "Edit Scholarship" : "Add Scholarship"}</h2>
              <button type="button" title="Close" onClick={() => { setShowForm(false); setEditing(null); }}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div><label className="text-xs text-muted-foreground block mb-1">Student *</label>
                <select title="Student" value={form.student_id} onChange={e => f("student_id", e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                  <option value="">— Select Student —</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name} {s.class_name ? `(${s.class_name})` : ""}</option>)}
                </select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Scholarship Name *</label>
                  <input value={form.scholarship_name} onChange={e => f("scholarship_name", e.target.value)} placeholder="PM Scholarship / State Merit…"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Provider *</label>
                  <input value={form.provider} onChange={e => f("provider", e.target.value)} placeholder="Ministry of Education / Trust name"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Provider Type</label>
                  <select title="Provider type" value={form.provider_type} onChange={e => f("provider_type", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                    {PROVIDER_TYPES.map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Amount (₹) *</label>
                  <input type="number" value={form.amount} onChange={e => f("amount", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Frequency</label>
                  <select title="Frequency" value={form.frequency} onChange={e => f("frequency", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                    {FREQUENCIES.map(f => <option key={f} value={f} className="capitalize">{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
                  </select></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Start Date</label>
                  <input type="date" value={form.start_date} onChange={e => f("start_date", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">End / Renewal Date</label>
                  <input type="date" value={form.end_date} onChange={e => f("end_date", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Academic Year</label>
                  <input value={form.academic_year} onChange={e => f("academic_year", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Status</label>
                  <select title="Status" value={form.status} onChange={e => f("status", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                    {["active", "pending", "expired"].map(s => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select></div>
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase pt-1">Bank Details (for direct transfer)</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Bank Name</label>
                  <input value={form.bank_name} onChange={e => f("bank_name", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Account Number</label>
                  <input value={form.account_number} onChange={e => f("account_number", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background font-mono" /></div>
              </div>
              <div><label className="text-xs text-muted-foreground block mb-1">IFSC Code</label>
                <input value={form.ifsc_code} onChange={e => f("ifsc_code", e.target.value.toUpperCase())}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background font-mono" /></div>
              <div><label className="text-xs text-muted-foreground block mb-1">Documents Submitted</label>
                <input value={form.documents} onChange={e => f("documents", e.target.value)} placeholder="Aadhar, income cert., marksheet…"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              <div><label className="text-xs text-muted-foreground block mb-1">Remarks</label>
                <textarea value={form.remarks} onChange={e => f("remarks", e.target.value)} rows={2}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none" /></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="flex-1 py-2.5 border border-border rounded-lg text-sm">Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving || !form.student_id || !form.scholarship_name || !form.provider || !form.amount}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {saving ? "Saving…" : editing ? "Update" : "Add Scholarship"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
