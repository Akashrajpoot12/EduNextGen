import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Plus, X, Search, Printer, LogIn } from "lucide-react";

type Student = { id: string; name: string; roll_number: string; class_id: string; class_name?: string; father_name?: string; phone?: string };
type GatePass = {
  id: string; student_id: string; pass_number: string; pass_date: string; reason: string;
  out_time: string; expected_return: string; actual_return: string | null; approved_by: string; status: string;
  student_name?: string; class_name?: string; father_name?: string; phone?: string;
};

const REASONS = ["Medical / Doctor visit", "Family emergency", "Early dismissal by parent", "Sports/Competition", "Government exam", "Other"];

function zeroPad(n: number) { return String(n).padStart(4, "0"); }

export function GatePassPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [passes, setPasses]     = useState<GatePass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [schoolName, setSchoolName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [printPass, setPrintPass] = useState<GatePass | null>(null);
  const [search, setSearch]     = useState("");
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving]     = useState(false);
  const [nextNum, setNextNum]   = useState(1);
  const [form, setForm]         = useState({
    student_id: "", reason: REASONS[0],
    out_time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }),
    expected_return: "", approved_by: "",
    pass_date: new Date().toISOString().slice(0, 10),
  });

  async function fetchData() {
    const [pRes, sRes, schRes] = await Promise.all([
      supabase.from("gate_passes").select("*").eq("school_id", schoolId).eq("pass_date", dateFilter).order("created_at", { ascending: false }),
      supabase.from("students").select("id, name, roll_number, class_id, father_name, phone").eq("school_id", schoolId).order("name"),
      supabase.from("schools").select("name").eq("id", schoolId).single(),
    ]);
    const classes = await supabase.from("classes").select("id, name").eq("school_id", schoolId);
    const classMap = Object.fromEntries((classes.data || []).map((c: { id: string; name: string }) => [c.id, c.name]));
    const stuList = (sRes.data || []).map((s: Student) => ({ ...s, class_name: classMap[s.class_id] || "" }));
    setStudents(stuList);
    setSchoolName(schRes.data?.name || "");
    const stuMap = Object.fromEntries(stuList.map(s => [s.id, s]));
    const list = (pRes.data || []).map((p: GatePass) => ({
      ...p,
      student_name: stuMap[p.student_id]?.name,
      class_name: stuMap[p.student_id]?.class_name,
      father_name: stuMap[p.student_id]?.father_name,
      phone: stuMap[p.student_id]?.phone,
    }));
    setPasses(list);
    setNextNum((pRes.data?.length || 0) + 1);
  }

  useEffect(() => { if (schoolId) fetchData(); }, [schoolId, dateFilter]);

  async function handleSave() {
    if (!form.student_id || !form.reason) return;
    setSaving(true);
    const pass_number = `GP/${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "2-digit" }).replace(/\//g, "")}/${zeroPad(nextNum)}`;
    await supabase.from("gate_passes").insert({ ...form, school_id: schoolId, pass_number, status: "approved" });
    setSaving(false);
    setShowForm(false);
    fetchData();
  }

  async function markReturn(id: string) {
    const t = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
    await supabase.from("gate_passes").update({ actual_return: t, status: "returned" }).eq("id", id);
    fetchData();
  }

  function doPrint(p: GatePass) { setPrintPass(p); setTimeout(() => window.print(), 300); }

  const filtered = passes.filter(p => !search || p.student_name?.toLowerCase().includes(search.toLowerCase()));
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const selStu = students.find(s => s.id === form.student_id);

  return (
    <div>
      <div className="no-print">
        <div className="page-header flex items-center justify-between">
          <div>
            <h1>Student Gate Pass</h1>
            <p>Issue gate passes for early departure — track out/return time</p>
          </div>
          <button type="button" onClick={() => { setForm({ student_id: "", reason: REASONS[0], out_time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }), expected_return: "", approved_by: "", pass_date: new Date().toISOString().slice(0, 10) }); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> Issue Gate Pass
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-blue">
            <p className="text-xs text-muted-foreground">Passes Today</p>
            <p className="text-2xl font-bold">{passes.length}</p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-orange">
            <p className="text-xs text-muted-foreground">Out (Not Returned)</p>
            <p className="text-2xl font-bold">{passes.filter(p => !p.actual_return).length}</p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-green">
            <p className="text-xs text-muted-foreground">Returned</p>
            <p className="text-2xl font-bold">{passes.filter(p => p.actual_return).length}</p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
            <p className="text-xs text-muted-foreground">Date</p>
            <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
              className="w-full border-0 bg-transparent text-sm font-semibold mt-1 focus:outline-none" />
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student…"
              className="pl-9 pr-4 py-2 border border-border rounded-lg text-sm bg-background w-56" />
          </div>
          {passes.filter(p => !p.actual_return).length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-orange-600 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              {passes.filter(p => !p.actual_return).length} student{passes.filter(p => !p.actual_return).length > 1 ? "s" : ""} outside campus
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          <table className="w-full edu-table">
            <thead><tr><th>Pass No.</th><th>Student</th><th>Class</th><th>Reason</th><th>Out</th><th>Exp. Return</th><th>Actual Return</th><th>Approved By</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={10} className="text-center py-12 text-muted-foreground">No gate passes for this date.</td></tr>}
              {filtered.map(p => (
                <tr key={p.id} className={!p.actual_return ? "bg-orange-50/20" : ""}>
                  <td className="font-mono text-xs">{p.pass_number}</td>
                  <td className="font-medium">{p.student_name}</td>
                  <td className="text-sm">{p.class_name}</td>
                  <td className="text-sm text-muted-foreground">{p.reason}</td>
                  <td className="text-sm font-semibold">{p.out_time}</td>
                  <td className="text-sm">{p.expected_return || "—"}</td>
                  <td className="text-sm">{p.actual_return || "—"}</td>
                  <td className="text-sm text-muted-foreground">{p.approved_by || "—"}</td>
                  <td>
                    <span className={`badge-${p.status === "returned" ? "green" : "orange"}`}>
                      {p.status === "returned" ? "Returned" : "Out"}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => doPrint(p)} className="text-xs text-primary hover:underline flex items-center gap-1">
                        <Printer className="w-3 h-3" />
                      </button>
                      {!p.actual_return && (
                        <button type="button" onClick={() => markReturn(p.id)} className="text-xs text-green-600 hover:text-green-800 flex items-center gap-1 border border-green-200 px-1.5 py-0.5 rounded">
                          <LogIn className="w-3 h-3" /> Return
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PRINT GATE PASS */}
      {printPass && (
        <div className="hidden print:block print-full">
          <div style={{ fontFamily: "Arial, sans-serif", maxWidth: "420px", margin: "0 auto", border: "2px solid #000", padding: "16px", fontSize: "12px" }}>
            <div style={{ textAlign: "center", borderBottom: "1px solid #000", paddingBottom: "8px", marginBottom: "10px" }}>
              <p style={{ fontSize: "14px", fontWeight: "bold", textTransform: "uppercase" }}>{schoolName}</p>
              <p style={{ fontSize: "12px", fontWeight: "bold", marginTop: "2px" }}>STUDENT GATE PASS</p>
              <p style={{ fontSize: "10px", color: "#555" }}>{printPass.pass_number}</p>
            </div>
            {[
              ["Student Name", printPass.student_name || ""],
              ["Class", printPass.class_name || ""],
              ["Father's Name", printPass.father_name || ""],
              ["Contact", printPass.phone || ""],
              ["Reason for Leaving", printPass.reason],
              ["Out Time", printPass.out_time],
              ["Expected Return", printPass.expected_return || "—"],
              ["Date", printPass.pass_date ? new Date(printPass.pass_date).toLocaleDateString("en-IN") : ""],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", padding: "4px 0", borderBottom: "1px dashed #eee" }}>
                <span style={{ width: "150px", fontWeight: "500", color: "#555" }}>{label}:</span>
                <span style={{ fontWeight: "bold" }}>{value}</span>
              </div>
            ))}
            <div style={{ marginTop: "16px", display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ borderTop: "1px solid #000", width: "110px", paddingTop: "4px" }}>Class Teacher</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ marginBottom: "4px" }}>Approved by: {printPass.approved_by || "____"}</p>
                <div style={{ borderTop: "1px solid #000", width: "110px", paddingTop: "4px" }}>Principal / Admin</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Issue Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">Issue Gate Pass</h2>
              <button type="button" title="Close" onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div><label className="text-xs text-muted-foreground block mb-1">Student *</label>
                <select title="Student" value={form.student_id} onChange={e => f("student_id", e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                  <option value="">— Select Student —</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name} {s.class_name ? `(${s.class_name})` : ""}</option>)}
                </select>
              </div>
              {selStu && (
                <div className="bg-muted/40 rounded-lg p-2.5 text-xs text-muted-foreground">
                  Father: {selStu.father_name || "—"} &nbsp;|&nbsp; Phone: {selStu.phone || "—"}
                </div>
              )}
              <div><label className="text-xs text-muted-foreground block mb-1">Reason *</label>
                <select title="Reason" value={form.reason} onChange={e => f("reason", e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                  {REASONS.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Out Time</label>
                  <input type="time" value={form.out_time} onChange={e => f("out_time", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Expected Return</label>
                  <input type="time" value={form.expected_return} onChange={e => f("expected_return", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              </div>
              <div><label className="text-xs text-muted-foreground block mb-1">Approved By</label>
                <input value={form.approved_by} onChange={e => f("approved_by", e.target.value)} placeholder="Class teacher / Principal name"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-border rounded-lg text-sm">Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving || !form.student_id}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {saving ? "Issuing…" : "Issue Pass & Print"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
