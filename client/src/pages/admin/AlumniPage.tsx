import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Plus, X, Search, GraduationCap, Printer } from "lucide-react";

type Alumni = {
  id: string; name: string; admission_number: string; batch_year: number; last_class: string;
  father_name: string; phone: string; email: string; current_city: string; occupation: string;
  organization: string; achievement: string; notes: string;
};

const EMPTY = { name: "", admission_number: "", batch_year: new Date().getFullYear(), last_class: "", father_name: "", phone: "", email: "", current_city: "", occupation: "", organization: "", achievement: "", notes: "" };

export function AlumniPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [alumni, setAlumni] = useState<Alumni[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Alumni | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [batchFilter, setBatchFilter] = useState("all");
  const [loading, setLoading] = useState(false);

  async function fetchData() {
    setLoading(true);
    const { data } = await supabase.from("alumni").select("*").eq("school_id", schoolId).order("batch_year", { ascending: false }).order("name");
    setAlumni(data as Alumni[] || []);
    setLoading(false);
  }

  useEffect(() => { if (schoolId) fetchData(); }, [schoolId]);

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    if (editing) {
      await supabase.from("alumni").update({ ...form }).eq("id", editing.id);
    } else {
      await supabase.from("alumni").insert({ ...form, school_id: schoolId });
    }
    setSaving(false);
    setShowForm(false);
    setEditing(null);
    setForm({ ...EMPTY });
    fetchData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this alumni record?")) return;
    await supabase.from("alumni").delete().eq("id", id);
    fetchData();
  }

  function openEdit(a: Alumni) {
    setEditing(a);
    setForm({ name: a.name, admission_number: a.admission_number || "", batch_year: a.batch_year, last_class: a.last_class || "", father_name: a.father_name || "", phone: a.phone || "", email: a.email || "", current_city: a.current_city || "", occupation: a.occupation || "", organization: a.organization || "", achievement: a.achievement || "", notes: a.notes || "" });
    setShowForm(true);
  }

  const batches = [...new Set(alumni.map(a => a.batch_year))].sort((a, b) => b - a);
  const filtered = alumni.filter(a => {
    const matchBatch = batchFilter === "all" || a.batch_year === Number(batchFilter);
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.occupation?.toLowerCase().includes(search.toLowerCase()) || a.current_city?.toLowerCase().includes(search.toLowerCase());
    return matchBatch && matchSearch;
  });

  const f = (k: keyof typeof form, v: string | number) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Alumni Management</h1>
          <p>Track past students — batch records, contact info, achievements</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button type="button" onClick={() => { setEditing(null); setForm({ ...EMPTY }); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> Add Alumni
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-blue">
          <div className="flex items-center gap-2"><GraduationCap className="w-4 h-4 text-blue-500" /><p className="text-xs text-muted-foreground">Total Alumni</p></div>
          <p className="text-2xl font-bold">{alumni.length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-purple">
          <p className="text-xs text-muted-foreground">Batches</p>
          <p className="text-2xl font-bold">{batches.length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-green">
          <p className="text-xs text-muted-foreground">With Contact</p>
          <p className="text-2xl font-bold">{alumni.filter(a => a.phone || a.email).length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-orange">
          <p className="text-xs text-muted-foreground">With Achievement</p>
          <p className="text-2xl font-bold">{alumni.filter(a => a.achievement).length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4 no-print">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, occupation, city…"
            className="pl-9 pr-4 py-2 border border-border rounded-lg text-sm bg-background w-64" />
        </div>
        <select title="Filter by batch" value={batchFilter} onChange={e => setBatchFilter(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
          <option value="all">All Batches</option>
          {batches.map(y => <option key={y} value={y}>Batch {y}</option>)}
        </select>
        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} records</span>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <table className="w-full edu-table">
          <thead><tr><th>Name</th><th>Batch</th><th>Last Class</th><th>Phone</th><th>City</th><th>Occupation</th><th>Achievement</th><th></th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Loading…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No alumni records. Add your first alumni.</td></tr>}
            {filtered.map(a => (
              <tr key={a.id}>
                <td>
                  <div className="font-medium">{a.name}</div>
                  {a.admission_number && <div className="text-xs text-muted-foreground">{a.admission_number}</div>}
                </td>
                <td><span className="badge-blue">Batch {a.batch_year}</span></td>
                <td>{a.last_class || "—"}</td>
                <td className="font-mono text-sm">{a.phone || "—"}</td>
                <td>{a.current_city || "—"}</td>
                <td>
                  <div className="text-sm">{a.occupation || "—"}</div>
                  {a.organization && <div className="text-xs text-muted-foreground">{a.organization}</div>}
                </td>
                <td className="text-sm text-muted-foreground max-w-xs truncate">{a.achievement || "—"}</td>
                <td>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => openEdit(a)} className="text-xs text-primary hover:underline">Edit</button>
                    <button type="button" onClick={() => handleDelete(a.id)} className="text-xs text-red-500 hover:text-red-700">Del</button>
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
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">{editing ? "Edit Alumni" : "Add Alumni"}</h2>
              <button type="button" title="Close" onClick={() => { setShowForm(false); setEditing(null); }}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Full Name *</label>
                  <input value={form.name} onChange={e => f("name", e.target.value)} placeholder="Student full name"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Admission Number</label>
                  <input value={form.admission_number} onChange={e => f("admission_number", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Batch Year (Passing) *</label>
                  <input type="number" value={form.batch_year} onChange={e => f("batch_year", Number(e.target.value))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Last Class</label>
                  <input value={form.last_class} onChange={e => f("last_class", e.target.value)} placeholder="e.g. Class 12"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Father's Name</label>
                  <input value={form.father_name} onChange={e => f("father_name", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Phone</label>
                  <input value={form.phone} onChange={e => f("phone", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Email</label>
                  <input value={form.email} onChange={e => f("email", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Current City</label>
                  <input value={form.current_city} onChange={e => f("current_city", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Occupation</label>
                  <input value={form.occupation} onChange={e => f("occupation", e.target.value)} placeholder="e.g. Engineer, Doctor"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Organization</label>
                  <input value={form.organization} onChange={e => f("organization", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              </div>
              <div><label className="text-xs text-muted-foreground block mb-1">Achievement / Notable Work</label>
                <input value={form.achievement} onChange={e => f("achievement", e.target.value)} placeholder="e.g. IIT topper, National award"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              <div><label className="text-xs text-muted-foreground block mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => f("notes", e.target.value)} rows={2}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none" /></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="flex-1 py-2.5 border border-border rounded-lg text-sm">Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving || !form.name}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {saving ? "Saving…" : editing ? "Update" : "Add Alumni"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
