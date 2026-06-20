import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, CheckSquare, BookOpen, Calendar, CalendarOff,
  LogOut, GraduationCap, BarChart3, Users, FileText, Bell, User, BookMarked,
  ClipboardList, TrendingUp, MessageSquare, BellRing, PieChart
} from "lucide-react";

type NavItem = { label: string; icon: React.FC<{ className?: string }>; href: string };

export function TeacherSidebar({ tenant }: { tenant: string }) {
  const pathname  = useLocation().pathname;
  const navigate  = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [teacherName, setTeacherName] = useState("");
  const [teacherSubject, setTeacherSubject] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [initials, setInitials] = useState("T");
  const supabaseClient = createClient();

  useEffect(() => {
    async function loadUnread() {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) return;
      const { data: readData } = await supabaseClient
        .from("teacher_notifications")
        .select("announcement_id")
        .eq("user_id", user.id);
      const readIds = new Set((readData || []).map((r: any) => r.announcement_id));
      const { count } = await supabaseClient
        .from("announcements")
        .select("id", { count: "exact", head: true })
        .in("audience", ["all", "teachers", "staff"]);
      const total = count || 0;
      setUnreadCount(Math.max(0, total - readIds.size));

      // Load teacher profile
      const { data: teacher } = await supabaseClient
        .from("teachers")
        .select("full_name, subject, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (teacher?.full_name) {
        setTeacherName(teacher.full_name);
        setTeacherSubject(teacher.subject || "");
        setAvatarUrl(teacher.avatar_url || "");
        setInitials(teacher.full_name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase());
      } else {
        const em = user.email?.split("@")[0] || "Teacher";
        setTeacherName(em);
        setInitials(em[0]?.toUpperCase() || "T");
      }
    }
    loadUnread();
  }, []);

  const routes: NavItem[] = [
    { label: "Dashboard",          icon: LayoutDashboard, href: `/${tenant}/teacher` },
    { label: "My Students",        icon: Users,           href: `/${tenant}/teacher/students` },
    { label: "Gradebook",          icon: BarChart3,       href: `/${tenant}/teacher/gradebook` },
    { label: "Marks History",      icon: FileText,        href: `/${tenant}/teacher/marks-history` },
    { label: "Homework",           icon: BookOpen,        href: `/${tenant}/teacher/homework` },
    { label: "Submissions",        icon: ClipboardList,   href: `/${tenant}/teacher/submissions` },
    { label: "Syllabus Progress",  icon: BookMarked,      href: `/${tenant}/teacher/syllabus` },
    { label: "Attendance",         icon: CheckSquare,     href: `/${tenant}/teacher/attendance` },
    { label: "Attendance Report",  icon: PieChart,        href: `/${tenant}/teacher/attendance-report` },
    { label: "Performance",        icon: TrendingUp,      href: `/${tenant}/teacher/performance` },
    { label: "Timetable",          icon: Calendar,        href: `/${tenant}/teacher/timetable` },
    { label: "Notices",            icon: Bell,            href: `/${tenant}/teacher/notices` },
    { label: "Notifications",      icon: BellRing,        href: `/${tenant}/teacher/notifications` },
    { label: "Daily Diary",        icon: BookMarked,      href: `/${tenant}/teacher/diary` },
    { label: "Parent Messages",    icon: MessageSquare,   href: `/${tenant}/teacher/messages` },
    { label: "Leave",              icon: CalendarOff,     href: `/${tenant}/teacher/leaves` },
    { label: "My Profile",         icon: User,            href: `/${tenant}/teacher/profile` },
  ];

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    navigate(`/${tenant}/login`);
  }

  return (
    <div className="flex h-full w-64 flex-col bg-card border-r border-border">
      {/* Teacher identity */}
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-600 to-purple-700 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden shadow-md">
            {avatarUrl
              ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              : initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{teacherName || "Teacher"}</p>
            {teacherSubject && <p className="text-xs text-muted-foreground truncate">{teacherSubject}</p>}
            <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-violet-500/15 text-violet-400 border border-violet-500/25">Teacher</span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {routes.map((route, i) => {
          const active = pathname === route.href || (route.href !== `/${tenant}/teacher` && pathname.startsWith(route.href));
          const isSection = (i === 0 || route.label === "Homework" || route.label === "Attendance" || route.label === "Timetable" || route.label === "Leave");
          const sectionLabel = route.label === "Homework" ? "Assignments" : route.label === "Attendance" ? "Attendance" : route.label === "Timetable" ? "Schedule & Comms" : route.label === "Leave" ? "HR" : route.label === "Dashboard" ? "Overview" : null;
          return (
            <div key={route.href + route.label}>
              {isSection && sectionLabel && <p className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{sectionLabel}</p>}
              <Link to={route.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                  active ? "bg-violet-500/10 text-violet-700 dark:text-violet-400" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}>
                <route.icon className={cn("w-4 h-4 flex-shrink-0", active ? "text-violet-500 dark:text-violet-400" : "text-muted-foreground")} />
                <span className="truncate">{route.label}</span>
                {route.label === "Notifications" && unreadCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
                {active && unreadCount === 0 && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" />}
              </Link>
            </div>
          );
        })}
      </div>

      {/* Sign out */}
      <div className="p-3 border-t border-border">
        <button type="button" onClick={handleSignOut} disabled={signingOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
          <LogOut className="w-4 h-4" />
          {signingOut ? "Signing out…" : "Sign Out"}
        </button>
      </div>
    </div>
  );
}
