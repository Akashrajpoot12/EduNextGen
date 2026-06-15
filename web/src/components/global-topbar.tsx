"use client";

import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";
import { Bell, Menu, Search, User } from "lucide-react";
import { Button } from "./ui/button";

export function GlobalTopbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const pathname = usePathname();
  
  // Basic breadcrumb generation
  const pathSegments = pathname.split('/').filter(Boolean);
  const breadcrumbs = pathSegments.slice(1).map(seg => 
    seg.charAt(0).toUpperCase() + seg.slice(1)
  );

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b bg-background/80 px-4 md:px-6 backdrop-blur-xl transition-colors">
      <div className="flex items-center gap-4">
        {onMenuClick && (
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick}>
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground font-medium">
          <span className="text-foreground">SMS Dashboard</span>
          {breadcrumbs.map((crumb, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span>/</span>
              <span className={idx === breadcrumbs.length - 1 ? "text-foreground font-bold" : ""}>
                {crumb}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Global Search Mock */}
        <div className="hidden sm:flex relative group">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search (Cmd+K)"
            className="h-9 w-64 rounded-full border bg-muted/50 pl-9 pr-4 text-sm focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground rounded-full">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
        </Button>
        
        <ThemeToggle />

        <div className="h-8 w-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary cursor-pointer hover:bg-primary/30 transition-colors ml-2">
          <User className="h-4 w-4" />
        </div>
      </div>
    </header>
  );
}
