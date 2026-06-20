"use client";

import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Wallet, Bus, Mail,
  LogOut, Users, CalendarCheck, Award,
  BookOpen, Calendar, CalendarOff, User
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function ParentSidebar({ tenant }: { tenant: string }) {
  const pathname = useLocation().pathname;
  const navigate = useNavigate();
  const supabase = createClient();
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [initials, setInitials] = useState("P");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Try parents table first
      const { data } = await supabase
        .from("parents")
        .select("full_name, phone, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.full_name) {
        setParentName(data.full_name);
        setParentPhone(data.phone || "");
        setAvatarUrl(data.avatar_url || "");
        setInitials(data.full_name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase());
      } else {
        const name = user.email?.split("@")[0] || "Parent";
        setParentName(name);
        setInitials(name[0]?.toUpperCase() || "P");
      }
    })();
  }, []);

  const sections = [
    {
      label: "Overview",
      routes: [
        { label: "Child Dashboard",  icon: LayoutDashboard, href: `/${tenant}/parent` },
      ],
    },
    {
      label: "Academics",
      routes: [
        { label: "Attendance",       icon: CalendarCheck,   href: `/${tenant}/parent/attendance` },
        { label: "Exam Results",     icon: Award,           href: `/${tenant}/parent/marks` },
        { label: "Homework",         icon: BookOpen,        href: `/${tenant}/parent/homework` },
        { label: "Daily Diary",      icon: BookOpen,        href: `/${tenant}/parent/diary` },
        { label: "Timetable",        icon: Calendar,        href: `/${tenant}/parent/timetable` },
      ],
    },
    {
      label: "School",
      routes: [
        { label: "Fees & Payments",  icon: Wallet,          href: `/${tenant}/parent/fees` },
        { label: "Leave Requests",   icon: CalendarOff,     href: `/${tenant}/parent/leaves` },
        { label: "Transport Status", icon: Bus,             href: `/${tenant}/parent/transport` },
        { label: "School Inbox",     icon: Mail,            href: `/${tenant}/parent/inbox` },
        { label: "My Profile",       icon: User,            href: `/${tenant}/parent/profile` },
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
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden shadow-md">
            {avatarUrl
              ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              : initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{parentName || "Parent"}</p>
            {parentPhone && <p className="text-xs text-muted-foreground">{parentPhone}</p>}
            <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-orange-500/15 text-orange-400 border border-orange-500/25">Parent</span>
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
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}>
                  <route.icon className={cn("w-4 h-4 flex-shrink-0", active ? "text-amber-500" : "text-muted-foreground")} />
                  {route.label}
                  {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500" />}
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
