"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Wallet,
  Bus,
  Mail,
  LogOut,
  Users
} from "lucide-react";

export function ParentSidebar({ tenant }: { tenant: string }) {
  const pathname = usePathname();

  const routes = [
    {
      label: "Child Dashboard",
      icon: LayoutDashboard,
      href: `/${tenant}/parent`,
      active: pathname === `/${tenant}/parent`,
    },
    {
      label: "Fees & Payments",
      icon: Wallet,
      href: `/${tenant}/parent/fees`,
      active: pathname === `/${tenant}/parent/fees`,
    },
    {
      label: "Transport Status",
      icon: Bus,
      href: `/${tenant}/parent/transport`,
      active: pathname === `/${tenant}/parent/transport`,
    },
    {
      label: "School Inbox",
      icon: Mail,
      href: `/${tenant}/parent/inbox`,
      active: pathname === `/${tenant}/parent/inbox`,
    },
  ];

  return (
    <div className="flex h-full w-64 flex-col bg-card border-r border-border backdrop-blur-xl">
      <div className="flex h-16 items-center px-6 border-b border-border">
        <div className="flex items-center gap-2 text-foreground font-bold text-xl tracking-tight">
          <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Users className="w-5 h-5 text-white" />
          </div>
          Parent Portal
        </div>
      </div>
      
      {/* Ward Selector (Mock) */}
      <div className="p-4 border-b border-border">
        <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Viewing Profile For</label>
        <select className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500">
          <option value="child1">Rahul Kumar (Class 10)</option>
          <option value="child2">Priya Kumar (Class 8)</option>
        </select>
      </div>
      
      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
        <div className="mb-4 px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Tracking
        </div>
        {routes.map((route) => (
          <Link
            key={route.href}
            href={route.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 group",
              route.active 
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <route.icon className={cn(
              "w-5 h-5 transition-colors",
              route.active ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground group-hover:text-foreground"
            )} />
            {route.label}
            {route.active && (
              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
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
