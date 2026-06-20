import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { CheckCircle, Circle, BookOpen } from "lucide-react";

type SyllabusItem = { id: string; subject: string; title: string; status: string; class_name?: string; class_id?: string };
type Class = { id: string; name: string };

export function TeacherSyllabusPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [items, setItems]           = useState<SyllabusItem[]>([]);
  const [classes, setClasses]       = useState<Class[]>([]);
  const [classFilter, setClassFilter] = useState("all");
  const [loading, setLoading]       = useState(true);
  const [updating, setUpdating]     = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    const load = async () => {
      const [{ data: syl }, { data: cls }] = await Promise.all([
        supabase.from("syllabus").select("id, subject, title, status, class_id, classes:class_id(name)").eq("school_id", schoolId).order("subject").order("title"),
        supabase.from("classes").select("id, name").eq("school_id", schoolId).order("name"),
      ]);
      setItems((syl || []).map((s: SyllabusItem & { classes?: { name: string } }) => ({ ...s, class_name: s.classes?.name || "—" })));
      setClasses(cls || []);
      setLoading(false);
    };
    load();
  }, [schoolId]);

  async function toggleStatus(id: string, current: string) {
    const next = current === "completed" ? "pending" : "completed";
    setUpdating(id);
    await supabase.from("syllabus").update({ status: next }).eq("id", id);
    setItems(p => p.map(i => i.id === id ? { ...i, status: next } : i));
    setUpdating(null);
  }

  const filtered = classFilter === "all" ? items : items.filter(i => i.class_id === classFilter);
  const bySubject: Record<string, SyllabusItem[]> = {};
  filtered.forEach(i => { if (!bySubject[i.subject]) bySubject[i.subject] = []; bySubject[i.subject].push(i); });

  const total     = filtered.length;
  const completed = filtered.filter(i => i.status === "completed").length;
  const pct       = total ? Math.round((completed / total) * 100) : 0;

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Syllabus Progress</h1>
          <p>Track topic completion — click any topic to mark complete/pending</p>
        </div>
        <select title="Class" value={classFilter} onChange={e => setClassFilter(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
          <option value="all">All Classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Progress bar */}
      <div className="bg-card border border-border rounded-xl p-4 mb-5 flex items-center gap-4">
        <div className="flex-1">
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium">Overall Completion</span>
            <span className="text-muted-foreground">{completed}/{total} topics</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <span className="text-2xl font-bold text-emerald-600">{pct}%</span>
      </div>

      {loading && <div className="text-center py-16 text-muted-foreground">Loading…</div>}
      {!loading && total === 0 && (
        <div className="bg-card border border-border rounded-xl p-16 text-center text-muted-foreground">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No syllabus items found. Admin se syllabus add karne ko kaho.</p>
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(bySubject).map(([subject, topicList]) => {
          const done = topicList.filter(i => i.status === "completed").length;
          return (
            <div key={subject} className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-3">
                  <BookOpen className="w-4 h-4 text-emerald-500" />
                  <span className="font-semibold">{subject}</span>
                  <span className="text-xs text-muted-foreground">{topicList[0]?.class_name}</span>
                </div>
                <span className="text-xs text-muted-foreground">{done}/{topicList.length} done</span>
              </div>
              <div className="divide-y divide-border">
                {topicList.map(item => (
                  <button key={item.id} type="button"
                    onClick={() => toggleStatus(item.id, item.status)}
                    disabled={updating === item.id}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors ${item.status === "completed" ? "opacity-70" : ""}`}>
                    {item.status === "completed"
                      ? <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      : <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />}
                    <span className={`text-sm ${item.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{item.title}</span>
                    {updating === item.id && <span className="ml-auto text-xs text-muted-foreground">Saving…</span>}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
