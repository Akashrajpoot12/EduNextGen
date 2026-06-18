"use client";

import { Link } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  Bell,
  LogOut,
  UserCircle2
} from "lucide-react";

export function StudentSidebar({ tenant }: { tenant: string }) {
  const pathname = useLocation().pathname;

  const routes = [
    {
      label: "My Dashboard",
      icon: LayoutDashboard,
      href: `/${tenant}/student`,
      active: pathname === `/${tenant}/student`,
    },
    {
      label: "My Homework",
      icon: BookOpen,
      href: `/${tenant}/student/homework`,
      active: pathname === `/${tenant}/student/homework`,
    },
    {
      label: "Class Timetable",
      icon: Calendar,
      href: `/${tenant}/student/timetable`,
      active: pathname === `/${tenant}/student/timetable`,
    },
    {
      label: "Notice Board",
      icon: Bell,
      href: `/${tenant}/student/notices`,
      active: pathname === `/${tenant}/student/notices`,
    },
  ];

  return (
    <div className="flex h-full w-64 flex-col bg-card border-r border-border backdrop-blur-xl">
      <div className="flex h-16 items-center px-6 border-b border-border">
        <div className="flex items-center gap-2 text-foreground font-bold text-xl tracking-tight">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/20">
            <UserCircle2 className="w-5 h-5 text-white" />
          </div>
          Student Portal
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
        <div className="mb-4 px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Learning
        </div>
        {routes.map((route) => (
          <Link
            key={route.href}
            to={route.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 group",
              route.active 
                ? "bg-purple-500/10 text-purple-600 dark:text-purple-400" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <route.icon className={cn(
              "w-5 h-5 transition-colors",
              route.active ? "text-purple-600 dark:text-purple-400" : "text-muted-foreground group-hover:text-foreground"
            )} />
            {route.label}
            {route.active && (
              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
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

