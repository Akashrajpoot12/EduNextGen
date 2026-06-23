import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Plus, Search, Printer, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type FeeStructure = { id: string; name: string; description?: string; amount: number; frequency: string; late_fine_per_day: number; is_active: boolean; academic_year?: string };
type Assignment = { id: string; student_id: string; fee_structure_id: string; due_date: string; amount: number; discount: number; fine: number; status: string; student_name?: string; fee_name?: string; late_fine_per_day?: number };
type FeeReceipt = { id: string; receipt_number: string; student_id: string; assignment_id?: string; amount_paid: number; payment_mode: string; remarks?: string; paid_at: string; student_name?: string };
type Student = { id: string; name: string; roll_number?: string; father_name?: string; phone?: string; class_id?: string };
type School = { name: string; address?: string; phone?: string };
type ClassRow = { id: string; grade_level: string; section: string };
const classLabel = (c?: { grade_level?: string; section?: string } | null) =>
  c ? `${c.grade_level ?? ""}${c.section ? " - " + c.section : ""}`.trim() || "—" : "—";

const FREQ_COLORS: Record<string, string> = { monthly: "badge-blue", quarterly: "badge-purple", annual: "badge-green", one_time: "badge-gray" };
const MODE_COLORS: Record<string, string> = { cash: "badge-gray", online: "badge-blue", upi: "badge-green", cheque: "badge-yellow", dd: "badge-purple" };

// Fetch every row of a query in 1000-row chunks — defeats supabase-js's default
// 1000-row cap so financial lists/totals are never silently truncated at scale.
async function fetchAllChunked<T>(build: (from: number, to: number) => any): Promise<T[]> {
  const CHUNK = 1000;
  let from = 0;
  const out: T[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data } = await build(from, from + CHUNK - 1);
    const batch = (data as T[]) || [];
    out.push(...batch);
    if (batch.length < CHUNK) break;
    from += CHUNK;
  }
  return out;
}

export function FeesPage() {
  const { tenantId: schoolId, subdomain } = useTenant();
  const [tab, setTab] = useState<"structures" | "assignments" | "receipts" | "defaulters">("structures");
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [receipts, setReceipts] = useState<FeeReceipt[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [assignMode, setAssignMode] = useState<"single" | "bulk">("single");
  const [bulkClassId, setBulkClassId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddStructure, setShowAddStructure] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showCollect, setShowCollect] = useState<Assignment | null>(null);
  const [showPrintReceipt, setShowPrintReceipt] = useState<FeeReceipt | null>(null);
  const [selectedDefaulterIds, setSelectedDefaulterIds] = useState<Set<string>>(new Set());
  const [structureForm, setStructureForm] = useState({ name: "", description: "", amount: "", frequency: "monthly", late_fine_per_day: "0", academic_year: "", is_active: true });
  const [assignForm, setAssignForm] = useState({ student_id: "", fee_structure_id: "", due_date: "", amount: "", discount: "0" });
  const [collectForm, setCollectForm] = useState({ payment_mode: "cash", amount_paid: "", remarks: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (schoolId) fetchAll(); }, [schoolId]);

  async function fetchAll() {
    setLoading(true);
    const supabase = createClient();
    const [s, sc, cl, a, r, st] = await Promise.all([
      supabase.from("fee_structures").select("*").eq("school_id", schoolId).order("created_at", { ascending: false }),
      supabase.from("schools").select("name, address, phone").eq("id", schoolId).single(),
      supabase.from("classes").select("id, grade_level, section").eq("school_id", schoolId).order("grade_level"),
      // Chunked so all dues/receipts/students load — never capped at 1000.
      fetchAllChunked<Assignment>((from, to) =>
        supabase.from("student_fee_assignments").select("*").eq("school_id", schoolId).order("due_date", { ascending: true }).range(from, to)),
      fetchAllChunked<FeeReceipt>((from, to) =>
        supabase.from("fee_receipts").select("*").eq("school_id", schoolId).order("paid_at", { ascending: false }).range(from, to)),
      fetchAllChunked<Student>((from, to) =>
        supabase.from("students").select("id, name, roll_number, father_name, phone, class_id").eq("school_id", schoolId).range(from, to)),
    ]);
    setClasses(cl.data || []);
    const stuMap = Object.fromEntries(st.map((x) => [x.id, x]));
    const feeMap = Object.fromEntries((s.data || []).map((x: FeeStructure) => [x.id, x]));
    const enrichedA = a.map((x) => ({ ...x, student_name: stuMap[x.student_id]?.name || "Unknown", fee_name: feeMap[x.fee_structure_id]?.name || "—", late_fine_per_day: feeMap[x.fee_structure_id]?.late_fine_per_day || 0 }));
    const enrichedR = r.map((x) => ({ ...x, student_name: stuMap[x.student_id]?.name || "Unknown" }));
    setStructures(s.data || []);
    setAssignments(enrichedA);
    setReceipts(enrichedR);
    setStudents(st);
    if (sc.data) setSchool(sc.data as School);
    setLoading(false);
  }

  async function saveStructure(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    const supabase = createClient();
    await supabase.from("fee_structures").insert({ school_id: schoolId, name: structureForm.name, description: structureForm.description, amount: Number(structureForm.amount), frequency: structureForm.frequency, late_fine_per_day: Number(structureForm.late_fine_per_day), academic_year: structureForm.academic_year, is_active: structureForm.is_active });
    setSaving(false); setShowAddStructure(false);
    setStructureForm({ name: "", description: "", amount: "", frequency: "monthly", late_fine_per_day: "0", academic_year: "", is_active: true });
    fetchAll();
  }

  async function saveAssign(e: React.FormEvent) {
    e.preventDefault();
    if (assignMode === "bulk") { await bulkAssign(); return; }
    setSaving(true);
    const supabase = createClient();
    await supabase.from("student_fee_assignments").insert({ school_id: schoolId, student_id: assignForm.student_id, fee_structure_id: assignForm.fee_structure_id, due_date: assignForm.due_date, amount: Number(assignForm.amount), discount: Number(assignForm.discount), fine: 0, status: "pending" });
    setSaving(false); setShowAssign(false); fetchAll();
  }

  // Assign one fee structure to an entire class (or all students) in a single insert.
  async function bulkAssign() {
    if (!assignForm.fee_structure_id || !assignForm.due_date) { return; }
    setSaving(true);
    const supabase = createClient();
    const targets = bulkClassId === "all" ? students : students.filter(s => s.class_id === bulkClassId);
    // Skip students who already have this fee assigned (avoid duplicates).
    const existing = new Set(assignments.map(a => `${a.student_id}:${a.fee_structure_id}`));
    const rows = targets
      .filter(s => !existing.has(`${s.id}:${assignForm.fee_structure_id}`))
      .map(s => ({
        school_id: schoolId, student_id: s.id, fee_structure_id: assignForm.fee_structure_id,
        due_date: assignForm.due_date, amount: Number(assignForm.amount), discount: Number(assignForm.discount || 0),
        fine: 0, status: "pending",
      }));
    if (rows.length === 0) { setSaving(false); toast.error("No new students to assign (all already have this fee)."); return; }
    // Insert in chunks of 500 to stay within request limits.
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from("student_fee_assignments").insert(rows.slice(i, i + 500));
      if (error) { setSaving(false); toast.error(error.message); return; }
    }
    setSaving(false); setShowAssign(false);
    toast.success(`Fee assigned to ${rows.length} student(s).`);
    fetchAll();
  }

  async function collectPayment(e: React.FormEvent) {
    e.preventDefault(); if (!showCollect) return; setSaving(true);
    const supabase = createClient();
    await supabase.from("fee_receipts").insert({ school_id: schoolId, student_id: showCollect.student_id, assignment_id: showCollect.id, amount_paid: Number(collectForm.amount_paid), payment_mode: collectForm.payment_mode, remarks: collectForm.remarks, receipt_number: "" });
    await supabase.from("student_fee_assignments").update({ status: "paid" }).eq("id", showCollect.id);
    setSaving(false); setShowCollect(null); setCollectForm({ payment_mode: "cash", amount_paid: "", remarks: "" }); fetchAll();
  }

  async function deleteStructure(id: string) {
    if (!confirm("Delete this fee structure?")) return;
    const supabase = createClient();
    await supabase.from("fee_structures").delete().eq("id", id);
    fetchAll();
  }

  const today = new Date();
  const defaulters = assignments.filter(a => a.status === "pending" && new Date(a.due_date) < today);

  // Group defaulters by student_id so one reminder slip covers all their dues
  const defaultersByStudent = defaulters.reduce<Record<string, Assignment[]>>((acc, a) => {
    if (!acc[a.student_id]) acc[a.student_id] = [];
    acc[a.student_id].push(a);
    return acc;
  }, {});
  const defaulterStudentIds = Object.keys(defaultersByStudent);

  function toggleDefaulterSelect(id: string) {
    setSelectedDefaulterIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  const selectedDefaulters = defaulterStudentIds.filter(id => selectedDefaulterIds.has(id));
  const studentMeta = Object.fromEntries(students.map(s => [s.id, s]));
  const filteredAssignments = assignments.filter(a => statusFilter === "all" || a.status === statusFilter);
  const filteredReceipts = receipts.filter(r => !search || r.receipt_number?.toLowerCase().includes(search.toLowerCase()) || r.student_name?.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading fee data…</div>;

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div><h1>Fee Management</h1><p>Manage fee structures, collect payments, track defaulters</p></div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowAddStructure(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> Add Fee Structure
          </button>
          <button type="button" onClick={() => setShowAssign(true)} className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">
            <Plus className="w-4 h-4" /> Assign Fee
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Collected", value: "₹" + receipts.reduce((s, r) => s + r.amount_paid, 0).toLocaleString("en-IN"), color: "card-accent-green" },
          { label: "Pending Amount", value: "₹" + assignments.filter(a => a.status === "pending").reduce((s, a) => s + (a.amount - a.discount + a.fine), 0).toLocaleString("en-IN"), color: "card-accent-orange" },
          { label: "Defaulters", value: defaulters.length, color: "card-accent-red" },
          { label: "Active Structures", value: structures.filter(s => s.is_active).length, color: "card-accent-blue" },
        ].map(c => (
          <div key={c.label} className={`bg-card rounded-xl p-4 shadow-sm border border-border ${c.color}`}>
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 mb-6 w-fit">
        {(["structures", "assignments", "receipts", "defaulters"] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {t === "structures" ? "Fee Structures" : t === "assignments" ? "Assignments" : t === "receipts" ? "Receipts" : <span>Defaulters {defaulters.length > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{defaulters.length}</span>}</span>}
          </button>
        ))}
      </div>

      {tab === "structures" && (
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          <table className="w-full edu-table">
            <thead><tr><th>Name</th><th>Amount</th><th>Frequency</th><th>Late Fine/Day</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {structures.length === 0 && <tr><td colSpan={6} className="text-center text-muted-foreground py-12">No fee structures yet.</td></tr>}
              {structures.map(s => (
                <tr key={s.id}>
                  <td><div className="font-medium">{s.name}</div><div className="text-xs text-muted-foreground">{s.description}</div></td>
                  <td className="font-semibold">₹{Number(s.amount).toLocaleString("en-IN")}</td>
                  <td><span className={FREQ_COLORS[s.frequency] || "badge-gray"}>{s.frequency}</span></td>
                  <td>{s.late_fine_per_day > 0 ? `₹${s.late_fine_per_day}/day` : "—"}</td>
                  <td><span className={s.is_active ? "badge-green" : "badge-gray"}>{s.is_active ? "Active" : "Inactive"}</span></td>
                  <td><button type="button" onClick={() => deleteStructure(s.id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "assignments" && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <select title="Filter by status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="waived">Waived</option>
            </select>
          </div>
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            <table className="w-full edu-table">
              <thead><tr><th>Student</th><th>Fee Type</th><th>Due Date</th><th>Amount</th><th>Discount</th><th>Net Due</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredAssignments.length === 0 && <tr><td colSpan={8} className="text-center text-muted-foreground py-12">No assignments found.</td></tr>}
                {filteredAssignments.map(a => {
                  const net = a.amount - a.discount + a.fine;
                  const statusColor: Record<string, string> = { pending: "badge-yellow", paid: "badge-green", partial: "badge-blue", waived: "badge-gray" };
                  return (
                    <tr key={a.id}>
                      <td className="font-medium">{a.student_name}</td>
                      <td>{a.fee_name}</td>
                      <td className="text-sm">{new Date(a.due_date).toLocaleDateString("en-IN")}</td>
                      <td>₹{Number(a.amount).toLocaleString("en-IN")}</td>
                      <td>{a.discount > 0 ? `₹${Number(a.discount).toLocaleString("en-IN")}` : "—"}</td>
                      <td className="font-semibold">₹{net.toLocaleString("en-IN")}</td>
                      <td><span className={statusColor[a.status] || "badge-gray"}>{a.status}</span></td>
                      <td>
                        {a.status === "pending" && (
                          <button type="button" onClick={() => { setShowCollect(a); setCollectForm({ payment_mode: "cash", amount_paid: String(net), remarks: "" }); }} className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">Collect</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "receipts" && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="relative"><Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search receipts…" className="pl-9 pr-4 py-2 border border-border rounded-lg text-sm bg-background w-64" /></div>
          </div>
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            <table className="w-full edu-table">
              <thead><tr><th>Receipt No.</th><th>Student</th><th>Amount</th><th>Mode</th><th>Date</th><th>Remarks</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredReceipts.length === 0 && <tr><td colSpan={7} className="text-center text-muted-foreground py-12">No receipts found.</td></tr>}
                {filteredReceipts.map(r => (
                  <tr key={r.id}>
                    <td className="font-mono text-sm font-semibold text-primary">{r.receipt_number}</td>
                    <td>{r.student_name}</td>
                    <td className="font-semibold">₹{Number(r.amount_paid).toLocaleString("en-IN")}</td>
                    <td><span className={MODE_COLORS[r.payment_mode] || "badge-gray"}>{r.payment_mode}</span></td>
                    <td className="text-sm">{new Date(r.paid_at).toLocaleDateString("en-IN")}</td>
                    <td className="text-sm text-muted-foreground">{r.remarks || "—"}</td>
                    <td><button type="button" title="Print Receipt" onClick={() => setShowPrintReceipt(r)} className="text-primary hover:underline text-xs flex items-center gap-1"><Printer className="w-3 h-3" />Print</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "defaulters" && (
        <div>
          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4">
              <p className="text-sm text-red-600 dark:text-red-400 font-medium">Defaulter Students</p>
              <p className="text-3xl font-bold text-red-700 dark:text-red-300">{defaulterStudentIds.length}</p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 rounded-xl p-4">
              <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">Total Overdue</p>
              <p className="text-3xl font-bold text-orange-700 dark:text-orange-300">₹{defaulters.reduce((s, a) => s + (a.amount - a.discount + a.fine), 0).toLocaleString("en-IN")}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-sm text-muted-foreground font-medium">Selected for Reminder</p>
              <p className="text-3xl font-bold">{selectedDefaulters.length}</p>
            </div>
          </div>

          {/* Bulk action bar */}
          <div className="flex items-center gap-3 mb-4 no-print">
            <button type="button" onClick={() => setSelectedDefaulterIds(new Set(defaulterStudentIds))}
              className="text-xs border border-border px-3 py-1.5 rounded-lg hover:bg-muted">
              Select All ({defaulterStudentIds.length})
            </button>
            {selectedDefaulters.length > 0 && (
              <>
                <button type="button" onClick={() => setSelectedDefaulterIds(new Set())}
                  className="text-xs border border-border px-3 py-1.5 rounded-lg hover:bg-muted">Clear</button>
                <button type="button" onClick={() => window.print()}
                  className="flex items-center gap-1.5 text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700">
                  <Printer className="w-3.5 h-3.5" /> Print {selectedDefaulters.length} Fee Reminder{selectedDefaulters.length > 1 ? "s" : ""}
                </button>
              </>
            )}
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm no-print">
            <table className="w-full edu-table">
              <thead>
                <tr>
                  <th className="w-8">
                    <input type="checkbox" title="Select all"
                      checked={selectedDefaulters.length === defaulterStudentIds.length && defaulterStudentIds.length > 0}
                      onChange={e => e.target.checked ? setSelectedDefaulterIds(new Set(defaulterStudentIds)) : setSelectedDefaulterIds(new Set())} />
                  </th>
                  <th>Student</th><th>Fee Items</th><th>Max Overdue</th><th>Total Due</th><th>Late Fine</th><th>Grand Total</th>
                </tr>
              </thead>
              <tbody>
                {defaulterStudentIds.length === 0 && <tr><td colSpan={7} className="text-center text-muted-foreground py-12">No defaulters! All fees are up to date.</td></tr>}
                {defaulterStudentIds.map(sid => {
                  const items = defaultersByStudent[sid];
                  const maxOverdue = Math.max(...items.map(a => Math.floor((today.getTime() - new Date(a.due_date).getTime()) / 86400000)));
                  const totalBase = items.reduce((s, a) => s + (a.amount - a.discount), 0);
                  const totalLateFine = items.reduce((s, a) => {
                    const days = Math.floor((today.getTime() - new Date(a.due_date).getTime()) / 86400000);
                    return s + days * (a.late_fine_per_day || 0);
                  }, 0);
                  return (
                    <tr key={sid} className={selectedDefaulterIds.has(sid) ? "bg-red-50 dark:bg-red-500/5" : ""}>
                      <td><input type="checkbox" title="Select" checked={selectedDefaulterIds.has(sid)} onChange={() => toggleDefaulterSelect(sid)} /></td>
                      <td className="font-medium">{items[0].student_name}</td>
                      <td><span className="badge-red">{items.length} item{items.length > 1 ? "s" : ""}</span></td>
                      <td><span className="badge-yellow">{maxOverdue} days</span></td>
                      <td>₹{totalBase.toLocaleString("en-IN")}</td>
                      <td className="text-red-500">{totalLateFine > 0 ? `₹${totalLateFine.toLocaleString("en-IN")}` : "—"}</td>
                      <td className="font-bold text-red-600">₹{(totalBase + totalLateFine).toLocaleString("en-IN")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ─── PRINT LAYOUT: Fee Reminder Slips ─── */}
          {selectedDefaulters.length > 0 && (
            <div className="hidden print:block print-full">
              {selectedDefaulters.map((sid, idx) => {
                const items = defaultersByStudent[sid];
                const stu = studentMeta[sid];
                const printDate = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
                const totalBase = items.reduce((s, a) => s + (a.amount - a.discount), 0);
                const totalLateFine = items.reduce((s, a) => {
                  const days = Math.floor((today.getTime() - new Date(a.due_date).getTime()) / 86400000);
                  return s + days * (a.late_fine_per_day || 0);
                }, 0);
                const grandTotal = totalBase + totalLateFine;
                return (
                  <div key={sid} className={`p-8 ${idx > 0 ? "print:break-before-page" : ""}`}>
                    {/* School header */}
                    <div className="text-center border-b-2 border-gray-800 pb-3 mb-5">
                      <h1 className="text-xl font-bold uppercase tracking-wide">{school?.name || subdomain + " School"}</h1>
                      {school?.address && <p className="text-xs text-gray-600">{school.address}</p>}
                      {school?.phone && <p className="text-xs text-gray-600">Ph: {school.phone}</p>}
                    </div>
                    {/* Title */}
                    <div className="text-center mb-5">
                      <div className="inline-flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-1.5 mb-2">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <h2 className="text-base font-bold uppercase text-red-700">Fee Payment Reminder</h2>
                      </div>
                      <p className="text-xs text-gray-500">Date: {printDate}</p>
                    </div>
                    {/* To */}
                    <p className="text-sm mb-1"><strong>To,</strong></p>
                    <p className="text-sm font-semibold">{stu?.father_name ? `Mr./Mrs. ${stu.father_name}` : "Parent / Guardian"}</p>
                    <p className="text-sm text-gray-600 mb-4">Parent of: <strong>{items[0].student_name}</strong>{stu?.roll_number ? ` (Roll No. ${stu.roll_number})` : ""}</p>
                    {/* Body */}
                    <p className="text-sm leading-relaxed mb-4">
                      Dear Parent,<br /><br />
                      This is to inform you that the following fees are <strong>overdue</strong> for your ward <strong>{items[0].student_name}</strong>.
                      Kindly clear the outstanding amount at the earliest to avoid any inconvenience.
                    </p>
                    {/* Fee table */}
                    <table className="w-full border-collapse text-sm mb-4">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 px-3 py-2 text-left">#</th>
                          <th className="border border-gray-300 px-3 py-2 text-left">Fee Head</th>
                          <th className="border border-gray-300 px-3 py-2 text-left">Due Date</th>
                          <th className="border border-gray-300 px-3 py-2 text-right">Amount</th>
                          <th className="border border-gray-300 px-3 py-2 text-right">Discount</th>
                          <th className="border border-gray-300 px-3 py-2 text-right">Late Fine</th>
                          <th className="border border-gray-300 px-3 py-2 text-right">Net Due</th>
                          <th className="border border-gray-300 px-3 py-2 text-center">Days</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((a, i) => {
                          const daysOverdue = Math.floor((today.getTime() - new Date(a.due_date).getTime()) / 86400000);
                          const lateFine = daysOverdue * (a.late_fine_per_day || 0);
                          const net = (a.amount - a.discount) + lateFine;
                          return (
                            <tr key={a.id}>
                              <td className="border border-gray-200 px-3 py-2 text-center">{i + 1}</td>
                              <td className="border border-gray-200 px-3 py-2 font-medium">{a.fee_name}</td>
                              <td className="border border-gray-200 px-3 py-2">{new Date(a.due_date).toLocaleDateString("en-IN")}</td>
                              <td className="border border-gray-200 px-3 py-2 text-right">₹{Number(a.amount).toLocaleString("en-IN")}</td>
                              <td className="border border-gray-200 px-3 py-2 text-right text-green-700">{a.discount > 0 ? `-₹${a.discount}` : "—"}</td>
                              <td className="border border-gray-200 px-3 py-2 text-right text-red-600">{lateFine > 0 ? `₹${lateFine.toLocaleString("en-IN")}` : "—"}</td>
                              <td className="border border-gray-200 px-3 py-2 text-right font-semibold">₹{net.toLocaleString("en-IN")}</td>
                              <td className="border border-gray-200 px-3 py-2 text-center text-red-600 font-semibold">{daysOverdue}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-red-50 font-bold">
                          <td colSpan={6} className="border border-gray-300 px-3 py-2 text-right text-red-700">Total Amount Due:</td>
                          <td className="border border-gray-300 px-3 py-2 text-right text-red-700">₹{grandTotal.toLocaleString("en-IN")}</td>
                          <td className="border border-gray-300"></td>
                        </tr>
                      </tfoot>
                    </table>
                    <p className="text-xs text-gray-500 italic mb-8">
                      Please ignore if payment has already been made. For any queries, contact the school office.
                      {school?.phone ? ` Ph: ${school.phone}` : ""}
                    </p>
                    {/* Signatures */}
                    <div className="flex justify-between mt-6">
                      <div className="text-center">
                        <div className="border-t border-gray-600 pt-1 w-36">
                          <p className="text-xs font-semibold text-gray-700">Parent Signature</p>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="border-t border-gray-600 pt-1 w-40">
                          <p className="text-xs font-semibold text-gray-700">Accounts / Office Seal</p>
                          <p className="text-xs text-gray-500">{school?.name}</p>
                        </div>
                      </div>
                    </div>
                    {/* Tear-off */}
                    <div className="mt-10 border-t-2 border-dashed border-gray-400 pt-3">
                      <p className="text-xs text-gray-500 text-center mb-3">— Cut here and return to school office —</p>
                      <div className="flex justify-between items-end text-xs">
                        <div>
                          <p><strong>Student:</strong> {items[0].student_name}</p>
                          <p><strong>Amount Paid:</strong> ₹ ____________</p>
                          <p><strong>Date of Payment:</strong> _______________</p>
                        </div>
                        <div>
                          <p><strong>Receipt No.:</strong> _______________</p>
                          <p><strong>Mode:</strong> ___________________</p>
                          <div className="border-t border-gray-500 pt-1 mt-6 w-36 text-center">
                            <p>Office Signature</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showAddStructure && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Add Fee Structure</h2>
              <button type="button" title="Close" onClick={() => setShowAddStructure(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={saveStructure} className="space-y-3">
              <input required value={structureForm.name} onChange={e => setStructureForm(p => ({ ...p, name: e.target.value }))} placeholder="Fee Name (e.g. Tuition Fee)" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
              <input value={structureForm.description} onChange={e => setStructureForm(p => ({ ...p, description: e.target.value }))} placeholder="Description (optional)" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
              <div className="grid grid-cols-2 gap-3">
                <input required type="number" value={structureForm.amount} onChange={e => setStructureForm(p => ({ ...p, amount: e.target.value }))} placeholder="Amount (₹)" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                <select title="Frequency" value={structureForm.frequency} onChange={e => setStructureForm(p => ({ ...p, frequency: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                  <option value="one_time">One Time</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" value={structureForm.late_fine_per_day} onChange={e => setStructureForm(p => ({ ...p, late_fine_per_day: e.target.value }))} placeholder="Late fine/day (₹)" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                <input value={structureForm.academic_year} onChange={e => setStructureForm(p => ({ ...p, academic_year: e.target.value }))} placeholder="Academic year 2024-25" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={structureForm.is_active} onChange={e => setStructureForm(p => ({ ...p, is_active: e.target.checked }))} /> Active</label>
              <button type="submit" disabled={saving} className="w-full py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-50">{saving ? "Saving…" : "Create Fee Structure"}</button>
            </form>
          </div>
        </div>
      )}

      {showAssign && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Assign Fee</h2>
              <button type="button" title="Close" onClick={() => setShowAssign(false)}><X className="w-5 h-5" /></button>
            </div>
            {/* Single vs Bulk mode */}
            <div className="flex gap-1 bg-muted/50 rounded-lg p-1 mb-3 w-full">
              {(["single", "bulk"] as const).map(m => (
                <button key={m} type="button" onClick={() => setAssignMode(m)}
                  className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-all ${assignMode === m ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {m === "single" ? "Single Student" : "Bulk (by Class)"}
                </button>
              ))}
            </div>
            <form onSubmit={saveAssign} className="space-y-3">
              {assignMode === "single" ? (
                <select required title="Select student" value={assignForm.student_id} onChange={e => setAssignForm(p => ({ ...p, student_id: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                  <option value="">Select Student</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              ) : (
                <div>
                  <select title="Select class" value={bulkClassId} onChange={e => setBulkClassId(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                    <option value="all">All Students ({students.length})</option>
                    {classes.map(c => {
                      const n = students.filter(s => s.class_id === c.id).length;
                      return <option key={c.id} value={c.id}>{classLabel(c)} ({n})</option>;
                    })}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Will assign to {(bulkClassId === "all" ? students.length : students.filter(s => s.class_id === bulkClassId).length)} student(s) · already-assigned are skipped.
                  </p>
                </div>
              )}
              <select required title="Select fee structure" value={assignForm.fee_structure_id} onChange={e => { const fs = structures.find(s => s.id === e.target.value); setAssignForm(p => ({ ...p, fee_structure_id: e.target.value, amount: fs ? String(fs.amount) : p.amount })); }} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                <option value="">Select Fee Structure</option>
                {structures.filter(s => s.is_active).map(s => <option key={s.id} value={s.id}>{s.name} — ₹{Number(s.amount).toLocaleString("en-IN")}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Due Date</label><input required title="Due date" type="date" value={assignForm.due_date} onChange={e => setAssignForm(p => ({ ...p, due_date: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Amount (₹)</label><input required title="Amount" type="number" value={assignForm.amount} onChange={e => setAssignForm(p => ({ ...p, amount: e.target.value }))} placeholder="Amount (₹)" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              </div>
              <input type="number" value={assignForm.discount} onChange={e => setAssignForm(p => ({ ...p, discount: e.target.value }))} placeholder="Discount (₹) — optional" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
              <button type="submit" disabled={saving} className="w-full py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-50">{saving ? "Saving…" : "Assign Fee"}</button>
            </form>
          </div>
        </div>
      )}

      {showCollect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Collect Payment</h2>
              <button type="button" title="Close" onClick={() => setShowCollect(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 mb-4 text-sm">
              <p className="font-medium">{showCollect.student_name}</p>
              <p className="text-muted-foreground">{showCollect.fee_name} — Due: {new Date(showCollect.due_date).toLocaleDateString("en-IN")}</p>
            </div>
            <form onSubmit={collectPayment} className="space-y-3">
              <select title="Payment mode" value={collectForm.payment_mode} onChange={e => setCollectForm(p => ({ ...p, payment_mode: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="online">Online Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="dd">Demand Draft</option>
              </select>
              <input required type="number" value={collectForm.amount_paid} onChange={e => setCollectForm(p => ({ ...p, amount_paid: e.target.value }))} placeholder="Amount Paid (₹)" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
              <input value={collectForm.remarks} onChange={e => setCollectForm(p => ({ ...p, remarks: e.target.value }))} placeholder="Remarks (optional)" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
              <button type="submit" disabled={saving} className="w-full py-2 bg-green-600 text-white rounded-lg font-medium text-sm hover:bg-green-700 disabled:opacity-50">{saving ? "Processing…" : "Confirm & Generate Receipt"}</button>
            </form>
          </div>
        </div>
      )}

      {showPrintReceipt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl text-gray-800">
            <div className="text-center mb-6 border-b pb-4">
              <h2 className="text-xl font-black uppercase">{subdomain} School</h2>
              <p className="text-sm text-gray-500 mt-1">Fee Receipt</p>
            </div>
            <div className="space-y-2 text-sm mb-6">
              {[
                ["Receipt No.", showPrintReceipt.receipt_number],
                ["Student", showPrintReceipt.student_name],
                ["Amount Paid", `₹${Number(showPrintReceipt.amount_paid).toLocaleString("en-IN")}`],
                ["Payment Mode", showPrintReceipt.payment_mode],
                ["Date", new Date(showPrintReceipt.paid_at).toLocaleDateString("en-IN")],
                ...(showPrintReceipt.remarks ? [["Remarks", showPrintReceipt.remarks]] : []),
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-gray-100 pb-1">
                  <span className="text-gray-500">{k}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => window.print()} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"><Printer className="w-4 h-4" />Print</button>
              <button type="button" onClick={() => setShowPrintReceipt(null)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
