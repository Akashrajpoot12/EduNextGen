"use client";

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ThemeToggle } from "./theme-toggle";
import { Bell, Search, User, LogOut, Settings, ChevronRight, X, BookOpen, Users, GraduationCap, CalendarDays, Banknote } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "./layout/DashboardLayout";

function portalPath(tenant: string, role: string) {
  if (role === "teacher") return `/${tenant}/teacher/profile`;
  if (role === "student") return `/${tenant}/student/profile`;
  if (role === "parent")  return `/${tenant}/parent/profile`;
  return `/${tenant}/admin/profile`;
}
import { motion, AnimatePresence } from "framer-motion";

// ── Quick search links ──────────────────────────────────────────────────────
const SEARCH_PAGES = [
  { label: "Students",      icon: Users,          path: "/admin/students" },
  { label: "Teachers",      icon: GraduationCap,  path: "/admin/teachers" },
  { label: "Timetable",     icon: CalendarDays,   path: "/admin/timetable" },
  { label: "Fee Management",icon: Banknote,        path: "/admin/fees" },
  { label: "Homework",      icon: BookOpen,        path: "/admin/homework" },
  { label: "Attendance",    icon: Users,           path: "/admin/attendance" },
];

function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { subdomain: tenant } = useTenant();

  useEffect(() => {
    if (open) { setQuery(""); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  const filtered = SEARCH_PAGES.filter(p =>
    p.label.toLowerCase().includes(query.toLowerCase())
  );

  function go(path: string) {
    navigate(`/${tenant}${path}`);
    onClose();
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -8 }}
        transition={{ duration: 0.15 }}
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search pages, students, features…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button type="button" title="Close search" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="py-2 max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No results found</p>
          ) : (
            filtered.map(page => (
              <button
                type="button"
                key={page.path}
                onClick={() => go(page.path)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/60 transition-colors text-left group"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <page.icon className="w-4 h-4 text-primary" />
                </div>
                <span className="flex-1 text-foreground">{page.label}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))
          )}
        </div>
        <div className="px-4 py-2 border-t border-border flex items-center gap-3 text-[11px] text-muted-foreground">
          <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono">↵</kbd> to navigate
          <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono">Esc</kbd> to close
        </div>
      </motion.div>
    </div>
  );
}

// ── Notifications dropdown ──────────────────────────────────────────────────
function NotificationsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { tenantId: schoolId } = useTenant();
  const supabase = createClient();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !schoolId) return;
    setLoading(true);
    supabase
      .from("announcements")
      .select("id, title, content, created_at, priority")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => { setNotices(data || []); setLoading(false); });
  }, [open, schoolId]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const priorityDot: Record<string, string> = {
    high: "bg-red-500", medium: "bg-amber-400", low: "bg-green-500", urgent: "bg-red-600",
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.97 }}
          transition={{ duration: 0.15 }}
          className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-50"
        >
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            <span className="text-xs text-muted-foreground">{notices.length} recent</span>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
            ) : notices.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No notifications</div>
            ) : notices.map(n => (
              <div key={n.id} className="px-4 py-3 border-b border-border/50 hover:bg-muted/40 transition-colors">
                <div className="flex items-start gap-2.5">
                  <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${priorityDot[n.priority] || "bg-primary"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.content}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {new Date(n.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2.5 border-t border-border">
            <button type="button" className="text-xs text-primary hover:underline w-full text-center">View all announcements</button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Profile dropdown ────────────────────────────────────────────────────────
function ProfileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [userInfo, setUserInfo] = useState<{ email: string; name: string; role: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { subdomain: tenant, role } = useTenant();
  const supabase = createClient();

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      setUserInfo({
        email: user.email || "",
        name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
        role: profile?.role || "user",
      });
    })();
  }, [open]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate(`/${tenant}/login`);
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.97 }}
          transition={{ duration: 0.15 }}
          className="absolute right-0 top-full mt-2 w-64 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-50"
        >
          {/* User info */}
          <div className="px-4 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-700 flex items-center justify-center text-foreground font-bold text-sm flex-shrink-0">
                {userInfo?.name?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{userInfo?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{userInfo?.email}</p>
                <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-primary/15 text-primary border border-primary/20">
                  {userInfo?.role}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="py-1">
            <button
              type="button"
              onClick={() => { navigate(portalPath(tenant, role || "")); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted/60 transition-colors"
            >
              <Settings className="w-4 h-4 text-muted-foreground" />
              Account Settings
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Main Topbar ─────────────────────────────────────────────────────────────
export function GlobalTopbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { pathname } = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const { tenantId: schoolId } = useTenant();
  const supabase = createClient();

  // Breadcrumb
  const pathSegments = pathname.split("/").filter(Boolean);
  const breadcrumbs = pathSegments.slice(1).map(seg =>
    seg.charAt(0).toUpperCase() + seg.replace(/-/g, " ").slice(1)
  );

  // Unread notification count
  useEffect(() => {
    if (!schoolId) return;
    supabase
      .from("announcements")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .then(({ count }) => setUnread(count || 0));
  }, [schoolId]);

  // Cmd+K shortcut
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSearchOpen(true); }
      if (e.key === "Escape") { setSearchOpen(false); setNotifOpen(false); setProfileOpen(false); }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b bg-background/80 px-4 md:px-6 backdrop-blur-xl transition-colors">
        {/* Breadcrumb */}
        <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground font-medium">
          <span className="text-foreground">EduNextGen Dashboard</span>
          {breadcrumbs.map((crumb, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span>/</span>
              <span className={idx === breadcrumbs.length - 1 ? "text-foreground font-bold" : ""}>
                {crumb}
              </span>
            </div>
          ))}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1 sm:gap-2 ml-auto">
          {/* Search */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-full border border-border bg-muted/50 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-all w-52"
          >
            <Search className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-left text-xs">Search (Cmd+K)</span>
          </button>

          {/* Bell */}
          <div className="relative">
            <button
              type="button"
              title="Notifications"
              onClick={() => { setNotifOpen(v => !v); setProfileOpen(false); }}
              className="relative flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unread > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
              )}
            </button>
            <div className="relative">
              <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
            </div>
          </div>

          {/* Theme toggle */}
          <ThemeToggle />

          {/* Profile */}
          <div className="relative">
            <button
              type="button"
              title="Profile"
              onClick={() => { setProfileOpen(v => !v); setNotifOpen(false); }}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-fuchsia-500/20 to-purple-600/20 border border-fuchsia-500/30 text-primary hover:from-fuchsia-500/30 hover:to-purple-600/30 transition-all"
            >
              <User className="w-4 h-4" />
            </button>
            <ProfileMenu open={profileOpen} onClose={() => setProfileOpen(false)} />
          </div>
        </div>
      </header>

      {/* Search modal (portal-like, outside header) */}
      <AnimatePresence>
        {searchOpen && <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />}
      </AnimatePresence>
    </>
  );
}
