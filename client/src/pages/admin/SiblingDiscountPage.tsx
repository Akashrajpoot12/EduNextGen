import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Users, IndianRupee, CheckCircle } from "lucide-react";

type Student = { id: string; name: string; father_name: string; phone: string; class_id: string; classes?: { name: string } | null };
type SiblingGroup = { key: string; label: string; students: Student[] };
type FeeAssignment = { id: string; student_id: string; amount: number; discount: number; status: string; fee_structures?: { name: string } | null };

export function SiblingDiscountPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<FeeAssignment[]>([]);
  const [siblingGroups, setSiblingGroups] = useState<SiblingGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<SiblingGroup | null>(null);
  const [discountType, setDiscountType] = useState<"flat" | "percent">("flat");
  const [discountValue, setDiscountValue] = useState("");
  const [applyTo, setApplyTo] = useState<"all" | "2nd_onwards">("2nd_onwards");
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    setLoading(true);
    Promise.all([
      supabase.from("students").select("id, name, father_name, phone, class_id, classes(name)").eq("school_id", schoolId).order("name"),
      supabase.from("student_fee_assignments").select("id, student_id, amount, discount, status, fee_structures(name)").eq("school_id", schoolId).eq("status", "pending"),
    ]).then(([sRes, aRes]) => {
      const studs = sRes.data as Student[] || [];
      setStudents(studs);
      setAssignments(aRes.data as FeeAssignment[] || []);

      // Group by phone (primary) or father_name (secondary)
      const phoneGroups = new Map<string, Student[]>();
      const fatherGroups = new Map<string, Student[]>();
      studs.forEach(s => {
        if (s.phone && s.phone.trim()) {
          const key = s.phone.trim().replace(/\s+/g, "");
          if (!phoneGroups.has(key)) phoneGroups.set(key, []);
          phoneGroups.get(key)!.push(s);
        } else if (s.father_name && s.father_name.trim()) {
          const key = s.father_name.trim().toLowerCase();
          if (!fatherGroups.has(key)) fatherGroups.set(key, []);
          fatherGroups.get(key)!.push(s);
        }
      });

      const groups: SiblingGroup[] = [];
      phoneGroups.forEach((studs, key) => {
        if (studs.length >= 2) groups.push({ key, label: `📞 ${key} — ${studs.map(s => s.name).join(", ")}`, students: studs });
      });
      fatherGroups.forEach((studs, key) => {
        if (studs.length >= 2) groups.push({ key, label: `👤 ${studs[0].father_name} — ${studs.map(s => s.name).join(", ")}`, students: studs });
      });
      setSiblingGroups(groups);
      setLoading(false);
    });
  }, [schoolId]);

  function selectGroup(g: SiblingGroup) {
    setSelectedGroup(g);
    setSaved(false);
    // Pre-select pending assignments for 2nd+ siblings
    const studs = applyTo === "2nd_onwards" ? g.students.slice(1) : g.students;
    const ids = assignments.filter(a => studs.some(s => s.id === a.student_id)).map(a => a.id);
    setSelectedAssignmentIds(new Set(ids));
  }

  function toggleAssignment(id: string) {
    setSelectedAssignmentIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function applyDiscount() {
    if (!discountValue || !selectedGroup || selectedAssignmentIds.size === 0) return;
    setSaving(true);
    const val = parseFloat(discountValue);
    for (const id of Array.from(selectedAssignmentIds)) {
      const asgn = assignments.find(a => a.id === id);
      if (!asgn) continue;
      const disc = discountType === "flat" ? val : Math.round((asgn.amount * val) / 100);
      await supabase.from("student_fee_assignments").update({ discount: disc }).eq("id", id);
    }
    setSaving(false);
    setSaved(true);
    // Refresh
    const { data } = await supabase.from("student_fee_assignments").select("id, student_id, amount, discount, status, fee_structures(name)").eq("school_id", schoolId).eq("status", "pending");
    setAssignments(data as FeeAssignment[] || []);
  }

  const groupAssignments = selectedGroup
    ? assignments.filter(a => selectedGroup.students.some(s => s.id === a.student_id))
    : [];

  return (
    <div>
      <div className="page-header">
        <h1>Sibling Discount</h1>
        <p>Auto-detect siblings, apply bulk fee discount for families with 2+ students</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-blue">
          <div className="flex items-center gap-2"><Users className="w-4 h-4 text-blue-500" /><p className="text-xs text-muted-foreground">Sibling Groups</p></div>
          <p className="text-2xl font-bold mt-1">{siblingGroups.length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-green">
          <div className="flex items-center gap-2"><Users className="w-4 h-4 text-emerald-500" /><p className="text-xs text-muted-foreground">Total Siblings</p></div>
          <p className="text-2xl font-bold mt-1">{siblingGroups.reduce((s, g) => s + g.students.length, 0)}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-orange">
          <div className="flex items-center gap-2"><IndianRupee className="w-4 h-4 text-amber-500" /><p className="text-xs text-muted-foreground">Pending Fee (Siblings)</p></div>
          <p className="text-2xl font-bold mt-1">
            ₹{assignments.filter(a => siblingGroups.some(g => g.students.some(s => s.id === a.student_id))).reduce((s, a) => s + a.amount, 0).toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      {loading && <div className="text-center text-muted-foreground py-12">Detecting sibling groups…</div>}

      {!loading && siblingGroups.length === 0 && (
        <div className="bg-card rounded-xl border border-border p-12 text-center text-muted-foreground">
          No sibling groups found. Siblings are detected by matching <strong>phone number</strong> or <strong>father's name</strong> across enrolled students.
        </div>
      )}

      {!loading && siblingGroups.length > 0 && (
        <div className="grid grid-cols-5 gap-6">
          {/* Sibling groups list */}
          <div className="col-span-2">
            <h2 className="font-semibold text-sm mb-3">Detected Sibling Groups ({siblingGroups.length})</h2>
            <div className="space-y-2">
              {siblingGroups.map(g => (
                <button key={g.key} type="button" onClick={() => selectGroup(g)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${selectedGroup?.key === g.key ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border bg-card hover:bg-muted/40"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-semibold text-sm">{g.students.length} siblings</span>
                  </div>
                  <div className="space-y-0.5">
                    {g.students.map(s => {
                      const cls = (s.classes as { name: string } | null)?.name;
                      return <p key={s.id} className="text-xs text-muted-foreground">{s.name}{cls ? ` (${cls})` : ""}</p>;
                    })}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Discount panel */}
          <div className="col-span-3">
            {!selectedGroup ? (
              <div className="bg-card rounded-xl border border-border p-10 text-center text-muted-foreground h-full flex items-center justify-center">
                Select a sibling group to apply discount.
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
                <h2 className="font-bold text-base mb-4">Apply Discount — {selectedGroup.students.map(s => s.name).join(", ")}</h2>

                {/* Discount settings */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Discount Type</label>
                    <select title="Discount type" value={discountType} onChange={e => setDiscountType(e.target.value as "flat" | "percent")}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                      <option value="flat">Flat Amount (₹)</option>
                      <option value="percent">Percentage (%)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Discount Value</label>
                    <input type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)}
                      placeholder={discountType === "flat" ? "e.g. 500" : "e.g. 10"}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Apply To</label>
                    <select title="Apply to" value={applyTo} onChange={e => { setApplyTo(e.target.value as "all" | "2nd_onwards"); selectGroup(selectedGroup); }}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                      <option value="2nd_onwards">2nd Child Onwards</option>
                      <option value="all">All Siblings</option>
                    </select>
                  </div>
                </div>

                {/* Fee assignments */}
                <p className="text-xs text-muted-foreground mb-2">Select fee items to apply discount:</p>
                <div className="border border-border rounded-xl overflow-hidden mb-4">
                  <table className="w-full edu-table text-xs">
                    <thead><tr><th className="w-6"></th><th>Student</th><th>Fee Head</th><th>Amount</th><th>Current Discount</th><th>New Discount</th></tr></thead>
                    <tbody>
                      {groupAssignments.length === 0 && <tr><td colSpan={6} className="text-center text-muted-foreground py-6">No pending fee assignments for this group.</td></tr>}
                      {groupAssignments.map(a => {
                        const stu = selectedGroup.students.find(s => s.id === a.student_id);
                        const fs = a.fee_structures as { name: string } | null;
                        const newDisc = discountValue ? (discountType === "flat" ? parseFloat(discountValue) : Math.round((a.amount * parseFloat(discountValue)) / 100)) : 0;
                        return (
                          <tr key={a.id} className={selectedAssignmentIds.has(a.id) ? "bg-primary/5" : ""}>
                            <td><input type="checkbox" title="Select" checked={selectedAssignmentIds.has(a.id)} onChange={() => toggleAssignment(a.id)} /></td>
                            <td className="font-medium">{stu?.name || "—"}</td>
                            <td>{fs?.name || "Fee"}</td>
                            <td>₹{a.amount.toLocaleString("en-IN")}</td>
                            <td className="text-emerald-600">{a.discount > 0 ? `₹${a.discount}` : "—"}</td>
                            <td className="text-blue-600 font-semibold">
                              {selectedAssignmentIds.has(a.id) && discountValue ? `₹${newDisc}` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {saved && (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-2.5 text-sm text-green-700 mb-3">
                    <CheckCircle className="w-4 h-4" /> Discount applied successfully to {selectedAssignmentIds.size} fee item{selectedAssignmentIds.size > 1 ? "s" : ""}.
                  </div>
                )}

                <button type="button" onClick={applyDiscount}
                  disabled={saving || !discountValue || selectedAssignmentIds.size === 0}
                  className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50">
                  {saving ? "Applying…" : `Apply ${discountType === "flat" ? `₹${discountValue || "0"}` : `${discountValue || "0"}%`} Discount to ${selectedAssignmentIds.size} items`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
