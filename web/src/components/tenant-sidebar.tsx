"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LayoutDashboard, Users, GraduationCap, UserSquare2, 
  CheckSquare, BookOpen, FileText, CalendarDays, Bell, 
  BookMarked, Banknote, Award, CalendarOff, Files, 
  BarChart3, MessageSquare, Bus, UserPlus, Fingerprint, 
  Wallet, Package, Loader2, CreditCard
} from "lucide-react";

export function TenantSidebar() {
  const pathname = usePathname();
  const params = useParams();
  const tenant = params.tenant as string;
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function fetchRole() {
      try {
        const supabase = createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (user) {
          // Query user_roles table to get the role for this specific user
          const { data: roleData, error: roleError } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .limit(1)
            .single();
          
          if (roleData && roleData.role) {
            // Normalize school_admin to admin for UI checks
            if (isMounted) setRole(roleData.role === 'school_admin' ? 'admin' : roleData.role);
          } else {
            // Fallback for tests if profile doesn't exist yet
            if (isMounted) setRole("admin");
          }
        } else {
          // No user found on client
          if (isMounted) setRole("admin"); // Fallback to show UI anyway during debugging
        }
      } catch (err) {
        console.error("Sidebar role fetch error:", err);
        if (isMounted) setRole("admin"); // Fallback
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchRole();
    return () => { isMounted = false; };
  }, []);

  const allRoutes = [
    { name: "Dashboard", href: `/${tenant}/admin`, icon: LayoutDashboard },
    { name: "Students", href: `/${tenant}/admin/students`, icon: Users },
    { name: "Teachers", href: `/${tenant}/admin/teachers`, icon: GraduationCap },
    { name: "Staff", href: `/${tenant}/admin/staff`, icon: UserSquare2 },
    { name: "Attendance", href: `/${tenant}/admin/attendance`, icon: CheckSquare },
    { name: "Homework", href: `/${tenant}/admin/homework`, icon: BookOpen },
    { name: "Exams & Marks", href: `/${tenant}/admin/exams`, icon: FileText },
    { name: "Timetable", href: `/${tenant}/admin/timetable`, icon: CalendarDays },
    { name: "Announcements", href: `/${tenant}/admin/announcements`, icon: Bell },
    { name: "Syllabus", href: `/${tenant}/admin/syllabus`, icon: BookMarked },
    { name: "Fee Management", href: `/${tenant}/admin/fees`, icon: Banknote },
    { name: "Certificates", href: `/${tenant}/admin/certificates`, icon: Award },
    { name: "Leave Management", href: `/${tenant}/admin/leaves`, icon: CalendarOff },
    { name: "Documents", href: `/${tenant}/admin/documents`, icon: Files },
    { name: "Analytics", href: `/${tenant}/admin/analytics`, icon: BarChart3 },
    { name: "Communication", href: `/${tenant}/admin/communication`, icon: MessageSquare },
    { name: "Transport", href: `/${tenant}/admin/transport`, icon: Bus },
    { name: "Admissions", href: `/${tenant}/admin/admissions`, icon: UserPlus },
    { name: "Face AI", href: `/${tenant}/admin/face-ai`, icon: Fingerprint },
    { name: "Staff Payroll", href: `/${tenant}/admin/payroll`, icon: Wallet },
    { name: "Inventory", href: `/${tenant}/admin/inventory`, icon: Package },
    { name: "My Subscription", href: `/${tenant}/admin/subscription`, icon: CreditCard },
  ];

  // RBAC: Role-Based Access Control
  const teacherAllowedRoutes = [
    "Dashboard", "Students", "Attendance", "Homework", 
    "Exams & Marks", "Timetable", "Syllabus", "Announcements", "Leave Management"
  ];

  const routes = allRoutes.filter(r => {
    if (role === "admin") return true;
    if (role === "teacher") return teacherAllowedRoutes.includes(r.name);
    // If student or parent, maybe they shouldn't even be in /admin, but if they are:
    return false;
  });

  return (
    <div className="w-64 border-r border-border bg-card backdrop-blur-xl text-muted-foreground flex-shrink-0 min-h-screen flex flex-col relative overflow-hidden">
      {/* Background ambient light */}
      <div className="absolute top-0 -left-1/2 w-full h-96 bg-emerald-500/10 blur-[100px] pointer-events-none" />
      
      <div className="p-6 border-b border-border sticky top-0 bg-transparent z-10">
        <h2 className="text-xl font-bold text-foreground tracking-tight uppercase flex items-center gap-2">
          <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">SMS</span>
          <span className="text-sm font-medium text-slate-500 lowercase tracking-normal">by</span>
          <span className="text-sm font-medium text-slate-300 tracking-normal">Blueate.in</span>
        </h2>
        <div className="flex items-center mt-2">
          <p className="text-[11px] text-slate-400 font-mono tracking-widest uppercase">[{tenant}] Workspace</p>
          {!loading && role && (
            <span className="ml-auto px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {role}
            </span>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin scrollbar-thumb-slate-700">
        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500/50" />
          </div>
        ) : (
          <AnimatePresence>
            {routes.map((route, idx) => {
              const isActive = pathname === route.href || (pathname?.startsWith(route.href + '/') && route.href !== `/${tenant}/admin`);
              
              return (
                <motion.div
                  key={route.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.02, duration: 0.2 }}
                >
                  <Link
                    href={route.href}
                    className={`relative flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-all duration-300 text-sm font-medium overflow-hidden group ${
                      isActive 
                        ? "text-foreground bg-muted shadow-[inset_0_1px_1px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]" 
                        : "hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    {isActive && (
                      <motion.div 
                        layoutId="active-nav-bg"
                        className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-transparent border-l-2 border-emerald-400 rounded-xl"
                        initial={false}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                    <route.icon className={`w-[18px] h-[18px] relative z-10 transition-colors duration-300 ${isActive ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "text-slate-500 group-hover:text-slate-400"}`} />
                    <span className="relative z-10 tracking-wide">{route.name}</span>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
