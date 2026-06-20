import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { BookOpen, CheckCircle2, Clock, AlertTriangle, Users } from "lucide-react";

export function ParentHomeworkPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();
  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<any>(null);
  const [homework, setHomework] = useState<any[]>([]);
  const [loadingHw, setLoadingHw] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: kids } = await supabase
        .from("students")
        .select("id, user_id, class_id, enrollment_number, users:user_id(full_name), classes:class_id(grade_level, section)")
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
      setLoadingHw(true);
      const { data } = await supabase
        .from("homework")
        .select("id, title, subject, description, due_date, created_at")
        .eq("school_id", schoolId)
        .eq("class_id", selectedChild.class_id)
        .order("due_date", { ascending: false });
      const today = new Date();
      setHomework((data || []).map(hw => ({
        ...hw,
        isOverdue: new Date(hw.due_date) < today,
        daysLeft: Math.ceil((new Date(hw.due_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
      })));
      setLoadingHw(false);
    })();
  }, [selectedChild]);

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const pending = homework.filter(h => !h.isOverdue).length;
  const overdue = homework.filter(h => h.isOverdue).length;

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
        <h1 className="text-2xl font-bold">Child's Homework</h1>
        <p className="text-sm text-muted-foreground mt-1">Track pending and completed assignments</p>
      </div>

      <div className="flex flex-wrap gap-3">
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
      </div>

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

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: homework.length, color: "text-blue-500" },
          { label: "Pending", value: pending, color: "text-amber-500" },
          { label: "Overdue", value: overdue, color: "text-red-500" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {loadingHw ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : homework.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="font-medium">No homework assigned yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {homework.map(hw => (
            <div key={hw.id} className="bg-card border border-border rounded-xl p-4 flex items-start gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${hw.isOverdue ? "bg-red-500/10" : "bg-amber-500/10"}`}>
                {hw.isOverdue
                  ? <AlertTriangle className="w-5 h-5 text-red-500" />
                  : <Clock className="w-5 h-5 text-amber-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="font-semibold">{hw.title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${hw.isOverdue ? "bg-red-500/10 text-red-600" : "bg-amber-500/10 text-amber-600"}`}>
                    {hw.isOverdue ? "Overdue" : `${hw.daysLeft}d left`}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{hw.subject}</p>
                {hw.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{hw.description}</p>}
                <p className="text-xs text-muted-foreground mt-2">Due: {fmtDate(hw.due_date)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
