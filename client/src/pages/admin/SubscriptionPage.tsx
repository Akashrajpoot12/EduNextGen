// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Zap, Shield, Crown, Blocks, MessageSquare, Globe, CreditCard } from "lucide-react";
import { motion } from "framer-motion";
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

export function SubscriptionPage() {
  const { tenantId: tenant } = useTenant();
  const supabase = createClient();

  const [activePlan, setActivePlan] = useState<string>("basic");
  const [activeAddons, setActiveAddons] = useState<string[]>([]);

  // Load the school's saved plan so it survives refresh.
  useEffect(() => {
    if (!tenant) return;
    supabase.from("schools").select("subscription_plan").eq("id", tenant).single()
      .then(({ data }) => {
        if (data?.subscription_plan) setActivePlan(String(data.subscription_plan).toLowerCase());
      });
  }, [tenant]);

  async function persistPlan(plan: string) {
    try {
      await supabase.from("schools")
        .update({ subscription_plan: plan.toLowerCase(), subscription_status: "active" })
        .eq("id", tenant);
    } catch (e) {
      console.error("Failed to persist plan", e);
    }
  }

  const handlePurchase = async (itemName: string, amount: number, isAddon: boolean = false) => {
    if (!import.meta.env.VITE_RAZORPAY_KEY_ID) {
      toast.error("Payments not configured (missing Razorpay key). Contact support.");
      return;
    }
    const res = await loadRazorpayScript();
    if (!res) {
      toast.error("Razorpay SDK failed to load. Please check your connection.");
      return;
    }

    const toastId = toast.loading("Initializing secure checkout...");

    try {
      // 1. Create order on our backend (Supabase Edge Function)
      const { data: { session } } = await createClient().auth.getSession();
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/razorpay`;
      const response = await fetch(`${functionUrl}/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ amount, receiptNotes: { item: itemName, tenant } }),
      });

      if (!response.ok) {
        toast.error("Failed to create billing order (server error)", { id: toastId });
        return;
      }
      const order = await response.json();

      if (order.error) {
        toast.error("Failed to create billing order", { id: toastId });
        return;
      }

      toast.dismiss(toastId);

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "EduNextGen SaaS",
        description: `Purchase: ${itemName}`,
        order_id: order.id,
        handler: async function (paymentRes: any) {
          const verifyToastId = toast.loading("Confirming subscription...");
          try {
            const verifyResponse = await fetch(`${functionUrl}/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: paymentRes.razorpay_order_id,
                razorpay_payment_id: paymentRes.razorpay_payment_id,
                razorpay_signature: paymentRes.razorpay_signature,
                item: itemName,
                tenant: tenant
              })
            });
            if (!verifyResponse.ok) {
              toast.error("Payment verification request failed.", { id: verifyToastId });
              return;
            }
            const verifyData = await verifyResponse.json();

            if (verifyData.success) {
              toast.success(`Successfully purchased ${itemName}!`, { id: verifyToastId });
              if (isAddon) {
                setActiveAddons((prev) => [...prev, itemName]);
              } else {
                setActivePlan(itemName.toLowerCase());
                await persistPlan(itemName);
              }
            } else {
              toast.error("Subscription verification failed! " + (verifyData.error || ""), { id: verifyToastId });
            }
          } catch (err) {
            console.error(err);
            toast.error("Verification failed.", { id: verifyToastId });
          }
        },
        prefill: {
          name: `${tenant} Admin`,
          email: `admin@${tenant}.edu`,
          contact: "9999999999",
        },
        theme: {
          color: "#8b5cf6", // Purple 500 for SaaS billing
        },
      };

      const rzp1 = new (window as any).Razorpay(options);
      rzp1.on("payment.failed", function (response: any) {
        toast.error(`Transaction Failed: ${response.error.description}`);
      });
      rzp1.open();
    } catch (err) {
      console.error(err);
      toast.error("Failed to initialize checkout", { id: toastId });
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center">
          My Subscription <span className="ml-3 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[10px] uppercase font-bold tracking-widest">B2B Billing</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your EduNextGen plan, limits, and additional services.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Basic Plan */}
        <Card className={`relative overflow-hidden border-2 transition-all ${activePlan === 'basic' ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.15)]' : 'border-border'}`}>
          {activePlan === 'basic' && (
             <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg">CURRENT PLAN</div>
          )}
          <CardHeader>
            <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-2xl">Essential</CardTitle>
            <CardDescription>Perfect for small growing schools.</CardDescription>
            <div className="mt-4">
              <span className="text-4xl font-bold text-foreground">₹999</span>
              <span className="text-muted-foreground">/month</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {['Up to 500 Students', 'Basic Attendance & Grades', 'Parent App Access', 'Standard Support'].map((feature) => (
              <div key={feature} className="flex items-center text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-3 flex-shrink-0" />
                <span>{feature}</span>
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <Button 
              variant={activePlan === 'basic' ? "outline" : "default"} 
              className="w-full"
              disabled={activePlan === 'basic'}
              onClick={() => handlePurchase('Basic', 999)}
            >
              {activePlan === 'basic' ? 'Active' : 'Downgrade'}
            </Button>
          </CardFooter>
        </Card>

        {/* Premium Plan */}
        <Card className={`relative overflow-hidden border-2 transition-all ${activePlan === 'premium' ? 'border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.15)]' : 'border-border'}`}>
          {activePlan === 'premium' && (
             <div className="absolute top-0 right-0 bg-purple-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg">CURRENT PLAN</div>
          )}
          <div className="absolute -right-12 -top-12 w-32 h-32 bg-purple-500/10 blur-2xl rounded-full" />
          <CardHeader>
             <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center mb-4 border border-purple-500/20">
              <Crown className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <CardTitle className="text-2xl">Premium</CardTitle>
            <CardDescription>Everything needed for a large institution.</CardDescription>
            <div className="mt-4">
              <span className="text-4xl font-bold text-foreground">₹2,499</span>
              <span className="text-muted-foreground">/month</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 relative z-10">
            {['Unlimited Students', 'Advanced Analytics Dashboard', 'HR & Payroll Module', 'Priority 24/7 Support'].map((feature) => (
              <div key={feature} className="flex items-center text-sm">
                <CheckCircle2 className="w-4 h-4 text-purple-500 mr-3 flex-shrink-0" />
                <span>{feature}</span>
              </div>
            ))}
          </CardContent>
          <CardFooter className="relative z-10">
            <Button 
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              disabled={activePlan === 'premium'}
              onClick={() => handlePurchase('Premium', 2499)}
            >
              {activePlan === 'premium' ? 'Active' : 'Upgrade to Premium'}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <div className="mt-12">
        <h2 className="text-2xl font-bold tracking-tight text-foreground mb-6">Add-on Services</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Addon 1 */}
          <Card className="bg-muted/50 border-border">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                  <ScanFaceIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold">₹500</span>
                  <span className="text-xs text-muted-foreground block">/month</span>
                </div>
              </div>
              <h3 className="font-bold mb-1">Face AI Biometrics</h3>
              <p className="text-xs text-muted-foreground mb-4">Enable real-time facial recognition attendance for your campus.</p>
              
              {activeAddons.includes('Face AI Biometrics') ? (
                <Button variant="outline" className="w-full border-emerald-500/50 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" disabled>
                   <CheckCircle2 className="w-4 h-4 mr-2" /> Activated
                </Button>
              ) : (
                <Button onClick={() => handlePurchase('Face AI Biometrics', 500, true)} variant="secondary" className="w-full">
                  <CreditCard className="w-4 h-4 mr-2" /> Subscribe
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Addon 2 */}
          <Card className="bg-muted/50 border-border">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold">₹300</span>
                  <span className="text-xs text-muted-foreground block">/month</span>
                </div>
              </div>
              <h3 className="font-bold mb-1">WhatsApp Integration</h3>
              <p className="text-xs text-muted-foreground mb-4">Send automatic absentee alerts and fee reminders directly to WhatsApp.</p>
              
              {activeAddons.includes('WhatsApp Integration') ? (
                <Button variant="outline" className="w-full border-green-500/50 text-green-600 dark:text-green-400 bg-green-500/10" disabled>
                   <CheckCircle2 className="w-4 h-4 mr-2" /> Activated
                </Button>
              ) : (
                <Button onClick={() => handlePurchase('WhatsApp Integration', 300, true)} variant="secondary" className="w-full">
                  <CreditCard className="w-4 h-4 mr-2" /> Subscribe
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Addon 3 */}
          <Card className="bg-muted/50 border-border">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold">₹999</span>
                  <span className="text-xs text-muted-foreground block">one-time</span>
                </div>
              </div>
              <h3 className="font-bold mb-1">Custom Domain Name</h3>
              <p className="text-xs text-muted-foreground mb-4">Remove 'edunextgen.com' and use your own domain (e.g., portal.yourschool.com).</p>
              
              {activeAddons.includes('Custom Domain') ? (
                <Button variant="outline" className="w-full border-blue-500/50 text-blue-600 dark:text-blue-400 bg-blue-500/10" disabled>
                   <CheckCircle2 className="w-4 h-4 mr-2" /> Activated
                </Button>
              ) : (
                <Button onClick={() => handlePurchase('Custom Domain', 999, true)} variant="secondary" className="w-full">
                  <CreditCard className="w-4 h-4 mr-2" /> Purchase
                </Button>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}

// Inline Icon to avoid import issues if not present
function ScanFaceIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <path d="M9 9h.01" />
      <path d="M15 9h.01" />
    </svg>
  );
}

