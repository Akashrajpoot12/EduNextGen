"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Wallet, CreditCard, Download, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function ParentFeesPage() {
  const params = useParams();
  const tenant = params.tenant as string;
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);

  const supabase = createClient();

  useEffect(() => {
    fetchFees();
  }, [tenant]);

  async function fetchFees() {
    setLoading(true);
    try {
      const { data: school } = await supabase
        .from('schools')
        .select('id')
        .eq('subdomain', tenant)
        .single();

      if (!school) return;

      // In a real app, we'd fetch the parent's ward first. 
      // For the UI demonstration, we'll fetch dummy fee records or general records if we can't link easily here without complex auth maps.
      // Assuming parent role can see their child's fees via RLS.
      const { data } = await supabase
        .from('fee_payments')
        .select(`
          id, amount, due_date, status, payment_date,
          student:student_id(users(full_name))
        `)
        .eq('school_id', school.id)
        .order('due_date', { ascending: false });

      if (data) setInvoices(data);
    } catch (error) {
      console.error("Error fetching fees:", error);
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  const handlePayment = async (invoiceId: string, amount: number) => {
    const res = await loadRazorpayScript();
    if (!res) {
      toast.error("Razorpay SDK failed to load. Are you online?");
      return;
    }

    const toastId = toast.loading("Initializing secure payment...");

    try {
      // 1. Create order on our backend
      const response = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, receiptNotes: { invoiceId } }),
      });

      const order = await response.json();

      if (order.error) {
        toast.error("Failed to create order", { id: toastId });
        return;
      }

      toast.dismiss(toastId);

      // 2. Open Razorpay Checkout
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, 
        amount: order.amount,
        currency: order.currency,
        name: "SMS by Blueate.in",
        description: "School Fee Payment",
        order_id: order.id,
        handler: async function (response: any) {
          // Here we would ideally verify the signature via another API route
          toast.success(`Payment of ₹${amount.toLocaleString('en-IN')} Successful!`);
          
          // Optimistic UI Update
          setInvoices((prev) => 
            prev.map(inv => inv.id === invoiceId ? { ...inv, status: 'paid', payment_date: new Date().toISOString() } : inv)
          );
        },
        prefill: {
          name: "Parent Name",
          email: "parent@example.com",
          contact: "9999999999",
        },
        theme: {
          color: "#10b981", // Emerald 500
        },
      };

      const rzp1 = new (window as any).Razorpay(options);
      rzp1.on("payment.failed", function (response: any) {
        toast.error(`Payment Failed: ${response.error.description}`);
      });
      rzp1.open();
    } catch (err) {
      console.error(err);
      toast.error("Payment initialization failed", { id: toastId });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Fees & Payments</h1>
          <p className="text-sm text-slate-400 mt-1">Track your pending dues and download payment receipts.</p>
        </div>
        
        <Button className="bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20">
          <CreditCard className="w-4 h-4 mr-2" /> Pay All Dues
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500/50" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/50 rounded-xl border border-white/10 shadow-xl">
          <Wallet className="w-12 h-12 text-slate-500 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-bold text-white mb-1">No fee records found</h3>
          <p className="text-slate-400 text-sm">There are no pending or paid invoices for your ward right now.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <AnimatePresence>
            {invoices.map((invoice, idx) => {
              const isPaid = invoice.status === 'paid';
              return (
                <motion.div
                  key={invoice.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl hover:bg-white/[0.02] transition-colors h-full">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${isPaid ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                            {isPaid ? <CheckCircle2 className="w-6 h-6 text-emerald-400" /> : <Wallet className="w-6 h-6 text-red-400" />}
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-white">₹{Number(invoice.amount).toLocaleString('en-IN')}</h3>
                            <p className="text-xs text-slate-400 uppercase tracking-wide">
                              {invoice.student?.users?.full_name || 'Term Fee'}
                            </p>
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold border ${isPaid ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                          {invoice.status}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                        <div className="bg-slate-950/50 rounded-lg p-3 border border-white/5">
                          <span className="text-slate-500 block mb-1">Due Date</span>
                          <span className="text-slate-300 font-medium">{formatDate(invoice.due_date)}</span>
                        </div>
                        <div className="bg-slate-950/50 rounded-lg p-3 border border-white/5">
                          <span className="text-slate-500 block mb-1">Payment Date</span>
                          <span className="text-slate-300 font-medium">{formatDate(invoice.payment_date)}</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-3">
                        {isPaid ? (
                          <Button variant="outline" className="w-full border-border text-foreground hover:bg-muted">
                            <Download className="w-4 h-4 mr-2" /> Download Receipt
                          </Button>
                        ) : (
                          <Button onClick={() => handlePayment(invoice.id, invoice.amount)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                            <CreditCard className="w-4 h-4 mr-2" /> Pay Now
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
