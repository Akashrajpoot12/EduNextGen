import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Bell, CheckCheck, Info, AlertTriangle, PartyPopper, Calendar } from "lucide-react";

type Notif = {
  id: string; title: string; message: string; type: string;
  is_read: boolean; created_at: string; priority?: string;
};

const TYPE_ICON: Record<string, any> = {
  info: Info, warning: AlertTriangle, event: Calendar, celebration: PartyPopper, default: Bell,
};
const TYPE_COLOR: Record<string, string> = {
  info: "text-blue-500 bg-blue-500/10", warning: "text-amber-500 bg-amber-500/10",
  event: "text-purple-500 bg-purple-500/10", celebration: "text-pink-500 bg-pink-500/10",
  default: "text-primary bg-primary/10",
};

export function TeacherNotificationsPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch announcements targeted to teachers/all as notifications
    const { data: ann } = await supabase
      .from("announcements")
      .select("id, title, content, type:notice_type, priority, created_at, audience:target_audience")
      .eq("school_id", schoolId)
      .in("target_audience", ["all", "teachers", "staff"])
      .order("created_at", { ascending: false })
      .limit(50);

    // Fetch read status from teacher_notifications if table exists, otherwise mark all unread
    const { data: readData } = await supabase
      .from("teacher_notifications")
      .select("announcement_id")
      .eq("user_id", user?.id);

    const readIds = new Set((readData || []).map((r: any) => r.announcement_id));

    setNotifs((ann || []).map((a: any) => ({
      id: a.id,
      title: a.title,
      message: a.content,
      type: a.type || "info",
      priority: a.priority,
      is_read: readIds.has(a.id),
      created_at: a.created_at,
    })));
    setLoading(false);
  }

  useEffect(() => { if (schoolId) load(); }, [schoolId]);

  async function markRead(id: string) {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("teacher_notifications").upsert(
      { user_id: user?.id, announcement_id: id, read_at: new Date().toISOString() },
      { onConflict: "user_id,announcement_id" }
    );
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  }

  async function markAllRead() {
    const { data: { user } } = await supabase.auth.getUser();
    const unread = notifs.filter(n => !n.is_read);
    for (const n of unread) {
      await supabase.from("teacher_notifications").upsert(
        { user_id: user?.id, announcement_id: n.id, read_at: new Date().toISOString() },
        { onConflict: "user_id,announcement_id" }
      );
    }
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
  }

  const unreadCount = notifs.filter(n => !n.is_read).length;
  const displayed = filter === "unread" ? notifs.filter(n => !n.is_read) : notifs;

  function timeAgo(dt: string) {
    const diff = Date.now() - new Date(dt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  if (loading) return <div className="flex justify-center items-center h-48"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Notifications
            {unreadCount > 0 && <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold bg-red-500 text-white rounded-full">{unreadCount}</span>}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">School announcements and alerts</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["all", "unread"] as const).map(f => (
              <button key={f} type="button" onClick={() => setFilter(f)}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                {f === "all" ? "All" : `Unread (${unreadCount})`}
              </button>
            ))}
          </div>
          {unreadCount > 0 && (
            <button type="button" onClick={markAllRead}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted transition-colors">
              <CheckCheck className="w-4 h-4" /> Mark all read
            </button>
          )}
        </div>
      </div>

      {displayed.length === 0
        ? <div className="text-center py-16 bg-card border border-border rounded-xl">
            <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="font-medium">{filter === "unread" ? "No unread notifications" : "No notifications yet"}</p>
          </div>
        : <div className="space-y-2">
          {displayed.map(n => {
            const Icon = TYPE_ICON[n.type] || TYPE_ICON.default;
            const colors = TYPE_COLOR[n.type] || TYPE_COLOR.default;
            return (
              <div key={n.id}
                onClick={() => !n.is_read && markRead(n.id)}
                className={`flex gap-4 p-4 rounded-xl border transition-all cursor-pointer ${n.is_read ? "bg-card border-border opacity-70" : "bg-card border-primary/30 shadow-sm"}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colors}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`font-semibold text-sm ${n.is_read ? "text-muted-foreground" : ""}`}>{n.title}</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {n.priority === "high" && <span className="badge-red text-xs">Urgent</span>}
                      {!n.is_read && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{timeAgo(n.created_at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      }
    </div>
  );
}
