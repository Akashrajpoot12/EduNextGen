// @ts-nocheck
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Plus, BookOpen, Loader2, X, Send, CalendarDays } from "lucide-react";
import { toast } from "sonner";

const EMPTY = { date: new Date().toISOString().split("T")[0], subject: "", homework: "", notes: "", class_id: "" };

export function TeacherDiaryPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [entries, setEntries]   = useState<any[]>([]);
  const [classes, setClasses]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ ...EMPTY });
  const [saving, setSaving]     = useState(false);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => { if (schoolId) init(); }, [schoolId]);

  async function init() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const [{ data: e }, { data: c }] = await Promise.all([
      supabase
        .from("daily_diary")
        .select("*, classes:class_id(grade_level, section)")
        .eq("school_id", schoolId)
        .eq("teacher_id", user!.id)
        .order("date", { ascending: false })
        .limit(60),
      supabase.from("classes").select("id, grade_level, section").eq("school_id", schoolId).order("grade_level"),
    ]);
    setEntries(e || []);
    setClasses(c || []);
    setLoading(false);
  }

  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSave(ev: React.FormEvent) {
    ev.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("daily_diary").insert({
      school_id: schoolId,
      teacher_id: user!.id,
      ...form,
      class_id: form.class_id || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Diary entry saved!");
    setForm({ ...EMPTY });
    setShowForm(false);
    init();
  }

  async function handleDelete(id: string) {
    await supabase.from("daily_diary").delete().eq("id", id);
    setEntries(prev => prev.filter(e => e.id !== id));
  }

  const filtered = filterDate
    ? entries.filter(e => e.date === filterDate)
    : entries;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Daily Diary</h1>
          <p className="text-sm text-muted-foreground mt-1">Post daily homework and notes — visible to parents</p>
        </div>
        <button type="button" onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Add Entry
        </button>
      </div>

      {/* Date filter */}
      <div className="flex items-center gap-3">
        <CalendarDays className="w-4 h-4 text-muted-foreground" />
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
          title="Filter by date"
          className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        {filterDate && (
          <button type="button" onClick={() => setFilterDate("")}
            className="text-xs text-muted-foreground hover:text-foreground underline">
            Show all
          </button>
        )}
      </div>

      {/* Add Entry Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-border">
              <h2 className="font-bold">New Diary Entry</h2>
              <button type="button" title="Close" onClick={() => setShowForm(false)}>
                <X className="w-5 h-5 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Date *</label>
                  <input required type="date" value={form.date} onChange={set("date")}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Class</label>
                  <select value={form.class_id} onChange={set("class_id")}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="">All / General</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>Class {c.grade_level}-{c.section}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subject</label>
                <input value={form.subject} onChange={set("subject")} placeholder="e.g. Mathematics"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Homework *</label>
                <textarea required value={form.homework} onChange={set("homework")} rows={3}
                  placeholder="e.g. Complete Ex. 5.1, Q1–Q10 from textbook"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Teacher Notes (optional)</label>
                <textarea value={form.notes} onChange={set("notes")} rows={2}
                  placeholder="Any additional notes for parents..."
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 border border-border rounded-lg py-2 text-sm hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-60">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Post Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Entries */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="font-medium">No entries {filterDate ? "for this date" : "yet"}</p>
          <p className="text-sm text-muted-foreground mt-1">Click "Add Entry" to post homework for parents</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(entry => (
            <div key={entry.id} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-base font-bold text-emerald-600 leading-none">
                      {new Date(entry.date).getDate()}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase">
                      {new Date(entry.date).toLocaleString("en-IN", { month: "short" })}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {entry.subject && (
                        <span className="text-xs bg-blue-500/10 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                          {entry.subject}
                        </span>
                      )}
                      {entry.classes && (
                        <span className="text-xs text-muted-foreground">
                          Class {entry.classes.grade_level}-{entry.classes.section}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium">{entry.homework}</p>
                    {entry.notes && (
                      <p className="text-xs text-muted-foreground mt-1 italic">{entry.notes}</p>
                    )}
                  </div>
                </div>
                <button type="button" title="Delete entry" onClick={() => handleDelete(entry.id)}
                  className="text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
