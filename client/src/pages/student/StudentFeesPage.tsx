// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Wallet, CheckCircle2, Clock, AlertCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StudentFeesPage() {
  const params = useParams();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [fees, setFees] = useState<any[]>([]);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("");
  const [schoolName, setSchoolName] = useState("");

  useEffect(() => { fetchFees(); }, []);

  async function fetchFees() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get student record
      const { data: student } = await supabase
        .from("students")
        .select("id, school_id, first_name, last_name, enrollment_number, schools:school_id(name)")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!student) { setLoading(false); return; }
      setStudentId(student.id);
      setStudentName(`${student.first_name || ""} ${student.last_name || ""}`.trim());
      setSchoolName(student.schools?.name || "School");

      // Fee dues assigned by admin — canonical table (same as parent/admin/dashboard)
      const { data: feeData } = await supabase
        .from("student_fee_assignments")
        .select("id, amount, paid_amount, due_date, status, fee_structure:fee_structure_id(name)")
        .eq("student_id", student.id)
        .order("due_date", { ascending: false });

      setFees((feeData || []).map((f: any) => ({
        id: f.id,
        amount: f.amount,
        due_date: f.due_date,
        paid_date: null,
        status: f.status,
        description: f.fee_structure?.name || "School Fee",
        fee_type: f.fee_structure?.name || "Fee",
      })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const totalDue = fees.filter(f => f.status !== "paid").reduce((s, f) => s + (f.amount || 0), 0);
  const totalPaid = fees.filter(f => f.status === "paid").reduce((s, f) => s + (f.amount || 0), 0);

  function printReceipt(fee: any) {
    const paidOn = fee.paid_date ? new Date(fee.paid_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
    const amount = `₹${(fee.amount || 0).toLocaleString("en-IN")}`;
    const receiptNo = `RC-${String(fee.id).slice(0, 8).toUpperCase()}`;
    const w = window.open("", "_blank", "width=480,height=640");
    if (!w) { return; }
    w.document.write(`<!doctype html><html><head><title>Receipt ${receiptNo}</title>
      <style>
        *{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}
        body{padding:28px;color:#111}
        .head{text-align:center;border-bottom:2px solid #7c3aed;padding-bottom:12px;margin-bottom:18px}
        .head h1{margin:0;font-size:20px;color:#7c3aed}
        .head p{margin:4px 0 0;font-size:12px;color:#555}
        .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed #ddd;font-size:14px}
        .row span:first-child{color:#666}
        .total{display:flex;justify-content:space-between;margin-top:14px;padding:12px;background:#f5f3ff;border-radius:8px;font-size:18px;font-weight:bold}
        .stamp{margin-top:22px;text-align:center}
        .stamp span{display:inline-block;border:3px solid #16a34a;color:#16a34a;padding:6px 18px;border-radius:8px;font-weight:bold;transform:rotate(-8deg);letter-spacing:2px}
        .foot{margin-top:26px;text-align:center;font-size:11px;color:#888}
      </style></head><body>
      <div class="head"><h1>${schoolName}</h1><p>Fee Payment Receipt</p></div>
      <div class="row"><span>Receipt No</span><span>${receiptNo}</span></div>
      <div class="row"><span>Student</span><span>${studentName || "—"}</span></div>
      <div class="row"><span>Description</span><span>${fee.description || fee.fee_type || "Fee"}</span></div>
      <div class="row"><span>Payment Date</span><span>${paidOn}</span></div>
      <div class="row"><span>Status</span><span>PAID</span></div>
      <div class="total"><span>Amount Paid</span><span>${amount}</span></div>
      <div class="stamp"><span>PAID</span></div>
      <div class="foot">This is a computer-generated receipt.<br/>${schoolName}</div>
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  const statusStyle = (s: string) => {
    if (s === "paid") return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    if (s === "overdue") return "text-red-400 bg-red-500/10 border-red-500/20";
    return "text-amber-400 bg-amber-500/10 border-amber-500/20";
  };

  const StatusIcon = ({ s }: { s: string }) => {
    if (s === "paid") return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    if (s === "overdue") return <AlertCircle className="w-4 h-4 text-red-400" />;
    return <Clock className="w-4 h-4 text-amber-400" />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Fees & Payments</h1>
        <p className="text-sm text-muted-foreground mt-1">View your fee structure and payment history.</p>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500/50" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="bg-card border-border shadow-xl">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Paid</p>
                  <p className="text-2xl font-bold text-emerald-400">₹{totalPaid.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border shadow-xl">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Outstanding Due</p>
                  <p className="text-2xl font-bold text-amber-400">₹{totalDue.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Fee list */}
          {fees.length === 0 ? (
            <Card className="bg-gradient-to-br from-fuchsia-500/10 via-purple-500/5 to-orange-500/10 rounded-2xl border border-fuchsia-500/20 shadow-xl">
              <CardContent className="p-12 text-center">
                <Wallet className="w-12 h-12 text-fuchsia-400 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-foreground mb-1">No fee records found</h3>
                <p className="text-muted-foreground text-sm">Your fee records will appear here once added by admin.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card border-border shadow-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-foreground text-lg">Fee Details</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left px-6 py-3 font-medium">Description</th>
                        <th className="text-left px-4 py-3 font-medium">Due Date</th>
                        <th className="text-right px-4 py-3 font-medium">Amount</th>
                        <th className="text-center px-4 py-3 font-medium">Status</th>
                        <th className="text-center px-4 py-3 font-medium">Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fees.map((fee, i) => (
                        <tr key={fee.id} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${i === fees.length - 1 ? "border-b-0" : ""}`}>
                          <td className="px-6 py-4">
                            <p className="text-foreground font-medium">{fee.description || fee.fee_type || "Fee"}</p>
                          </td>
                          <td className="px-4 py-4 text-muted-foreground">
                            {fee.due_date ? new Date(fee.due_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                          </td>
                          <td className="px-4 py-4 text-right font-bold text-foreground">
                            ₹{(fee.amount || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusStyle(fee.status)}`}>
                              <StatusIcon s={fee.status} />
                              {fee.status === "paid" ? "Paid" : fee.status === "overdue" ? "Overdue" : "Pending"}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            {fee.status === "paid" ? (
                              <Button size="sm" variant="ghost" onClick={() => printReceipt(fee)} className="text-emerald-500 hover:text-emerald-400 h-7 px-2">
                                <Download className="w-3.5 h-3.5 mr-1" /> Receipt
                              </Button>
                            ) : (
                              <span className="text-muted-foreground/60 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <p className="text-xs text-muted-foreground/60 text-center">For fee payment or disputes, contact your school office.</p>
        </div>
      )}
    </div>
  );
}
