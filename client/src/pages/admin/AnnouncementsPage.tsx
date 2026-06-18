import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Plus, Printer, Trash2, X, Pin, Megaphone, BookOpen, Calendar } from "lucide-react";

type Notice = {
  id: string;
  title: string;
  content: string;
  target_audience: string;
  notice_type: string;
  notice_date: string;
  priority: string;
  is_pinned: boolean;
  created_at: string;
  event_time?: string;
  event_venue?: string;
  event_class?: string;
};

const AUDIENCE_LABELS: Record<string, string> = {
  all: "Everyone",
  teachers: "Teachers",
  students: "Students",
  parents: "Parents",
  staff: "Staff",
};

const TYPE_COLORS: Record<string, string> = {
  announcement: "badge-blue",
  circular: "badge-purple",
  daily_diary: "badge-green",
  notice: "badge-yellow",
  ptm: "badge-orange",
  event: "badge-pink",
};

const EMPTY_FORM = {
  title: "",
  content: "",
  target_audience: "all",
  notice_type: "announcement",
  notice_date: new Date().toISOString().split("T")[0],
  priority: "normal",
  is_pinned: false,
  event_time: "",
  event_venue: "",
  event_class: "",
};

export function AnnouncementsPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [tab, setTab] = useState<"announcements" | "diary" | "ptm">("announcements");
  const [notices, setNotices] = useState<Notice[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [printNotice, setPrintNotice] = useState<Notice | null>(null);
  const [school, setSchool] = useState<{ name: string } | null>(null);
  const [audienceFilter, setAudienceFilter] = useState("all");

  async function fetchData() {
    const [noticesRes, schoolRes] = await Promise.all([
      supabase.from("announcements").select("*").eq("school_id", schoolId).order("is_pinned", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("schools").select("name").eq("id", schoolId).single(),
    ]);
    setNotices(noticesRes.data || []);
    if (schoolRes.data) setSchool(schoolRes.data as { name: string });
  }

  useEffect(() => { if (schoolId) fetchData(); }, [schoolId]);

  async function handleSave() {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    const payload: Record<string, unknown> = { ...form, school_id: schoolId };
    if (!form.event_time) delete payload.event_time;
    if (!form.event_venue) delete payload.event_venue;
    if (!form.event_class) delete payload.event_class;
    await supabase.from("announcements").insert(payload);
    setSaving(false);
    setShowForm(false);
    setForm({ ...EMPTY_FORM });
    fetchData();
  }

  async function handleDelete(id: string) {
    await supabase.from("announcements").delete().eq("id", id);
    fetchData();
  }

  async function togglePin(notice: Notice) {
    await supabase.from("announcements").update({ is_pinned: !notice.is_pinned }).eq("id", notice.id);
    fetchData();
  }

  function openNew(type: string) {
    setForm({ ...EMPTY_FORM, notice_type: type, notice_date: new Date().toISOString().split("T")[0] });
    setShowForm(true);
  }

  // Filter by tab type
  const tabTypes = tab === "announcements"
    ? ["announcement", "circular", "notice"]
    : tab === "ptm"
    ? ["ptm", "event"]
    : ["daily_diary"];

  const filtered = notices.filter((n) => {
    const matchType = tabTypes.includes(n.notice_type);
    const matchAud = audienceFilter === "all" || n.target_audience === audienceFilter;
    return matchType && matchAud;
  });

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Notices &amp; Diary</h1>
          <p>Circulars, announcements and daily diary for staff, students and parents</p>
        </div>
        <div className="flex gap-2">
          {tab === "diary" && (
            <button type="button" onClick={() => openNew("daily_diary")}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
              <Plus className="w-4 h-4" /> Add Diary Entry
            </button>
          )}
          {tab === "ptm" && (
            <>
              <button type="button" onClick={() => openNew("event")}
                className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted">
                <Plus className="w-4 h-4" /> Event
              </button>
              <button type="button" onClick={() => openNew("ptm")}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
                <Plus className="w-4 h-4" /> PTM Notice
              </button>
            </>
          )}
          {tab === "announcements" && (
            <>
              <button type="button" onClick={() => openNew("circular")}
                className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted">
                <Plus className="w-4 h-4" /> Circular
              </button>
              <button type="button" onClick={() => openNew("announcement")}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
                <Plus className="w-4 h-4" /> Announcement
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: "Announcements", count: notices.filter((n) => n.notice_type === "announcement").length, accent: "card-accent-blue" },
          { label: "Circulars", count: notices.filter((n) => n.notice_type === "circular").length, accent: "card-accent-purple" },
          { label: "Notices", count: notices.filter((n) => n.notice_type === "notice").length, accent: "card-accent-orange" },
          { label: "PTM / Events", count: notices.filter((n) => n.notice_type === "ptm" || n.notice_type === "event").length, accent: "card-accent-red" },
          { label: "Diary Entries", count: notices.filter((n) => n.notice_type === "daily_diary").length, accent: "card-accent-green" },
        ].map((item) => (
          <div key={item.label} className={`bg-card rounded-xl p-4 border border-border shadow-sm ${item.accent}`}>
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="text-2xl font-bold mt-1">{item.count}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 mb-6 w-fit">
        <button type="button" onClick={() => setTab("announcements")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === "announcements" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          <Megaphone className="w-3.5 h-3.5" /> Announcements &amp; Circulars
        </button>
        <button type="button" onClick={() => setTab("ptm")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === "ptm" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          <Calendar className="w-3.5 h-3.5" /> PTM &amp; Events
        </button>
        <button type="button" onClick={() => setTab("diary")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === "diary" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          <BookOpen className="w-3.5 h-3.5" /> Daily Diary
        </button>
      </div>

      {/* Audience filter */}
      <div className="flex items-center gap-3 mb-4">
        <select title="Filter by audience" value={audienceFilter} onChange={(e) => setAudienceFilter(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
          <option value="all">All Audiences</option>
          {Object.entries(AUDIENCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <span className="text-sm text-muted-foreground">{filtered.length} {tab === "diary" ? "entries" : "notices"}</span>
      </div>

      {/* Notice list */}
      {tab === "announcements" && (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="bg-card rounded-xl border border-border p-10 text-center text-muted-foreground text-sm">
              No notices yet. Create an announcement or circular.
            </div>
          )}
          {filtered.map((notice) => (
            <div key={notice.id} className={`bg-card rounded-xl border p-4 shadow-sm ${notice.is_pinned ? "border-primary/40 ring-1 ring-primary/20" : "border-border"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {notice.is_pinned && <Pin className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                    <h3 className="font-semibold text-sm truncate">{notice.title}</h3>
                    <span className={TYPE_COLORS[notice.notice_type] || "badge-gray"}>{notice.notice_type.replace("_", " ")}</span>
                    <span className="badge-blue">{AUDIENCE_LABELS[notice.target_audience] || notice.target_audience}</span>
                    {notice.priority === "urgent" && <span className="badge-red">Urgent</span>}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{notice.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {notice.notice_date ? new Date(notice.notice_date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "—"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button type="button" title={notice.is_pinned ? "Unpin" : "Pin"} onClick={() => togglePin(notice)}
                    className={`p-1.5 rounded-lg border transition-all ${notice.is_pinned ? "border-primary/40 text-primary bg-primary/5" : "border-border text-muted-foreground hover:bg-muted"}`}>
                    <Pin className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" title="Print" onClick={() => setPrintNotice(notice)}
                    className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted">
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" title="Delete" onClick={() => handleDelete(notice.id)}
                    className="p-1.5 rounded-lg border border-border text-red-400 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PTM & Events */}
      {tab === "ptm" && (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="bg-card rounded-xl border border-border p-10 text-center text-muted-foreground text-sm">
              No PTM or event notices yet. Create a PTM or School Event notice.
            </div>
          )}
          {filtered.map((notice) => (
            <div key={notice.id} className={`bg-card rounded-xl border p-4 shadow-sm ${notice.is_pinned ? "border-primary/40 ring-1 ring-primary/20" : "border-border"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {notice.is_pinned && <Pin className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                    <h3 className="font-semibold text-sm">{notice.title}</h3>
                    <span className={TYPE_COLORS[notice.notice_type] || "badge-gray"}>{notice.notice_type.toUpperCase()}</span>
                    <span className="badge-blue">{AUDIENCE_LABELS[notice.target_audience] || notice.target_audience}</span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-1">
                    <span>📅 {notice.notice_date ? new Date(notice.notice_date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "—"}</span>
                    {notice.event_time && <span>🕐 {notice.event_time}</span>}
                    {notice.event_venue && <span>📍 {notice.event_venue}</span>}
                    {notice.event_class && <span>🏫 {notice.event_class}</span>}
                  </div>
                  {notice.content && <p className="text-sm text-muted-foreground line-clamp-2">{notice.content}</p>}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button type="button" title={notice.is_pinned ? "Unpin" : "Pin"} onClick={() => togglePin(notice)}
                    className={`p-1.5 rounded-lg border transition-all ${notice.is_pinned ? "border-primary/40 text-primary bg-primary/5" : "border-border text-muted-foreground hover:bg-muted"}`}>
                    <Pin className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" title="Print slip" onClick={() => setPrintNotice(notice)}
                    className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted">
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" title="Delete" onClick={() => handleDelete(notice.id)}
                    className="p-1.5 rounded-lg border border-border text-red-400 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Daily Diary */}
      {tab === "diary" && (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="bg-card rounded-xl border border-border p-10 text-center text-muted-foreground text-sm">
              No diary entries. Add today's diary entry.
            </div>
          )}
          {filtered.map((entry) => (
            <div key={entry.id} className="bg-card rounded-xl border border-border p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {entry.notice_date ? new Date(entry.notice_date).toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }) : "—"}
                    </span>
                    <span className="badge-blue">{AUDIENCE_LABELS[entry.target_audience] || entry.target_audience}</span>
                  </div>
                  <h3 className="font-semibold text-sm mb-1">{entry.title}</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{entry.content}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                  <button type="button" title="Print" onClick={() => setPrintNotice(entry)}
                    className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted">
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" title="Delete" onClick={() => handleDelete(entry.id)}
                    className="p-1.5 rounded-lg border border-border text-red-400 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg capitalize">
                {form.notice_type === "daily_diary" ? "Daily Diary Entry" : `New ${form.notice_type}`}
              </h2>
              <button type="button" title="Close" onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={form.notice_type === "daily_diary" ? "Subject / Topic *" : "Title *"}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
              <textarea required value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder={form.notice_type === "daily_diary" ? "Today's diary message for parents/students…" : "Notice content *"}
                rows={5}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Date</label>
                  <input type="date" title="Date" value={form.notice_date} onChange={(e) => setForm({ ...form, notice_date: e.target.value })}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">For</label>
                  <select title="Target audience" value={form.target_audience} onChange={(e) => setForm({ ...form, target_audience: e.target.value })}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                    {Object.entries(AUDIENCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              {form.notice_type !== "daily_diary" && form.notice_type !== "ptm" && form.notice_type !== "event" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Type</label>
                    <select title="Notice type" value={form.notice_type} onChange={(e) => setForm({ ...form, notice_type: e.target.value })}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                      <option value="announcement">Announcement</option>
                      <option value="circular">Circular</option>
                      <option value="notice">Notice</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Priority</label>
                    <select title="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                      <option value="normal">Normal</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>
              )}
              {(form.notice_type === "ptm" || form.notice_type === "event") && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Time</label>
                      <input value={form.event_time} onChange={(e) => setForm({ ...form, event_time: e.target.value })}
                        placeholder="e.g. 10:00 AM – 1:00 PM"
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Venue</label>
                      <input value={form.event_venue} onChange={(e) => setForm({ ...form, event_venue: e.target.value })}
                        placeholder="e.g. School Hall / Classroom"
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Class / Section (optional)</label>
                    <input value={form.event_class} onChange={(e) => setForm({ ...form, event_class: e.target.value })}
                      placeholder="e.g. All Classes / Class 9 &amp; 10"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                  </div>
                </>
              )}
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.is_pinned} onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })} />
                Pin to top
              </label>
            </div>
            <div className="flex gap-3 mt-4">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-border rounded-lg text-sm">Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving || !form.title || !form.content}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {saving ? "Saving…" : "Publish"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Modal */}
      {printNotice && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-800">{printNotice.title}</h3>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => window.print()} className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                  <Printer className="w-4 h-4" /> Print
                </button>
                <button type="button" title="Close" onClick={() => setPrintNotice(null)}><X className="w-5 h-5 text-gray-500" /></button>
              </div>
            </div>
            <div className="p-8 font-serif text-gray-900 min-h-[400px]">
              {/* School header */}
              <div className="text-center border-b-2 border-gray-800 pb-4 mb-5">
                <h1 className="text-xl font-bold uppercase tracking-wide">{school?.name || "School"}</h1>
              </div>
              <div className="text-center mb-5">
                <h2 className="text-lg font-bold uppercase underline capitalize">
                  {printNotice.notice_type === "daily_diary" ? "Daily Diary" : printNotice.notice_type === "ptm" ? "Parent-Teacher Meeting Notice" : printNotice.notice_type === "event" ? "School Event Notice" : printNotice.notice_type}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Date: {printNotice.notice_date ? new Date(printNotice.notice_date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "—"}
                </p>
              </div>
              <p className="font-semibold text-sm mb-2">To: {AUDIENCE_LABELS[printNotice.target_audience] || printNotice.target_audience}</p>
              <h3 className="font-bold text-base mb-3">{printNotice.title}</h3>
              {/* PTM/Event details block */}
              {(printNotice.notice_type === "ptm" || printNotice.notice_type === "event") && (printNotice.event_time || printNotice.event_venue || printNotice.event_class) && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 grid grid-cols-2 gap-2 text-sm">
                  {printNotice.event_time && <div><span className="text-gray-500">Time:</span> <strong>{printNotice.event_time}</strong></div>}
                  {printNotice.event_venue && <div><span className="text-gray-500">Venue:</span> <strong>{printNotice.event_venue}</strong></div>}
                  {printNotice.event_class && <div><span className="text-gray-500">Class:</span> <strong>{printNotice.event_class}</strong></div>}
                  <div><span className="text-gray-500">Date:</span> <strong>{printNotice.notice_date ? new Date(printNotice.notice_date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "—"}</strong></div>
                </div>
              )}
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{printNotice.content}</p>
              <div className="flex justify-between mt-12">
                <div />
                <div className="text-center">
                  <div className="border-t border-gray-700 pt-1 w-40">
                    <p className="text-xs font-semibold text-gray-700">Principal / Head</p>
                    <p className="text-xs text-gray-500">{school?.name}</p>
                  </div>
                </div>
              </div>
              {/* PTM tear-off slip */}
              {(printNotice.notice_type === "ptm" || printNotice.notice_type === "event") && (
                <div className="mt-10 border-t-2 border-dashed border-gray-400 pt-4">
                  <p className="text-xs text-gray-400 text-center mb-3">— Cut here and return to class teacher by _________________ —</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs font-bold text-gray-700 uppercase mb-1">{printNotice.notice_type === "ptm" ? "PTM Attendance Slip" : "Event Acknowledgement Slip"}</p>
                      <p><strong>Student Name:</strong> ___________________________</p>
                      <p className="mt-1"><strong>Class / Sec:</strong> _____________</p>
                      {printNotice.notice_type === "ptm" && <p className="mt-1"><strong>Will Attend PTM:</strong> Yes / No</p>}
                      {printNotice.notice_type === "event" && <p className="mt-1"><strong>Will Participate:</strong> Yes / No</p>}
                    </div>
                    <div>
                      <p className="mt-5"><strong>Parent Name:</strong> ___________________________</p>
                      <p className="mt-1"><strong>Contact No.:</strong> ___________________________</p>
                      <div className="border-t border-gray-500 pt-1 mt-5 w-40 text-center">
                        <p className="text-xs">Parent Signature</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
