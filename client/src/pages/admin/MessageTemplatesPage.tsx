// @ts-nocheck
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import {
  Plus, X, Pencil, Send, Copy, CheckCircle2, Loader2,
  MessageSquare, Smartphone, Search, Sparkles
} from "lucide-react";
import { toast } from "sonner";

// ── Default templates seeded for new schools ──────────────────────────────
const DEFAULT_TEMPLATES = [
  {
    name: "Absent Alert",
    category: "absent",
    message: "Dear Parent,\n\nYour child *{STUDENT_NAME}* (Class {CLASS}) was marked *ABSENT* today ({DATE}) at *{SCHOOL_NAME}*.\n\nIf this is incorrect, please contact the class teacher.\n\n_{SCHOOL_NAME}_",
    variables: ["STUDENT_NAME", "CLASS", "DATE", "SCHOOL_NAME"],
  },
  {
    name: "Fees Due Reminder",
    category: "fees",
    message: "Dear Parent,\n\nThis is a reminder that *{FEE_NAME}* of *₹{AMOUNT}* for *{STUDENT_NAME}* is due on *{DUE_DATE}*.\n\nPlease pay at the earliest to avoid late fine.\nPay online via the parent portal.\n\n_{SCHOOL_NAME}_",
    variables: ["FEE_NAME", "AMOUNT", "STUDENT_NAME", "DUE_DATE", "SCHOOL_NAME"],
  },
  {
    name: "Exam Result",
    category: "exam",
    message: "Dear Parent,\n\n*{EXAM_NAME} Results* for *{STUDENT_NAME}*:\n\n📊 Marks: *{MARKS}/{TOTAL}* ({PERCENT}%)\n🎯 Grade: *{GRADE}*\n\nLogin to parent portal to view detailed results.\n\n_{SCHOOL_NAME}_",
    variables: ["EXAM_NAME", "STUDENT_NAME", "MARKS", "TOTAL", "PERCENT", "GRADE", "SCHOOL_NAME"],
  },
  {
    name: "PTM Notice",
    category: "ptm",
    message: "Dear Parent,\n\nA *Parent-Teacher Meeting* has been scheduled on *{DATE}* from *{TIME}* at *{VENUE}*.\n\nYou are cordially invited to discuss your ward's academic progress.\n\nKindly ensure your presence.\n\n_{SCHOOL_NAME}_",
    variables: ["DATE", "TIME", "VENUE", "SCHOOL_NAME"],
  },
  {
    name: "Holiday Notice",
    category: "holiday",
    message: "Dear Parent,\n\nPlease note that the school will remain *CLOSED* on *{DATE}* on account of *{REASON}*.\n\nRegular classes will resume from *{RESUME_DATE}*.\n\n_{SCHOOL_NAME}_",
    variables: ["DATE", "REASON", "RESUME_DATE", "SCHOOL_NAME"],
  },
  {
    name: "Homework Reminder",
    category: "homework",
    message: "Dear Parent,\n\nNew homework assigned for *{STUDENT_NAME}* (Class {CLASS}):\n\n📚 Subject: *{SUBJECT}*\n📝 Task: {HOMEWORK}\n⏰ Due: *{DUE_DATE}*\n\nPlease ensure completion.\n\n_{SCHOOL_NAME}_",
    variables: ["STUDENT_NAME", "CLASS", "SUBJECT", "HOMEWORK", "DUE_DATE", "SCHOOL_NAME"],
  },
];

const CATEGORY_COLOR: Record<string, string> = {
  absent:   "bg-red-100 text-red-700 border-red-200",
  fees:     "bg-amber-100 text-amber-700 border-amber-200",
  exam:     "bg-blue-100 text-blue-700 border-blue-200",
  ptm:      "bg-purple-100 text-purple-700 border-purple-200",
  holiday:  "bg-emerald-100 text-emerald-700 border-emerald-200",
  homework: "bg-indigo-100 text-indigo-700 border-indigo-200",
  general:  "bg-slate-100 text-slate-700 border-slate-200",
  custom:   "bg-pink-100 text-pink-700 border-pink-200",
};

const CATEGORIES = ["absent","fees","exam","ptm","holiday","homework","general","custom"];

const EMPTY_FORM = { name: "", category: "general", message: "" };

function extractVars(msg: string): string[] {
  return [...new Set([...msg.matchAll(/\{([A-Z_]+)\}/g)].map(m => m[1]))];
}

export function MessageTemplatesPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<any>(null);
  const [form, setForm]           = useState({ ...EMPTY_FORM });
  const [saving, setSaving]       = useState(false);
  const [copied, setCopied]       = useState<string | null>(null);

  // Send panel state
  const [sendTpl, setSendTpl]       = useState<any>(null);
  const [varValues, setVarValues]   = useState<Record<string, string>>({});
  const [phoneList, setPhoneList]   = useState("");
  const [sending, setSending]       = useState(false);
  const [preview, setPreview]       = useState("");

  useEffect(() => { if (schoolId) init(); }, [schoolId]);

  async function init() {
    setLoading(true);
    const { data } = await supabase
      .from("message_templates")
      .select("*")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false });

    if (data && data.length === 0) await seedDefaults();
    else setTemplates(data || []);
    setLoading(false);
  }

  async function seedDefaults() {
    const { data: { user } } = await supabase.auth.getUser();
    const rows = DEFAULT_TEMPLATES.map(t => ({
      school_id: schoolId,
      created_by: user?.id,
      ...t,
    }));
    const { data } = await supabase.from("message_templates").insert(rows).select();
    setTemplates(data || []);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const variables = extractVars(form.message);
    const payload = { school_id: schoolId, ...form, variables };

    if (editing) {
      const { error } = await supabase.from("message_templates").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("message_templates").insert({ ...payload, created_by: user?.id });
      if (error) { toast.error(error.message); setSaving(false); return; }
    }

    toast.success(editing ? "Template updated" : "Template created");
    setSaving(false);
    setShowForm(false);
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    init();
  }

  async function handleDelete(id: string) {
    await supabase.from("message_templates").delete().eq("id", id);
    setTemplates(prev => prev.filter(t => t.id !== id));
    toast.success("Template deleted");
  }

  function openEdit(t: any) {
    setEditing(t);
    setForm({ name: t.name, category: t.category, message: t.message });
    setShowForm(true);
  }

  function openSend(t: any) {
    setSendTpl(t);
    const init: Record<string, string> = {};
    (t.variables || []).forEach((v: string) => { init[v] = ""; });
    setVarValues(init);
    setPhoneList("");
    setPreview(t.message);
  }

  function updatePreview(vars: Record<string, string>, msg: string) {
    let p = msg;
    Object.entries(vars).forEach(([k, v]) => {
      p = p.replaceAll(`{${k}}`, v || `{${k}}`);
    });
    setPreview(p);
  }

  function setVar(k: string, v: string) {
    const next = { ...varValues, [k]: v };
    setVarValues(next);
    updatePreview(next, sendTpl.message);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    const numbers = phoneList.split(/[\n,]/).map(n => n.trim()).filter(Boolean);
    if (numbers.length === 0) { toast.error("Enter at least one phone number"); setSending(false); return; }

    // Replace vars in message
    let msg = sendTpl.message;
    Object.entries(varValues).forEach(([k, v]) => { msg = msg.replaceAll(`{${k}}`, v); });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            type: "custom",
            schoolId,
            data: { message: msg, numbers },
          }),
        }
      );
      const result = await res.json();
      toast.success(`Sent: ${result.sent}, Failed: ${result.failed}`);
      setSendTpl(null);
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    }
    setSending(false);
  }

  function copyTemplate(msg: string, id: string) {
    navigator.clipboard.writeText(msg);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }));

  const filtered = templates.filter(t => {
    const matchCat = filterCat === "all" || t.category === filterCat;
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.message.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const vars = extractVars(form.message);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">WhatsApp / SMS Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create reusable message templates with {"{"}<span className="font-mono">PLACEHOLDERS</span>{"}"} — fill and send in one click
          </p>
        </div>
        <button type="button" onClick={() => { setEditing(null); setForm({ ...EMPTY_FORM }); setShowForm(true); }}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> New Template
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {["absent","fees","exam","general"].map(cat => (
          <div key={cat} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground capitalize">{cat}</p>
            <p className="text-2xl font-bold mt-1">{templates.filter(t => t.category === cat).length}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates…"
            className="pl-9 pr-4 py-2 border border-border rounded-lg text-sm bg-background w-52 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div className="flex flex-wrap gap-1">
          {["all", ...CATEGORIES].map(cat => (
            <button key={cat} type="button" onClick={() => setFilterCat(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                filterCat === cat ? "bg-emerald-500 text-white" : "border border-border hover:bg-muted text-muted-foreground"
              }`}>
              {cat}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} templates</span>
      </div>

      {/* Template Grid */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="font-medium">No templates found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(t => (
            <div key={t.id} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold capitalize ${CATEGORY_COLOR[t.category] || CATEGORY_COLOR.general}`}>
                    {t.category}
                  </span>
                  <h3 className="font-semibold text-sm">{t.name}</h3>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button type="button" title="Copy" onClick={() => copyTemplate(t.message, t.id)}
                    className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                    {copied === t.id ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button type="button" title="Edit" onClick={() => openEdit(t)}
                    className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button type="button" title="Delete" onClick={() => handleDelete(t.id)}
                    className="p-1.5 rounded hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Message preview */}
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 whitespace-pre-wrap line-clamp-4 font-mono leading-relaxed">
                {t.message}
              </p>

              {/* Variables used */}
              {t.variables?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {t.variables.map((v: string) => (
                    <span key={v} className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded font-mono">
                      {"{" + v + "}"}
                    </span>
                  ))}
                </div>
              )}

              <button type="button" onClick={() => openSend(t)}
                className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium py-2 rounded-lg transition-colors mt-auto">
                <Send className="w-4 h-4" /> Send via WhatsApp
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-border">
              <h2 className="font-bold">{editing ? "Edit Template" : "New Template"}</h2>
              <button type="button" title="Close" onClick={() => { setShowForm(false); setEditing(null); }}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Template Name *</label>
                  <input required value={form.name} onChange={set("name")} placeholder="e.g. Monthly Fee Reminder"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <select value={form.category} onChange={set("category")}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium">Message *</label>
                  <span className="text-xs text-muted-foreground">Use {"{VARIABLE_NAME}"} for dynamic values</span>
                </div>
                <textarea required value={form.message} onChange={set("message")} rows={10}
                  placeholder={`e.g. Dear Parent,\n\nYour child *{STUDENT_NAME}* was absent today.\n\n_{SCHOOL_NAME}_`}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background font-mono resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>

              {/* Auto-detected variables */}
              {vars.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Auto-detected variables:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {vars.map(v => (
                      <span key={v} className="text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-mono">
                        {"{" + v + "}"}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditing(null); }}
                  className="flex-1 border border-border rounded-lg py-2 text-sm hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-60">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {editing ? "Update Template" : "Save Template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Send Modal ── */}
      {sendTpl && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-border">
              <div>
                <h2 className="font-bold">Send: {sendTpl.name}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Fill variables → preview → send</p>
              </div>
              <button type="button" title="Close" onClick={() => setSendTpl(null)}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <form onSubmit={handleSend} className="p-6 space-y-5">
              {/* Variable inputs */}
              {(sendTpl.variables || []).length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-3">Fill in the variables:</p>
                  <div className="grid grid-cols-2 gap-3">
                    {(sendTpl.variables || []).map((v: string) => (
                      <div key={v}>
                        <label className="block text-xs text-muted-foreground mb-1 font-mono">{"{" + v + "}"}</label>
                        <input value={varValues[v] || ""} onChange={e => setVar(v, e.target.value)}
                          placeholder={v.replace(/_/g, " ").toLowerCase()}
                          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview */}
              <div>
                <p className="text-sm font-medium mb-2">Message Preview:</p>
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm whitespace-pre-wrap font-mono text-slate-700 max-h-48 overflow-y-auto">
                  {preview}
                </div>
              </div>

              {/* Phone numbers */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Phone Numbers <span className="text-muted-foreground font-normal">(one per line, or comma-separated)</span>
                </label>
                <textarea value={phoneList} onChange={e => setPhoneList(e.target.value)} rows={4}
                  placeholder={"9876543210\n9123456789\nor: 9876543210, 9123456789"}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background font-mono resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                <p className="text-xs text-muted-foreground mt-1">
                  {phoneList.split(/[\n,]/).map(n => n.trim()).filter(Boolean).length} number(s) entered
                </p>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setSendTpl(null)}
                  className="flex-1 border border-border rounded-lg py-2.5 text-sm hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={sending}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-60">
                  {sending
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                    : <><Send className="w-4 h-4" /> Send WhatsApp</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
