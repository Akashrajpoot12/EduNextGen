import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Phone, Copy, ExternalLink, CheckCircle, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Student = { id: string; name: string; father_name: string; phone: string; class_id: string; classes?: { name: string } | null };

const TEMPLATES = [
  { label: "Fee Reminder", text: "Dear Parent of {name}, your fee of Rs. {amount} is due. Please pay at the earliest. - {school}" },
  { label: "Exam Notice", text: "Dear Parent of {name}, exams begin from {date}. Please ensure timely preparation. - {school}" },
  { label: "PTM Invite", text: "Dear Parent of {name}, PTM is scheduled on {date} at {time}. Your presence is requested. - {school}" },
  { label: "Attendance Alert", text: "Dear Parent of {name}, your child's attendance is below 75%. Please contact the school. - {school}" },
  { label: "Holiday Notice", text: "Dear Parent, school will remain closed on {date} due to {reason}. - {school}" },
  { label: "Custom", text: "" },
];

export function BulkMessagesPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [schoolName, setSchoolName] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [template, setTemplate] = useState(TEMPLATES[0].text);
  const [customMsg, setCustomMsg] = useState("");
  const [messageMode, setMessageMode] = useState<"whatsapp" | "sms">("whatsapp");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [showLinks, setShowLinks] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    Promise.all([
      supabase.from("students").select("id, name, father_name, phone, class_id, classes(name)").eq("school_id", schoolId).not("phone", "is", null).order("name"),
      supabase.from("classes").select("id, name").eq("school_id", schoolId).order("name"),
      supabase.from("schools").select("name").eq("id", schoolId).single(),
    ]).then(([sRes, cRes, scRes]) => {
      setStudents(sRes.data as Student[] || []);
      setClasses(cRes.data || []);
      if (scRes.data) setSchoolName((scRes.data as { name: string }).name);
    });
  }, [schoolId]);

  const filtered = classFilter === "all" ? students : students.filter(s => s.class_id === classFilter);
  const noPhone = students.length - filtered.filter(s => s.phone).length;

  function toggle(id: string) { setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function selectAll() { setSelectedIds(new Set(filtered.filter(s => s.phone).map(s => s.id))); }
  function clearAll() { setSelectedIds(new Set()); }

  const msg = customMsg || template;

  function buildMessage(s: Student) {
    return msg.replaceAll("{name}", s.name).replaceAll("{school}", schoolName).replace(/\{[^}]+\}/g, "___");
  }

  function waLink(s: Student) {
    const phone = s.phone.replace(/\D/g, "");
    const fullPhone = phone.startsWith("91") ? phone : "91" + phone;
    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(buildMessage(s))}`;
  }

  async function copyAll() {
    const lines = filtered.filter(s => selectedIds.has(s.id) && s.phone)
      .map(s => `${s.name} (${s.phone}): ${buildMessage(s)}`).join("\n\n");
    await navigator.clipboard.writeText(lines);
    toast.success("Messages copied to clipboard");
  }

  const selectedStudents = filtered.filter(s => selectedIds.has(s.id) && s.phone);

  async function sendViaApi(channel: "sms" | "whatsapp") {
    if (selectedStudents.length === 0) return;
    setSending(true);
    const toastId = toast.loading(`Sending ${selectedStudents.length} ${channel.toUpperCase()} messages...`);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const items = selectedStudents.map(s => ({ mobile: s.phone, message: buildMessage(s) }));
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ type: "custom", schoolId, data: { channel, items } }),
        }
      );
      if (!res.ok) throw new Error("Messaging service error");
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      toast.success(`${channel.toUpperCase()}: ${result.sent ?? 0} sent, ${result.failed ?? 0} failed`, { id: toastId });
    } catch (err: any) {
      toast.error("Failed: " + err.message, { id: toastId });
    }
    setSending(false);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Bulk Parent Messages</h1>
        <p>Send WhatsApp or SMS messages to parents — select by class, compose template</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-green">
          <p className="text-xs text-muted-foreground">With Phone</p>
          <p className="text-2xl font-bold">{students.filter(s => s.phone).length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-red">
          <p className="text-xs text-muted-foreground">No Phone</p>
          <p className="text-2xl font-bold">{students.filter(s => !s.phone).length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-blue">
          <p className="text-xs text-muted-foreground">Selected</p>
          <p className="text-2xl font-bold">{selectedIds.size}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-purple">
          <p className="text-xs text-muted-foreground">Classes</p>
          <p className="text-2xl font-bold">{classes.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Left — student selector */}
        <div className="col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <select title="Filter class" value={classFilter} onChange={e => setClassFilter(e.target.value)}
              className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background">
              <option value="all">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button type="button" onClick={selectAll} className="text-xs border border-border px-2 py-1.5 rounded-lg hover:bg-muted">All</button>
            <button type="button" onClick={clearAll} className="text-xs border border-border px-2 py-1.5 rounded-lg hover:bg-muted">None</button>
          </div>
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm max-h-[420px] overflow-y-auto">
            <table className="w-full edu-table text-xs">
              <thead><tr><th className="w-6"></th><th>Name</th><th>Phone</th></tr></thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} className={!s.phone ? "opacity-40" : selectedIds.has(s.id) ? "bg-primary/5" : ""}>
                    <td><input type="checkbox" title="Select" checked={selectedIds.has(s.id)} disabled={!s.phone} onChange={() => toggle(s.id)} /></td>
                    <td className="font-medium">{s.name}</td>
                    <td className="font-mono">{s.phone || <span className="text-red-400">No phone</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">{selectedIds.size} selected · {filtered.filter(s => !s.phone).length} students have no phone</p>
        </div>

        {/* Right — message composer */}
        <div className="col-span-3 space-y-4">
          {/* Mode */}
          <div className="flex gap-2">
            <button type="button" onClick={() => setMessageMode("whatsapp")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${messageMode === "whatsapp" ? "bg-green-600 text-white border-green-600" : "border-border hover:bg-muted"}`}>
              💬 WhatsApp
            </button>
            <button type="button" onClick={() => setMessageMode("sms")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${messageMode === "sms" ? "bg-blue-600 text-white border-blue-600" : "border-border hover:bg-muted"}`}>
              <Phone className="w-4 h-4" /> SMS
            </button>
          </div>

          {/* Template picker */}
          <div>
            <label className="text-xs text-muted-foreground block mb-2">Message Template</label>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map(t => (
                <button key={t.label} type="button"
                  onClick={() => { setTemplate(t.text); setCustomMsg(""); }}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${template === t.text && !customMsg ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message editor */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Message <span className="text-blue-500">(use {"{name}"}, {"{school}"}, {"{date}"}, {"{amount}"} etc.)</span></label>
            <textarea value={customMsg || template} onChange={e => setCustomMsg(e.target.value)} rows={4}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none" />
            <p className="text-xs text-muted-foreground mt-1">{(customMsg || template).length} characters</p>
          </div>

          {/* Preview */}
          {selectedStudents.length > 0 && (
            <div className="bg-muted/30 rounded-xl p-3 text-sm border border-border">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Preview (first student):</p>
              <p className="text-sm">{buildMessage(selectedStudents[0])}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            {messageMode === "whatsapp" ? (
              <>
                <button type="button" onClick={() => sendViaApi("whatsapp")} disabled={selectedStudents.length === 0 || sending}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send {selectedStudents.length} WhatsApp
                </button>
                <button type="button" onClick={() => setShowLinks(!showLinks)} disabled={selectedStudents.length === 0}
                  className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm hover:bg-muted disabled:opacity-50">
                  <ExternalLink className="w-4 h-4" /> {showLinks ? "Hide" : "Show"} Links
                </button>
                <button type="button" onClick={copyAll} disabled={selectedStudents.length === 0}
                  className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm hover:bg-muted disabled:opacity-50">
                  <Copy className="w-4 h-4" /> Copy All
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => sendViaApi("sms")} disabled={selectedStudents.length === 0 || sending}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send {selectedStudents.length} SMS
                </button>
                <button type="button" onClick={copyAll} disabled={selectedStudents.length === 0}
                  className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm hover:bg-muted disabled:opacity-50">
                  <Copy className="w-4 h-4" /> Copy All
                </button>
              </>
            )}
          </div>

          {/* WhatsApp links list */}
          {showLinks && messageMode === "whatsapp" && selectedStudents.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4 max-h-60 overflow-y-auto">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Click to open each chat:</p>
              <div className="space-y-2">
                {selectedStudents.map((s, idx) => (
                  <div key={s.id} className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium flex-1">{s.name} · {s.phone}</span>
                    <div className="flex gap-2">
                      <a href={waLink(s)} target="_blank" rel="noopener noreferrer"
                        className="text-xs bg-green-600 text-white px-2.5 py-1 rounded-lg flex items-center gap-1 hover:bg-green-700">
                        <ExternalLink className="w-3 h-3" /> Open
                      </a>
                      <button type="button" onClick={async () => { await navigator.clipboard.writeText(buildMessage(s)); setCopiedIdx(idx); setTimeout(() => setCopiedIdx(null), 1500); }}
                        className="text-xs border border-border px-2.5 py-1 rounded-lg flex items-center gap-1 hover:bg-muted">
                        {copiedIdx === idx ? <CheckCircle className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
