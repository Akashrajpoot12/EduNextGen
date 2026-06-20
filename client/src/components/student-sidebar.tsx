"use client";

import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, BookOpen, Calendar, Bell,
  LogOut, UserCircle2, CalendarCheck, Award,
  Wallet, CalendarOff, MessageSquare, FileText, User
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function StudentSidebar({ tenant }: { tenant: string }) {
  const pathname = useLocation().pathname;
  const navigate = useNavigate();
  const supabase = createClient();
  const [studentName, setStudentName] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [initials, setInitials] = useState("S");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("students")
        .select("first_name, last_name, roll_number, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      // Name priority: first_name+last_name → user_metadata → users table → email prefix
      const dbName = data ? [data.first_name, data.last_name].filter(Boolean).join(" ") : "";
      const metaName = user.user_metadata?.full_name || user.user_metadata?.name || "";

      let finalName = dbName || metaName;

      if (!finalName) {
        // Try users table
        const { data: userRow } = await supabase
          .from("users")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();
        finalName = userRow?.full_name || user.email?.split("@")[0] || "Student";
      }

      setStudentName(finalName);
      setRollNo(data?.roll_number || "");
      setAvatarUrl(data?.avatar_url || "");
      setInitials(
        finalName ? finalName.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase() : "S"
      );
    })();
  }, []);

  const sections = [
    {
      label: "Learning",
      routes: [
        { label: "My Dashboard",    icon: LayoutDashboard, href: `/${tenant}/student` },
        { label: "My Homework",     icon: BookOpen,         href: `/${tenant}/student/homework` },
        { label: "Messages",        icon: MessageSquare,    href: `/${tenant}/student/messages` },
      ],
    },
    {
      label: "Academics",
      routes: [
        { label: "My Marks",        icon: Award,            href: `/${tenant}/student/marks` },
        { label: "My Attendance",   icon: CalendarCheck,    href: `/${tenant}/student/attendance` },
        { label: "Class Timetable", icon: Calendar,         href: `/${tenant}/student/timetable` },
      ],
    },
    {
      label: "School",
      routes: [
        { label: "Notice Board",    icon: Bell,             href: `/${tenant}/student/notices` },
        { label: "Fees",            icon: Wallet,           href: `/${tenant}/student/fees` },
        { label: "Leave Requests",  icon: CalendarOff,      href: `/${tenant}/student/leaves` },
        { label: "Documents",       icon: FileText,         href: `/${tenant}/student/documents` },
        { label: "My Profile",      icon: User,             href: `/${tenant}/student/profile` },
      ],
    },
  ];

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    navigate(`/${tenant}/login`);
  }

  return (
    <div className="flex h-full w-64 flex-col bg-card border-r border-border backdrop-blur-xl">
      {/* Student identity header */}
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-700 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden shadow-md">
            {avatarUrl
              ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              : initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{studentName || "Student"}</p>
            {rollNo && <p className="text-xs text-muted-foreground">Roll No: {rollNo}</p>}
            <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/15 text-amber-400 border border-amber-500/25">Student</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {section.label}
            </p>
            {section.routes.map((route) => {
              const active = pathname === route.href;
              return (
                <Link key={route.href} to={route.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all group",
                    active
                      ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}>
                  <route.icon className={cn("w-4 h-4 flex-shrink-0", active ? "text-purple-500" : "text-muted-foreground")} />
                  {route.label}
                  {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-500" />}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-border">
        <button type="button" onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
