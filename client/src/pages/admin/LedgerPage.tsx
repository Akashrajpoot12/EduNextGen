import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Plus, X, TrendingUp, TrendingDown, Printer } from "lucide-react";

type Receipt = { id: string; amount_paid: number; paid_at: string };
type Expense = { id: string; category: string; description: string; amount: number; expense_date: string; paid_to: string; reference: string };

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const EXP_CATEGORIES = [
  { value: "salary",      label: "Staff Salary" },
  { value: "utilities",   label: "Utilities (Electric/Water)" },
  { value: "maintenance", label: "Maintenance/Repair" },
  { value: "supplies",    label: "Supplies/Stationery" },
  { value: "events",      label: "Events/Activities" },
  { value: "other",       label: "Other" },
];
const CAT_COLORS: Record<string, string> = { salary: "badge-purple", utilities: "badge-blue", maintenance: "badge-yellow", supplies: "badge-green", events: "badge-orange", other: "badge-gray" };

const EMPTY_FORM = { category: "salary", description: "", amount: "", expense_date: new Date().toISOString().split("T")[0], paid_to: "", reference: "" };

export function LedgerPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [tab, setTab] = useState<"overview" | "expenses" | "income">("overview");
  const [loading, setLoading] = useState(false);

  async function fetchData() {
    setLoading(true);
    const [rRes, eRes] = await Promise.all([
      supabase.from("fee_receipts").select("id, amount_paid, paid_at").eq("school_id", schoolId).order("paid_at"),
      supabase.from("school_expenses").select("*").eq("school_id", schoolId).order("expense_date"),
    ]);
    setReceipts(rRes.data as Receipt[] || []);
    setExpenses(eRes.data as Expense[] || []);
    setLoading(false);
  }

  useEffect(() => { if (schoolId) fetchData(); }, [schoolId]);

  async function saveExpense() {
    if (!form.description.trim() || !form.amount) return;
    setSaving(true);
    await supabase.from("school_expenses").insert({ ...form, amount: parseFloat(form.amount), school_id: schoolId });
    setSaving(false);
    setShowForm(false);
    setForm({ ...EMPTY_FORM });
    fetchData();
  }

  async function deleteExpense(id: string) {
    await supabase.from("school_expenses").delete().eq("id", id);
    fetchData();
  }

  // Filter by year
  const yearReceipts = receipts.filter(r => new Date(r.paid_at).getFullYear() === filterYear);
  const yearExpenses = expenses.filter(e => new Date(e.expense_date).getFullYear() === filterYear);

  const totalIncome = yearReceipts.reduce((s, r) => s + Number(r.amount_paid), 0);
  const totalExpense = yearExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const netBalance = totalIncome - totalExpense;

  // Monthly breakdown
  type MonthData = { income: number; expense: number };
  const monthlyData: MonthData[] = Array.from({ length: 12 }, (_, i) => {
    const income = yearReceipts.filter(r => new Date(r.paid_at).getMonth() === i).reduce((s, r) => s + Number(r.amount_paid), 0);
    const expense = yearExpenses.filter(e => new Date(e.expense_date).getMonth() === i).reduce((s, e) => s + Number(e.amount), 0);
    return { income, expense };
  });

  // Category breakdown
  const catBreakdown = EXP_CATEGORIES.map(c => ({
    ...c,
    total: yearExpenses.filter(e => e.category === c.value).reduce((s, e) => s + Number(e.amount), 0),
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  const years = Array.from(new Set([...receipts.map(r => new Date(r.paid_at).getFullYear()), ...expenses.map(e => new Date(e.expense_date).getFullYear()), new Date().getFullYear()])).sort((a, b) => b - a);

  const f = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Income / Expense Ledger</h1>
          <p>School finance overview — fee income vs expenses, monthly P&amp;L</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted">
            <Printer className="w-4 h-4" /> Print Report
          </button>
          <button type="button" onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> Add Expense
          </button>
        </div>
      </div>

      {/* Year filter */}
      <div className="flex items-center gap-3 mb-5">
        <label className="text-sm font-medium">Financial Year:</label>
        <select title="Select year" value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-emerald-600" /><p className="text-sm font-medium text-emerald-600">Total Income</p></div>
          <p className="text-3xl font-bold text-emerald-700">₹{totalIncome.toLocaleString("en-IN")}</p>
          <p className="text-xs text-emerald-600 mt-1">Fee receipts — {filterYear}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><TrendingDown className="w-4 h-4 text-red-600" /><p className="text-sm font-medium text-red-600">Total Expenses</p></div>
          <p className="text-3xl font-bold text-red-700">₹{totalExpense.toLocaleString("en-IN")}</p>
          <p className="text-xs text-red-600 mt-1">{yearExpenses.length} entries — {filterYear}</p>
        </div>
        <div className={`${netBalance >= 0 ? "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20" : "bg-orange-50 dark:bg-orange-500/10 border-orange-200"} border rounded-xl p-4`}>
          <p className="text-sm font-medium text-muted-foreground mb-1">Net Balance</p>
          <p className={`text-3xl font-bold ${netBalance >= 0 ? "text-blue-700" : "text-orange-700"}`}>
            {netBalance >= 0 ? "+" : ""}₹{Math.abs(netBalance).toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{netBalance >= 0 ? "Surplus" : "Deficit"}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 mb-6 w-fit">
        {(["overview", "expenses", "income"] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${tab === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {t === "overview" ? "Monthly Overview" : t === "expenses" ? "Expense Entries" : "Income (Fees)"}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {tab === "overview" && (
        <div className="space-y-4">
          {/* Monthly table */}
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            <table className="w-full edu-table">
              <thead><tr><th>Month</th><th>Income (₹)</th><th>Expense (₹)</th><th>Net (₹)</th><th>Status</th></tr></thead>
              <tbody>
                {monthlyData.map((m, i) => {
                  const net = m.income - m.expense;
                  if (m.income === 0 && m.expense === 0) return null;
                  return (
                    <tr key={i}>
                      <td className="font-medium">{MONTHS[i]} {filterYear}</td>
                      <td className="text-emerald-600 font-semibold">₹{m.income.toLocaleString("en-IN")}</td>
                      <td className="text-red-500">₹{m.expense.toLocaleString("en-IN")}</td>
                      <td className={`font-bold ${net >= 0 ? "text-blue-600" : "text-orange-600"}`}>{net >= 0 ? "+" : ""}₹{Math.abs(net).toLocaleString("en-IN")}</td>
                      <td><span className={net >= 0 ? "badge-green" : "badge-red"}>{net >= 0 ? "Surplus" : "Deficit"}</span></td>
                    </tr>
                  );
                })}
                {monthlyData.every(m => m.income === 0 && m.expense === 0) && (
                  <tr><td colSpan={5} className="text-center text-muted-foreground py-10">No data for {filterYear}.</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr className="font-bold bg-muted/30">
                  <td>Total {filterYear}</td>
                  <td className="text-emerald-600">₹{totalIncome.toLocaleString("en-IN")}</td>
                  <td className="text-red-500">₹{totalExpense.toLocaleString("en-IN")}</td>
                  <td className={netBalance >= 0 ? "text-blue-600" : "text-orange-600"}>{netBalance >= 0 ? "+" : ""}₹{Math.abs(netBalance).toLocaleString("en-IN")}</td>
                  <td><span className={netBalance >= 0 ? "badge-green" : "badge-red"}>{netBalance >= 0 ? "Surplus" : "Deficit"}</span></td>
                </tr>
              </tfoot>
            </table>
          </div>
          {/* Category breakdown */}
          {catBreakdown.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
              <h3 className="font-semibold text-sm mb-3">Expense by Category</h3>
              <div className="space-y-2">
                {catBreakdown.map(c => (
                  <div key={c.value} className="flex items-center gap-3">
                    <span className={`${CAT_COLORS[c.value]} w-24 text-center flex-shrink-0`}>{c.label}</span>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div className="h-2 rounded-full bg-red-400" style={{ width: `${(c.total / totalExpense) * 100}%` }} />
                    </div>
                    <span className="text-sm font-semibold w-28 text-right">₹{c.total.toLocaleString("en-IN")}</span>
                    <span className="text-xs text-muted-foreground w-12 text-right">{((c.total / totalExpense) * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* EXPENSES TAB */}
      {tab === "expenses" && (
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          <table className="w-full edu-table">
            <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Paid To</th><th>Ref</th><th>Amount</th><th></th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">Loading…</td></tr>}
              {!loading && yearExpenses.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">No expenses recorded for {filterYear}. Click "Add Expense" to start.</td></tr>}
              {yearExpenses.sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime()).map(e => (
                <tr key={e.id}>
                  <td className="text-sm">{new Date(e.expense_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</td>
                  <td><span className={CAT_COLORS[e.category] || "badge-gray"}>{EXP_CATEGORIES.find(c => c.value === e.category)?.label || e.category}</span></td>
                  <td className="font-medium">{e.description}</td>
                  <td className="text-sm text-muted-foreground">{e.paid_to || "—"}</td>
                  <td className="text-sm font-mono text-muted-foreground">{e.reference || "—"}</td>
                  <td className="font-semibold text-red-600">₹{Number(e.amount).toLocaleString("en-IN")}</td>
                  <td><button type="button" onClick={() => deleteExpense(e.id)} className="text-red-400 hover:text-red-600 text-xs">Delete</button></td>
                </tr>
              ))}
            </tbody>
            {yearExpenses.length > 0 && (
              <tfoot>
                <tr className="font-bold bg-muted/30">
                  <td colSpan={5} className="text-right">Total Expenses {filterYear}:</td>
                  <td className="text-red-600">₹{totalExpense.toLocaleString("en-IN")}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* INCOME TAB */}
      {tab === "income" && (
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          <table className="w-full edu-table">
            <thead><tr><th>Date</th><th>Amount</th></tr></thead>
            <tbody>
              {yearReceipts.length === 0 && <tr><td colSpan={2} className="text-center py-10 text-muted-foreground">No fee receipts for {filterYear}.</td></tr>}
              {yearReceipts.map(r => (
                <tr key={r.id}>
                  <td className="text-sm">{new Date(r.paid_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                  <td className="font-semibold text-emerald-600">₹{Number(r.amount_paid).toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
            {yearReceipts.length > 0 && (
              <tfoot>
                <tr className="font-bold bg-muted/30">
                  <td className="text-right">Total Income {filterYear}:</td>
                  <td className="text-emerald-600">₹{totalIncome.toLocaleString("en-IN")}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Add Expense Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">Add Expense</h2>
              <button type="button" title="Close" onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Category *</label>
                <select title="Category" value={form.category} onChange={e => f("category", e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                  {EXP_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Description *</label>
                <input value={form.description} onChange={e => f("description", e.target.value)} placeholder="e.g. April electricity bill"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Amount (₹) *</label>
                  <input type="number" value={form.amount} onChange={e => f("amount", e.target.value)} placeholder="0"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Date *</label>
                  <input type="date" title="Date" value={form.expense_date} onChange={e => f("expense_date", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Paid To</label>
                  <input value={form.paid_to} onChange={e => f("paid_to", e.target.value)} placeholder="Vendor / Person"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Reference / Bill No.</label>
                  <input value={form.reference} onChange={e => f("reference", e.target.value)} placeholder="Optional"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-border rounded-lg text-sm">Cancel</button>
              <button type="button" onClick={saveExpense} disabled={saving || !form.description || !form.amount}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {saving ? "Saving…" : "Add Expense"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── PRINT LAYOUT ─── */}
      <div className="hidden print:block print-full p-8">
        <div className="text-center border-b-2 border-gray-800 pb-3 mb-6">
          <h1 className="text-xl font-bold uppercase">Income / Expense Report — {filterYear}</h1>
        </div>
        <div className="grid grid-cols-3 gap-6 mb-6 text-sm">
          <div className="border border-gray-300 rounded p-3 text-center">
            <p className="text-gray-500">Total Income</p>
            <p className="text-2xl font-bold text-emerald-700">₹{totalIncome.toLocaleString("en-IN")}</p>
          </div>
          <div className="border border-gray-300 rounded p-3 text-center">
            <p className="text-gray-500">Total Expenses</p>
            <p className="text-2xl font-bold text-red-700">₹{totalExpense.toLocaleString("en-IN")}</p>
          </div>
          <div className="border border-gray-300 rounded p-3 text-center">
            <p className="text-gray-500">Net Balance</p>
            <p className={`text-2xl font-bold ${netBalance >= 0 ? "text-blue-700" : "text-orange-700"}`}>{netBalance >= 0 ? "+" : ""}₹{Math.abs(netBalance).toLocaleString("en-IN")}</p>
          </div>
        </div>
        <h2 className="font-bold mb-2">Monthly Breakdown</h2>
        <table className="w-full border-collapse text-sm mb-6">
          <thead><tr className="bg-gray-100">{["Month","Income","Expense","Net"].map(h => <th key={h} className="border border-gray-300 px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {monthlyData.map((m, i) => m.income === 0 && m.expense === 0 ? null : (
              <tr key={i}>
                <td className="border border-gray-200 px-3 py-1.5">{MONTHS[i]} {filterYear}</td>
                <td className="border border-gray-200 px-3 py-1.5 text-right">₹{m.income.toLocaleString("en-IN")}</td>
                <td className="border border-gray-200 px-3 py-1.5 text-right">₹{m.expense.toLocaleString("en-IN")}</td>
                <td className="border border-gray-200 px-3 py-1.5 text-right font-semibold">{m.income - m.expense >= 0 ? "+" : ""}₹{Math.abs(m.income - m.expense).toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
