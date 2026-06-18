import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Plus, X, Search, Printer, UserCheck, LogOut, Clock } from "lucide-react";

type Visitor = {
  id: string; visitor_name: string; visitor_phone: string; purpose: string; whom_to_meet: string;
  id_proof_type: string; vehicle_number: string; entry_time: string; exit_time: string | null;
  notes: string; visit_date: string;
};

const PURPOSE_OPTIONS = ["Meeting with Principal", "Parent-Teacher Meeting", "Admission enquiry", "Fee payment", "Document collection", "Delivery/Courier", "Maintenance/Repair", "Government inspection", "Job interview", "Other"];
const ID_PROOF_OPTIONS = ["Aadhar Card", "PAN Card", "Driving Licence", "Voter ID", "Passport", "Employee ID", "Other"];

export function VisitorLogPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    visitor_name: "", visitor_phone: "", purpose: PURPOSE_OPTIONS[0], whom_to_meet: "",
    id_proof_type: "Aadhar Card", vehicle_number: "", notes: "",
    entry_time: new Date().toISOString().slice(0, 16), visit_date: new Date().toISOString().slice(0, 10),
  });

  async function fetchData() {
    const { data } = await supabase.from("visitor_logs").select("*").eq("school_id", schoolId)
      .eq("visit_date", dateFilter).order("entry_time", { ascending: false });
    setVisitors(data as Visitor[] || []);
  }

  useEffect(() => { if (schoolId) fetchData(); }, [schoolId, dateFilter]);

  async function handleSave() {
    if (!form.visitor_name.trim()) return;
    setSaving(true);
    await supabase.from("visitor_logs").insert({ ...form, school_id: schoolId });
    setSaving(false);
    setShowForm(false);
    setForm({ visitor_name: "", visitor_phone: "", purpose: PURPOSE_OPTIONS[0], whom_to_meet: "", id_proof_type: "Aadhar Card", vehicle_number: "", notes: "", entry_time: new Date().toISOString().slice(0, 16), visit_date: new Date().toISOString().slice(0, 10) });
    fetchData();
  }

  async function markExit(id: string) {
    await supabase.from("visitor_logs").update({ exit_time: new Date().toISOString() }).eq("id", id);
    fetchData();
  }

  function fmtTime(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  }

  const filtered = visitors.filter(v => !search || v.visitor_name.toLowerCase().includes(search.toLowerCase()) || v.purpose.toLowerCase().includes(search.toLowerCase()));
  const inside = visitors.filter(v => !v.exit_time).length;
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div>
      <div className="page-header flex items-center justify-between no-print">
        <div>
          <h1>Visitor / Gate Register</h1>
          <p>Daily visitor log — entry/exit time, purpose, ID proof</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted">
            <Printer className="w-4 h-4" /> Print Register
          </button>
          <button type="button" onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> New Entry
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6 no-print">
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-blue">
          <div className="flex items-center gap-2"><UserCheck className="w-4 h-4 text-blue-500" /><p className="text-xs text-muted-foreground">Today's Visitors</p></div>
          <p className="text-2xl font-bold">{visitors.length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-green">
          <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-green-500" /><p className="text-xs text-muted-foreground">Currently Inside</p></div>
          <p className="text-2xl font-bold">{inside}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-purple">
          <p className="text-xs text-muted-foreground">Exited</p>
          <p className="text-2xl font-bold">{visitors.filter(v => v.exit_time).length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-orange">
          <p className="text-xs text-muted-foreground">Date</p>
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            className="w-full border-0 bg-transparent text-sm font-semibold mt-1 focus:outline-none" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 no-print">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search visitor or purpose…"
            className="pl-9 pr-4 py-2 border border-border rounded-lg text-sm bg-background w-60" />
        </div>
        {inside > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-orange-600 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" /> {inside} visitor{inside > 1 ? "s" : ""} still inside
          </div>
        )}
        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} entries</span>
      </div>

      {/* Print header */}
      <div className="hidden print:block mb-4 text-center">
        <p className="text-lg font-bold">VISITOR REGISTER</p>
        <p className="text-sm">Date: {new Date(dateFilter).toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</p>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <table className="w-full edu-table">
          <thead><tr><th>#</th><th>Visitor Name</th><th>Phone</th><th>Purpose</th><th>Whom to Meet</th><th>ID Proof</th><th>Vehicle</th><th>Entry</th><th>Exit</th><th className="no-print"></th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={10} className="text-center py-12 text-muted-foreground">No visitors logged for this date.</td></tr>}
            {filtered.map((v, i) => (
              <tr key={v.id} className={!v.exit_time ? "bg-orange-50/30" : ""}>
                <td className="text-muted-foreground text-xs">{i + 1}</td>
                <td className="font-medium">{v.visitor_name}</td>
                <td className="font-mono text-sm">{v.visitor_phone || "—"}</td>
                <td className="text-sm">{v.purpose}</td>
                <td className="text-sm">{v.whom_to_meet || "—"}</td>
                <td className="text-sm text-muted-foreground">{v.id_proof_type || "—"}</td>
                <td className="text-sm font-mono">{v.vehicle_number || "—"}</td>
                <td className="text-sm font-semibold">{fmtTime(v.entry_time)}</td>
                <td className="text-sm">{v.exit_time ? fmtTime(v.exit_time) : <span className="badge-orange text-xs">Inside</span>}</td>
                <td className="no-print">
                  {!v.exit_time && (
                    <button type="button" onClick={() => markExit(v.id)}
                      className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 border border-red-200 px-2 py-1 rounded-lg">
                      <LogOut className="w-3 h-3" /> Exit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">New Visitor Entry</h2>
              <button type="button" title="Close" onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Visitor Name *</label>
                  <input value={form.visitor_name} onChange={e => f("visitor_name", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Phone</label>
                  <input value={form.visitor_phone} onChange={e => f("visitor_phone", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              </div>
              <div><label className="text-xs text-muted-foreground block mb-1">Purpose *</label>
                <select title="Purpose" value={form.purpose} onChange={e => f("purpose", e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                  {PURPOSE_OPTIONS.map(p => <option key={p}>{p}</option>)}
                </select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Whom to Meet</label>
                  <input value={form.whom_to_meet} onChange={e => f("whom_to_meet", e.target.value)} placeholder="Principal / Teacher name"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">ID Proof Type</label>
                  <select title="ID proof" value={form.id_proof_type} onChange={e => f("id_proof_type", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                    {ID_PROOF_OPTIONS.map(i => <option key={i}>{i}</option>)}
                  </select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Entry Time</label>
                  <input type="datetime-local" value={form.entry_time} onChange={e => f("entry_time", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Vehicle Number</label>
                  <input value={form.vehicle_number} onChange={e => f("vehicle_number", e.target.value)} placeholder="MH 12 AB 1234"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              </div>
              <div><label className="text-xs text-muted-foreground block mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => f("notes", e.target.value)} rows={2}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none" /></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-border rounded-lg text-sm">Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving || !form.visitor_name.trim()}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {saving ? "Saving…" : "Log Entry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
