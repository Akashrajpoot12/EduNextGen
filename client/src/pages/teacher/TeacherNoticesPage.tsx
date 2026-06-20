import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Bell, Megaphone, AlertCircle, Search, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 10;

type Notice = {
  id: string; title: string; content: string; type?: string;
  priority?: string; created_at: string; author?: { name?: string; full_name?: string };
};

const TYPE_BADGE: Record<string, string> = {
  general: "badge-blue", exam: "badge-red", holiday: "badge-green",
  fee: "badge-orange", event: "badge-purple", meeting: "badge-yellow",
};

export function TeacherNoticesPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState("all");
  const [search, setSearch]   = useState("");
  const [page, setPage]       = useState(1);

  useEffect(() => {
    if (!schoolId) return;
    const load = async () => {
      const { data } = await supabase
        .from("announcements")
        .select("id, title, content, type, priority, created_at, author:created_by(name, full_name)")
        .eq("school_id", schoolId)
        .in("audience", ["all", "teachers", "staff"])
        .order("created_at", { ascending: false });
      setNotices(data || []);
      setLoading(false);
    };
    load();
  }, [schoolId]);

  const filtered = notices
    .filter(n => filter === "all" || n.type === filter)
    .filter(n => !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase()));

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleFilterChange = (f: string) => { setFilter(f); setPage(1); };
  const handleSearch = (s: string) => { setSearch(s); setPage(1); };

  const fmt = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div>
      <div className="page-header flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1>Notices & Announcements</h1>
          <p>School notices, exam updates, holiday announcements</p>
        </div>
        <div className="flex items-center gap-2 no-print flex-wrap">
          {["all", "general", "exam", "holiday", "event", "meeting"].map(t => (
            <button key={t} type="button" onClick={() => handleFilterChange(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${filter === t ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={e => handleSearch(e.target.value)}
          placeholder="Search notices…"
          className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>

      {loading && <div className="text-center py-16 text-muted-foreground">Loading notices…</div>}

      {!loading && filtered.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-16 text-center text-muted-foreground">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No notices found.</p>
        </div>
      )}

      <div className="space-y-3">
        {paginated.map(n => (
          <div key={n.id} className={`bg-card border rounded-xl p-5 shadow-sm ${n.priority === "high" ? "border-red-300 dark:border-red-800" : "border-border"}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${n.priority === "high" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}`}>
                  {n.priority === "high" ? <AlertCircle className="w-4 h-4" /> : <Megaphone className="w-4 h-4" />}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{n.title}</h3>
                    {n.type && <span className={`${TYPE_BADGE[n.type] || "badge-gray"} text-xs`}>{n.type}</span>}
                    {n.priority === "high" && <span className="badge-red text-xs">Urgent</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {fmt(n.created_at)} {n.author ? `· by ${n.author.name || n.author.full_name}` : ""}
                  </p>
                </div>
              </div>
            </div>
            <p className="mt-3 text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{n.content}</p>
          </div>
        ))}
      </div>

      {!loading && filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-muted-foreground">
            Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-40">
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="text-sm font-medium px-2">{safePage} / {totalPages}</span>
            <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-40">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
