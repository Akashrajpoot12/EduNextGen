// @ts-nocheck
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Plus, X, CalendarDays, Clock, Users, CheckCircle2, Loader2 } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700 border-blue-200",
  ongoing:   "bg-amber-100 text-amber-700 border-amber-200",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
};

const EMPTY = {
  title: "", date: "", start_time: "", end_time: "", venue: "", class_id: "", description: "", status: "scheduled",
};

export function PTMPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [meetings, setMeetings]   = useState<any[]>([]);
  const [classes, setClasses]     = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ ...EMPTY });
  const [saving, setSaving]       = useState(false);
  const [selected, setSelected]   = useState<any>(null);

  useEffect(() => { if (schoolId) init(); }, [schoolId]);

  async function init() {
    setLoading(true);
    const [{ data: m }, { data: c }] = await Promise.all([
      supabase
        .from("ptm_meetings")
        .select("*, classes:class_id(grade_level, section)")
        .eq("school_id", schoolId)
        .order("date", { ascending: false }),
      supabase.from("classes").select("id, grade_level, section").eq("school_id", schoolId).order("grade_level"),
    ]);
    setMeetings(m || []);
    setClasses(c || []);
    setLoading(false);
  }

  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("ptm_meetings").insert({
      school_id: schoolId,
      ...form,
      class_id: form.class_id || null,
    });
    setSaving(false);
    if (!error) { setForm({ ...EMPTY }); setShowForm(false); init(); }
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from("ptm_meetings").update({ status }).eq("id", id);
    init();
  }

  const upcoming = meetings.filter(m => m.status === "scheduled" && new Date(m.date) >= new Date());
  const past     = meetings.filter(m => m.status === "completed" || new Date(m.date) < new Date());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">PTM Scheduling</h1>
          <p className="text-sm text-muted-foreground mt-1">Schedule and manage Parent-Teacher Meetings</p>
        </div>
        <button type="button" onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Schedule PTM
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Upcoming", count: upcoming.length, color: "text-blue-600", bg: "bg-blue-50", icon: CalendarDays },
          { label: "Total This Year", count: meetings.length, color: "text-slate-600", bg: "bg-slate-50", icon: Users },
          { label: "Completed", count: meetings.filter(m => m.status === "completed").length, color: "text-emerald-600", bg: "bg-emerald-50", icon: CheckCircle2 },
          { label: "Cancelled", count: meetings.filter(m => m.status === "cancelled").length, color: "text-red-600", bg: "bg-red-50", icon: X },
        ].map(({ label, count, color, bg, icon: Icon }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center mb-2`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className={`text-2xl font-bold ${color}`}>{count}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Schedule Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-border">
              <h2 className="font-bold text-lg">Schedule PTM</h2>
              <button type="button" title="Close" onClick={() => setShowForm(false)}>
                <X className="w-5 h-5 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Meeting Title *</label>
                <input required value={form.title} onChange={set("title")}
                  placeholder="e.g. Mid-Term PTM 2025"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Date *</label>
                  <input required type="date" value={form.date} onChange={set("date")}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Class (optional)</label>
                  <select value={form.class_id} onChange={set("class_id")}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="">All Classes</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>Class {c.grade_level}-{c.section}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Start Time *</label>
                  <input required type="time" value={form.start_time} onChange={set("start_time")}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Time *</label>
                  <input required type="time" value={form.end_time} onChange={set("end_time")}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Venue</label>
                <input value={form.venue} onChange={set("venue")}
                  placeholder="e.g. School Auditorium / Room 101"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes / Agenda</label>
                <textarea value={form.description} onChange={set("description")} rows={2}
                  placeholder="Agenda or instructions for parents..."
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 border border-border rounded-lg py-2 text-sm hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-60">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Meeting Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-border">
              <h2 className="font-bold">{selected.title}</h2>
              <button type="button" title="Close" onClick={() => setSelected(null)}>
                <X className="w-5 h-5 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
            <div className="p-6 space-y-3 text-sm">
              <div className="flex gap-2"><CalendarDays className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <span>{new Date(selected.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
              </div>
              <div className="flex gap-2"><Clock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <span>{selected.start_time} – {selected.end_time}</span>
              </div>
              {selected.venue && (
                <div className="flex gap-2"><Users className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span>{selected.venue}</span>
                </div>
              )}
              {selected.classes && (
                <div className="text-muted-foreground">
                  Class: <strong>Class {selected.classes.grade_level}-{selected.classes.section}</strong>
                </div>
              )}
              {selected.description && <p className="text-muted-foreground bg-muted/40 rounded-lg p-3">{selected.description}</p>}

              <div className="pt-2 flex gap-2">
                {selected.status === "scheduled" && <>
                  <button type="button" onClick={() => { updateStatus(selected.id, "completed"); setSelected(null); }}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg py-2 text-xs font-medium transition-colors">
                    Mark Completed
                  </button>
                  <button type="button" onClick={() => { updateStatus(selected.id, "cancelled"); setSelected(null); }}
                    className="flex-1 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg py-2 text-xs font-medium transition-colors">
                    Cancel PTM
                  </button>
                </>}
                {selected.status !== "scheduled" && (
                  <p className="text-xs text-muted-foreground italic">Status: {selected.status}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Meetings List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
        </div>
      ) : meetings.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="font-medium">No PTM scheduled yet</p>
          <p className="text-sm text-muted-foreground mt-1">Click "Schedule PTM" to add the first parent-teacher meeting</p>
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map(m => (
            <div key={m.id} onClick={() => setSelected(m)}
              className="bg-card border border-border rounded-xl px-5 py-4 flex items-center gap-4 cursor-pointer hover:border-emerald-500/40 transition-colors group">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex flex-col items-center justify-center flex-shrink-0">
                <span className="text-lg font-bold text-emerald-600 leading-none">
                  {new Date(m.date).getDate()}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase">
                  {new Date(m.date).toLocaleString("en-IN", { month: "short" })}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate group-hover:text-emerald-600 transition-colors">{m.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {m.start_time} – {m.end_time}
                  {m.venue ? ` · ${m.venue}` : ""}
                  {m.classes ? ` · Class ${m.classes.grade_level}-${m.classes.section}` : " · All Classes"}
                </p>
              </div>
              <span className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold uppercase flex-shrink-0 ${STATUS_COLORS[m.status] || STATUS_COLORS.scheduled}`}>
                {m.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
