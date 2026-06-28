import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Calendar, Users } from "lucide-react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function ParentTimetablePage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();
  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<any>(null);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [loadingSched, setLoadingSched] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: kids } = await supabase
        .from("students")
        .select("id, class_id, users:user_id(full_name), classes:class_id(grade_level, section)")
        .eq("school_id", schoolId)
        .eq("parent_user_id", user.id);
      if (kids && kids.length > 0) {
        setChildren(kids);
        setSelectedChild(kids[0]);
      }
      setLoading(false);
    })();
  }, [schoolId]);

  useEffect(() => {
    if (!selectedChild || !schoolId) return;
    (async () => {
      setLoadingSched(true);
      const { data } = await supabase
        .from("timetables")
        .select("id, day_of_week, start_time, end_time, subject, teacher:teacher_id(full_name)")
        .eq("school_id", schoolId)
        .eq("class_id", selectedChild.class_id)
        .order("start_time", { ascending: true });
      setSchedule(data || []);
      setLoadingSched(false);
    })();
  }, [selectedChild]);

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (children.length === 0) return (
    <div className="text-center py-16 bg-card border border-border rounded-xl">
      <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
      <p className="font-medium">No children linked to your account</p>
      <p className="text-sm text-muted-foreground mt-1">Contact school admin to link your child's profile</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Class Timetable</h1>
        <p className="text-sm text-muted-foreground mt-1">Your child's weekly schedule</p>
      </div>

      {children.length > 1 && (
        <select value={selectedChild?.id} onChange={e => setSelectedChild(children.find(c => c.id === e.target.value))}
          className="h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
          {children.map(c => (
            <option key={c.id} value={c.id}>
              {(c.users as any)?.full_name} — Class {(c.classes as any)?.grade_level}-{(c.classes as any)?.section}
            </option>
          ))}
        </select>
      )}

      {selectedChild && (
        <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center font-bold text-amber-600">
            {((selectedChild.users as any)?.full_name || "?")[0]}
          </div>
          <div>
            <p className="font-semibold">{(selectedChild.users as any)?.full_name}</p>
            <p className="text-xs text-muted-foreground">
              Class {(selectedChild.classes as any)?.grade_level} - {(selectedChild.classes as any)?.section}
            </p>
          </div>
        </div>
      )}

      {loadingSched ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : schedule.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="font-medium">No timetable published yet</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {DAYS.map((day, idx) => {
            // timetables.day_of_week is an INT index (Monday=0 … Saturday=5)
            const periods = schedule.filter(s => s.day_of_week === idx);
            if (periods.length === 0) return null;
            return (
              <div key={day} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-amber-500/5">
                  <h3 className="font-bold text-amber-600">{day}</h3>
                </div>
                <div className="divide-y divide-border">
                  {periods.map(p => (
                    <div key={p.id} className="px-4 py-3">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-sm">{p.subject}</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {p.start_time?.slice(0, 5)} – {p.end_time?.slice(0, 5)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {(p.teacher as any)?.full_name || "Staff"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
