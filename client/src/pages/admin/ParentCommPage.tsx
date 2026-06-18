import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Plus, X, Phone, MessageSquare, Users, Calendar, AlertCircle, CheckCircle } from "lucide-react";

type CommLog = {
  id: string;
  student_id: string;
  contact_name: string;
  contact_phone: string;
  comm_type: string;
  direction: string;
  subject: string;
  notes: string;
  follow_up_date: string | null;
  follow_up_done: boolean;
  comm_date: string;
  created_at: string;
  students?: { name: string; classes?: { name: string } | null } | null;
};

type Student = { id: string; name: string; father_name: string; phone: string; classes?: { name: string } | null };

const COMM_TYPES = [
  { value: "call",    label: "Phone Call",  icon: "📞" },
  { value: "sms",     label: "SMS",         icon: "💬" },
  { value: "whatsapp",label: "WhatsApp",    icon: "💚" },
  { value: "meeting", label: "Meeting",     icon: "🤝" },
  { value: "email",   label: "Email",       icon: "📧" },
  { value: "letter",  label: "Letter",      icon: "📩" },
];

const TYPE_ICONS: Record<string, string> = { call: "📞", sms: "💬", whatsapp: "💚", meeting: "🤝", email: "📧", letter: "📩" };

const EMPTY_FORM = {
  student_id: "",
  contact_name: "",
  contact_phone: "",
  comm_type: "call",
  direction: "outgoing",
  subject: "",
  notes: "",
  follow_up_date: "",
  comm_date: new Date().toISOString().split("T")[0],
};

export function ParentCommPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [logs, setLogs] = useState<CommLog[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [filterStudent, setFilterStudent] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [showFollowUpOnly, setShowFollowUpOnly] = useState(false);
  const [search, setSearch] = useState("");

  async function fetchData() {
    const [logsRes, studsRes] = await Promise.all([
      supabase
        .from("parent_communication_log")
        .select("*, students(name, classes(name))")
        .eq("school_id", schoolId)
        .order("comm_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("students")
        .select("id, name, father_name, phone, classes(name)")
        .eq("school_id", schoolId)
        .order("name"),
    ]);
    setLogs(logsRes.data || []);
    setStudents(studsRes.data || []);
  }

  useEffect(() => { if (schoolId) fetchData(); }, [schoolId]);

  async function handleSave() {
    if (!form.student_id || !form.subject.trim()) return;
    setSaving(true);
    await supabase.from("parent_communication_log").insert({
      ...form,
      school_id: schoolId,
      follow_up_date: form.follow_up_date || null,
      follow_up_done: false,
    });
    setSaving(false);
    setShowForm(false);
    setForm({ ...EMPTY_FORM });
    fetchData();
  }

  async function toggleFollowUpDone(log: CommLog) {
    await supabase.from("parent_communication_log").update({ follow_up_done: !log.follow_up_done }).eq("id", log.id);
    fetchData();
  }

  async function handleDelete(id: string) {
    await supabase.from("parent_communication_log").delete().eq("id", id);
    fetchData();
  }

  function prefillFromStudent(studentId: string) {
    const s = students.find((st) => st.id === studentId);
    if (s) setForm((prev) => ({ ...prev, student_id: studentId, contact_name: s.father_name || "", contact_phone: s.phone || "" }));
    else setForm((prev) => ({ ...prev, student_id: studentId }));
  }

  const pendingFollowUps = logs.filter((l) => l.follow_up_date && !l.follow_up_done);
  const overdueFollowUps = pendingFollowUps.filter((l) => l.follow_up_date && new Date(l.follow_up_date) < new Date());

  const filtered = logs.filter((l) => {
    const sn = l.students as { name: string } | null;
    const matchStudent = filterStudent === "all" || l.student_id === filterStudent;
    const matchType = filterType === "all" || l.comm_type === filterType;
    const matchFollowUp = !showFollowUpOnly || (l.follow_up_date && !l.follow_up_done);
    const matchSearch = !search || sn?.name?.toLowerCase().includes(search.toLowerCase()) || l.subject.toLowerCase().includes(search.toLowerCase()) || l.contact_name.toLowerCase().includes(search.toLowerCase());
    return matchStudent && matchType && matchFollowUp && matchSearch;
  });

  const f = (k: keyof typeof form, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Parent Communication Log</h1>
          <p>Record calls, messages and meetings with parents — track follow-ups</p>
        </div>
        <button type="button" onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" /> Log Communication
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-blue">
          <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-blue-500" /><p className="text-xs text-muted-foreground">Total Logs</p></div>
          <p className="text-2xl font-bold mt-1">{logs.length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-orange">
          <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-amber-500" /><p className="text-xs text-muted-foreground">Follow-ups Pending</p></div>
          <p className="text-2xl font-bold mt-1">{pendingFollowUps.length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-red">
          <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4 text-red-500" /><p className="text-xs text-muted-foreground">Overdue Follow-ups</p></div>
          <p className="text-2xl font-bold mt-1">{overdueFollowUps.length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-green">
          <div className="flex items-center gap-2"><Users className="w-4 h-4 text-emerald-500" /><p className="text-xs text-muted-foreground">Parents Contacted</p></div>
          <p className="text-2xl font-bold mt-1">{new Set(logs.map((l) => l.student_id)).size}</p>
        </div>
      </div>

      {/* Overdue follow-up banner */}
      {overdueFollowUps.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span><strong>{overdueFollowUps.length} overdue follow-up{overdueFollowUps.length > 1 ? "s" : ""}</strong> — {overdueFollowUps.slice(0, 3).map((l) => { const sn = l.students as { name: string } | null; return sn?.name; }).filter(Boolean).join(", ")}{overdueFollowUps.length > 3 ? ` +${overdueFollowUps.length - 3} more` : ""}</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by student, subject…"
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background w-60" />
        <select title="Filter by student" value={filterStudent} onChange={(e) => setFilterStudent(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
          <option value="all">All Students</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select title="Filter by type" value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
          <option value="all">All Types</option>
          {COMM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={showFollowUpOnly} onChange={(e) => setShowFollowUpOnly(e.target.checked)} />
          Pending follow-ups only
        </label>
        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} records</span>
      </div>

      {/* Log list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="bg-card rounded-xl border border-border p-10 text-center text-muted-foreground text-sm">
            No communication logs found. Log your first interaction with a parent.
          </div>
        )}
        {filtered.map((log) => {
          const sn = log.students as { name: string; classes?: { name: string } | null } | null;
          const cls = sn?.classes as { name: string } | null;
          const isOverdue = log.follow_up_date && !log.follow_up_done && new Date(log.follow_up_date) < new Date();
          return (
            <div key={log.id} className={`bg-card rounded-xl border p-4 shadow-sm ${isOverdue ? "border-red-200 ring-1 ring-red-100" : "border-border"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center text-lg flex-shrink-0">
                    {TYPE_ICONS[log.comm_type] || "📞"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-semibold text-sm">{sn?.name || "—"}</span>
                      {cls?.name && <span className="badge-blue">{cls.name}</span>}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${log.direction === "incoming" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                        {log.direction === "incoming" ? "↙ Incoming" : "↗ Outgoing"}
                      </span>
                    </div>
                    <p className="font-medium text-sm">{log.subject}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {log.contact_name}{log.contact_phone ? ` · ${log.contact_phone}` : ""} · {new Date(log.comm_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                    {log.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{log.notes}</p>}
                    {log.follow_up_date && (
                      <div className={`flex items-center gap-1.5 text-xs mt-1.5 ${log.follow_up_done ? "text-emerald-600" : isOverdue ? "text-red-600 font-semibold" : "text-amber-600"}`}>
                        {log.follow_up_done
                          ? <><CheckCircle className="w-3.5 h-3.5" /> Follow-up done</>
                          : <><Calendar className="w-3.5 h-3.5" /> Follow-up: {new Date(log.follow_up_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}{isOverdue ? " (Overdue)" : ""}</>
                        }
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {log.follow_up_date && !log.follow_up_done && (
                    <button type="button" title="Mark follow-up done" onClick={() => toggleFollowUpDone(log)}
                      className="p-1.5 rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 text-xs">
                      <CheckCircle className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button type="button" title="Delete" onClick={() => handleDelete(log.id)}
                    className="p-1.5 rounded-lg border border-border text-red-400 hover:text-red-600 hover:bg-red-50">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">Log Communication</h2>
              <button type="button" title="Close" onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Student *</label>
                <select title="Select student" value={form.student_id} onChange={(e) => prefillFromStudent(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                  <option value="">Select student…</option>
                  {students.map((s) => {
                    const cls = s.classes as { name: string } | null;
                    return <option key={s.id} value={s.id}>{s.name}{cls ? ` (${cls.name})` : ""}</option>;
                  })}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Contact Name</label>
                  <input value={form.contact_name} onChange={(e) => f("contact_name", e.target.value)} placeholder="Father / Mother name"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Phone</label>
                  <input value={form.contact_phone} onChange={(e) => f("contact_phone", e.target.value)} placeholder="Contact number"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Type</label>
                  <select title="Communication type" value={form.comm_type} onChange={(e) => f("comm_type", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                    {COMM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Direction</label>
                  <select title="Direction" value={form.direction} onChange={(e) => f("direction", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                    <option value="outgoing">↗ Outgoing</option>
                    <option value="incoming">↙ Incoming</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Date</label>
                  <input type="date" title="Communication date" value={form.comm_date} onChange={(e) => f("comm_date", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Subject *</label>
                <input value={form.subject} onChange={(e) => f("subject", e.target.value)} placeholder="What was discussed (e.g. Fee payment, Attendance issue)"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Notes</label>
                <textarea value={form.notes} onChange={(e) => f("notes", e.target.value)} placeholder="Detailed notes about the conversation…"
                  rows={3} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Follow-up Date (optional)</label>
                <input type="date" title="Follow-up date" value={form.follow_up_date} onChange={(e) => f("follow_up_date", e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-border rounded-lg text-sm">Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving || !form.student_id || !form.subject.trim()}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {saving ? "Saving…" : "Save Log"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
