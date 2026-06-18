import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { CreditCard, ExternalLink, Copy, CheckCircle, Settings, IndianRupee } from "lucide-react";

type FeeAssignment = {
  id: string; student_id: string; amount: number; discount: number; fine: number; status: string; due_date: string;
  student_name?: string; fee_name?: string; phone?: string;
};

export function OnlinePaymentPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [assignments, setAssignments] = useState<FeeAssignment[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [classFilter, setClassFilter] = useState("all");
  const [rzpKeyId, setRzpKeyId] = useState(() => localStorage.getItem(`rzp_key_${schoolId}`) || "");
  const [showSettings, setShowSettings] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [tab, setTab] = useState<"pending" | "setup" | "guide">("pending");

  useEffect(() => {
    if (!schoolId) return;
    Promise.all([
      supabase.from("student_fee_assignments")
        .select("id, student_id, amount, discount, fine, status, due_date")
        .eq("school_id", schoolId).eq("status", "pending"),
      supabase.from("students").select("id, name, phone, class_id").eq("school_id", schoolId),
      supabase.from("fee_structures").select("id, name").eq("school_id", schoolId),
      supabase.from("classes").select("id, name").eq("school_id", schoolId).order("name"),
    ]).then(([aRes, sRes, fRes, cRes]) => {
      const stuMap = Object.fromEntries((sRes.data || []).map((s: { id: string; name: string; phone: string }) => [s.id, s]));
      setAssignments((aRes.data || []).map((a: FeeAssignment) => ({
        ...a,
        student_name: stuMap[a.student_id]?.name || "Unknown",
        phone: stuMap[a.student_id]?.phone || "",
      })));
      setClasses(cRes.data || []);
    });
  }, [schoolId]);

  function net(a: FeeAssignment) { return Math.max(0, (a.amount || 0) - (a.discount || 0) + (a.fine || 0)); }

  function buildPaymentLink(a: FeeAssignment) {
    if (!rzpKeyId) return "#";
    const amount = net(a) * 100;
    return `https://rzp.io/l/${rzpKeyId}?amount=${amount}&description=${encodeURIComponent(a.fee_name || "School Fee")}&customer_name=${encodeURIComponent(a.student_name || "")}&contact=${a.phone || ""}`;
  }

  async function copyLink(id: string, link: string) {
    await navigator.clipboard.writeText(link);
    setCopied(id);
    setTimeout(() => setCopied(null), 1800);
  }

  function saveKey() {
    localStorage.setItem(`rzp_key_${schoolId}`, keyInput);
    setRzpKeyId(keyInput);
    setShowSettings(false);
    setKeyInput("");
  }

  const pending = assignments.filter(a => a.status === "pending");
  const totalDue = pending.reduce((s, a) => s + net(a), 0);

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Online Fee Payment</h1>
          <p>Generate Razorpay payment links — send to parents via WhatsApp/SMS</p>
        </div>
        <button type="button" onClick={() => { setKeyInput(rzpKeyId); setShowSettings(true); }}
          className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">
          <Settings className="w-4 h-4" /> Razorpay Settings
        </button>
      </div>

      {!rzpKeyId && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <CreditCard className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800">Razorpay not configured</p>
            <p className="text-sm text-amber-700 mt-0.5">Add your Razorpay Key ID to generate payment links. <button type="button" onClick={() => { setKeyInput(""); setShowSettings(true); }} className="underline">Configure now →</button></p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-red">
          <div className="flex items-center gap-2"><IndianRupee className="w-4 h-4 text-red-500" /><p className="text-xs text-muted-foreground">Total Pending</p></div>
          <p className="text-2xl font-bold">₹{totalDue.toLocaleString("en-IN")}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-orange">
          <p className="text-xs text-muted-foreground">Pending Assignments</p>
          <p className="text-2xl font-bold">{pending.length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-blue">
          <p className="text-xs text-muted-foreground">Razorpay Status</p>
          <p className="text-sm font-semibold mt-1">{rzpKeyId ? <span className="text-emerald-600">✓ Configured</span> : <span className="text-red-500">Not configured</span>}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 mb-6 w-fit">
        {(["pending", "setup", "guide"] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${tab === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {t === "pending" ? "Pending Fees" : t === "setup" ? "Payment Setup" : "Integration Guide"}
          </button>
        ))}
      </div>

      {/* PENDING TAB */}
      {tab === "pending" && (
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          <table className="w-full edu-table">
            <thead><tr><th>Student</th><th>Fee</th><th>Amount</th><th>Due Date</th><th>Phone</th><th>Payment Link</th></tr></thead>
            <tbody>
              {pending.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No pending fees.</td></tr>}
              {pending.map(a => (
                <tr key={a.id}>
                  <td className="font-medium">{a.student_name}</td>
                  <td className="text-sm text-muted-foreground">{a.fee_name || "Fee"}</td>
                  <td className="font-semibold">₹{net(a).toLocaleString("en-IN")}</td>
                  <td className="text-sm">{a.due_date ? new Date(a.due_date).toLocaleDateString("en-IN") : "—"}</td>
                  <td className="text-sm font-mono">{a.phone || <span className="text-muted-foreground">—</span>}</td>
                  <td>
                    {rzpKeyId ? (
                      <div className="flex gap-1">
                        <a href={buildPaymentLink(a)} target="_blank" rel="noopener noreferrer"
                          className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-lg flex items-center gap-1 hover:bg-blue-700">
                          <ExternalLink className="w-3 h-3" /> Open
                        </a>
                        <button type="button" onClick={() => copyLink(a.id, buildPaymentLink(a))}
                          className="text-xs border border-border px-2.5 py-1 rounded-lg flex items-center gap-1 hover:bg-muted">
                          {copied === a.id ? <CheckCircle className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">Setup required</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* SETUP TAB */}
      {tab === "setup" && (
        <div className="max-w-lg space-y-4">
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <h3 className="font-semibold mb-3">Razorpay Configuration</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Key ID (starts with rzp_live_ or rzp_test_)</label>
                <input value={keyInput || rzpKeyId} onChange={e => setKeyInput(e.target.value)}
                  placeholder="rzp_live_xxxxxxxxxxxx"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background font-mono" />
              </div>
              <button type="button" onClick={() => { localStorage.setItem(`rzp_key_${schoolId}`, keyInput); setRzpKeyId(keyInput); }}
                disabled={!keyInput}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                Save Configuration
              </button>
              {rzpKeyId && <p className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Razorpay Key ID saved</p>}
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <h3 className="font-semibold mb-3">Webhook for Auto-Payment Confirmation</h3>
            <p className="text-sm text-muted-foreground mb-2">Add this URL in your Razorpay Dashboard → Webhooks to auto-mark fees as paid:</p>
            <div className="bg-muted/50 rounded-lg p-3 font-mono text-xs break-all">
              https://your-supabase-url.supabase.co/functions/v1/razorpay-webhook
            </div>
            <p className="text-xs text-muted-foreground mt-2">Enable events: <code>payment.captured</code>, <code>order.paid</code></p>
          </div>
        </div>
      )}

      {/* GUIDE TAB */}
      {tab === "guide" && (
        <div className="space-y-4 max-w-2xl">
          {[
            { step: "1", title: "Create Razorpay Account", desc: "Go to razorpay.com → Sign Up → Complete KYC with school's bank details.", link: "https://razorpay.com" },
            { step: "2", title: "Get API Keys", desc: "Dashboard → Settings → API Keys → Generate Key. Copy the Key ID (rzp_live_...)." },
            { step: "3", title: "Configure here", desc: "Paste the Key ID in Setup tab above and save." },
            { step: "4", title: "Generate payment links", desc: "Go to Pending Fees tab → copy payment link for each student → send via WhatsApp or SMS." },
            { step: "5", title: "Parent pays", desc: "Parent opens link → pays via UPI, card, net banking → payment confirmation received." },
            { step: "6", title: "Auto-update (optional)", desc: "Configure webhook URL in Razorpay dashboard to auto-mark fees as paid when payment succeeds." },
          ].map(s => (
            <div key={s.step} className="bg-card rounded-xl border border-border p-4 shadow-sm flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">{s.step}</div>
              <div className="flex-1">
                <p className="font-semibold text-sm">{s.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                {s.link && <a href={s.link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"><ExternalLink className="w-3 h-3" />{s.link}</a>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm shadow-2xl">
            <h2 className="font-bold text-lg mb-4">Razorpay Settings</h2>
            <input value={keyInput} onChange={e => setKeyInput(e.target.value)} placeholder="rzp_live_xxxxxxxxxxxx"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background font-mono mb-4" />
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowSettings(false)} className="flex-1 py-2 border border-border rounded-lg text-sm">Cancel</button>
              <button type="button" onClick={saveKey} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
