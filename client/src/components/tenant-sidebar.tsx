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
  Calendar, ChevronDown, ChevronRight,
  TicketCheck, TrendingUp, Users2, BookMarked as LibCard, Receipt,
  Send, IndianRupee, GraduationCap as AlumniIcon, BedDouble, Navigation, HelpCircle,
  ClipboardList, BarChart2, UserCheck, KeyRound,
  Landmark, CalendarCheck, ScrollText, MessageCircleWarning,
  ReceiptText, Newspaper, BookCopy,
  Building2, HeartHandshake, Megaphone
} from "lucide-react";

// ── Nav Categories ────────────────────────────────────────────────────────────
type NavItem = { name: string; href: string; icon: React.FC<{ className?: string }> };
type NavGroup = { group: string; color: string; items: NavItem[] };

function buildAdminRoutes(tenant: string): NavGroup[] {
  return [
    // ── 1. Dashboard ─────────────────────────────────────────────
    {
      group: "Dashboard",
      color: "text-violet-400",
      items: [
        { name: "Overview",       href: `/${tenant}/admin`,              icon: LayoutDashboard },
        { name: "Analytics",      href: `/${tenant}/admin/analytics`,    icon: BarChart3 },
        { name: "Calendar",       href: `/${tenant}/admin/calendar`,     icon: Calendar },
      ],
    },
    // ── 2. Students ───────────────────────────────────────────────
    {
      group: "Students",
      color: "text-pink-400",
      items: [
        { name: "All Students",    href: `/${tenant}/admin/students`,          icon: Users },
        { name: "Admissions",      href: `/${tenant}/admin/admissions`,        icon: UserPlus },
        { name: "Admission Reg.",  href: `/${tenant}/admin/admission-register`,icon: BookCopy },
        { name: "Attendance",      href: `/${tenant}/admin/attendance`,        icon: CheckSquare },
        { name: "Roll List",       href: `/${tenant}/admin/roll-list`,         icon: Files },
        { name: "ID Cards",        href: `/${tenant}/admin/id-cards`,          icon: Award },
        { name: "Class Promotion", href: `/${tenant}/admin/class-promotion`,   icon: TrendingUp },
        { name: "Health Records",  href: `/${tenant}/admin/health`,            icon: Heart },
        { name: "Gate Pass",       href: `/${tenant}/admin/gate-pass`,         icon: KeyRound },
      ],
    },
    // ── 3. Academics ──────────────────────────────────────────────
    {
      group: "Academics",
      color: "text-amber-400",
      items: [
        { name: "Classes",        href: `/${tenant}/admin/classes`,        icon: BookMarked },
        { name: "Teachers",       href: `/${tenant}/admin/teachers`,       icon: GraduationCap },
        { name: "Timetable",      href: `/${tenant}/admin/timetable`,      icon: CalendarDays },
        { name: "Syllabus",       href: `/${tenant}/admin/syllabus`,       icon: BookOpen },
        { name: "Homework",       href: `/${tenant}/admin/homework`,       icon: BookOpen },
        { name: "Exams & Marks",  href: `/${tenant}/admin/exams`,          icon: FileText },
        { name: "Marks Analysis", href: `/${tenant}/admin/marks-analysis`, icon: BarChart2 },
        { name: "Report Card",    href: `/${tenant}/admin/report-card`,    icon: BarChart3 },
        { name: "Hall Tickets",   href: `/${tenant}/admin/hall-tickets`,   icon: TicketCheck },
        { name: "Question Bank",  href: `/${tenant}/admin/question-bank`,  icon: HelpCircle },
        { name: "Exam Date Sheet",href: `/${tenant}/admin/exam-datesheet`, icon: CalendarCheck },
        { name: "Certificates",   href: `/${tenant}/admin/certificates`,   icon: Award },
      ],
    },
    // ── 4. Staff & HR ─────────────────────────────────────────────
    {
      group: "Staff & HR",
      color: "text-violet-400",
      items: [
        { name: "Staff Directory", href: `/${tenant}/admin/staff`,             icon: UserSquare2 },
        { name: "Staff Attendance",href: `/${tenant}/admin/staff-attendance`,  icon: CheckSquare },
        { name: "Leave Requests",  href: `/${tenant}/admin/leaves`,            icon: CalendarOff },
        { name: "Leave Balance",   href: `/${tenant}/admin/leave-balance`,     icon: CalendarCheck },
        { name: "Payroll",         href: `/${tenant}/admin/payroll`,           icon: Wallet },
        { name: "Biometric",       href: `/${tenant}/admin/biometric`,         icon: Fingerprint },
        { name: "Duty Roster",     href: `/${tenant}/admin/duty-roster`,        icon: ClipboardList },
      ],
    },
    // ── 5. Finance ────────────────────────────────────────────────
    {
      group: "Finance",
      color: "text-amber-500",
      items: [
        { name: "Fee Management",  href: `/${tenant}/admin/fees`,             icon: Banknote },
        { name: "Fee Challan",     href: `/${tenant}/admin/fee-challan`,      icon: Receipt },
        { name: "Fee Receipt",     href: `/${tenant}/admin/fee-receipt`,      icon: ReceiptText },
        { name: "Sibling Discount",href: `/${tenant}/admin/sibling-discount`, icon: Users2 },
        { name: "Cheque Mgmt",     href: `/${tenant}/admin/cheque`,           icon: Landmark },
        { name: "Online Payment",  href: `/${tenant}/admin/online-payment`,   icon: IndianRupee },
        { name: "Ledger",          href: `/${tenant}/admin/ledger`,           icon: TrendingUp },
        { name: "Subscription",    href: `/${tenant}/admin/subscription`,     icon: CreditCard },
      ],
    },
    // ── 6. Office ─────────────────────────────────────────────────
    {
      group: "Office",
      color: "text-purple-400",
      items: [
        { name: "Announcements",  href: `/${tenant}/admin/announcements`,      icon: Bell },
        { name: "Circulars",      href: `/${tenant}/admin/circulars`,          icon: Newspaper },
        { name: "Transfer Cert.", href: `/${tenant}/admin/tc`,                 icon: ClipboardList },
        { name: "Bonafide Cert.", href: `/${tenant}/admin/bonafide`,           icon: ScrollText },
        { name: "Visitor Reg.",   href: `/${tenant}/admin/visitor-log`,        icon: UserCheck },
        { name: "Complaint Reg.", href: `/${tenant}/admin/complaints`,         icon: MessageCircleWarning },
        { name: "Documents",      href: `/${tenant}/admin/documents`,          icon: Files },
        { name: "Communication",  href: `/${tenant}/admin/communication`,      icon: MessageSquare },
        { name: "WA Templates",   href: `/${tenant}/admin/message-templates`,  icon: MessageSquare },
      ],
    },
    // ── 7. Services ───────────────────────────────────────────────
    {
      group: "Services",
      color: "text-fuchsia-400",
      items: [
        { name: "Library",        href: `/${tenant}/admin/library`,       icon: Library },
        { name: "Library Cards",  href: `/${tenant}/admin/library-cards`, icon: LibCard },
        { name: "Transport",      href: `/${tenant}/admin/transport`,     icon: Bus },
        { name: "Bus Pass",       href: `/${tenant}/admin/bus-pass`,      icon: Bus },
        { name: "GPS Tracking",   href: `/${tenant}/admin/gps-tracking`,  icon: Navigation },
        { name: "Hostel",         href: `/${tenant}/admin/hostel`,        icon: BedDouble },
        { name: "Inventory",      href: `/${tenant}/admin/inventory`,     icon: Package },
        { name: "Face AI",        href: `/${tenant}/admin/face-ai`,       icon: Fingerprint },
      ],
    },
    // ── 8. Community ──────────────────────────────────────────────
    {
      group: "Community",
      color: "text-orange-400",
      items: [
        { name: "Bulk Messages",  href: `/${tenant}/admin/bulk-messages`, icon: Send },
        { name: "Parent Log",     href: `/${tenant}/admin/parent-log`,    icon: MessageSquare },
        { name: "Alumni",         href: `/${tenant}/admin/alumni`,        icon: AlumniIcon },
        { name: "Scholarships",   href: `/${tenant}/admin/scholarships`,  icon: HeartHandshake },
      ],
    },
  ];
}

const activeGroupBg: Record<string, string> = {
  "text-violet-400":  "from-violet-500/20 border-violet-400",
  "text-pink-400":    "from-pink-500/20 border-pink-400",
  "text-amber-400":   "from-amber-500/20 border-amber-400",
  "text-amber-500":   "from-amber-500/20 border-amber-400",
  "text-purple-400":  "from-purple-500/20 border-purple-400",
  "text-fuchsia-400": "from-fuchsia-500/20 border-fuchsia-400",
  "text-orange-400":  "from-orange-500/20 border-orange-400",
  "text-indigo-500":  "from-indigo-500/15 border-indigo-400",
  "text-sky-500":     "from-sky-500/15 border-sky-400",
  "text-emerald-500": "from-emerald-500/15 border-emerald-400",
  "text-blue-500":    "from-blue-500/15 border-blue-400",
  "text-violet-500":  "from-violet-500/15 border-violet-400",
  "text-purple-500":  "from-purple-500/15 border-purple-400",
  "text-rose-500":    "from-rose-500/15 border-rose-400",
};
const activeGroupIcon: Record<string, string> = {
  "text-violet-400":  "text-violet-300 drop-shadow-[0_0_6px_rgba(167,139,250,0.6)]",
  "text-pink-400":    "text-pink-300 drop-shadow-[0_0_6px_rgba(249,168,212,0.6)]",
  "text-amber-400":   "text-amber-300 drop-shadow-[0_0_6px_rgba(252,211,77,0.6)]",
  "text-amber-500":   "text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]",
  "text-purple-400":  "text-purple-300 drop-shadow-[0_0_6px_rgba(216,180,254,0.6)]",
  "text-fuchsia-400": "text-fuchsia-300 drop-shadow-[0_0_6px_rgba(240,171,252,0.6)]",
  "text-orange-400":  "text-orange-300 drop-shadow-[0_0_6px_rgba(253,186,116,0.6)]",
  "text-indigo-500":  "text-indigo-400 drop-shadow-[0_0_6px_rgba(99,102,241,0.5)]",
  "text-sky-500":     "text-sky-400 drop-shadow-[0_0_6px_rgba(56,189,248,0.5)]",
  "text-emerald-500": "text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]",
  "text-blue-500":    "text-blue-400 drop-shadow-[0_0_6px_rgba(96,165,250,0.5)]",
  "text-violet-500":  "text-violet-400 drop-shadow-[0_0_6px_rgba(167,139,250,0.5)]",
  "text-purple-500":  "text-purple-400 drop-shadow-[0_0_6px_rgba(167,139,250,0.5)]",
  "text-rose-500":    "text-rose-400 drop-shadow-[0_0_6px_rgba(251,113,133,0.5)]",
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
  let portalColor = "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30";
  if (isTeacherPortal) { portalLabel = "Teacher"; portalColor = "bg-violet-500/20 text-violet-300 border-violet-500/30"; }
  if (isStudentPortal) { portalLabel = "Student";  portalColor = "bg-amber-500/20 text-amber-300 border-amber-500/30"; }
  if (isParentPortal)  { portalLabel = "Parent";   portalColor = "bg-orange-500/20 text-orange-300 border-orange-500/30"; }

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
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-fuchsia-600 to-purple-700 flex items-center justify-center shadow-lg">
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
                          const activeBg = activeGroupBg[grp.color] || "from-fuchsia-500/20 border-fuchsia-400";
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
                      className="absolute inset-0 bg-gradient-to-r from-fuchsia-500/20 to-transparent border-l-2 border-fuchsia-400 rounded-lg"
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
          type="button"
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
