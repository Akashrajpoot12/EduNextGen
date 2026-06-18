import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Plus, X, RefreshCw, CheckCircle } from "lucide-react";

type Staff = { id: string; name: string; role?: string; department?: string };
type Balance = { id: string; staff_id: string; year: number; leave_type: string; total_allowed: number; carry_forward: number; used: number };
type StaffRow = { staff: Staff; balances: Record<string, Balance> };

const LEAVE_TYPES = ["CL", "EL", "ML", "SL"];
const LEAVE_FULL: Record<string, string> = { CL: "Casual Leave", EL: "Earned Leave", ML: "Medical Leave", SL: "Special Leave" };
const DEFAULT_ALLOWED: Record<string, number> = { CL: 12, EL: 15, ML: 7, SL: 3 };

export function StaffLeaveBalancePage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [staffRows, setStaffRows] = useState<StaffRow[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [editRow, setEditRow] = useState<StaffRow | null>(null);
  const [editForm, setEditForm] = useState<Record<string, { total: string; carry: string; used: string }>>({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  async function fetchData() {
    setLoading(true);
    const [staffRes, balRes] = await Promise.all([
      supabase.from("users").select("id, name, role, department").eq("school_id", schoolId).in("role", ["teacher", "staff", "school_admin"]).order("name"),
      supabase.from("staff_leave_balances").select("*").eq("school_id", schoolId).eq("year", year),
    ]);
    const staffList = staffRes.data as Staff[] || [];
    const balList = balRes.data as Balance[] || [];

    const rows: StaffRow[] = staffList.map(staff => {
      const bals: Record<string, Balance> = {};
      LEAVE_TYPES.forEach(lt => {
        const found = balList.find(b => b.staff_id === staff.id && b.leave_type === lt);
        bals[lt] = found || { id: "", staff_id: staff.id, year, leave_type: lt, total_allowed: DEFAULT_ALLOWED[lt], carry_forward: 0, used: 0 };
      });
      return { staff, balances: bals };
    });
    setStaffRows(rows);
    setLoading(false);
  }

  useEffect(() => { if (schoolId) fetchData(); }, [schoolId, year]);

  function openEdit(row: StaffRow) {
    setEditRow(row);
    const form: typeof editForm = {};
    LEAVE_TYPES.forEach(lt => {
      const b = row.balances[lt];
      form[lt] = { total: String(b.total_allowed), carry: String(b.carry_forward), used: String(b.used) };
    });
    setEditForm(form);
    setShowSetup(true);
  }

  async function handleSave() {
    if (!editRow) return;
    setSaving(true);
    for (const lt of LEAVE_TYPES) {
      const b = editRow.balances[lt];
      const vals = { school_id: schoolId, staff_id: editRow.staff.id, year, leave_type: lt, total_allowed: Number(editForm[lt].total), carry_forward: Number(editForm[lt].carry), used: Number(editForm[lt].used) };
      if (b.id) {
        await supabase.from("staff_leave_balances").update(vals).eq("id", b.id);
      } else {
        await supabase.from("staff_leave_balances").insert(vals);
      }
    }
    setSaving(false);
    setShowSetup(false);
    setEditRow(null);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2500);
    fetchData();
  }

  async function initYear() {
    setSaving(true);
    for (const row of staffRows) {
      for (const lt of LEAVE_TYPES) {
        const b = row.balances[lt];
        if (!b.id) {
          await supabase.from("staff_leave_balances").insert({ school_id: schoolId, staff_id: row.staff.id, year, leave_type: lt, total_allowed: DEFAULT_ALLOWED[lt], carry_forward: 0, used: 0 });
        }
      }
    }
    setSaving(false);
    fetchData();
  }

  function available(b: Balance) { return b.total_allowed + b.carry_forward - b.used; }
  function pctUsed(b: Balance) { const total = b.total_allowed + b.carry_forward; return total > 0 ? Math.round((b.used / total) * 100) : 0; }

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Staff Leave Balance</h1>
          <p>CL / EL / ML / SL balance ledger — available, used, carry forward per staff</p>
        </div>
        <div className="flex items-center gap-3">
          {success && <span className="flex items-center gap-1 text-sm text-green-600"><CheckCircle className="w-4 h-4" /> Saved</span>}
          <select title="Year" value={year} onChange={e => setYear(Number(e.target.value))}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
            {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button type="button" onClick={initYear} disabled={saving}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted">
            <RefreshCw className={`w-4 h-4 ${saving ? "animate-spin" : ""}`} /> Init {year}
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-5 text-xs text-muted-foreground">
        {LEAVE_TYPES.map(lt => <span key={lt} className="bg-muted/50 px-2 py-1 rounded"><strong>{lt}</strong> = {LEAVE_FULL[lt]}</span>)}
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center text-muted-foreground">Loading staff leave data…</div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-x-auto shadow-sm">
          <table className="w-full edu-table">
            <thead>
              <tr>
                <th rowSpan={2} className="border-r border-border">Staff Name</th>
                <th rowSpan={2} className="border-r border-border">Role</th>
                {LEAVE_TYPES.map(lt => (
                  <th key={lt} colSpan={3} className="text-center border-r border-border bg-muted/30">
                    {lt} <span className="font-normal text-muted-foreground text-xs">({LEAVE_FULL[lt]})</span>
                  </th>
                ))}
                <th>Action</th>
              </tr>
              <tr>
                {LEAVE_TYPES.map(lt => (
                  <td key={lt} colSpan={3} className="p-0 border-r border-border">
                    <div className="grid grid-cols-3 divide-x divide-border">
                      <span className="text-xs text-center py-1.5 text-muted-foreground">Total</span>
                      <span className="text-xs text-center py-1.5 text-muted-foreground">Used</span>
                      <span className="text-xs text-center py-1.5 font-semibold">Avail.</span>
                    </div>
                  </td>
                ))}
                <td></td>
              </tr>
            </thead>
            <tbody>
              {staffRows.length === 0 && (
                <tr><td colSpan={LEAVE_TYPES.length * 3 + 3} className="text-center py-12 text-muted-foreground">No staff found. Make sure staff are added to the system.</td></tr>
              )}
              {staffRows.map(row => (
                <tr key={row.staff.id}>
                  <td className="font-medium border-r border-border">{row.staff.name}</td>
                  <td className="text-sm text-muted-foreground capitalize border-r border-border">{row.staff.role || "—"}</td>
                  {LEAVE_TYPES.map(lt => {
                    const b = row.balances[lt];
                    const avail = available(b);
                    const pct = pctUsed(b);
                    return (
                      <td key={lt} colSpan={3} className="p-0 border-r border-border">
                        <div className="grid grid-cols-3 divide-x divide-border">
                          <span className="text-center py-2 text-sm">
                            {b.total_allowed}
                            {b.carry_forward > 0 && <span className="text-xs text-blue-500 block">+{b.carry_forward}CF</span>}
                          </span>
                          <span className="text-center py-2 text-sm font-medium">
                            <span className={pct >= 80 ? "text-red-600" : pct >= 50 ? "text-orange-500" : "text-foreground"}>{b.used}</span>
                          </span>
                          <span className={`text-center py-2 text-sm font-bold ${avail <= 0 ? "text-red-600" : avail <= 2 ? "text-orange-500" : "text-green-600"}`}>
                            {avail}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                  <td>
                    <button type="button" onClick={() => openEdit(row)} className="text-xs text-primary hover:underline">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {showSetup && editRow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-bold text-lg">Edit Leave Balance</h2>
                <p className="text-sm text-muted-foreground">{editRow.staff.name} · {year}</p>
              </div>
              <button type="button" title="Close" onClick={() => { setShowSetup(false); setEditRow(null); }}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              {LEAVE_TYPES.map(lt => (
                <div key={lt} className="bg-muted/30 rounded-xl p-3">
                  <p className="text-sm font-semibold mb-2">{lt} — {LEAVE_FULL[lt]}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Total Allowed</label>
                      <input type="number" min="0" value={editForm[lt]?.total || "0"} onChange={e => setEditForm(p => ({ ...p, [lt]: { ...p[lt], total: e.target.value } }))}
                        className="w-full border border-border rounded-lg px-2 py-1.5 text-sm bg-background" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Carry Forward</label>
                      <input type="number" min="0" value={editForm[lt]?.carry || "0"} onChange={e => setEditForm(p => ({ ...p, [lt]: { ...p[lt], carry: e.target.value } }))}
                        className="w-full border border-border rounded-lg px-2 py-1.5 text-sm bg-background" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Used</label>
                      <input type="number" min="0" value={editForm[lt]?.used || "0"} onChange={e => setEditForm(p => ({ ...p, [lt]: { ...p[lt], used: e.target.value } }))}
                        className="w-full border border-border rounded-lg px-2 py-1.5 text-sm bg-background" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Available: <strong className={available({ ...editRow.balances[lt], total_allowed: Number(editForm[lt]?.total || 0), carry_forward: Number(editForm[lt]?.carry || 0), used: Number(editForm[lt]?.used || 0) }) <= 0 ? "text-red-500" : "text-green-600"}>{Number(editForm[lt]?.total || 0) + Number(editForm[lt]?.carry || 0) - Number(editForm[lt]?.used || 0)}</strong>
                  </p>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => { setShowSetup(false); setEditRow(null); }} className="flex-1 py-2.5 border border-border rounded-lg text-sm">Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {saving ? "Saving…" : "Save Balances"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
