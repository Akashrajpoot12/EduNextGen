import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Plus, X, Search, Printer, FileText, Edit2 } from "lucide-react";

type Circular = {
  id: string; circular_number: string; title: string; content: string;
  issued_to: string; issue_date: string; academic_year: string;
};
type School = { name: string; address?: string; phone?: string };

const ISSUED_TO_OPTIONS = [
  { v: "all",      l: "All (Parents + Staff + Students)" },
  { v: "parents",  l: "Parents Only" },
  { v: "staff",    l: "Staff Only" },
  { v: "students", l: "Students Only" },
  { v: "teachers", l: "Teachers Only" },
];

const TEMPLATES = [
  {
    label: "Holiday Notice",
    title: "School Holiday Notice",
    content: `This is to inform all students, parents and staff that the school will remain closed on {DATE} on account of {REASON}.\n\nRegular classes will resume from {RESUME_DATE}.\n\nKindly note the same and plan accordingly.\n\nFor any queries, contact the school office.`,
  },
  {
    label: "PTM Notice",
    title: "Parent-Teacher Meeting Notice",
    content: `Dear Parent/Guardian,\n\nA Parent-Teacher Meeting (PTM) has been scheduled for Class {CLASS} on {DATE} from {TIME} onwards.\n\nYou are cordially invited to attend the meeting to discuss your ward's academic progress and conduct.\n\nKindly ensure your presence. Your cooperation will be highly appreciated.\n\nNote: Students are not required to attend.`,
  },
  {
    label: "Fee Reminder",
    title: "Fee Payment Reminder",
    content: `Dear Parent/Guardian,\n\nThis is a gentle reminder that the fee for the current term is due. Kindly clear the pending dues on or before {DUE_DATE} to avoid late fine of ₹{FINE_AMOUNT} per day.\n\nFee payment timings: {TIMINGS}\n\nPlease carry this circular along with your fee book.\n\nFor queries, contact the accounts office.`,
  },
  {
    label: "Exam Notice",
    title: "Examination Notice",
    content: `Dear Students and Parents,\n\nThis is to inform you that {EXAM_NAME} examinations for Classes {CLASSES} will commence from {START_DATE}.\n\nStudents are advised to:\n1. Bring their hall ticket / admit card on the day of examination.\n2. Report to school by {REPORT_TIME}.\n3. Carry all necessary stationery.\n4. No mobile phones are allowed inside the examination hall.\n\nWishing all students the very best!`,
  },
  {
    label: "Annual Function",
    title: "Annual Day / Function Notice",
    content: `Dear Parents/Guardians,\n\nWe are delighted to announce our Annual Day celebration on {DATE} at {VENUE}, starting at {TIME}.\n\nYou are warmly invited to attend along with your family.\n\nKindly RSVP by {RSVP_DATE} by contacting the school office.\n\nWe look forward to your gracious presence.`,
  },
  {
    label: "Custom",
    title: "",
    content: "",
  },
];

function zeroPad(n: number) { return String(n).padStart(3, "0"); }

export function CircularPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [circulars, setCirculars] = useState<Circular[]>([]);
  const [school, setSchool]       = useState<School>({ name: "" });
  const [showForm, setShowForm]   = useState(false);
  const [printCirc, setPrintCirc] = useState<Circular | null>(null);
  const [editing, setEditing]     = useState<Circular | null>(null);
  const [search, setSearch]       = useState("");
  const [saving, setSaving]       = useState(false);
  const [nextNum, setNextNum]     = useState(1);
  const [form, setForm] = useState({
    title: "", content: "", issued_to: "all",
    issue_date: new Date().toISOString().slice(0, 10),
    academic_year: "2025-26",
  });

  async function fetchData() {
    const [cRes, schRes] = await Promise.all([
      supabase.from("circulars").select("*").eq("school_id", schoolId).order("created_at", { ascending: false }),
      supabase.from("schools").select("name, address, phone").eq("id", schoolId).single(),
    ]);
    setCirculars(cRes.data as Circular[] || []);
    setSchool(schRes.data || { name: "" });
    setNextNum((cRes.data?.length || 0) + 1);
  }

  useEffect(() => { if (schoolId) fetchData(); }, [schoolId]);

  async function handleSave() {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    if (editing) {
      await supabase.from("circulars").update({ ...form }).eq("id", editing.id);
    } else {
      const circular_number = `C-${zeroPad(nextNum)}/${new Date().getFullYear()}`;
      await supabase.from("circulars").insert({ ...form, school_id: schoolId, circular_number });
    }
    setSaving(false);
    setShowForm(false);
    setEditing(null);
    setForm({ title: "", content: "", issued_to: "all", issue_date: new Date().toISOString().slice(0, 10), academic_year: "2025-26" });
    fetchData();
  }

  function openEdit(c: Circular) {
    setEditing(c);
    setForm({ title: c.title, content: c.content, issued_to: c.issued_to, issue_date: c.issue_date, academic_year: c.academic_year });
    setShowForm(true);
  }

  function applyTemplate(tpl: typeof TEMPLATES[0]) {
    setForm(p => ({ ...p, title: tpl.title, content: tpl.content }));
  }

  function doPrint(c: Circular) { setPrintCirc(c); setTimeout(() => window.print(), 300); }

  const BADGE: Record<string, string> = { all: "badge-blue", parents: "badge-purple", staff: "badge-orange", students: "badge-green", teachers: "badge-yellow" };

  const filtered = circulars.filter(c => !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.circular_number.toLowerCase().includes(search.toLowerCase()));
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div>
      <div className="no-print">
        <div className="page-header flex items-center justify-between">
          <div>
            <h1>Circular / Letter Generator</h1>
            <p>Issue numbered school circulars — C-001/2025 format, template library, print</p>
          </div>
          <button type="button" onClick={() => { setEditing(null); setForm({ title: "", content: "", issued_to: "all", issue_date: new Date().toISOString().slice(0, 10), academic_year: "2025-26" }); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> New Circular
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-blue">
            <p className="text-xs text-muted-foreground">Total Circulars</p>
            <p className="text-2xl font-bold">{circulars.length}</p>
          </div>
          {["parents", "staff", "all"].map(t => (
            <div key={t} className="bg-card rounded-xl p-4 border border-border shadow-sm">
              <p className="text-xs text-muted-foreground capitalize">{t === "all" ? "To Everyone" : `To ${t}`}</p>
              <p className="text-2xl font-bold">{circulars.filter(c => c.issued_to === t).length}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search circular number or title…"
              className="pl-9 pr-4 py-2 border border-border rounded-lg text-sm bg-background w-64" />
          </div>
          <span className="text-sm text-muted-foreground ml-auto">{filtered.length} circulars</span>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-16 text-center text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3" />
            <p className="font-semibold">No circulars issued yet.</p>
            <p className="text-sm mt-1">Click "New Circular" to issue your first circular.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(c => (
              <div key={c.id} className="bg-card rounded-xl border border-border p-4 shadow-sm flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-bold text-primary">{c.circular_number}</span>
                      <span className={`${BADGE[c.issued_to] || "badge-gray"} capitalize text-xs`}>
                        {ISSUED_TO_OPTIONS.find(o => o.v === c.issued_to)?.l || c.issued_to}
                      </span>
                    </div>
                    <p className="font-semibold">{c.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{c.content.slice(0, 120)}…</p>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(c.issue_date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })} · AY {c.academic_year}</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button type="button" onClick={() => openEdit(c)} className="flex items-center gap-1 text-xs border border-border px-2.5 py-1.5 rounded-lg hover:bg-muted">
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                  <button type="button" onClick={() => doPrint(c)} className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:opacity-90">
                    <Printer className="w-3 h-3" /> Print
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PRINT VIEW */}
      {printCirc && (
        <div className="hidden print:block print-full">
          <div style={{ fontFamily: "Arial, sans-serif", maxWidth: "680px", margin: "0 auto", padding: "28px", fontSize: "12px" }}>
            {/* Header */}
            <div style={{ textAlign: "center", borderBottom: "3px double #000", paddingBottom: "12px", marginBottom: "20px" }}>
              <p style={{ fontSize: "18px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px" }}>{school.name}</p>
              {school.address && <p style={{ fontSize: "10px", color: "#555", marginTop: "3px" }}>{school.address}</p>}
              {school.phone  && <p style={{ fontSize: "10px", color: "#555" }}>Ph: {school.phone}</p>}
            </div>

            {/* Circular meta */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", fontSize: "11px" }}>
              <div>
                <strong>Circular No.:</strong>
                <span style={{ fontFamily: "monospace", fontWeight: "bold", marginLeft: "6px", fontSize: "13px" }}>{printCirc.circular_number}</span>
              </div>
              <div><strong>Date:</strong> {new Date(printCirc.issue_date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</div>
            </div>

            {/* Issued to */}
            <p style={{ marginBottom: "12px", fontSize: "11px" }}>
              <strong>Issued to:</strong> {ISSUED_TO_OPTIONS.find(o => o.v === printCirc.issued_to)?.l}
            </p>

            {/* Title */}
            <p style={{ fontSize: "15px", fontWeight: "bold", textAlign: "center", textDecoration: "underline", marginBottom: "16px", textTransform: "uppercase" }}>
              {printCirc.title}
            </p>

            {/* Content */}
            <div style={{ lineHeight: "2", fontSize: "12px", whiteSpace: "pre-wrap", marginBottom: "32px" }}>
              {printCirc.content}
            </div>

            {/* Signature */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "40px" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ borderTop: "1px solid #000", width: "180px", paddingTop: "4px", fontSize: "11px" }}>
                  Principal<br />{school.name}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ borderTop: "1px dashed #ccc", marginTop: "24px", paddingTop: "8px", textAlign: "center", fontSize: "9px", color: "#aaa" }}>
              {school.name} · Academic Year {printCirc.academic_year} · Circular {printCirc.circular_number}
            </div>
          </div>
        </div>
      )}

      {/* New/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 no-print">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-lg">{editing ? "Edit Circular" : "New Circular"}</h2>
                {!editing && <p className="text-xs text-muted-foreground">Will be assigned: C-{zeroPad(nextNum)}/{new Date().getFullYear()}</p>}
              </div>
              <button type="button" title="Close" onClick={() => { setShowForm(false); setEditing(null); }}><X className="w-5 h-5" /></button>
            </div>

            {/* Template picker */}
            {!editing && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Use Template</p>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATES.map(t => (
                    <button key={t.label} type="button" onClick={() => applyTemplate(t)}
                      className="text-xs px-3 py-1.5 border border-border rounded-lg hover:bg-muted hover:border-primary transition-colors">
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div><label className="text-xs text-muted-foreground block mb-1">Title *</label>
                <input value={form.title} onChange={e => f("title", e.target.value)} placeholder="Circular subject / title"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>

              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Issued To</label>
                  <select title="Issued to" value={form.issued_to} onChange={e => f("issued_to", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                    {ISSUED_TO_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Issue Date</label>
                  <input type="date" value={form.issue_date} onChange={e => f("issue_date", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Academic Year</label>
                  <input value={form.academic_year} onChange={e => f("academic_year", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground block mb-1">Content * <span className="font-normal">(use {"{PLACEHOLDER}"} for variable parts)</span></label>
                <textarea value={form.content} onChange={e => f("content", e.target.value)} rows={12}
                  placeholder="Type the circular content here…"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-y font-mono" />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="flex-1 py-2.5 border border-border rounded-lg text-sm">Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving || !form.title.trim() || !form.content.trim()}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {saving ? "Saving…" : editing ? "Update Circular" : "Issue Circular"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
