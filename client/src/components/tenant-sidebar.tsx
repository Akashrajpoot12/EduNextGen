import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { useTenant } from "./layout/DashboardLayout";
import {
  LayoutDashboard, Users, GraduationCap, UserSquare2,
  CheckSquare, BookOpen, FileText, CalendarDays, Bell,
  BookMarked, Banknote, Award, CalendarOff, Files,
  BarChart3, MessageSquare, Bus, UserPlus, Fingerprint,
  Wallet, Package, CreditCard, LogOut, Library, Heart,
  Calendar, ChevronDown, ChevronRight, GraduationCapIcon,
  TicketCheck, TrendingUp, Users2, CreditCard as CardIcon, BookMarked as LibCard, Receipt
} from "lucide-react";

// ── Nav Categories ────────────────────────────────────────────────────────────
type NavItem = { name: string; href: string; icon: React.FC<{ className?: string }> };
type NavGroup = { group: string; color: string; items: NavItem[] };

function buildAdminRoutes(tenant: string): NavGroup[] {
  return [
    {
      group: "Overview",
      color: "text-indigo-500",
      items: [
        { name: "Dashboard",      href: `/${tenant}/admin`,              icon: LayoutDashboard },
        { name: "Analytics",      href: `/${tenant}/admin/analytics`,    icon: BarChart3 },
        { name: "Announcements",  href: `/${tenant}/admin/announcements`,icon: Bell },
      ],
    },
    {
      group: "Academics",
      color: "text-emerald-500",
      items: [
        { name: "Students",       href: `/${tenant}/admin/students`,     icon: Users },
        { name: "Teachers",       href: `/${tenant}/admin/teachers`,     icon: GraduationCap },
        { name: "Classes",        href: `/${tenant}/admin/classes`,      icon: BookMarked },
        { name: "Attendance",     href: `/${tenant}/admin/attendance`,   icon: CheckSquare },
        { name: "Timetable",      href: `/${tenant}/admin/timetable`,    icon: CalendarDays },
        { name: "Homework",       href: `/${tenant}/admin/homework`,     icon: BookOpen },
        { name: "Exams & Marks",  href: `/${tenant}/admin/exams`,          icon: FileText },
        { name: "Marks Analysis", href: `/${tenant}/admin/marks-analysis`, icon: TrendingUp },
        { name: "Hall Tickets",   href: `/${tenant}/admin/hall-tickets`,   icon: TicketCheck },
        { name: "Syllabus",       href: `/${tenant}/admin/syllabus`,       icon: BookMarked },
        { name: "Calendar",       href: `/${tenant}/admin/calendar`,       icon: Calendar },
        { name: "Certificates",   href: `/${tenant}/admin/certificates`,   icon: Award },
      ],
    },
    {
      group: "Finance",
      color: "text-amber-500",
      items: [
        { name: "Fee Management",   href: `/${tenant}/admin/fees`,            icon: Banknote },
        { name: "Fee Challan",      href: `/${tenant}/admin/fee-challan`,     icon: Receipt },
        { name: "Sibling Discount", href: `/${tenant}/admin/sibling-discount`,icon: Users2 },
        { name: "Staff Payroll",    href: `/${tenant}/admin/payroll`,         icon: Wallet },
        { name: "Ledger",           href: `/${tenant}/admin/ledger`,          icon: TrendingUp },
        { name: "Subscription",     href: `/${tenant}/admin/subscription`,    icon: CreditCard },
      ],
    },
    {
      group: "Administration",
      color: "text-blue-500",
      items: [
        { name: "Staff",            href: `/${tenant}/admin/staff`,             icon: UserSquare2 },
        { name: "Staff Attendance", href: `/${tenant}/admin/staff-attendance`, icon: CheckSquare },
        { name: "Leave Mgmt",       href: `/${tenant}/admin/leaves`,            icon: CalendarOff },
        { name: "Class Promotion",  href: `/${tenant}/admin/class-promotion`,   icon: GraduationCap },
        { name: "ID Cards",         href: `/${tenant}/admin/id-cards`,          icon: Award },
        { name: "Roll List",        href: `/${tenant}/admin/roll-list`,         icon: Files },
        { name: "Parent Log",       href: `/${tenant}/admin/parent-log`,        icon: MessageSquare },
        { name: "Admissions",     href: `/${tenant}/admin/admissions`,   icon: UserPlus },
        { name: "Documents",      href: `/${tenant}/admin/documents`,    icon: Files },
        { name: "Communication",  href: `/${tenant}/admin/communication`,icon: MessageSquare },
      ],
    },
    {
      group: "Services",
      color: "text-purple-500",
      items: [
        { name: "Library",        href: `/${tenant}/admin/library`,        icon: Library },
        { name: "Library Cards",  href: `/${tenant}/admin/library-cards`,  icon: LibCard },
        { name: "Transport",      href: `/${tenant}/admin/transport`,      icon: Bus },
        { name: "Bus Pass",       href: `/${tenant}/admin/bus-pass`,       icon: Bus },
        { name: "Health Records", href: `/${tenant}/admin/health`,       icon: Heart },
        { name: "Inventory",      href: `/${tenant}/admin/inventory`,    icon: Package },
        { name: "Face AI",        href: `/${tenant}/admin/face-ai`,      icon: Fingerprint },
      ],
    },
  ];
}

const activeGroupBg: Record<string, string> = {
  "text-indigo-500": "from-indigo-500/15 border-indigo-400",
  "text-emerald-500": "from-emerald-500/15 border-emerald-400",
  "text-amber-500": "from-amber-500/15 border-amber-400",
  "text-blue-500": "from-blue-500/15 border-blue-400",
  "text-purple-500": "from-purple-500/15 border-purple-400",
};
const activeGroupIcon: Record<string, string> = {
  "text-indigo-500": "text-indigo-400 drop-shadow-[0_0_6px_rgba(99,102,241,0.5)]",
  "text-emerald-500": "text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]",
  "text-amber-500": "text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]",
  "text-blue-500": "text-blue-400 drop-shadow-[0_0_6px_rgba(96,165,250,0.5)]",
  "text-purple-500": "text-purple-400 drop-shadow-[0_0_6px_rgba(167,139,250,0.5)]",
};

// ── Component ─────────────────────────────────────────────────────────────────
export function TenantSidebar() {
  const location  = useLocation();
  const pathname  = location.pathname;
  const navigate  = useNavigate();
  const { subdomain: tenant } = useTenant();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserEmail(user.email ?? null);
    })();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    navigate(`/${tenant}/login`);
  };

  const isAdminPortal   = pathname.includes(`/${tenant}/admin`);
  const isTeacherPortal = pathname.includes(`/${tenant}/teacher`);
  const isStudentPortal = pathname.includes(`/${tenant}/student`);
  const isParentPortal  = pathname.includes(`/${tenant}/parent`);

  let portalLabel = "Admin";
  let portalColor = "bg-indigo-500/20 text-indigo-400 border-indigo-500/30";
  if (isTeacherPortal) { portalLabel = "Teacher"; portalColor = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"; }
  if (isStudentPortal) { portalLabel = "Student";  portalColor = "bg-sky-500/20 text-sky-400 border-sky-500/30"; }
  if (isParentPortal)  { portalLabel = "Parent";   portalColor = "bg-purple-500/20 text-purple-400 border-purple-500/30"; }

  // Flat routes for non-admin portals
  const flatRoutes: NavItem[] = isTeacherPortal ? [
    { name: "Dashboard",        href: `/${tenant}/teacher`,            icon: LayoutDashboard },
    { name: "Mark Attendance",  href: `/${tenant}/teacher/attendance`, icon: CheckSquare },
    { name: "Homework",         href: `/${tenant}/teacher/homework`,   icon: BookOpen },
    { name: "Leave Request",    href: `/${tenant}/teacher/leaves`,     icon: CalendarOff },
    { name: "Timetable",        href: `/${tenant}/teacher/timetable`,  icon: CalendarDays },
  ] : isStudentPortal ? [
    { name: "Dashboard",  href: `/${tenant}/student`,          icon: LayoutDashboard },
    { name: "Homework",   href: `/${tenant}/student/homework`, icon: BookOpen },
    { name: "Notices",    href: `/${tenant}/student/notices`,  icon: Bell },
    { name: "Timetable",  href: `/${tenant}/student/timetable`,icon: CalendarDays },
  ] : isParentPortal ? [
    { name: "Dashboard",    href: `/${tenant}/parent`,          icon: LayoutDashboard },
    { name: "Fee Payment",  href: `/${tenant}/parent/fees`,     icon: Banknote },
    { name: "Messages",     href: `/${tenant}/parent/inbox`,    icon: MessageSquare },
    { name: "Transport",    href: `/${tenant}/parent/transport`,icon: Bus },
  ] : [];

  const adminGroups = isAdminPortal && tenant ? buildAdminRoutes(tenant) : [];

  const isItemActive = (href: string) =>
    pathname === href || (pathname?.startsWith(href + "/") && href !== `/${tenant}/admin`);

  const toggleGroup = (group: string) =>
    setCollapsed(prev => ({ ...prev, [group]: !prev[group] }));

  return (
    <div className="w-[230px] border-r border-border bg-sidebar text-sidebar-foreground flex-shrink-0 min-h-screen flex flex-col relative overflow-hidden">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-border/60 sticky top-0 bg-sidebar z-10">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg">
            <span className="text-white text-xs font-black">E</span>
          </div>
          <div>
            <h2 className="text-sm font-black tracking-tight text-foreground leading-none">EduNextGen</h2>
            <p className="text-[10px] text-muted-foreground leading-none mt-0.5">School ERP</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${portalColor}`}>
            {portalLabel}
          </span>
          {userEmail && (
            <span className="text-[10px] text-muted-foreground truncate flex-1" title={userEmail}>{userEmail}</span>
          )}
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {isAdminPortal ? (
          /* ── Grouped admin nav ── */
          adminGroups.map((grp) => {
            const isOpen = collapsed[grp.group] === undefined ? true : !collapsed[grp.group];
            const groupHasActive = grp.items.some(i => isItemActive(i.href));
            return (
              <div key={grp.group} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(grp.group)}
                  className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-widest transition-colors ${groupHasActive ? grp.color : "text-muted-foreground hover:text-foreground"}`}
                >
                  <span className="flex-1 text-left">{grp.group}</span>
                  {isOpen ? <ChevronDown className="w-3 h-3 opacity-60" /> : <ChevronRight className="w-3 h-3 opacity-60" />}
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-0.5 pl-1">
                        {grp.items.map((item, idx) => {
                          const active = isItemActive(item.href);
                          const activeBg = activeGroupBg[grp.color] || "from-indigo-500/15 border-indigo-400";
                          const activeIcon = activeGroupIcon[grp.color] || "text-indigo-400";
                          return (
                            <motion.div
                              key={item.name}
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.015 }}
                            >
                              <Link
                                to={item.href}
                                className={`relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200 overflow-hidden group ${
                                  active
                                    ? "text-foreground font-medium"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                }`}
                              >
                                {active && (
                                  <motion.div
                                    layoutId="sidebar-active"
                                    className={`absolute inset-0 bg-gradient-to-r ${activeBg} to-transparent border-l-2 rounded-lg`}
                                    initial={false}
                                    transition={{ type: "spring", stiffness: 350, damping: 35 }}
                                  />
                                )}
                                <item.icon className={`w-4 h-4 relative z-10 flex-shrink-0 transition-colors ${active ? activeIcon : "text-muted-foreground/70 group-hover:text-muted-foreground"}`} />
                                <span className="relative z-10 text-[13px]">{item.name}</span>
                              </Link>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        ) : (
          /* ── Flat nav for other portals ── */
          flatRoutes.map((item, idx) => {
            const active = isItemActive(item.href);
            return (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.02 }}
              >
                <Link
                  to={item.href}
                  className={`relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 overflow-hidden group ${
                    active ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="sidebar-active-flat"
                      className="absolute inset-0 bg-gradient-to-r from-indigo-500/15 to-transparent border-l-2 border-indigo-400 rounded-lg"
                      initial={false}
                      transition={{ type: "spring", stiffness: 350, damping: 35 }}
                    />
                  )}
                  <item.icon className={`w-4 h-4 relative z-10 ${active ? "text-indigo-400" : "text-muted-foreground/70"}`} />
                  <span className="relative z-10 text-[13px]">{item.name}</span>
                </Link>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border/60 bg-sidebar">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}
