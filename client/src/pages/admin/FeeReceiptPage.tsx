import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Search, Printer, IndianRupee, CheckCircle } from "lucide-react";

type Student = {
  id: string; name: string; roll_number: string; father_name?: string; phone?: string;
  address?: string; class_name?: string; admission_number?: string;
};
type Assignment = {
  id: string; student_id: string; amount: number; discount: number; fine: number;
  status: string; paid_date?: string; receipt_number?: string; fee_name?: string;
  student?: Student;
};
type School = { name: string; address?: string; phone?: string; email?: string };

export function FeeReceiptPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [students, setStudents]   = useState<Student[]>([]);
  const [selected, setSelected]   = useState<Student | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [school, setSchool]       = useState<School>({ name: "" });
  const [search, setSearch]       = useState("");
  const [showSearch, setShowSearch] = useState(true);
  const [printIds, setPrintIds]   = useState<Set<string>>(new Set());
  const [printData, setPrintData] = useState<Assignment[] | null>(null);
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!schoolId) return;
    Promise.all([
      supabase.from("students").select("id, name, roll_number, father_name, phone, address, admission_number, class_id").eq("school_id", schoolId).order("name"),
      supabase.from("schools").select("name, address, phone, email").eq("id", schoolId).single(),
    ]).then(([sRes, schRes]) => {
      const classes = supabase.from("classes").select("id, name").eq("school_id", schoolId);
      classes.then(cRes => {
        const cm = Object.fromEntries((cRes.data || []).map((c: { id: string; name: string }) => [c.id, c.name]));
        setStudents((sRes.data || []).map((s: Student & { class_id: string }) => ({ ...s, class_name: cm[s.class_id] || "" })));
      });
      setSchool(schRes.data || { name: "" });
    });
  }, [schoolId]);

  async function selectStudent(stu: Student) {
    setSelected(stu);
    setShowSearch(false);
    const [aRes, fRes] = await Promise.all([
      supabase.from("student_fee_assignments").select("id, student_id, amount, discount, fine, status, paid_date, receipt_number").eq("school_id", schoolId).eq("student_id", stu.id),
      supabase.from("fee_structures").select("id, name").eq("school_id", schoolId),
    ]);
    const fMap = Object.fromEntries((fRes.data || []).map((f: { id: string; name: string }) => [f.id, f.name]));
    setAssignments((aRes.data || []).map((a: Assignment & { fee_structure_id?: string }) => ({ ...a, fee_name: fMap[a.fee_structure_id || ""] || "School Fee", student: stu })));
    setPrintIds(new Set((aRes.data || []).filter((a: Assignment) => a.status === "paid").map((a: Assignment) => a.id)));
  }

  function net(a: Assignment) { return Math.max(0, (a.amount || 0) - (a.discount || 0) + (a.fine || 0)); }

  function handlePrint(single?: Assignment) {
    const toPrint = single ? [single] : assignments.filter(a => printIds.has(a.id));
    if (!toPrint.length) return;
    setPrintData(toPrint);
    setTimeout(() => window.print(), 300);
  }

  function genReceiptNo(a: Assignment, idx: number) {
    return a.receipt_number || `RCT/${new Date(receiptDate).getFullYear()}/${String(idx + 1).padStart(5, "0")}`;
  }

  const filteredStudents = students.filter(s =>
    search.length > 1 && (
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.admission_number || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.roll_number || "").includes(search)
    )
  );

  const paidTotal = assignments.filter(a => printIds.has(a.id)).reduce((s, a) => s + net(a), 0);

  return (
    <div>
      {/* Screen */}
      <div className="no-print">
        <div className="page-header flex items-center justify-between">
          <div>
            <h1>Fee Receipt Print</h1>
            <p>Search student → select paid fees → print official receipt with serial number</p>
          </div>
          {selected && (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { setSelected(null); setShowSearch(true); setAssignments([]); setSearch(""); }}
                className="px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted">
                ← Change Student
              </button>
              <button type="button" onClick={() => handlePrint()} disabled={printIds.size === 0}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                <Printer className="w-4 h-4" /> Print Receipt ({printIds.size})
              </button>
            </div>
          )}
        </div>

        {/* Student search */}
        {showSearch && (
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm mb-6 max-w-xl">
            <p className="font-semibold mb-3">Search Student</p>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} autoFocus
                placeholder="Type student name, admission number or roll number…"
                className="pl-9 pr-4 py-2.5 border border-border rounded-lg text-sm bg-background w-full" />
            </div>
            {search.length > 1 && (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {filteredStudents.length === 0 && <p className="text-sm text-muted-foreground py-2">No students found.</p>}
                {filteredStudents.map(s => (
                  <button key={s.id} type="button" onClick={() => selectStudent(s)}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-muted/60 transition-colors border border-transparent hover:border-border">
                    <p className="font-medium text-sm">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.class_name} · Adm: {s.admission_number || "—"} · Roll: {s.roll_number || "—"}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Student + fee list */}
        {selected && (
          <>
            {/* Student card */}
            <div className="bg-card rounded-xl border border-border p-4 shadow-sm mb-5 flex items-start justify-between">
              <div>
                <p className="font-bold text-base">{selected.name}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-sm text-muted-foreground">
                  <span>Class: {selected.class_name}</span>
                  <span>Adm. No: {selected.admission_number || "—"}</span>
                  <span>Father: {selected.father_name || "—"}</span>
                  <span>Phone: {selected.phone || "—"}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground mb-1">Receipt Date</p>
                <input type="date" value={receiptDate} onChange={e => setReceiptDate(e.target.value)}
                  className="border border-border rounded-lg px-2 py-1 text-sm bg-background" />
              </div>
            </div>

            {/* Fee assignments */}
            <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm mb-4">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
                <p className="font-semibold text-sm">Fee Details</p>
                <p className="text-xs text-muted-foreground">Check fees to include in receipt</p>
              </div>
              <table className="w-full edu-table">
                <thead><tr><th className="w-10"></th><th>Fee Head</th><th>Amount</th><th>Discount</th><th>Fine</th><th>Net</th><th>Status</th><th>Paid Date</th><th></th></tr></thead>
                <tbody>
                  {assignments.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">No fee records found for this student.</td></tr>}
                  {assignments.map(a => (
                    <tr key={a.id} className={a.status === "paid" ? "" : "opacity-50"}>
                      <td>
                        <input type="checkbox" checked={printIds.has(a.id)} disabled={a.status !== "paid"}
                          onChange={e => { const s = new Set(printIds); e.target.checked ? s.add(a.id) : s.delete(a.id); setPrintIds(s); }}
                          className="w-4 h-4" />
                      </td>
                      <td className="font-medium">{a.fee_name}</td>
                      <td>₹{(a.amount || 0).toLocaleString("en-IN")}</td>
                      <td className="text-green-600">{a.discount ? `- ₹${a.discount.toLocaleString("en-IN")}` : "—"}</td>
                      <td className="text-red-600">{a.fine ? `+ ₹${a.fine.toLocaleString("en-IN")}` : "—"}</td>
                      <td className="font-semibold">₹{net(a).toLocaleString("en-IN")}</td>
                      <td><span className={a.status === "paid" ? "badge-green" : a.status === "pending" ? "badge-yellow" : "badge-red"}>{a.status}</span></td>
                      <td className="text-sm">{a.paid_date ? new Date(a.paid_date).toLocaleDateString("en-IN") : "—"}</td>
                      <td>
                        {a.status === "paid" && (
                          <button type="button" onClick={() => handlePrint(a)} className="text-xs text-primary hover:underline flex items-center gap-1">
                            <Printer className="w-3 h-3" /> Print
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {printIds.size > 0 && (
              <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl p-4">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span>{printIds.size} fee head{printIds.size > 1 ? "s" : ""} selected</span>
                  <span className="font-bold">· Total: ₹{paidTotal.toLocaleString("en-IN")}</span>
                </div>
                <button type="button" onClick={() => handlePrint()}
                  className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
                  <Printer className="w-4 h-4" /> Print Receipt
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* PRINT VIEW */}
      {printData && selected && (
        <div className="hidden print:block print-full">
          {/* Two copies: original + duplicate */}
          {["ORIGINAL", "DUPLICATE"].map((copy, ci) => (
            <div key={copy} style={{ fontFamily: "Arial, sans-serif", maxWidth: "680px", margin: ci === 0 ? "0 auto 24px" : "0 auto", border: "2px solid #000", padding: "20px", fontSize: "12px", pageBreakAfter: ci === 0 ? "always" : "auto" }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #000", paddingBottom: "10px", marginBottom: "12px" }}>
                <div>
                  <p style={{ fontSize: "16px", fontWeight: "bold", textTransform: "uppercase" }}>{school.name}</p>
                  {school.address && <p style={{ fontSize: "10px", color: "#555", marginTop: "2px" }}>{school.address}</p>}
                  {school.phone  && <p style={{ fontSize: "10px", color: "#555" }}>Ph: {school.phone}</p>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: "14px", fontWeight: "bold" }}>FEE RECEIPT</p>
                  <p style={{ fontSize: "10px", color: "#555", marginTop: "2px" }}>({copy})</p>
                  <p style={{ fontSize: "11px", fontWeight: "bold", marginTop: "4px", fontFamily: "monospace" }}>
                    {genReceiptNo(printData[0], 0)}
                  </p>
                </div>
              </div>

              {/* Student info */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "12px", fontSize: "11px" }}>
                <div><strong>Student Name:</strong> {selected.name}</div>
                <div><strong>Class:</strong> {selected.class_name}</div>
                <div><strong>Father's Name:</strong> {selected.father_name || "—"}</div>
                <div><strong>Adm. No:</strong> {selected.admission_number || "—"}</div>
                <div><strong>Receipt Date:</strong> {new Date(receiptDate).toLocaleDateString("en-IN")}</div>
                <div><strong>Phone:</strong> {selected.phone || "—"}</div>
              </div>

              {/* Fee table */}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", marginBottom: "12px" }}>
                <thead>
                  <tr style={{ background: "#f0f0f0" }}>
                    <th style={{ border: "1px solid #999", padding: "5px 8px", textAlign: "left" }}>Fee Head</th>
                    <th style={{ border: "1px solid #999", padding: "5px 8px", textAlign: "right" }}>Amount</th>
                    <th style={{ border: "1px solid #999", padding: "5px 8px", textAlign: "right" }}>Discount</th>
                    <th style={{ border: "1px solid #999", padding: "5px 8px", textAlign: "right" }}>Fine</th>
                    <th style={{ border: "1px solid #999", padding: "5px 8px", textAlign: "right" }}>Net Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {printData.map(a => (
                    <tr key={a.id}>
                      <td style={{ border: "1px solid #ccc", padding: "5px 8px" }}>{a.fee_name}</td>
                      <td style={{ border: "1px solid #ccc", padding: "5px 8px", textAlign: "right" }}>₹{(a.amount || 0).toLocaleString("en-IN")}</td>
                      <td style={{ border: "1px solid #ccc", padding: "5px 8px", textAlign: "right", color: "#16a34a" }}>{a.discount ? `₹${a.discount.toLocaleString("en-IN")}` : "—"}</td>
                      <td style={{ border: "1px solid #ccc", padding: "5px 8px", textAlign: "right", color: "#dc2626" }}>{a.fine ? `₹${a.fine.toLocaleString("en-IN")}` : "—"}</td>
                      <td style={{ border: "1px solid #ccc", padding: "5px 8px", textAlign: "right", fontWeight: "bold" }}>₹{net(a).toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                  <tr style={{ background: "#f9f9f9", fontWeight: "bold" }}>
                    <td colSpan={4} style={{ border: "1px solid #999", padding: "6px 8px", textAlign: "right" }}>TOTAL AMOUNT PAID</td>
                    <td style={{ border: "1px solid #999", padding: "6px 8px", textAlign: "right", fontSize: "13px" }}>
                      ₹{printData.reduce((s, a) => s + net(a), 0).toLocaleString("en-IN")}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Amount in words */}
              <p style={{ fontSize: "11px", marginBottom: "16px", fontStyle: "italic" }}>
                Amount in Words: <strong>Rupees {printData.reduce((s, a) => s + net(a), 0).toLocaleString("en-IN")} Only</strong>
              </p>

              {/* Payment mode */}
              <div style={{ display: "flex", gap: "24px", fontSize: "11px", marginBottom: "20px" }}>
                <span>Mode of Payment: <strong>Cash / Online / Cheque</strong></span>
              </div>

              {/* Signatures */}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", borderTop: "1px solid #ccc", paddingTop: "12px" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ borderTop: "1px solid #000", width: "130px", paddingTop: "4px" }}>Parent's Signature</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ borderTop: "1px solid #000", width: "130px", paddingTop: "4px" }}>Cashier / Accountant</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ borderTop: "1px solid #000", width: "130px", paddingTop: "4px" }}>Principal</div>
                </div>
              </div>

              <p style={{ textAlign: "center", marginTop: "10px", fontSize: "9px", color: "#aaa" }}>
                This is a computer-generated receipt. · {school.name}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
