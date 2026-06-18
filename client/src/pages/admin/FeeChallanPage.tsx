import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Printer, Search } from "lucide-react";

type Student = {
  id: string;
  name: string;
  roll_number: string;
  admission_number: string;
  father_name: string;
  phone: string;
  class_id: string;
  classes?: { name: string } | null;
};

type FeeAssignment = {
  id: string;
  student_id: string;
  amount: number;
  discount: number;
  fine: number;
  due_date: string;
  status: string;
  month: number | null;
  year: number | null;
  fee_structures?: { name: string; frequency: string } | null;
};

type School = { name: string; address?: string; phone?: string };

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export function FeeChallanPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<FeeAssignment[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    setLoading(true);
    Promise.all([
      supabase.from("students").select("id, name, roll_number, admission_number, father_name, phone, class_id, classes(name)").eq("school_id", schoolId).order("name"),
      supabase.from("student_fee_assignments").select("id, student_id, amount, discount, fine, due_date, status, month, year, fee_structures(name, frequency)").eq("school_id", schoolId).order("due_date"),
      supabase.from("classes").select("id, name").eq("school_id", schoolId).order("name"),
      supabase.from("schools").select("name, address, phone").eq("id", schoolId).single(),
    ]).then(([studsRes, assRes, classRes, schoolRes]) => {
      setStudents(studsRes.data || []);
      setAssignments(assRes.data || []);
      setClasses(classRes.data || []);
      if (schoolRes.data) setSchool(schoolRes.data as School);
      setLoading(false);
    });
  }, [schoolId]);

  // Group assignments by student_id
  const assignmentsByStudent = assignments.reduce<Record<string, FeeAssignment[]>>((acc, a) => {
    if (!acc[a.student_id]) acc[a.student_id] = [];
    acc[a.student_id].push(a);
    return acc;
  }, {});

  const filtered = students.filter((s) => {
    const matchClass = classFilter === "all" || s.class_id === classFilter;
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.admission_number?.includes(search);
    const stuAssignments = assignmentsByStudent[s.id] || [];
    const matchStatus = statusFilter === "all" || stuAssignments.some((a) => a.status === statusFilter);
    return matchClass && matchSearch && (statusFilter === "all" ? true : matchStatus);
  });

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function selectAll() { setSelectedIds(new Set(filtered.map((s) => s.id))); }
  function clearAll() { setSelectedIds(new Set()); }

  const printStudents = filtered.filter((s) => selectedIds.has(s.id));

  function netAmount(a: FeeAssignment) {
    return Math.max(0, (a.amount || 0) - (a.discount || 0) + (a.fine || 0));
  }

  function studentTotal(studentId: string) {
    return (assignmentsByStudent[studentId] || [])
      .filter((a) => statusFilter === "all" || a.status === statusFilter)
      .reduce((sum, a) => sum + netAmount(a), 0);
  }

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Fee Challan / Demand Notice</h1>
          <p>Generate and print bulk fee challans for students</p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={selectedIds.size === 0}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          <Printer className="w-4 h-4" /> Print {selectedIds.size > 0 ? `${selectedIds.size} Challans` : "Selected"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4 no-print">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student…"
            className="border border-border rounded-lg pl-9 pr-3 py-2 text-sm bg-background w-56" />
        </div>
        <select title="Filter by class" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
          <option value="all">All Classes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select title="Filter by fee status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
        </select>
        <button type="button" onClick={selectAll} className="text-xs border border-border px-3 py-1.5 rounded-lg hover:bg-muted">
          Select All ({filtered.length})
        </button>
        {selectedIds.size > 0 && (
          <button type="button" onClick={clearAll} className="text-xs border border-border px-3 py-1.5 rounded-lg hover:bg-muted">Clear</button>
        )}
        <span className="text-sm text-muted-foreground ml-auto">{selectedIds.size} selected</span>
      </div>

      {/* Student selection table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm no-print">
        <table className="w-full edu-table">
          <thead>
            <tr>
              <th className="w-8">
                <input type="checkbox" title="Select all"
                  checked={selectedIds.size === filtered.length && filtered.length > 0}
                  onChange={(e) => e.target.checked ? selectAll() : clearAll()} />
              </th>
              <th>Student</th>
              <th>Class</th>
              <th>Adm No</th>
              <th>Fee Items</th>
              <th>Total Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="text-center text-muted-foreground py-10">Loading…</td></tr>}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center text-muted-foreground py-10">No students found.</td></tr>
            )}
            {filtered.map((s) => {
              const stuAss = (assignmentsByStudent[s.id] || []).filter((a) => statusFilter === "all" || a.status === statusFilter);
              const total = stuAss.reduce((sum, a) => sum + netAmount(a), 0);
              const hasAny = stuAss.length > 0;
              const cls = (s.classes as { name: string } | null)?.name || "—";
              return (
                <tr key={s.id} className={selectedIds.has(s.id) ? "bg-primary/5" : ""}>
                  <td>
                    <input type="checkbox" title="Select student" checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)} />
                  </td>
                  <td className="font-medium">{s.name}</td>
                  <td>{cls}</td>
                  <td className="font-mono text-sm">{s.admission_number || "—"}</td>
                  <td className="text-sm text-muted-foreground">{stuAss.length} item{stuAss.length !== 1 ? "s" : ""}</td>
                  <td className="font-semibold">₹{total.toLocaleString("en-IN")}</td>
                  <td>
                    {hasAny ? (
                      <span className={stuAss.every((a) => a.status === "paid") ? "badge-green" : stuAss.some((a) => a.status === "partial") ? "badge-blue" : "badge-yellow"}>
                        {stuAss.every((a) => a.status === "paid") ? "Paid" : stuAss.some((a) => a.status === "partial") ? "Partial" : "Pending"}
                      </span>
                    ) : <span className="text-muted-foreground text-xs">No fees</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ─── PRINT LAYOUT ─── */}
      {printStudents.length > 0 && (
        <div className="hidden print:block print-full">
          {printStudents.map((s, idx) => {
            const stuAss = (assignmentsByStudent[s.id] || []).filter((a) => statusFilter === "all" || a.status === statusFilter);
            const total = stuAss.reduce((sum, a) => sum + netAmount(a), 0);
            const cls = (s.classes as { name: string } | null)?.name || "—";
            const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
            return (
              <div key={s.id} className={`p-6 ${idx > 0 ? "print:break-before-page" : ""}`}>
                {/* School header */}
                <div className="text-center border-b-2 border-gray-800 pb-3 mb-4">
                  <h1 className="text-lg font-bold uppercase tracking-wide">{school?.name || "School"}</h1>
                  {school?.address && <p className="text-xs text-gray-600">{school.address}</p>}
                  {school?.phone && <p className="text-xs text-gray-600">Ph: {school.phone}</p>}
                </div>
                <div className="text-center mb-4">
                  <h2 className="text-base font-bold uppercase underline">Fee Demand Notice</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Date: {today}</p>
                </div>
                {/* Student details */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm mb-4 bg-gray-50 p-3 rounded border border-gray-200">
                  <div><span className="text-gray-500">Student Name:</span> <strong>{s.name}</strong></div>
                  <div><span className="text-gray-500">Class:</span> <strong>{cls}</strong></div>
                  <div><span className="text-gray-500">Admission No:</span> <strong>{s.admission_number || "—"}</strong></div>
                  <div><span className="text-gray-500">Roll No:</span> <strong>{s.roll_number || "—"}</strong></div>
                  {s.father_name && <div><span className="text-gray-500">Father:</span> <strong>{s.father_name}</strong></div>}
                  {s.phone && <div><span className="text-gray-500">Phone:</span> <strong>{s.phone}</strong></div>}
                </div>
                {/* Fee items */}
                <table className="w-full border-collapse text-sm mb-4">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-3 py-2 text-left">#</th>
                      <th className="border border-gray-300 px-3 py-2 text-left">Fee Head</th>
                      <th className="border border-gray-300 px-3 py-2 text-left">Period</th>
                      <th className="border border-gray-300 px-3 py-2 text-left">Due Date</th>
                      <th className="border border-gray-300 px-3 py-2 text-right">Amount</th>
                      <th className="border border-gray-300 px-3 py-2 text-right">Discount</th>
                      <th className="border border-gray-300 px-3 py-2 text-right">Fine</th>
                      <th className="border border-gray-300 px-3 py-2 text-right">Net</th>
                      <th className="border border-gray-300 px-3 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stuAss.length === 0 ? (
                      <tr><td colSpan={9} className="border border-gray-200 text-center text-gray-400 py-4">No pending fees</td></tr>
                    ) : stuAss.map((a, i) => {
                      const fs = a.fee_structures as { name: string; frequency: string } | null;
                      const period = a.month && a.year ? `${MONTHS[a.month - 1]} ${a.year}` : a.due_date ? new Date(a.due_date).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "—";
                      return (
                        <tr key={a.id}>
                          <td className="border border-gray-200 px-3 py-2 text-center">{i + 1}</td>
                          <td className="border border-gray-200 px-3 py-2 font-medium">{fs?.name || "Fee"}</td>
                          <td className="border border-gray-200 px-3 py-2">{period}</td>
                          <td className="border border-gray-200 px-3 py-2">{a.due_date ? new Date(a.due_date).toLocaleDateString("en-IN") : "—"}</td>
                          <td className="border border-gray-200 px-3 py-2 text-right">₹{(a.amount || 0).toLocaleString("en-IN")}</td>
                          <td className="border border-gray-200 px-3 py-2 text-right text-green-700">{a.discount > 0 ? `-₹${a.discount}` : "—"}</td>
                          <td className="border border-gray-200 px-3 py-2 text-right text-red-600">{a.fine > 0 ? `₹${a.fine}` : "—"}</td>
                          <td className="border border-gray-200 px-3 py-2 text-right font-semibold">₹{netAmount(a).toLocaleString("en-IN")}</td>
                          <td className="border border-gray-200 px-3 py-2 text-center capitalize">{a.status}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-bold">
                      <td colSpan={7} className="border border-gray-300 px-3 py-2 text-right">Total Amount Due:</td>
                      <td className="border border-gray-300 px-3 py-2 text-right">₹{total.toLocaleString("en-IN")}</td>
                      <td className="border border-gray-300"></td>
                    </tr>
                  </tfoot>
                </table>
                <p className="text-xs text-gray-500 italic mb-6">Kindly pay the above amount by the due date. Late payment will attract additional fine as per school policy.</p>
                <div className="flex justify-between mt-8">
                  <div className="text-center">
                    <div className="border-t border-gray-600 pt-1 w-32">
                      <p className="text-xs font-semibold text-gray-700">Parent Signature</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="border-t border-gray-600 pt-1 w-36">
                      <p className="text-xs font-semibold text-gray-700">Accounts / Office</p>
                      <p className="text-xs text-gray-500">{school?.name}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
