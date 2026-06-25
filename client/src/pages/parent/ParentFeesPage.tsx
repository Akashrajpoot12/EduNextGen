// @ts-nocheck
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "react-router-dom";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Loader2, Wallet, CreditCard, Download, CheckCircle2, AlertTriangle, Users, Clock } from "lucide-react";
import { toast } from "sonner";

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) { resolve(true); return; }
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const STATUS_STYLE: Record<string, string> = {
  paid:    "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  overdue: "bg-red-500/10 text-red-600 border-red-500/20",
  waived:  "bg-blue-500/10 text-blue-600 border-blue-500/20",
};

export function ParentFeesPage() {
  const supabase    = createClient();
  const params      = useParams();
  const tenant      = params.tenantId as string;
  const { tenantId: schoolId } = useTenant();

  const [loading, setLoading]       = useState(true);
  const [children, setChildren]     = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<any>(null);
  const [fees, setFees]             = useState<any[]>([]);
  const [loadingFees, setLoadingFees] = useState(false);
  const [paying, setPaying]         = useState<string | null>(null);
  const [school, setSchool]         = useState<any>(null);
  const [parentUser, setParentUser] = useState<any>(null);

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setParentUser(user);

      const [{ data: kids }, { data: schoolData }] = await Promise.all([
        supabase
          .from("students")
          .select("id, first_name, last_name, enrollment_number, users:user_id(full_name), classes:class_id(grade_level,section)")
          .eq("school_id", schoolId)
          .eq("parent_user_id", user.id),
        supabase.from("schools").select("name, subdomain").eq("id", schoolId).maybeSingle(),
      ]);

      setSchool(schoolData);
      if (kids && kids.length > 0) {
        setChildren(kids);
        setSelectedChild(kids[0]);
      }
      setLoading(false);
    })();
  }, [schoolId]);

  useEffect(() => {
    if (selectedChild) loadFees(selectedChild.id);
  }, [selectedChild]);

  async function loadFees(studentId: string) {
    setLoadingFees(true);
    const { data } = await supabase
      .from("student_fee_assignments")
      .select(`
        id, amount, due_date, status, paid_at, discount, late_fine,
        academic_year, payment_mode, razorpay_payment_id,
        fee_structure:fee_structure_id(name, frequency, description)
      `)
      .eq("student_id", studentId)
      .eq("school_id", schoolId)
      .order("due_date", { ascending: false });
    setFees(data || []);
    setLoadingFees(false);
  }

  const totalPaid    = fees.filter(f => f.status === "paid").reduce((s, f) => s + (f.amount || 0), 0);
  const totalPending = fees.filter(f => f.status !== "paid" && f.status !== "waived").reduce((s, f) => s + (f.amount || 0), 0);
  const overdueFees  = fees.filter(f => f.status === "pending" && new Date(f.due_date) < new Date());

  async function handlePay(fee: any) {
    const ok = await loadRazorpay();
    if (!ok) { toast.error("Razorpay SDK failed to load. Check internet."); return; }

    setPaying(fee.id);
    const toastId = toast.loading("Initializing payment...");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/razorpay/create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            amount: fee.amount,
            receiptNotes: { feeAssignmentId: fee.id, studentId: selectedChild?.id },
          }),
        }
      );

      const order = await res.json();
      if (order.error) { toast.error("Could not create payment order", { id: toastId }); setPaying(null); return; }
      toast.dismiss(toastId);

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency || "INR",
        name: school?.name || "School Fees",
        description: fee.fee_structure?.name || "Fee Payment",
        order_id: order.id,
        prefill: {
          name: parentUser?.user_metadata?.full_name || "",
          email: parentUser?.email || "",
        },
        theme: { color: "#f59e0b" },
        handler: async (payRes: any) => {
          const verifyToast = toast.loading("Verifying payment...");
          const vRes = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/razorpay/verify`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session?.access_token}`,
                apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              },
              body: JSON.stringify({
                razorpay_order_id: payRes.razorpay_order_id,
                razorpay_payment_id: payRes.razorpay_payment_id,
                razorpay_signature: payRes.razorpay_signature,
                feeAssignmentId: fee.id,
              }),
            }
          );
          const vData = await vRes.json();
          if (vData.success) {
            toast.success(`₹${fee.amount.toLocaleString("en-IN")} paid successfully!`, { id: verifyToast });
            // Optimistic update
            setFees(prev => prev.map(f => f.id === fee.id
              ? { ...f, status: "paid", paid_at: new Date().toISOString(), razorpay_payment_id: payRes.razorpay_payment_id }
              : f
            ));
          } else {
            toast.error("Payment verification failed: " + (vData.error || ""), { id: verifyToast });
          }
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", (e: any) => toast.error("Payment failed: " + e.error.description));
      rzp.open();
    } catch (err: any) {
      toast.error("Payment error: " + err.message);
    }
    setPaying(null);
  }

  const fmtDate  = (d: string) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
  const fmtMoney = (n: number) => `₹${(n || 0).toLocaleString("en-IN")}`;

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (children.length === 0) return (
    <div className="text-center py-20 bg-card border border-border rounded-xl">
      <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
      <p className="font-medium">No children linked to your account</p>
      <p className="text-sm text-muted-foreground mt-1">Contact school admin to link your child</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Fees & Payments</h1>
        <p className="text-sm text-muted-foreground mt-1">View and pay your child's school fees online</p>
      </div>

      {/* Child selector */}
      {children.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {children.map(c => (
            <button key={c.id} type="button"
              onClick={() => setSelectedChild(c)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                selectedChild?.id === c.id
                  ? "bg-amber-500 text-foreground border-amber-500"
                  : "border-border hover:bg-muted"
              }`}>
              {c.first_name} {c.last_name}
            </button>
          ))}
        </div>
      )}

      {selectedChild && (
        <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center font-bold text-amber-600">
            {selectedChild.first_name?.[0]}
          </div>
          <div>
            <p className="font-semibold">{selectedChild.first_name} {selectedChild.last_name}</p>
            <p className="text-xs text-muted-foreground">
              Class {selectedChild.classes?.grade_level}-{selectedChild.classes?.section} · {selectedChild.enrollment_number}
            </p>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600">{fmtMoney(totalPaid)}</p>
          <p className="text-xs text-muted-foreground mt-1">Total Paid</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center mb-3">
            <Wallet className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600">{fmtMoney(totalPending)}</p>
          <p className="text-xs text-muted-foreground mt-1">Pending Amount</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center mb-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-600">{overdueFees.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Overdue Fees</p>
        </div>
      </div>

      {/* Overdue alert */}
      {overdueFees.length > 0 && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-600">Payment Overdue!</p>
            <p className="text-sm text-red-500 mt-0.5">
              {overdueFees.length} fee(s) are past due date. Please pay immediately to avoid late fines.
            </p>
          </div>
        </div>
      )}

      {/* Fee list */}
      {loadingFees ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
        </div>
      ) : fees.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="font-medium">No fee records found</p>
          <p className="text-sm text-muted-foreground mt-1">Fee assignments will appear here once created by admin</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="font-semibold">Fee Details</h3>
          {fees.map(fee => {
            const isOverdue = fee.status === "pending" && new Date(fee.due_date) < new Date();
            const displayStatus = fee.status === "pending" && isOverdue ? "overdue" : fee.status;
            return (
              <div key={fee.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      fee.status === "paid" ? "bg-emerald-500/10" : isOverdue ? "bg-red-500/10" : "bg-amber-500/10"
                    }`}>
                      {fee.status === "paid"
                        ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        : isOverdue
                          ? <AlertTriangle className="w-5 h-5 text-red-500" />
                          : <Clock className="w-5 h-5 text-amber-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{fee.fee_structure?.name || "School Fee"}</p>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold uppercase ${STATUS_STYLE[displayStatus] || STATUS_STYLE.pending}`}>
                          {displayStatus}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {fee.fee_structure?.frequency && <span className="capitalize">{fee.fee_structure.frequency} · </span>}
                        {fee.academic_year && <span>{fee.academic_year} · </span>}
                        Due: {fmtDate(fee.due_date)}
                      </p>
                      {fee.status === "paid" && fee.paid_at && (
                        <p className="text-xs text-emerald-600 mt-0.5">Paid on {fmtDate(fee.paid_at)}</p>
                      )}
                      {(fee.discount > 0 || fee.late_fine > 0) && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {fee.discount > 0 && <span className="text-emerald-600">Discount: -{fmtMoney(fee.discount)} </span>}
                          {fee.late_fine > 0 && <span className="text-red-500">Late Fine: +{fmtMoney(fee.late_fine)}</span>}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <p className="text-xl font-bold">{fmtMoney(fee.amount)}</p>
                    {fee.status === "paid" ? (
                      <button type="button"
                        onClick={() => toast.info("Receipt download coming soon")}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted transition-colors">
                        <Download className="w-3.5 h-3.5" /> Receipt
                      </button>
                    ) : fee.status !== "waived" && (
                      <button type="button"
                        disabled={paying === fee.id}
                        onClick={() => handlePay(fee)}
                        className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-foreground rounded-lg font-medium transition-colors disabled:opacity-60">
                        {paying === fee.id
                          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing...</>
                          : <><CreditCard className="w-3.5 h-3.5" /> Pay Now</>}
                      </button>
                    )}
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
