"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CheckSquare,
  BookOpen,
  Calendar,
  CalendarOff,
  LogOut,
  GraduationCap
} from "lucide-react";

export function TeacherSidebar({ tenant }: { tenant: string }) {
  const pathname = usePathname();

  const routes = [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      href: `/${tenant}/teacher`,
      active: pathname === `/${tenant}/teacher`,
    },
    {
      label: "My Attendance",
      icon: CheckSquare,
      href: `/${tenant}/teacher/attendance`,
      active: pathname === `/${tenant}/teacher/attendance`,
    },
    {
      label: "Homework & Assignments",
      icon: BookOpen,
      href: `/${tenant}/teacher/homework`,
      active: pathname === `/${tenant}/teacher/homework`,
    },
    {
      label: "My Timetable",
      icon: Calendar,
      href: `/${tenant}/teacher/timetable`,
      active: pathname === `/${tenant}/teacher/timetable`,
    },
    {
      label: "Apply Leave",
      icon: CalendarOff,
      href: `/${tenant}/teacher/leaves`,
      active: pathname === `/${tenant}/teacher/leaves`,
    },
  ];

  return (
    <div className="flex h-full w-64 flex-col bg-card border-r border-border backdrop-blur-xl">
      <div className="flex h-16 items-center px-6 border-b border-border">
        <div className="flex items-center gap-2 text-foreground font-bold text-xl tracking-tight">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-blue-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          Teacher Portal
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
        <div className="mb-4 px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Academics
        </div>
        {routes.map((route) => (
          <Link
            key={route.href}
            href={route.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 group",
              route.active 
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <route.icon className={cn(
              "w-5 h-5 transition-colors",
              route.active ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground group-hover:text-foreground"
            )} />
            {route.label}
            {route.active && (
              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            )}
          </Link>
        ))}
      </div>
      
      <div className="p-4 border-t border-border">
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
