// @ts-nocheck
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { BookOpen, Loader2, Users, CalendarDays } from "lucide-react";

export function ParentDiaryPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [loading, setLoading]   = useState(true);
  const [children, setChildren] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [entries, setEntries]   = useState<any[]>([]);
  const [filterDate, setFilterDate] = useState("");

  useEffect(() => { if (schoolId) init(); }, [schoolId]);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: kids } = await supabase
      .from("students")
      .select("id, first_name, last_name, class_id, classes:class_id(grade_level, section)")
      .eq("school_id", schoolId)
      .eq("parent_user_id", user!.id);
    setChildren(kids || []);
    if (kids && kids.length > 0) {
      setSelected(kids[0]);
      loadDiary(kids[0].class_id);
    }
    setLoading(false);
  }

  async function loadDiary(classId: string) {
    const { data } = await supabase
      .from("daily_diary")
      .select("*, classes:class_id(grade_level, section), teacher:teacher_id(full_name)")
      .eq("school_id", schoolId)
      .or(`class_id.eq.${classId},class_id.is.null`)
      .order("date", { ascending: false })
      .limit(30);
    setEntries(data || []);
  }

  const filtered = filterDate ? entries.filter(e => e.date === filterDate) : entries;

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (children.length === 0) return (
    <div className="text-center py-20 bg-card border border-border rounded-xl">
      <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
      <p className="font-medium">No children linked to your account</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Daily Diary</h1>
        <p className="text-sm text-muted-foreground mt-1">Homework and notes posted by your child's teacher</p>
      </div>

      {/* Child selector */}
      {children.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {children.map(c => (
            <button key={c.id} type="button"
              onClick={() => { setSelected(c); loadDiary(c.class_id); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                selected?.id === c.id ? "bg-emerald-500 text-white border-emerald-500" : "border-border hover:bg-muted"
              }`}>
              {c.first_name} {c.last_name}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center font-bold text-emerald-600">
            {selected.first_name?.[0]}
          </div>
          <div>
            <p className="font-semibold">{selected.first_name} {selected.last_name}</p>
            <p className="text-xs text-muted-foreground">
              Class {selected.classes?.grade_level}-{selected.classes?.section}
            </p>
          </div>
        </div>
      )}

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

      {/* Entries */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="font-medium">No diary entries {filterDate ? "for this date" : "yet"}</p>
          <p className="text-sm text-muted-foreground mt-1">Teacher ke diary entries yahan dikhenge</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(entry => (
            <div key={entry.id} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-start gap-3">
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
                    <span className="text-xs text-muted-foreground">
                      by {entry.teacher?.full_name || "Teacher"}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{entry.homework}</p>
                  {entry.notes && (
                    <p className="text-xs text-muted-foreground mt-1.5 bg-muted/40 rounded-lg px-3 py-2 italic">
                      {entry.notes}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
