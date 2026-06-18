// @ts-nocheck
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Building2, CreditCard, Activity, LogOut, CheckCircle2,
  XCircle, Clock, RefreshCw, Layers, ShieldCheck, Mail, Globe,
  Search, Ban, Power, Eye, Users, TrendingUp, AlertTriangle,
  PlusCircle, X, IndianRupee, Receipt, CalendarClock, BadgeAlert, KeyRound
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────
type School = {
  id: string; name: string; subdomain: string;
  admin_email?: string; admin_name?: string;
  subscription_status?: string; student_quota?: number;
  is_active?: boolean; suspended_at?: string;
  suspension_reason?: string; created_at: string;
};

type Request = {
  id: string; school_name: string; subdomain: string;
  admin_name: string; admin_email: string; status: string; created_at: string;
};

type SuperAdmin = {
  id: string; email: string; full_name: string; created_at: string;
};

type Log = {
  id: string; action: string; target_type: string;
  target_name?: string; metadata?: any; created_at: string;
};

type PlatformPayment = {
  id: string; school_name: string; school_subdomain: string;
  admin_email?: string; razorpay_order_id?: string;
  razorpay_payment_id?: string; amount: number; plan_name?: string;
  payment_type: string; status: string; billing_month?: number;
  billing_year?: number; next_renewal_date?: string;
  failure_reason?: string; created_at: string;
};

type MonthlyRevenue = {
  billing_year: number; billing_month: number;
  total_payments: number; total_revenue: number;
  successful_payments: number; failed_payments: number;
  collected_revenue: number;
};

type Plan = { id: string; name: string; slug: string; price_monthly: number; student_quota: number; features: string[] };
type Alert = { id: string; type: string; title: string; message: string; school_name?: string; is_read: boolean; created_at: string };

// ─── Component ────────────────────────────────────────────────────────────────
export function SuperAdminDashboard() {
  const navigate = useNavigate();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<"overview" | "schools" | "requests" | "provision" | "admins" | "logs" | "payments" | "plans" | "support" | "broadcast" | "tools">("overview");
  const [requests, setRequests] = useState<Request[]>([]);
  const [schoolsList, setSchoolsList] = useState<School[]>([]);
  const [superAdmins, setSuperAdmins] = useState<SuperAdmin[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [payments, setPayments] = useState<PlatformPayment[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue[]>([]);
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<"all" | "captured" | "pending" | "failed">("all");
  const [selectedPaymentSchool, setSelectedPaymentSchool] = useState<string>("all");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [realMrr, setRealMrr] = useState(0);
  const [schoolsPage, setSchoolsPage] = useState(1);
  const [requestsPage, setRequestsPage] = useState(1);
  const PAGE_SIZE = 10;
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Search & Filter
  const [schoolSearch, setSchoolSearch] = useState("");
  const [schoolFilter, setSchoolFilter] = useState<"all" | "active" | "suspended" | "trial">("all");
  const [requestFilter, setRequestFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  // Modals
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [suspendModal, setSuspendModal] = useState<{ school: School } | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  // New super admin form
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [addingAdmin, setAddingAdmin] = useState(false);

  // ── Feature: Quota Override ────────────────────────────────────────────────
  const [quotaEditId, setQuotaEditId]     = useState<string | null>(null);
  const [quotaEditVal, setQuotaEditVal]   = useState<string>("");
  const [quotaReason, setQuotaReason]     = useState("");

  // ── Feature: School Notes / CRM ───────────────────────────────────────────
  const [notesSchool, setNotesSchool]     = useState<School | null>(null);
  const [schoolNotes, setSchoolNotes]     = useState<any[]>([]);
  const [newNote, setNewNote]             = useState("");
  const [noteType, setNoteType]           = useState("general");
  const [savingNote, setSavingNote]       = useState(false);

  // ── Feature: Bulk Email ───────────────────────────────────────────────────
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false);
  const [bulkSubject, setBulkSubject]     = useState("");
  const [bulkBody, setBulkBody]           = useState("");
  const [bulkFilter, setBulkFilter]       = useState<"all" | "active" | "trialing" | "suspended">("all");
  const [sendingBulk, setSendingBulk]     = useState(false);

  // ── Feature: Impersonation ────────────────────────────────────────────────
  const [impersonating, setImpersonating] = useState<string | null>(null);

  // ── Support Tickets ────────────────────────────────────────────────────────
  const [tickets, setTickets]               = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [ticketReplies, setTicketReplies]   = useState<any[]>([]);
  const [replyText, setReplyText]           = useState("");
  const [replyInternal, setReplyInternal]   = useState(false);
  const [sendingReply, setSendingReply]     = useState(false);

  // ── Announcements ─────────────────────────────────────────────────────────
  const [announcements, setAnnouncements]   = useState<any[]>([]);
  const [annForm, setAnnForm]               = useState({ title: "", message: "", type: "info" as const, target: "all" as const, ends_at: "" });
  const [savingAnn, setSavingAnn]           = useState(false);

  // ── Onboarding Progress ───────────────────────────────────────────────────
  const [onboardingData, setOnboardingData] = useState<any[]>([]);

  // ── White-label ───────────────────────────────────────────────────────────
  const [brandingSchool, setBrandingSchool] = useState<any | null>(null);
  const [brandingForm, setBrandingForm]     = useState<any>({});
  const [savingBranding, setSavingBranding] = useState(false);

  // ── API Keys ──────────────────────────────────────────────────────────────
  const [apiKeysSchool, setApiKeysSchool]   = useState<any | null>(null);
  const [apiKeys, setApiKeys]               = useState<any[]>([]);
  const [newKeyName, setNewKeyName]         = useState("");
  const [newKeyScopes, setNewKeyScopes]     = useState<string[]>(["read"]);
  const [generatedKey, setGeneratedKey]     = useState<string | null>(null);

  // ── Archive ───────────────────────────────────────────────────────────────
  const [archiveModal, setArchiveModal]     = useState<any | null>(null);
  const [archiveReason, setArchiveReason]   = useState("");

  // ── GDPR Export ───────────────────────────────────────────────────────────
  const [exportingId, setExportingId]       = useState<string | null>(null);

  useEffect(() => { fetchAll(); }, []);

  // ─── Data Fetching ───────────────────────────────────────────────────────────
  async function fetchAll() {
    setLoading(true);
    try {
      const [reqRes, schRes, logRes, payRes, mrevRes, planRes, alertRes, mrrRes, ticketRes, annRes, onboardRes] = await Promise.all([
        supabase.from("registration_requests").select("*").order("created_at", { ascending: false }),
        supabase.from("schools_with_stats").select("*").order("created_at", { ascending: false }),
        supabase.from("super_admin_logs").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("platform_payments").select("*").order("created_at", { ascending: false }),
        supabase.from("monthly_revenue").select("*").limit(12),
        supabase.from("subscription_plans").select("*").order("sort_order"),
        supabase.from("super_admin_alerts").select("*").order("created_at", { ascending: false }).limit(20),
        supabase.from("current_mrr").select("*").single(),
        supabase.from("support_tickets").select("*").order("created_at", { ascending: false }),
        supabase.from("platform_announcements").select("*").order("created_at", { ascending: false }),
        supabase.from("school_onboarding_progress").select("*").order("created_at", { ascending: false }),
      ]);
      if (reqRes.error) throw reqRes.error;
      if (schRes.error) throw schRes.error;
      setRequests(reqRes.data || []);
      setSchoolsList(schRes.data || []);
      setLogs(logRes.data || []);
      setPayments(payRes.data || []);
      setMonthlyRevenue(mrevRes.data || []);
      setPlans(planRes.data || []);
      setAlerts(alertRes.data || []);
      setRealMrr(Number(mrrRes.data?.mrr || 0));
      setTickets(ticketRes.data || []);
      setAnnouncements(annRes.data || []);
      setOnboardingData(onboardRes.data || []);

      // Fetch super admins
      const { data: roles } = await supabase
        .from("user_roles").select("user_id").eq("role", "super_admin");
      if (roles && roles.length > 0) {
        const ids = roles.map(r => r.user_id);
        const { data: admins } = await supabase.from("users").select("*").in("id", ids);
        setSuperAdmins(admins || []);
      }
    } catch (err: any) {
      toast.error("Failed to load data: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // ─── Log Action ─────────────────────────────────────────────────────────────
  async function logAction(action: string, target_type: string, target_id: string, target_name: string, metadata?: any) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: u } = await supabase.from("users").select("id").eq("email", user.email).maybeSingle();
    await supabase.from("super_admin_logs").insert({
      performed_by: u?.id,
      action, target_type, target_id, target_name, metadata: metadata || {}
    });
  }

  // ─── Send Email ─────────────────────────────────────────────────────────────
  async function sendEmail(to_email: string, admin_name: string, school_name: string, subdomain: string, action: string, invite_token?: string) {
    try {
      await supabase.functions.invoke("send-approval-email", {
        body: { to_email, admin_name, school_name, subdomain, action, invite_token }
      });
    } catch (e) {
      console.warn("Email send failed (non-critical):", e);
    }
  }

  // ─── Approve / Reject Registration ──────────────────────────────────────────
  async function handleUpdateStatus(id: string, status: "approved" | "rejected") {
    setActionLoadingId(id);
    const req = requests.find(r => r.id === id);
    const toastId = toast.loading(status === "approved" ? "Approving & Provisioning School..." : "Rejecting...");
    try {
      const { error } = await supabase.from("registration_requests").update({ status }).eq("id", id);
      if (error) throw error;
      toast.success(status === "approved" ? "School Approved & Provisioned!" : "Request Rejected", { id: toastId });
      if (req) {
        let inviteToken: string | undefined;
        if (status === "approved") {
          // Fetch newly generated invite token for the school
          const { data: schoolData } = await supabase
            .from("schools")
            .select("invite_token")
            .eq("subdomain", req.subdomain)
            .maybeSingle();
          inviteToken = schoolData?.invite_token;
        }
        await sendEmail(req.admin_email, req.admin_name, req.school_name, req.subdomain, status, inviteToken);
        await logAction(status === "approved" ? "SCHOOL_APPROVED" : "SCHOOL_REJECTED", "registration_request", id, req.school_name);
      }
      fetchAll();
    } catch (err: any) {
      toast.error("Failed: " + err.message, { id: toastId });
    } finally {
      setActionLoadingId(null);
    }
  }

  // ─── Suspend / Activate School ──────────────────────────────────────────────
  async function handleToggleSchool(school: School, suspend: boolean) {
    const toastId = toast.loading(suspend ? "Suspending school..." : "Activating school...");
    try {
      const updates: any = { is_active: !suspend };
      if (suspend) {
        updates.suspended_at = new Date().toISOString();
        updates.suspension_reason = suspendReason || "Suspended by admin";
      } else {
        updates.suspended_at = null;
        updates.suspension_reason = null;
      }
      const { error } = await supabase.from("schools").update(updates).eq("id", school.id);
      if (error) throw error;
      toast.success(suspend ? "School suspended." : "School activated!", { id: toastId });
      if (suspend && school.admin_email) {
        await sendEmail(school.admin_email, school.admin_name || "Admin", school.name, school.subdomain, "suspended");
      }
      await logAction(suspend ? "SCHOOL_SUSPENDED" : "SCHOOL_ACTIVATED", "school", school.id, school.name, { reason: suspendReason });
      setSuspendModal(null);
      setSuspendReason("");
      setSelectedSchool(null);
      fetchAll();
    } catch (err: any) {
      toast.error("Failed: " + err.message, { id: toastId });
    }
  }

  // ─── Password Reset for School Admin ────────────────────────────────────────
  async function handlePasswordReset(school: School) {
    if (!school.admin_email) {
      toast.error("No admin email found for this school.");
      return;
    }
    const toastId = toast.loading("Sending password reset email...");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(school.admin_email, {
        redirectTo: `${window.location.origin}/${school.subdomain}/reset-password`,
      });
      if (error) throw error;

      await supabase.from("password_reset_logs").insert({
        school_id:    school.id,
        admin_email:  school.admin_email,
        triggered_by: (await supabase.auth.getUser()).data.user?.id,
        notes:        "Triggered by super admin from dashboard",
      });

      await logAction("PASSWORD_RESET_SENT", "school", school.id, school.name, { admin_email: school.admin_email });
      toast.success(`Password reset email sent to ${school.admin_email}`, { id: toastId });
    } catch (err: any) {
      toast.error("Failed: " + err.message, { id: toastId });
    }
  }

  // ─── Impersonate School Admin ────────────────────────────────────────────────
  async function handleImpersonate(school: School) {
    if (!school.admin_email) { toast.error("No admin email for this school."); return; }
    setImpersonating(school.id);
    const toastId = toast.loading(`Generating login link for ${school.name}...`);
    try {
      const { data, error } = await supabase.functions.invoke("impersonate-school", {
        body: { admin_email: school.admin_email, school_id: school.id, school_name: school.name, subdomain: school.subdomain },
      });
      if (error) throw error;
      if (!data?.link) throw new Error("No link returned from server");
      toast.success("Login link generated! Opening in new tab...", { id: toastId });
      window.open(data.link, "_blank");
    } catch (err: any) {
      toast.error("Impersonation failed: " + err.message, { id: toastId });
    } finally {
      setImpersonating(null);
    }
  }

  // ─── Quota Override ──────────────────────────────────────────────────────────
  async function handleQuotaUpdate(school: School) {
    const newQuota = parseInt(quotaEditVal);
    if (isNaN(newQuota) || newQuota < 1) { toast.error("Enter a valid quota number."); return; }
    const toastId = toast.loading("Updating quota...");
    try {
      const { error } = await supabase.from("schools").update({
        student_quota:        newQuota,
        quota_override_reason: quotaReason || `Manually overridden to ${newQuota}`,
      }).eq("id", school.id);
      if (error) throw error;
      await logAction("QUOTA_OVERRIDDEN", "school", school.id, school.name, { old_quota: school.student_quota, new_quota: newQuota, reason: quotaReason });
      toast.success(`Quota updated to ${newQuota} students.`, { id: toastId });
      setQuotaEditId(null); setQuotaEditVal(""); setQuotaReason("");
      fetchAll();
    } catch (err: any) {
      toast.error("Failed: " + err.message, { id: toastId });
    }
  }

  // ─── School Notes ────────────────────────────────────────────────────────────
  async function openNotes(school: School) {
    setNotesSchool(school);
    const { data } = await supabase
      .from("school_notes")
      .select("*")
      .eq("school_id", school.id)
      .order("created_at", { ascending: false });
    setSchoolNotes(data || []);
  }

  async function handleAddNote() {
    if (!newNote.trim() || !notesSchool) return;
    setSavingNote(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: u } = await supabase.from("users").select("full_name").eq("id", user?.id).maybeSingle();
      const { error } = await supabase.from("school_notes").insert({
        school_id:       notesSchool.id,
        note:            newNote.trim(),
        note_type:       noteType,
        created_by:      user?.id,
        created_by_name: u?.full_name || user?.email || "Super Admin",
      });
      if (error) throw error;
      toast.success("Note added.");
      setNewNote("");
      await openNotes(notesSchool);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingNote(false);
    }
  }

  async function handleDeleteNote(noteId: string) {
    await supabase.from("school_notes").delete().eq("id", noteId);
    if (notesSchool) await openNotes(notesSchool);
  }

  // ─── Bulk Email ──────────────────────────────────────────────────────────────
  async function handleBulkEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!bulkSubject.trim() || !bulkBody.trim()) { toast.error("Subject and body required."); return; }
    setSendingBulk(true);
    const toastId = toast.loading("Sending bulk email...");
    try {
      const { data, error } = await supabase.functions.invoke("bulk-email", {
        body: { subject: bulkSubject, body: bulkBody, filter: bulkFilter },
      });
      if (error) throw error;
      toast.success(`Email sent to ${data.sent}/${data.total} schools!`, { id: toastId, duration: 5000 });
      setBulkEmailOpen(false); setBulkSubject(""); setBulkBody(""); setBulkFilter("all");
    } catch (err: any) {
      toast.error("Failed: " + err.message, { id: toastId });
    } finally {
      setSendingBulk(false);
    }
  }

  // ─── Support Tickets ────────────────────────────────────────────────────────
  async function openTicket(ticket: any) {
    setSelectedTicket(ticket);
    const { data } = await supabase.from("ticket_replies").select("*").eq("ticket_id", ticket.id).order("created_at");
    setTicketReplies(data || []);
    // Mark in-progress if open
    if (ticket.status === "open") {
      await supabase.from("support_tickets").update({ status: "in_progress", updated_at: new Date().toISOString() }).eq("id", ticket.id);
      setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, status: "in_progress" } : t));
    }
  }

  async function handleSendReply() {
    if (!replyText.trim() || !selectedTicket) return;
    setSendingReply(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: u } = await supabase.from("users").select("full_name").eq("id", user?.id).maybeSingle();
      await supabase.from("ticket_replies").insert({
        ticket_id:   selectedTicket.id,
        author_id:   user?.id,
        author_name: u?.full_name || user?.email,
        author_role: "super_admin",
        message:     replyText.trim(),
        is_internal: replyInternal,
      });
      await supabase.from("support_tickets").update({ updated_at: new Date().toISOString() }).eq("id", selectedTicket.id);
      setReplyText("");
      await openTicket(selectedTicket);
      toast.success("Reply sent.");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSendingReply(false);
    }
  }

  async function handleResolveTicket(ticket: any) {
    await supabase.from("support_tickets").update({ status: "resolved", resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", ticket.id);
    setSelectedTicket(null);
    toast.success("Ticket resolved.");
    fetchAll();
  }

  // ─── Announcements ───────────────────────────────────────────────────────────
  async function handleCreateAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    setSavingAnn(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("platform_announcements").insert({
        title:    annForm.title,
        message:  annForm.message,
        type:     annForm.type,
        target:   annForm.target,
        ends_at:  annForm.ends_at || null,
        created_by: user?.id,
      });
      if (error) throw error;
      toast.success("Announcement created! Schools will see it on next load.");
      setAnnForm({ title: "", message: "", type: "info", target: "all", ends_at: "" });
      fetchAll();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingAnn(false);
    }
  }

  async function handleDeleteAnnouncement(id: string) {
    await supabase.from("platform_announcements").delete().eq("id", id);
    toast.success("Announcement removed.");
    fetchAll();
  }

  async function handleToggleAnnouncement(id: string, current: boolean) {
    await supabase.from("platform_announcements").update({ is_active: !current }).eq("id", id);
    fetchAll();
  }

  // ─── Archive School ──────────────────────────────────────────────────────────
  async function handleArchiveSchool(school: any) {
    const toastId = toast.loading("Archiving school...");
    try {
      await supabase.from("schools").update({
        is_archived:    true,
        archived_at:    new Date().toISOString(),
        archive_reason: archiveReason || "Archived by super admin",
        is_active:      false,
        suspended_at:   new Date().toISOString(),
      }).eq("id", school.id);
      await logAction("SCHOOL_ARCHIVED", "school", school.id, school.name, { reason: archiveReason });
      toast.success("School archived safely.", { id: toastId });
      setArchiveModal(null); setArchiveReason("");
      fetchAll();
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    }
  }

  // ─── GDPR Export ────────────────────────────────────────────────────────────
  async function handleGdprExport(school: any) {
    setExportingId(school.id);
    const toastId = toast.loading(`Exporting data for ${school.name}...`);
    try {
      const { data, error } = await supabase.functions.invoke("gdpr-export", {
        body: { school_id: school.id },
      });
      if (error) throw error;
      const blob     = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url      = URL.createObjectURL(blob);
      const link     = document.createElement("a");
      link.href      = url;
      link.download  = `school_export_${school.subdomain}_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Export downloaded!", { id: toastId });
    } catch (err: any) {
      toast.error("Export failed: " + err.message, { id: toastId });
    } finally {
      setExportingId(null);
    }
  }

  // ─── White-label Branding ────────────────────────────────────────────────────
  async function openBranding(school: any) {
    setBrandingSchool(school);
    const { data } = await supabase.from("school_branding").select("*").eq("school_id", school.id).maybeSingle();
    setBrandingForm(data || { school_id: school.id, platform_name: "EduNextGen", primary_color: "#10b981", secondary_color: "#0f172a", accent_color: "#3b82f6" });
  }

  async function handleSaveBranding(e: React.FormEvent) {
    e.preventDefault();
    setSavingBranding(true);
    try {
      const { error } = await supabase.from("school_branding").upsert({ ...brandingForm, school_id: brandingSchool.id, updated_at: new Date().toISOString() }, { onConflict: "school_id" });
      if (error) throw error;
      toast.success("Branding saved.");
      setBrandingSchool(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingBranding(false);
    }
  }

  // ─── API Keys ────────────────────────────────────────────────────────────────
  async function openApiKeys(school: any) {
    setApiKeysSchool(school);
    const { data } = await supabase.from("school_api_keys").select("*").eq("school_id", school.id).order("created_at", { ascending: false });
    setApiKeys(data || []);
    setGeneratedKey(null);
  }

  async function handleGenerateApiKey() {
    if (!newKeyName.trim() || !apiKeysSchool) { toast.error("Key name required."); return; }
    const rawKey    = `enk_live_${crypto.randomUUID().replace(/-/g, "")}`;
    const keyPreview = rawKey.slice(0, 16) + "..." + rawKey.slice(-4);
    const encoder   = new TextEncoder();
    const data      = encoder.encode(rawKey);
    const hashBuf   = await crypto.subtle.digest("SHA-256", data);
    const hashArr   = Array.from(new Uint8Array(hashBuf));
    const keyHash   = hashArr.map(b => b.toString(16).padStart(2, "0")).join("");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("school_api_keys").insert({
      school_id:   apiKeysSchool.id,
      name:        newKeyName.trim(),
      key_prefix:  "enk_live_",
      key_hash:    keyHash,
      key_preview: keyPreview,
      scopes:      newKeyScopes,
      created_by:  user?.id,
    });
    if (error) { toast.error(error.message); return; }
    setGeneratedKey(rawKey);
    setNewKeyName(""); setNewKeyScopes(["read"]);
    await openApiKeys(apiKeysSchool);
    toast.success("API Key generated! Copy it now — it won't be shown again.");
  }

  async function handleRevokeApiKey(keyId: string) {
    await supabase.from("school_api_keys").update({ is_active: false, revoked_at: new Date().toISOString() }).eq("id", keyId);
    if (apiKeysSchool) await openApiKeys(apiKeysSchool);
    toast.success("API key revoked.");
  }

  // ─── Add Super Admin ─────────────────────────────────────────────────────────
  async function handleAddSuperAdmin(e: React.FormEvent) {
    e.preventDefault();
    setAddingAdmin(true);
    const toastId = toast.loading("Creating super admin...");
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({ email: newAdminEmail, password: newAdminPassword });
      if (signUpError) throw signUpError;
      if (!data.user) throw new Error("No user returned");

      const { data: pUser } = await supabase.from("users").insert({
        id: data.user.id, email: newAdminEmail, full_name: newAdminName
      }).select("id").single();

      const userId = pUser?.id || data.user.id;
      const { error: roleErr } = await supabase.from("user_roles").insert({ user_id: userId, role: "super_admin" });
      if (roleErr) throw roleErr;

      toast.success("Super Admin created! They need to confirm their email.", { id: toastId });
      await logAction("SUPER_ADMIN_CREATED", "super_admin", userId, newAdminName);
      setNewAdminEmail(""); setNewAdminName(""); setNewAdminPassword("");
      fetchAll();
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setAddingAdmin(false);
    }
  }

  // ─── Logout ─────────────────────────────────────────────────────────────────
  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success("Logged out");
    navigate("/super-admin/login");
  }

  // ─── Derived Data ────────────────────────────────────────────────────────────
  const pendingRequests = requests.filter(r => r.status === "pending");
  const activeSchools   = schoolsList.filter(s => s.is_active !== false);
  const suspendedSchools = schoolsList.filter(s => s.is_active === false);
  const unreadAlerts    = alerts.filter(a => !a.is_read);

  // Export CSV helper
  function exportCSV(data: any[], filename: string) {
    if (!data.length) return;
    const keys = Object.keys(data[0]);
    const rows = [keys.join(","), ...data.map(row => keys.map(k => `"${String(row[k] ?? "").replace(/"/g, '""')}"`).join(","))];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  // Pagination helpers
  function paginate<T>(arr: T[], page: number): T[] {
    return arr.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }
  function totalPages(arr: any[]) { return Math.max(1, Math.ceil(arr.length / PAGE_SIZE)); }

  const filteredSchools = schoolsList
    .filter(s => {
      if (schoolFilter === "active") return s.is_active !== false;
      if (schoolFilter === "suspended") return s.is_active === false;
      if (schoolFilter === "trial") return !s.subscription_status || s.subscription_status === "trialing";
      return true;
    })
    .filter(s =>
      !schoolSearch ||
      s.name.toLowerCase().includes(schoolSearch.toLowerCase()) ||
      s.subdomain.toLowerCase().includes(schoolSearch.toLowerCase()) ||
      s.admin_email?.toLowerCase().includes(schoolSearch.toLowerCase())
    );

  const filteredRequests = requests.filter(r => requestFilter === "all" ? true : r.status === requestFilter);

  const statusColor = (status?: string) => {
    if (status === "active") return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    if (status === "past_due") return "text-red-400 bg-red-500/10 border-red-500/20";
    if (status === "canceled") return "text-slate-400 bg-slate-500/10 border-slate-500/20";
    return "text-amber-400 bg-amber-500/10 border-amber-500/20";
  };

  // ─── Sidebar tabs ────────────────────────────────────────────────────────────
  const tabs = [
    { key: "overview", label: "Platform Overview", icon: Layers },
    { key: "schools", label: "Manage Schools", icon: Building2, badge: schoolsList.length },
    { key: "requests", label: "Onboarding Requests", icon: ShieldCheck, badge: pendingRequests.length, badgePulse: true },
    { key: "provision", label: "Provision School", icon: PlusCircle },
    { key: "payments", label: "Payments & Revenue", icon: IndianRupee },
    { key: "plans", label: "Subscription Plans", icon: CreditCard },
    { key: "admins", label: "Super Admins", icon: Users, badge: superAdmins.length },
    { key: "logs", label: "Activity Logs", icon: Activity },
    { key: "support", label: "Support Tickets", icon: BadgeAlert, badge: tickets.filter(t => t.status === "open").length, badgePulse: tickets.some(t => t.status === "open") },
    { key: "broadcast", label: "Announcements", icon: Mail },
    { key: "tools", label: "Tools & Settings", icon: ShieldCheck },
  ] as const;

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">

      {/* ── Sidebar ── */}
      <div className="w-64 border-r border-border bg-card text-muted-foreground flex-shrink-0 min-h-screen flex flex-col relative overflow-hidden">
        <div className="absolute top-0 -left-1/2 w-full h-96 bg-emerald-500/5 blur-[100px] pointer-events-none" />

        <div className="p-6 border-b border-border z-10">
          <h2 className="text-xl font-bold tracking-tight uppercase flex items-center gap-2">
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">EDUNEXTGEN</span>
            <span className="text-xs font-medium text-slate-500 lowercase">saas</span>
          </h2>
          <div className="flex items-center mt-2">
            <p className="text-[10px] text-slate-400 font-mono tracking-widest">GLOBAL SYSTEM</p>
            <span className="ml-auto px-2 py-0.5 rounded-full text-[8px] uppercase font-bold tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
              Super Admin
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1 z-10">
          {tabs.map(({ key, label, icon: Icon, badge, badgePulse }) => (
            <button
              type="button"
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium ${
                activeTab === key ? "text-foreground bg-muted border-l-2 border-emerald-400" : "hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <Icon className="w-[18px] h-[18px] text-emerald-400 flex-shrink-0" />
              <div className="flex justify-between w-full items-center">
                <span>{label}</span>
                {badge !== undefined && badge > 0 && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${badgePulse ? "bg-emerald-500/20 text-emerald-400 animate-pulse" : "bg-slate-800 text-slate-400"}`}>
                    {badge}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-border mt-auto z-10">
          <button type="button" onClick={handleLogout} className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 transition-all text-sm font-medium">
            <LogOut className="w-[18px] h-[18px]" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

        {/* Header */}
        <header className="h-16 border-b border-border bg-card/30 backdrop-blur-md flex items-center justify-between px-8 z-10">
          <h1 className="text-lg font-bold tracking-wide">EDUNEXTGEN SAAS CONTROL PANEL</h1>
          <Button size="sm" variant="outline" onClick={fetchAll} disabled={loading} className="border-border hover:bg-muted">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </header>

        <main className="flex-1 overflow-y-auto p-8 z-10">
          <AnimatePresence mode="wait">

            {/* ═══════════════════════════════════════════════════════════
                TAB 1 — OVERVIEW
            ═══════════════════════════════════════════════════════════ */}
            {activeTab === "overview" && (
              <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">System Overview</h2>
                  <p className="text-muted-foreground mt-1">Real-time statistics of EduNextGen SaaS platform.</p>
                </div>

                {/* Alerts banner */}
                {unreadAlerts.length > 0 && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-red-400 text-sm">{unreadAlerts.length} Unread Alert{unreadAlerts.length > 1 ? "s" : ""}</p>
                      {unreadAlerts.slice(0, 3).map(a => (
                        <p key={a.id} className="text-xs text-slate-400 mt-0.5">• {a.title}</p>
                      ))}
                    </div>
                    <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs"
                      onClick={async () => {
                        await supabase.from("super_admin_alerts").update({ is_read: true }).eq("is_read", false);
                        fetchAll();
                      }}>
                      Mark all read
                    </Button>
                  </div>
                )}

                {/* Stats */}
                <div className="grid gap-6 md:grid-cols-4">
                  {[
                    { title: "Active Schools", value: activeSchools.length, icon: Building2, color: "text-emerald-400", sub: `${suspendedSchools.length} suspended` },
                    { title: "Real MRR (This Month)", value: `₹${realMrr.toLocaleString("en-IN")}`, icon: CreditCard, color: "text-emerald-400", sub: "From actual payments" },
                    { title: "Pending Approvals", value: pendingRequests.length, icon: Clock, color: "text-amber-400", sub: "Awaiting review" },
                    { title: "Total Requests", value: requests.length, icon: TrendingUp, color: "text-blue-400", sub: `${requests.filter(r => r.status === "approved").length} approved` },
                  ].map(({ title, value, icon: Icon, color, sub }) => (
                    <Card key={title} className="bg-card border-border shadow-xl">
                      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">{title}</CardTitle>
                        <Icon className={`w-5 h-5 ${color}`} />
                      </CardHeader>
                      <CardContent>
                        <div className={`text-3xl font-bold ${color}`}>{value}</div>
                        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Subscription Breakdown */}
                <div className="grid gap-6 md:grid-cols-2">
                  <Card className="bg-card border-border shadow-xl">
                    <CardHeader>
                      <CardTitle className="text-lg">Subscription Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {[
                        { label: "Active (Paid)", count: schoolsList.filter(s => s.subscription_status === "active").length, color: "bg-emerald-500" },
                        { label: "Trial", count: schoolsList.filter(s => !s.subscription_status || s.subscription_status === "trialing").length, color: "bg-amber-500" },
                        { label: "Past Due", count: schoolsList.filter(s => s.subscription_status === "past_due").length, color: "bg-red-500" },
                        { label: "Canceled", count: schoolsList.filter(s => s.subscription_status === "canceled").length, color: "bg-slate-500" },
                      ].map(({ label, count, color }) => (
                        <div key={label} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
                            <span className="text-sm">{label}</span>
                          </div>
                          <span className="font-bold text-sm">{count}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Quick pending actions */}
                  <Card className="bg-card border-border shadow-xl">
                    <CardHeader>
                      <CardTitle className="text-lg">Pending Approvals</CardTitle>
                      <CardDescription>Approve or reject school registrations</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {pendingRequests.length === 0 ? (
                        <div className="text-center p-6 border border-dashed border-border rounded-xl">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
                          <p className="text-slate-400 text-sm">All clear! No pending requests.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {pendingRequests.slice(0, 4).map(r => (
                            <div key={r.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                              <div>
                                <p className="font-medium text-sm text-white">{r.school_name}</p>
                                <p className="text-xs text-slate-400">{r.admin_email}</p>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" disabled={actionLoadingId === r.id}
                                  onClick={() => handleUpdateStatus(r.id, "rejected")}
                                  className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-7 w-7 p-0">
                                  <XCircle className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="sm" disabled={actionLoadingId === r.id}
                                  onClick={() => handleUpdateStatus(r.id, "approved")}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-7 text-xs px-2">
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> OK
                                </Button>
                              </div>
                            </div>
                          ))}
                          {pendingRequests.length > 4 && (
                            <button type="button" onClick={() => setActiveTab("requests")} className="text-xs text-emerald-400 hover:underline w-full text-center">
                              +{pendingRequests.length - 4} more → View all
                            </button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* ── Revenue Forecast + Churn Risk ── */}
                <div className="grid gap-6 md:grid-cols-2">
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-400" /> Revenue Forecast
                      </CardTitle>
                      <CardDescription>Next 30-day expected MRR based on active subscriptions</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {(() => {
                        const essentialCount  = schoolsList.filter(s => s.subscription_status === "essential").length;
                        const premiumCount    = schoolsList.filter(s => s.subscription_status === "premium").length;
                        const trialingCount   = schoolsList.filter(s => s.subscription_status === "trialing" && s.is_active).length;
                        const forecastMrr     = (essentialCount * 999) + (premiumCount * 4999);
                        const conversionForecast = Math.round(trialingCount * 0.3 * 999);
                        return (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-slate-400">Recurring (guaranteed)</span>
                              <span className="font-bold text-emerald-400">₹{forecastMrr.toLocaleString("en-IN")}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-slate-400">Trial conversions (~30%)</span>
                              <span className="font-medium text-blue-400">+₹{conversionForecast.toLocaleString("en-IN")}</span>
                            </div>
                            <div className="border-t border-border pt-2 flex justify-between items-center">
                              <span className="text-sm font-semibold">Total Forecast</span>
                              <span className="text-xl font-bold text-white">₹{(forecastMrr + conversionForecast).toLocaleString("en-IN")}</span>
                            </div>
                            <div className="text-xs text-slate-500 pt-1">
                              {essentialCount} Essential + {premiumCount} Premium + {trialingCount} trials converting
                            </div>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400" /> Churn Risk
                      </CardTitle>
                      <CardDescription>Schools at risk based on payment & activity signals</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const churnSchools = schoolsList.map(s => {
                          let score = 0;
                          if ((s as any).payment_failure_count >= 2) score += 40;
                          else if ((s as any).payment_failure_count === 1) score += 15;
                          if (s.is_active === false) score += 50;
                          const risk = score >= 60 ? "high" : score >= 30 ? "medium" : "low";
                          return { ...s, churnRisk: risk };
                        }).filter(s => s.churnRisk !== "low");
                        if (churnSchools.length === 0) return <p className="text-sm text-emerald-400 py-2">✅ No high-risk schools detected.</p>;
                        return (
                          <div className="space-y-2 max-h-44 overflow-y-auto">
                            {churnSchools.slice(0, 6).map(s => (
                              <div key={s.id} className="flex items-center justify-between text-sm">
                                <span className="text-slate-300 truncate flex-1">{s.name}</span>
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ml-2 ${s.churnRisk === "high" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                                  {s.churnRisk === "high" ? "🔴 High" : "🟡 Medium"}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </div>

                {/* ── Onboarding Progress + Platform Health ── */}
                <div className="grid gap-6 md:grid-cols-2">
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-400" /> Onboarding Progress
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 max-h-56 overflow-y-auto">
                        {onboardingData.slice(0, 8).map(s => (
                          <div key={s.id} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-300 truncate flex-1">{s.name}</span>
                              <span className="text-slate-400 ml-2">{s.onboarding_score}%</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${s.onboarding_score >= 80 ? "bg-emerald-500" : s.onboarding_score >= 40 ? "bg-yellow-500" : "bg-red-500"}`}
                                style={{ width: `${s.onboarding_score}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Activity className="w-4 h-4 text-green-400" /> Platform Health
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: "Active Schools", value: schoolsList.filter(s => s.is_active !== false).length, color: "text-emerald-400", icon: "✅" },
                          { label: "Open Tickets", value: tickets.filter(t => t.status === "open").length, color: "text-yellow-400", icon: "🎫" },
                          { label: "Payments OK", value: payments.filter(p => p.status === "captured").length, color: "text-emerald-400", icon: "💳" },
                          { label: "Failed Payments", value: payments.filter(p => p.status === "failed").length, color: "text-red-400", icon: "❌" },
                          { label: "Announcements", value: announcements.filter(a => a.is_active).length, color: "text-blue-400", icon: "📢" },
                          { label: "API Status", value: "Online", color: "text-emerald-400", icon: "🟢" },
                        ].map(({ label, value, color, icon }) => (
                          <div key={label} className="bg-muted/50 rounded-lg p-2.5 text-center">
                            <div className="text-base mb-0.5">{icon}</div>
                            <div className={`text-lg font-bold ${color}`}>{value}</div>
                            <div className="text-xs text-slate-500">{label}</div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

              </motion.div>
            )}

            {/* ═══════════════════════════════════════════════════════════
                TAB 2 — MANAGE SCHOOLS
            ═══════════════════════════════════════════════════════════ */}
            {activeTab === "schools" && (
              <motion.div key="schools" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">Manage Schools</h2>
                  <p className="text-muted-foreground mt-1">View, suspend, or activate school tenants.</p>
                </div>

                {/* Search + Filter + Export + Bulk Email */}
                <div className="flex gap-3 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input placeholder="Search by name, subdomain or email..."
                      value={schoolSearch} onChange={e => { setSchoolSearch(e.target.value); setSchoolsPage(1); }}
                      className="pl-9 bg-background border-border" />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {(["all", "active", "suspended", "trial"] as const).map(f => (
                      <Button key={f} size="sm" variant={schoolFilter === f ? "default" : "outline"}
                        onClick={() => { setSchoolFilter(f); setSchoolsPage(1); }}
                        className={schoolFilter === f ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "border-border"}>
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </Button>
                    ))}
                    <Button size="sm" variant="outline" className="border-border"
                      onClick={() => exportCSV(filteredSchools, `schools_${new Date().toISOString().split("T")[0]}.csv`)}>
                      ↓ Export CSV
                    </Button>
                    <Button size="sm" onClick={() => setBulkEmailOpen(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white">
                      <Mail className="w-3.5 h-3.5 mr-1.5" /> Bulk Email
                    </Button>
                  </div>
                </div>

                <Card className="bg-card border-border shadow-xl">
                  <CardContent className="pt-6">
                    {filteredSchools.length === 0 ? (
                      <div className="text-center p-12 border border-dashed border-border rounded-xl">
                        <Building2 className="w-12 h-12 text-slate-500/50 mx-auto mb-2" />
                        <p className="text-slate-400">No schools found.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-sm">
                          <thead>
                            <tr className="border-b border-border text-slate-500">
                              <th className="py-3 px-4">School</th>
                              <th className="py-3 px-4">Subdomain</th>
                              <th className="py-3 px-4">Admin</th>
                              <th className="py-3 px-4">Stats</th>
                              <th className="py-3 px-4">Subscription</th>
                              <th className="py-3 px-4">Status</th>
                              <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginate(filteredSchools, schoolsPage).map(s => (
                              <tr key={s.id} className="border-b border-border hover:bg-muted/30">
                                <td className="py-4 px-4">
                                  <div className="font-bold text-white">{s.name}</div>
                                  <div className="text-xs text-slate-500">{new Date(s.created_at).toLocaleDateString("en-IN")}</div>
                                </td>
                                <td className="py-4 px-4 font-mono text-emerald-400 text-xs">
                                  <div className="flex items-center gap-1"><Globe className="w-3 h-3" /> {s.subdomain}</div>
                                </td>
                                <td className="py-4 px-4">
                                  <div className="text-sm">{s.admin_name || "—"}</div>
                                  <div className="text-xs text-slate-500">{s.admin_email || "—"}</div>
                                </td>
                                <td className="py-4 px-4 text-xs text-slate-400">
                                  <div>👨‍🎓 {(s as any).student_count ?? 0} students</div>
                                  <div>👩‍🏫 {(s as any).teacher_count ?? 0} teachers</div>
                                  <div>🏛 {(s as any).class_count ?? 0} classes</div>
                                </td>
                                <td className="py-4 px-4">
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold border ${statusColor(s.subscription_status)}`}>
                                    {s.subscription_status || "trialing"}
                                  </span>
                                  {/* Inline quota override */}
                                  {quotaEditId === s.id ? (
                                    <div className="flex gap-1 mt-1">
                                      <input type="number" value={quotaEditVal} onChange={e => setQuotaEditVal(e.target.value)}
                                        title="New student quota" placeholder="Quota"
                                        className="w-16 text-xs bg-muted border border-border rounded px-1 py-0.5 text-white" />
                                      <button type="button" title="Save quota" onClick={() => handleQuotaUpdate(s)}
                                        className="text-xs text-emerald-400 hover:text-emerald-300 px-1">✓</button>
                                      <button type="button" title="Cancel" onClick={() => setQuotaEditId(null)}
                                        className="text-xs text-slate-400 hover:text-white px-1">✕</button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <span className="text-xs text-slate-500">Quota: {s.student_quota || 50}</span>
                                      <button type="button" title="Override student quota"
                                        onClick={() => { setQuotaEditId(s.id); setQuotaEditVal(String(s.student_quota || 50)); }}
                                        className="text-xs text-blue-400 hover:text-blue-300">✏️</button>
                                    </div>
                                  )}
                                </td>
                                <td className="py-4 px-4">
                                  {s.is_active === false ? (
                                    <span className="px-2 py-0.5 rounded text-xs font-bold border bg-red-500/10 text-red-400 border-red-500/20">Suspended</span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-xs font-bold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Active</span>
                                  )}
                                  {(s as any).payment_failure_count > 0 && (
                                    <div className="text-xs text-orange-400 mt-0.5">⚠️ {(s as any).payment_failure_count} fail(s)</div>
                                  )}
                                  {(s as any).note_count > 0 && (
                                    <div className="text-xs text-blue-400 mt-0.5">📝 {(s as any).note_count} note(s)</div>
                                  )}
                                </td>
                                <td className="py-4 px-4 text-right">
                                  <div className="flex flex-wrap gap-1 justify-end">
                                    <Button size="sm" variant="outline" onClick={() => setSelectedSchool(s)}
                                      className="border-border hover:bg-muted h-7 w-7 p-0" title="View details">
                                      <Eye className="w-3 h-3" />
                                    </Button>
                                    <Button size="sm" variant="outline"
                                      onClick={() => openNotes(s)}
                                      className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 h-7 text-xs px-1.5" title="CRM notes">
                                      📝
                                    </Button>
                                    <Button size="sm" variant="outline"
                                      disabled={impersonating === s.id}
                                      onClick={() => handleImpersonate(s)}
                                      className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10 h-7 text-xs px-1.5" title="Login as this admin">
                                      {impersonating === s.id ? "..." : "👤"}
                                    </Button>
                                    <Button size="sm" variant="outline" title="Reset admin password"
                                      onClick={() => handlePasswordReset(s)}
                                      className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 h-7 text-xs px-1.5">
                                      <KeyRound className="w-3 h-3" />
                                    </Button>
                                    {s.is_active === false ? (
                                      <Button size="sm" onClick={() => handleToggleSchool(s, false)}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs px-1.5">
                                        <Power className="w-3 h-3" />
                                      </Button>
                                    ) : (
                                      <Button size="sm" variant="outline"
                                        onClick={() => setSuspendModal({ school: s })}
                                        className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-7 text-xs px-1.5">
                                        <Ban className="w-3 h-3" />
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* ═══════════════════════════════════════════════════════════
                TAB 3 — ONBOARDING REQUESTS
            ═══════════════════════════════════════════════════════════ */}
            {activeTab === "requests" && (
              <motion.div key="requests" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">Onboarding Request Pipeline</h2>
                  <p className="text-muted-foreground mt-1">Approve or reject school registration requests. Email is sent automatically.</p>
                </div>

                {/* Filter tabs */}
                <div className="flex gap-2">
                  {(["all", "pending", "approved", "rejected"] as const).map(f => (
                    <Button key={f} size="sm" variant={requestFilter === f ? "default" : "outline"}
                      onClick={() => setRequestFilter(f)}
                      className={requestFilter === f ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "border-border"}>
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                      <span className="ml-1.5 text-xs opacity-70">
                        ({f === "all" ? requests.length : requests.filter(r => r.status === f).length})
                      </span>
                    </Button>
                  ))}
                </div>

                <Card className="bg-card border-border shadow-xl">
                  <CardContent className="pt-6">
                    {filteredRequests.length === 0 ? (
                      <div className="text-center p-12">
                        <Clock className="w-12 h-12 text-slate-500/50 mx-auto mb-2" />
                        <p className="text-slate-400">No requests found.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-sm">
                          <thead>
                            <tr className="border-b border-border text-slate-500">
                              <th className="py-3 px-4">School</th>
                              <th className="py-3 px-4">Subdomain</th>
                              <th className="py-3 px-4">Admin</th>
                              <th className="py-3 px-4">Date</th>
                              <th className="py-3 px-4">Status</th>
                              <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredRequests.map(r => (
                              <tr key={r.id} className="border-b border-border hover:bg-muted/30">
                                <td className="py-4 px-4 text-white font-medium">{r.school_name}</td>
                                <td className="py-4 px-4 font-mono text-emerald-400 text-xs">{r.subdomain}</td>
                                <td className="py-4 px-4">
                                  <div>{r.admin_name}</div>
                                  <div className="text-xs text-slate-500 flex items-center gap-1">
                                    <Mail className="w-3 h-3" /> {r.admin_email}
                                  </div>
                                </td>
                                <td className="py-4 px-4 text-slate-400 text-xs">
                                  {new Date(r.created_at).toLocaleDateString("en-IN")}
                                </td>
                                <td className="py-4 px-4">
                                  <span className={`px-2.5 py-0.5 rounded text-xs font-bold border ${
                                    r.status === "approved" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                    : r.status === "rejected" ? "bg-red-500/10 text-red-400 border-red-500/20"
                                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                  }`}>{r.status}</span>
                                </td>
                                <td className="py-4 px-4 text-right space-x-2">
                                  {r.status === "pending" && (
                                    <>
                                      <Button size="sm" variant="outline" disabled={actionLoadingId === r.id}
                                        onClick={() => handleUpdateStatus(r.id, "rejected")}
                                        className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-8 w-8 p-0">
                                        <XCircle className="w-4 h-4" />
                                      </Button>
                                      <Button size="sm" disabled={actionLoadingId === r.id}
                                        onClick={() => handleUpdateStatus(r.id, "approved")}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 text-xs px-3">
                                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                                      </Button>
                                    </>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* ═══════════════════════════════════════════════════════════
                TAB 4 — PROVISION SCHOOL
            ═══════════════════════════════════════════════════════════ */}
            {activeTab === "provision" && (
              <motion.div key="provision" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">Provision New School</h2>
                  <p className="text-muted-foreground mt-1">Directly create a school tenant. Admin will receive an approval email.</p>
                </div>
                <Card className="bg-card border-border shadow-xl max-w-2xl">
                  <CardHeader>
                    <CardTitle>School Information</CardTitle>
                    <CardDescription>Fill all fields. Admin email will receive login instructions.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form className="space-y-4" onSubmit={async (e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      const schoolName = fd.get("schoolName") as string;
                      const subdomain = fd.get("subdomain") as string;
                      const adminName = fd.get("adminName") as string;
                      const adminEmail = fd.get("adminEmail") as string;
                      const phone = fd.get("phone") as string;
                      const toastId = toast.loading("Validating...");
                      try {
                        // Step 0: Check uniqueness
                        const { data: existing } = await supabase.from("schools")
                          .select("id").eq("subdomain", subdomain).maybeSingle();
                        if (existing) throw new Error(`Subdomain "${subdomain}" already taken. Choose another.`);

                        const { data: emailExists } = await supabase.from("schools")
                          .select("id").eq("admin_email", adminEmail).maybeSingle();
                        if (emailExists) throw new Error(`Email "${adminEmail}" already used by another school.`);

                        toast.loading("Provisioning School...", { id: toastId });

                        // Step 1: Insert directly into schools table
                        const { data: newSchool, error: schoolErr } = await supabase
                          .from("schools")
                          .insert({
                            name: schoolName,
                            subdomain,
                            admin_name: adminName,
                            admin_email: adminEmail,
                            is_active: true,
                            subscription_status: "trialing",
                            student_quota: 50,
                          })
                          .select("id")
                          .single();

                        if (schoolErr) throw schoolErr;

                        // Step 2: Also log in registration_requests as approved record
                        await supabase.from("registration_requests").insert({
                          school_name: schoolName, subdomain,
                          admin_name: adminName, admin_email: adminEmail,
                          status: "approved"
                        });

                        // Step 3: Fetch invite token then send email + log
                        const { data: invData } = await supabase
                          .from("schools").select("invite_token").eq("id", newSchool.id).maybeSingle();
                        await sendEmail(adminEmail, adminName, schoolName, subdomain, "approved", invData?.invite_token);
                        await logAction("SCHOOL_PROVISIONED", "school", newSchool?.id || "", schoolName, { subdomain, adminEmail });

                        toast.success("School Provisioned! Admin email sent.", { id: toastId });
                        e.currentTarget.reset();
                        fetchAll();
                        setActiveTab("schools");
                      } catch (err: any) {
                        toast.error(err.message, { id: toastId });
                      }
                    }}>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">School Name *</label>
                          <input name="schoolName" required className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm" placeholder="Delhi Public School" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Subdomain Prefix *</label>
                          <input name="subdomain" required pattern="[a-z0-9\-]+" className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm" placeholder="dps (lowercase only)" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Admin Full Name *</label>
                          <input name="adminName" required className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm" placeholder="Principal Sharma" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Admin Email *</label>
                          <input name="adminEmail" required type="email" className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm" placeholder="admin@dps.edu.in" />
                        </div>
                        <div className="space-y-2 col-span-2">
                          <label className="text-sm font-medium">Phone (Optional)</label>
                          <input name="phone" className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm" placeholder="+91 98765 43210" />
                        </div>
                      </div>
                      <div className="pt-4 flex justify-end">
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                          <PlusCircle className="w-4 h-4 mr-2" /> Provision Tenant
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                  {/* Pagination */}
                  {totalPages(filteredSchools) > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t border-border">
                      <p className="text-xs text-slate-400">
                        Showing {((schoolsPage-1)*PAGE_SIZE)+1}–{Math.min(schoolsPage*PAGE_SIZE, filteredSchools.length)} of {filteredSchools.length}
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" disabled={schoolsPage === 1} onClick={() => setSchoolsPage(p => p-1)} className="border-border h-8 w-8 p-0">‹</Button>
                        <span className="text-xs text-slate-400 self-center">{schoolsPage}/{totalPages(filteredSchools)}</span>
                        <Button size="sm" variant="outline" disabled={schoolsPage >= totalPages(filteredSchools)} onClick={() => setSchoolsPage(p => p+1)} className="border-border h-8 w-8 p-0">›</Button>
                      </div>
                    </div>
                  )}
                </Card>
              </motion.div>
            )}

            {/* ═══════════════════════════════════════════════════════════
                TAB 5 — PAYMENTS & REVENUE
            ═══════════════════════════════════════════════════════════ */}
            {activeTab === "payments" && (() => {
              const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

              // Prepare chart data (last 6 months, newest last)
              const chartData = [...monthlyRevenue].reverse().slice(-6).map(m => ({
                month: `${MONTH_NAMES[(m.billing_month || 1) - 1]} ${m.billing_year}`,
                Revenue: Number(m.collected_revenue || 0),
                Payments: Number(m.total_payments || 0),
                Failed: Number(m.failed_payments || 0),
              }));

              // Filtered payments
              const filteredPayments = payments.filter(p => {
                const matchStatus = paymentStatusFilter === "all" || p.status === paymentStatusFilter;
                const matchSchool = selectedPaymentSchool === "all" || p.school_subdomain === selectedPaymentSchool;
                const matchSearch = !paymentSearch ||
                  p.school_name.toLowerCase().includes(paymentSearch.toLowerCase()) ||
                  p.razorpay_payment_id?.toLowerCase().includes(paymentSearch.toLowerCase()) ||
                  p.plan_name?.toLowerCase().includes(paymentSearch.toLowerCase());
                return matchStatus && matchSchool && matchSearch;
              });

              // Summary stats
              const totalCollected = payments.filter(p => p.status === "captured").reduce((s, p) => s + Number(p.amount), 0);
              const totalFailed    = payments.filter(p => p.status === "failed").length;
              const totalPending   = payments.filter(p => p.status === "pending").length;

              // Upcoming renewals (next 30 days)
              const today = new Date();
              const in30  = new Date(); in30.setDate(today.getDate() + 30);
              const upcomingRenewals = schoolsList.filter(s => {
                if (!s.subscription_renewal_date) return false;
                const rd = new Date(s.subscription_renewal_date);
                return rd >= today && rd <= in30;
              });

              // Per-school revenue
              const schoolRevMap: Record<string, { name: string; total: number; count: number; last: string }> = {};
              payments.filter(p => p.status === "captured").forEach(p => {
                if (!schoolRevMap[p.school_subdomain]) {
                  schoolRevMap[p.school_subdomain] = { name: p.school_name, total: 0, count: 0, last: p.created_at };
                }
                schoolRevMap[p.school_subdomain].total += Number(p.amount);
                schoolRevMap[p.school_subdomain].count += 1;
                if (p.created_at > schoolRevMap[p.school_subdomain].last) schoolRevMap[p.school_subdomain].last = p.created_at;
              });
              const schoolRevList = Object.values(schoolRevMap).sort((a, b) => b.total - a.total);

              return (
                <motion.div key="payments" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight">Payments & Revenue</h2>
                    <p className="text-muted-foreground mt-1">Full platform payment tracking — transactions, MRR, renewals, failures.</p>
                  </div>
                  <a href="https://dashboard.razorpay.com/" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors self-start">
                    <CreditCard className="w-4 h-4" /> Open Razorpay Dashboard ↗
                  </a>

                  {/* ── Stats Row ── */}
                  <div className="grid gap-4 md:grid-cols-4">
                    {[
                      { label: "Total Collected", value: `₹${totalCollected.toLocaleString("en-IN")}`, icon: IndianRupee, color: "text-emerald-400" },
                      { label: "Total Transactions", value: payments.filter(p => p.status === "captured").length, icon: Receipt, color: "text-blue-400" },
                      { label: "Failed Payments", value: totalFailed, icon: BadgeAlert, color: "text-red-400" },
                      { label: "Renewals (30 days)", value: upcomingRenewals.length, icon: CalendarClock, color: "text-amber-400" },
                    ].map(({ label, value, icon: Icon, color }) => (
                      <Card key={label} className="bg-card border-border">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                          <CardTitle className="text-sm font-medium">{label}</CardTitle>
                          <Icon className={`w-5 h-5 ${color}`} />
                        </CardHeader>
                        <CardContent>
                          <div className={`text-2xl font-bold ${color}`}>{value}</div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* ── Revenue Chart ── */}
                  <div className="grid gap-6 md:grid-cols-2">
                    <Card className="bg-card border-border shadow-xl">
                      <CardHeader>
                        <CardTitle className="text-base">Monthly Revenue (Last 6 Months)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {chartData.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                            <TrendingUp className="w-10 h-10 mb-2 opacity-30" />
                            <p className="text-sm">No payment data yet</p>
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                              <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} />
                              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                              <Tooltip
                                contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
                                formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]}
                              />
                              <Bar dataKey="Revenue" fill="#34d399" radius={[4,4,0,0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>

                    {/* ── Upcoming Renewals ── */}
                    <Card className="bg-card border-border shadow-xl">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <CalendarClock className="w-4 h-4 text-amber-400" /> Upcoming Renewals (30 days)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {upcomingRenewals.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-32 text-slate-500">
                            <CheckCircle2 className="w-8 h-8 mb-2 opacity-30" />
                            <p className="text-sm">No renewals due soon</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {upcomingRenewals.map(s => (
                              <div key={s.id} className="flex items-center justify-between p-2.5 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                                <div>
                                  <p className="font-medium text-sm text-white">{s.name}</p>
                                  <p className="text-xs text-slate-400">{s.subscription_plan || "Trial"}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-amber-400 font-bold">
                                    {new Date(s.subscription_renewal_date!).toLocaleDateString("en-IN")}
                                  </p>
                                  <p className="text-xs text-slate-500">renewal date</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* ── Per-school Revenue ── */}
                  <Card className="bg-card border-border shadow-xl">
                    <CardHeader>
                      <CardTitle className="text-base">Revenue per School</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {schoolRevList.length === 0 ? (
                        <p className="text-slate-400 text-sm text-center py-6">No payments recorded yet.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-sm">
                            <thead>
                              <tr className="border-b border-border text-slate-500">
                                <th className="py-2 px-3">School</th>
                                <th className="py-2 px-3">Total Paid</th>
                                <th className="py-2 px-3">Transactions</th>
                                <th className="py-2 px-3">Last Payment</th>
                              </tr>
                            </thead>
                            <tbody>
                              {schoolRevList.map((s, i) => (
                                <tr key={i} className="border-b border-border hover:bg-muted/30">
                                  <td className="py-2.5 px-3 text-white font-medium">{s.name}</td>
                                  <td className="py-2.5 px-3 text-emerald-400 font-bold">₹{s.total.toLocaleString("en-IN")}</td>
                                  <td className="py-2.5 px-3 text-slate-300">{s.count}</td>
                                  <td className="py-2.5 px-3 text-slate-400 text-xs">{new Date(s.last).toLocaleDateString("en-IN")}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* ── All Transactions ── */}
                  <Card className="bg-card border-border shadow-xl">
                    <CardHeader>
                      <CardTitle className="text-base">All Transactions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Filters */}
                      <div className="flex gap-3 flex-wrap">
                        <div className="relative flex-1 min-w-[200px]">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input placeholder="Search school, payment ID, plan..."
                            value={paymentSearch} onChange={e => setPaymentSearch(e.target.value)}
                            className="pl-9 bg-background border-border" />
                        </div>
                        <div className="flex gap-2">
                          {(["all", "captured", "pending", "failed"] as const).map(f => (
                            <Button key={f} size="sm" variant={paymentStatusFilter === f ? "default" : "outline"}
                              onClick={() => setPaymentStatusFilter(f)}
                              className={paymentStatusFilter === f ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "border-border"}>
                              {f.charAt(0).toUpperCase() + f.slice(1)}
                            </Button>
                          ))}
                        </div>
                        <select
                          title="Filter by school"
                          value={selectedPaymentSchool}
                          onChange={e => setSelectedPaymentSchool(e.target.value)}
                          className="bg-background border border-input rounded-md px-3 py-1.5 text-sm"
                        >
                          <option value="all">All Schools</option>
                          {[...new Set(payments.map(p => p.school_subdomain))].map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>

                      {/* Table */}
                      {filteredPayments.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                          <Receipt className="w-10 h-10 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No transactions found</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-sm">
                            <thead>
                              <tr className="border-b border-border text-slate-500">
                                <th className="py-3 px-3">School</th>
                                <th className="py-3 px-3">Plan</th>
                                <th className="py-3 px-3">Amount</th>
                                <th className="py-3 px-3">Status</th>
                                <th className="py-3 px-3">Razorpay ID</th>
                                <th className="py-3 px-3">Renewal Date</th>
                                <th className="py-3 px-3">Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredPayments.map(p => (
                                <tr key={p.id} className="border-b border-border hover:bg-muted/30">
                                  <td className="py-3 px-3">
                                    <div className="text-white font-medium">{p.school_name}</div>
                                    <div className="text-xs text-slate-500">{p.school_subdomain}</div>
                                  </td>
                                  <td className="py-3 px-3 text-slate-300">{p.plan_name || "—"}</td>
                                  <td className="py-3 px-3 font-bold text-emerald-400">
                                    ₹{Number(p.amount).toLocaleString("en-IN")}
                                  </td>
                                  <td className="py-3 px-3">
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                                      p.status === "captured" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                      : p.status === "failed"   ? "bg-red-500/10 text-red-400 border-red-500/20"
                                      : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                    }`}>{p.status}</span>
                                    {p.failure_reason && <div className="text-xs text-red-400 mt-0.5">{p.failure_reason}</div>}
                                  </td>
                                  <td className="py-3 px-3 font-mono text-xs text-slate-400">
                                    {p.razorpay_payment_id || p.razorpay_order_id || "—"}
                                  </td>
                                  <td className="py-3 px-3 text-xs text-slate-400">
                                    {p.next_renewal_date ? new Date(p.next_renewal_date).toLocaleDateString("en-IN") : "—"}
                                  </td>
                                  <td className="py-3 px-3 text-xs text-slate-400">
                                    {new Date(p.created_at).toLocaleDateString("en-IN")}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })()}

            {/* ═══════════════════════════════════════════════════════════
                TAB 6 — SUBSCRIPTION PLANS
            ═══════════════════════════════════════════════════════════ */}
            {activeTab === "plans" && (
              <motion.div key="plans" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">Subscription Plans</h2>
                  <p className="text-muted-foreground mt-1">Manage pricing tiers and features for school subscriptions.</p>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                  {plans.map(plan => (
                    <Card key={plan.id} className="bg-card border-border shadow-xl relative overflow-hidden">
                      {plan.slug === "premium" && (
                        <div className="absolute top-3 right-3 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">POPULAR</div>
                      )}
                      <CardHeader>
                        <CardTitle className="text-lg">{plan.name}</CardTitle>
                        <div className="text-3xl font-bold text-emerald-400 mt-1">
                          {plan.price_monthly === 0 ? "Free" : `₹${plan.price_monthly.toLocaleString("en-IN")}`}
                          {plan.price_monthly > 0 && <span className="text-sm text-slate-400 font-normal">/month</span>}
                        </div>
                        <p className="text-xs text-slate-400">Up to {plan.student_quota.toLocaleString()} students</p>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {(plan.features || []).map((f: string, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-slate-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" /> {f}
                          </div>
                        ))}
                        <div className="pt-4 border-t border-border mt-4 text-xs text-slate-500 space-y-1">
                          <div className="flex justify-between">
                            <span>Schools on this plan:</span>
                            <span className="font-bold text-white">
                              {schoolsList.filter(s => (s.subscription_status || "trialing") === plan.slug || (s.subscription_plan || "").toLowerCase() === plan.name.toLowerCase()).length}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Monthly revenue:</span>
                            <span className="font-bold text-emerald-400">
                              ₹{(schoolsList.filter(s => (s.subscription_status || "trialing") === plan.slug && s.is_active !== false).length * plan.price_monthly).toLocaleString("en-IN")}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Card className="bg-card border-border shadow-xl">
                  <CardHeader>
                    <CardTitle className="text-base">Schools by Plan</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-border text-slate-500">
                            <th className="py-3 px-4">School</th>
                            <th className="py-3 px-4">Current Plan</th>
                            <th className="py-3 px-4">Students</th>
                            <th className="py-3 px-4">Quota</th>
                            <th className="py-3 px-4">Renewal Date</th>
                            <th className="py-3 px-4">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {schoolsList.map(s => {
                            const usagePct = Math.round(((s as any).student_count || 0) / (s.student_quota || 50) * 100);
                            return (
                              <tr key={s.id} className="border-b border-border hover:bg-muted/30">
                                <td className="py-3 px-4 font-medium text-white">{s.name}</td>
                                <td className="py-3 px-4">
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold border ${statusColor(s.subscription_status)}`}>
                                    {s.subscription_plan || s.subscription_status || "trialing"}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-slate-300">{(s as any).student_count || 0}</td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                                      <div className={`h-1.5 rounded-full ${usagePct > 90 ? "bg-red-400" : usagePct > 70 ? "bg-amber-400" : "bg-emerald-400"}`}
                                        style={{ width: `${Math.min(usagePct, 100)}%` }} />
                                    </div>
                                    <span className="text-xs text-slate-400">{usagePct}%</span>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-xs text-slate-400">
                                  {s.subscription_renewal_date ? new Date(s.subscription_renewal_date).toLocaleDateString("en-IN") : "—"}
                                </td>
                                <td className="py-3 px-4">
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold border ${s.is_active === false ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"}`}>
                                    {s.is_active === false ? "Suspended" : "Active"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* ═══════════════════════════════════════════════════════════
                TAB 7 — SUPER ADMINS
            ═══════════════════════════════════════════════════════════ */}
            {activeTab === "admins" && (
              <motion.div key="admins" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">Super Admin Accounts</h2>
                  <p className="text-muted-foreground mt-1">Manage who has global platform access.</p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  {/* Existing Admins */}
                  <Card className="bg-card border-border shadow-xl">
                    <CardHeader>
                      <CardTitle className="text-base">Current Super Admins</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {superAdmins.length === 0 ? (
                        <p className="text-slate-400 text-sm">No super admins found.</p>
                      ) : superAdmins.map(a => (
                        <div key={a.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <div>
                            <p className="font-medium text-sm text-white">{a.full_name}</p>
                            <p className="text-xs text-slate-400">{a.email}</p>
                          </div>
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            Super Admin
                          </span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Add New Admin */}
                  <Card className="bg-card border-border shadow-xl">
                    <CardHeader>
                      <CardTitle className="text-base">Add New Super Admin</CardTitle>
                      <CardDescription>They will need to confirm their email before logging in.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleAddSuperAdmin} className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-sm font-medium">Full Name *</label>
                          <input required value={newAdminName} onChange={e => setNewAdminName(e.target.value)}
                            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm" placeholder="Admin Name" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium">Email *</label>
                          <input required type="email" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)}
                            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm" placeholder="admin@edunextgen.in" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium">Password *</label>
                          <input required type="password" minLength={8} value={newAdminPassword} onChange={e => setNewAdminPassword(e.target.value)}
                            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm" placeholder="Min. 8 characters" />
                        </div>
                        <Button type="submit" disabled={addingAdmin} className="w-full bg-purple-600 hover:bg-purple-700 text-white mt-2">
                          <PlusCircle className="w-4 h-4 mr-2" /> {addingAdmin ? "Creating..." : "Create Super Admin"}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            )}

            {/* ═══════════════════════════════════════════════════════════
                TAB 6 — ACTIVITY LOGS
            ═══════════════════════════════════════════════════════════ */}
            {activeTab === "logs" && (
              <motion.div key="logs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">Activity Logs</h2>
                  <p className="text-muted-foreground mt-1">Full audit trail of all super admin actions.</p>
                </div>
                <Card className="bg-card border-border shadow-xl">
                  <CardContent className="pt-6">
                    {logs.length === 0 ? (
                      <div className="text-center p-12">
                        <Activity className="w-12 h-12 text-slate-500/50 mx-auto mb-2" />
                        <p className="text-slate-400">No activity logs yet. Actions will appear here.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-sm">
                          <thead>
                            <tr className="border-b border-border text-slate-500">
                              <th className="py-3 px-4">Action</th>
                              <th className="py-3 px-4">Target</th>
                              <th className="py-3 px-4">Type</th>
                              <th className="py-3 px-4">Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {logs.map(l => (
                              <tr key={l.id} className="border-b border-border hover:bg-muted/30">
                                <td className="py-3 px-4">
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                                    l.action.includes("APPROVED") || l.action.includes("ACTIVATED") ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                    : l.action.includes("REJECTED") || l.action.includes("SUSPENDED") ? "bg-red-500/10 text-red-400 border-red-500/20"
                                    : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                  }`}>{l.action}</span>
                                </td>
                                <td className="py-3 px-4 text-white font-medium">{l.target_name || "—"}</td>
                                <td className="py-3 px-4 text-slate-400 text-xs uppercase">{l.target_type}</td>
                                <td className="py-3 px-4 text-slate-400 text-xs">
                                  {new Date(l.created_at).toLocaleString("en-IN")}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* ═══════════════════════════════════════════════════════════
                TAB — SUPPORT TICKETS
            ═══════════════════════════════════════════════════════════ */}
            {activeTab === "support" && (
              <motion.div key="support" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">Support Tickets</h2>
                  <p className="text-muted-foreground mt-1">Handle school admin support requests.</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(["all","open","in_progress","resolved","closed"] as const).map(s => (
                    <span key={s} className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer border ${
                      s === "open" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                      : s === "in_progress" ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                      : s === "resolved" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-muted text-slate-400 border-border"
                    }`}>{s.replace("_"," ").toUpperCase()} {tickets.filter(t => s === "all" || t.status === s).length}</span>
                  ))}
                </div>
                <div className="space-y-3">
                  {tickets.length === 0 ? (
                    <Card className="bg-card border-border"><CardContent className="py-12 text-center text-slate-500">No support tickets yet.</CardContent></Card>
                  ) : tickets.map(t => (
                    <Card key={t.id} className="bg-card border-border hover:border-blue-500/30 transition-colors cursor-pointer" onClick={() => openTicket(t)}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-xs font-mono text-slate-500">#{t.ticket_number}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                                t.priority === "urgent" ? "bg-red-500/10 text-red-400 border-red-500/20"
                                : t.priority === "high" ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                                : "bg-muted text-slate-400 border-border"
                              }`}>{t.priority}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                                t.status === "open" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                                : t.status === "in_progress" ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              }`}>{t.status.replace("_"," ")}</span>
                              <span className="text-xs text-slate-500 bg-muted px-2 py-0.5 rounded">{t.category}</span>
                            </div>
                            <p className="font-semibold text-white">{t.subject}</p>
                            <p className="text-sm text-slate-400 truncate mt-0.5">{t.description}</p>
                            <div className="flex gap-3 mt-2 text-xs text-slate-500">
                              <span>👤 {t.submitter_name || t.submitter_email}</span>
                              <span>🏫 {t.school_name || "—"}</span>
                              <span>🕒 {new Date(t.created_at).toLocaleDateString("en-IN")}</span>
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            {t.status !== "resolved" && (
                              <Button size="sm" type="button"
                                onClick={e => { e.stopPropagation(); handleResolveTicket(t); }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs px-2">
                                ✓ Resolve
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ═══════════════════════════════════════════════════════════
                TAB — ANNOUNCEMENTS / BROADCAST
            ═══════════════════════════════════════════════════════════ */}
            {activeTab === "broadcast" && (
              <motion.div key="broadcast" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">Platform Announcements</h2>
                  <p className="text-muted-foreground mt-1">Broadcast in-app banners to school portals. Shown to all logged-in school users.</p>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Create form */}
                  <Card className="bg-card border-border">
                    <CardHeader><CardTitle className="text-base">New Announcement</CardTitle></CardHeader>
                    <CardContent>
                      <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-slate-300 block mb-1">Title</label>
                          <Input value={annForm.title} onChange={e => setAnnForm(f => ({...f, title: e.target.value}))}
                            placeholder="e.g. Scheduled Maintenance" required className="bg-muted/50 border-border" />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-slate-300 block mb-1">Message</label>
                          <textarea value={annForm.message} onChange={e => setAnnForm(f => ({...f, message: e.target.value}))}
                            placeholder="Brief message for school admins..." required rows={3}
                            className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-sm font-medium text-slate-300 block mb-1">Type</label>
                            <select value={annForm.type} onChange={e => setAnnForm(f => ({...f, type: e.target.value as any}))}
                              title="Announcement type"
                              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                              <option value="info">ℹ️ Info</option>
                              <option value="warning">⚠️ Warning</option>
                              <option value="success">✅ Success</option>
                              <option value="urgent">🚨 Urgent</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-slate-300 block mb-1">Target</label>
                            <select value={annForm.target} onChange={e => setAnnForm(f => ({...f, target: e.target.value as any}))}
                              title="Target audience"
                              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                              <option value="all">All Schools</option>
                              <option value="trialing">Trial Only</option>
                              <option value="paid">Paid Only</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-slate-300 block mb-1">Expires (optional)</label>
                          <Input type="datetime-local" value={annForm.ends_at}
                            onChange={e => setAnnForm(f => ({...f, ends_at: e.target.value}))}
                            className="bg-muted/50 border-border" />
                        </div>
                        <Button type="submit" disabled={savingAnn} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                          {savingAnn ? "Creating..." : "📢 Create Announcement"}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>

                  {/* Active announcements list */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-slate-300">Active Announcements ({announcements.filter(a => a.is_active).length})</h3>
                    {announcements.length === 0 ? (
                      <Card className="bg-card border-border"><CardContent className="py-8 text-center text-slate-500 text-sm">No announcements yet.</CardContent></Card>
                    ) : announcements.map(ann => (
                      <Card key={ann.id} className={`bg-card border-border ${!ann.is_active ? "opacity-50" : ""}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs px-2 py-0.5 rounded font-bold border ${
                                  ann.type === "urgent" ? "bg-red-500/10 text-red-400 border-red-500/20"
                                  : ann.type === "warning" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                                  : ann.type === "success" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                }`}>{ann.type}</span>
                                <span className="text-xs text-slate-500">→ {ann.target}</span>
                              </div>
                              <p className="font-semibold text-white text-sm">{ann.title}</p>
                              <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{ann.message}</p>
                              {ann.ends_at && <p className="text-xs text-slate-500 mt-1">Expires: {new Date(ann.ends_at).toLocaleDateString("en-IN")}</p>}
                            </div>
                            <div className="flex gap-1.5 flex-shrink-0">
                              <Button size="sm" type="button" variant="outline"
                                onClick={() => handleToggleAnnouncement(ann.id, ann.is_active)}
                                className="h-7 text-xs px-2 border-border">
                                {ann.is_active ? "Pause" : "Resume"}
                              </Button>
                              <Button size="sm" type="button" variant="outline"
                                onClick={() => handleDeleteAnnouncement(ann.id)}
                                className="h-7 text-xs px-2 border-red-500/30 text-red-400 hover:bg-red-500/10">
                                Delete
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ═══════════════════════════════════════════════════════════
                TAB — TOOLS & SETTINGS
            ═══════════════════════════════════════════════════════════ */}
            {activeTab === "tools" && (
              <motion.div key="tools" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">Tools & Settings</h2>
                  <p className="text-muted-foreground mt-1">GDPR export, school archive, white-label branding, API key management.</p>
                </div>

                {/* School selector for tools */}
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-base">School Tools</CardTitle>
                    <CardDescription>Select a school to manage its tools and settings</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-slate-500 text-xs uppercase">
                            <th className="py-2 px-3 text-left">School</th>
                            <th className="py-2 px-3 text-left">Status</th>
                            <th className="py-2 px-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {schoolsList.filter(s => !(s as any).is_archived).map(s => (
                            <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30">
                              <td className="py-3 px-3">
                                <div className="font-medium text-white">{s.name}</div>
                                <div className="text-xs text-slate-500">{s.subdomain}</div>
                              </td>
                              <td className="py-3 px-3">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                                  s.is_active === false ? "bg-red-500/10 text-red-400 border-red-500/20"
                                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                }`}>{s.is_active === false ? "Suspended" : "Active"}</span>
                              </td>
                              <td className="py-3 px-3 text-right">
                                <div className="flex gap-1.5 justify-end">
                                  <Button size="sm" type="button" variant="outline"
                                    onClick={() => handleGdprExport(s)}
                                    disabled={exportingId === s.id}
                                    className="h-7 text-xs px-2 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                    title="Download all school data as JSON (GDPR)">
                                    {exportingId === s.id ? "..." : "⬇ Export"}
                                  </Button>
                                  <Button size="sm" type="button" variant="outline"
                                    onClick={() => openBranding(s)}
                                    className="h-7 text-xs px-2 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                                    title="White-label branding settings">
                                    🎨 Brand
                                  </Button>
                                  <Button size="sm" type="button" variant="outline"
                                    onClick={() => openApiKeys(s)}
                                    className="h-7 text-xs px-2 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                                    title="API key management">
                                    🔑 API Keys
                                  </Button>
                                  <Button size="sm" type="button" variant="outline"
                                    onClick={() => setArchiveModal(s)}
                                    className="h-7 text-xs px-2 border-red-500/30 text-red-400 hover:bg-red-500/10"
                                    title="Archive this school (soft delete)">
                                    🗄 Archive
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Archived schools */}
                    {schoolsList.some(s => (s as any).is_archived) && (
                      <div className="pt-4 border-t border-border">
                        <p className="text-sm font-medium text-slate-400 mb-2">Archived Schools</p>
                        {schoolsList.filter(s => (s as any).is_archived).map(s => (
                          <div key={s.id} className="flex items-center justify-between py-2 text-sm">
                            <span className="text-slate-500">{s.name}</span>
                            <span className="text-xs text-slate-600">Archived {(s as any).archived_at ? new Date((s as any).archived_at).toLocaleDateString("en-IN") : "—"}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

          </AnimatePresence>
        </main>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          MODAL — School Detail View
      ═══════════════════════════════════════════════════════════ */}
      {selectedSchool && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">{selectedSchool.name}</h2>
              <button type="button" title="Close" onClick={() => setSelectedSchool(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              {[
                ["Subdomain", selectedSchool.subdomain],
                ["Admin Name", selectedSchool.admin_name || "—"],
                ["Admin Email", selectedSchool.admin_email || "—"],
                ["Subscription", selectedSchool.subscription_status || "trialing"],
                ["Student Quota", selectedSchool.student_quota || 50],
                ["Status", selectedSchool.is_active === false ? "Suspended" : "Active"],
                ["Created", new Date(selectedSchool.created_at).toLocaleDateString("en-IN")],
                ...(selectedSchool.suspension_reason ? [["Suspension Reason", selectedSchool.suspension_reason]] : []),
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-slate-400">{label}</span>
                  <span className="text-white font-medium">{value}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6 flex-wrap">
              <Button className="flex-1" variant="outline"
                onClick={() => window.open(`${window.location.origin}/${selectedSchool.subdomain}/admin`, "_blank")}>
                <Globe className="w-4 h-4 mr-2" /> Open Portal
              </Button>
              <Button className="flex-1 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10" variant="outline"
                title="Send password reset email to school admin"
                onClick={() => { handlePasswordReset(selectedSchool); setSelectedSchool(null); }}>
                <KeyRound className="w-4 h-4 mr-2" /> Reset Password
              </Button>
              {selectedSchool.is_active === false ? (
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => handleToggleSchool(selectedSchool, false)}>
                  <Power className="w-4 h-4 mr-2" /> Activate
                </Button>
              ) : (
                <Button className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10" variant="outline"
                  onClick={() => { setSuspendModal({ school: selectedSchool }); setSelectedSchool(null); }}>
                  <Ban className="w-4 h-4 mr-2" /> Suspend
                </Button>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          MODAL — Suspend Confirmation
      ═══════════════════════════════════════════════════════════ */}
      {suspendModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-red-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-400" />
              <h2 className="text-xl font-bold text-red-400">Suspend School</h2>
            </div>
            <p className="text-slate-400 text-sm mb-4">
              You are about to suspend <strong className="text-white">{suspendModal.school.name}</strong>.
              The school admin will receive an email notification. All school users will lose access.
            </p>
            <div className="space-y-2 mb-4">
              <label className="text-sm font-medium">Reason (optional)</label>
              <input
                value={suspendReason}
                onChange={e => setSuspendReason(e.target.value)}
                placeholder="e.g., Payment overdue, Policy violation..."
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 border-border" onClick={() => { setSuspendModal(null); setSuspendReason(""); }}>
                Cancel
              </Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={() => handleToggleSchool(suspendModal.school, true)}>
                <Ban className="w-4 h-4 mr-2" /> Confirm Suspend
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          MODAL — Bulk Email
      ═══════════════════════════════════════════════════════════ */}
      {bulkEmailOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-blue-500/30 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-400" /> Bulk Email to Schools
              </h2>
              <button type="button" title="Close" onClick={() => setBulkEmailOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleBulkEmail} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-300 block mb-1">Send To</label>
                <div className="flex gap-2 flex-wrap">
                  {([
                    { val: "all", label: "All Schools" },
                    { val: "active", label: "Active (Paid)" },
                    { val: "trialing", label: "Trial" },
                    { val: "suspended", label: "Suspended" },
                  ] as const).map(opt => (
                    <button type="button" key={opt.val}
                      onClick={() => setBulkFilter(opt.val)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        bulkFilter === opt.val
                          ? "bg-blue-600 text-white border-blue-500"
                          : "border-border text-slate-400 hover:border-blue-500/50"
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  ~{bulkFilter === "all" ? schoolsList.length
                    : bulkFilter === "active" ? schoolsList.filter(s => s.is_active && s.subscription_status !== "trialing").length
                    : bulkFilter === "trialing" ? schoolsList.filter(s => s.subscription_status === "trialing" && s.is_active).length
                    : schoolsList.filter(s => !s.is_active).length} recipients
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 block mb-1">Subject</label>
                <Input value={bulkSubject} onChange={e => setBulkSubject(e.target.value)}
                  placeholder="e.g. Important Platform Update" required
                  className="bg-muted/50 border-border" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 block mb-1">Message</label>
                <textarea value={bulkBody} onChange={e => setBulkBody(e.target.value)}
                  placeholder="Write your announcement here..." required rows={5}
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
              </div>
              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" className="flex-1 border-border"
                  onClick={() => setBulkEmailOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={sendingBulk}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                  {sendingBulk
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Sending...</>
                    : <><Mail className="w-4 h-4 mr-2" /> Send Email</>}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          MODAL — School Notes / CRM
      ═══════════════════════════════════════════════════════════ */}
      {notesSchool && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold text-white">📝 Notes — {notesSchool.name}</h2>
                <p className="text-slate-500 text-xs mt-0.5">Internal CRM notes (only visible to super admins)</p>
              </div>
              <button type="button" title="Close notes" onClick={() => { setNotesSchool(null); setSchoolNotes([]); setNewNote(""); }}
                className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notes list */}
            <div className="flex-1 overflow-y-auto space-y-3 mb-4 min-h-0">
              {schoolNotes.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">No notes yet. Add your first note below.</div>
              ) : schoolNotes.map(note => (
                <div key={note.id} className="bg-muted/50 border border-border rounded-lg p-3 group">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          note.note_type === "payment" ? "bg-red-500/10 text-red-400 border border-red-500/20"
                          : note.note_type === "support" ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                          : note.note_type === "upgrade" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        }`}>{note.note_type}</span>
                        <span className="text-xs text-slate-500">{note.created_by_name}</span>
                        <span className="text-xs text-slate-600">{new Date(note.created_at).toLocaleDateString("en-IN")}</span>
                      </div>
                      <p className="text-sm text-slate-200 whitespace-pre-wrap">{note.note}</p>
                    </div>
                    <button type="button" title="Delete note" onClick={() => handleDeleteNote(note.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all flex-shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add note form */}
            <div className="border-t border-border pt-4 flex-shrink-0 space-y-2">
              <div className="flex gap-2">
                {(["general", "payment", "support", "upgrade"] as const).map(t => (
                  <button type="button" key={t}
                    onClick={() => setNoteType(t)}
                    className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                      noteType === t ? "bg-blue-600 text-white border-blue-500" : "border-border text-slate-400 hover:border-blue-500/50"
                    }`}>{t}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <textarea value={newNote} onChange={e => setNewNote(e.target.value)}
                  placeholder="Add a note..." rows={2}
                  className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/50" />
                <Button type="button" onClick={handleAddNote} disabled={savingNote || !newNote.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white self-stretch px-3">
                  {savingNote ? "..." : "Add"}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          MODAL — Ticket Detail & Reply
      ═══════════════════════════════════════════════════════════ */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between mb-4 flex-shrink-0">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-slate-500">#{selectedTicket.ticket_number}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                    selectedTicket.priority === "urgent" ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-muted text-slate-400 border-border"
                  }`}>{selectedTicket.priority}</span>
                </div>
                <h2 className="text-lg font-bold text-white">{selectedTicket.subject}</h2>
                <p className="text-sm text-slate-400 mt-0.5">{selectedTicket.submitter_name} · {selectedTicket.submitter_email} · {selectedTicket.school_name}</p>
              </div>
              <button type="button" title="Close ticket" onClick={() => { setSelectedTicket(null); setTicketReplies([]); }}
                className="text-slate-400 hover:text-white flex-shrink-0 ml-4">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 min-h-0 mb-4">
              {/* Original message */}
              <div className="bg-muted/50 border border-border rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Original Message</p>
                <p className="text-sm text-slate-200 whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>
              {/* Replies */}
              {ticketReplies.map(r => (
                <div key={r.id} className={`rounded-lg p-3 border ${
                  r.is_internal ? "bg-yellow-500/5 border-yellow-500/20"
                  : r.author_role === "super_admin" ? "bg-blue-500/5 border-blue-500/20 ml-4"
                  : "bg-muted/30 border-border"
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-semibold ${r.author_role === "super_admin" ? "text-blue-400" : "text-slate-300"}`}>
                      {r.author_role === "super_admin" ? "👨‍💼 Super Admin" : "👤"} {r.author_name}
                    </span>
                    {r.is_internal && <span className="text-xs text-yellow-400 bg-yellow-500/10 px-1.5 rounded">Internal Note</span>}
                    <span className="text-xs text-slate-500 ml-auto">{new Date(r.created_at).toLocaleString("en-IN")}</span>
                  </div>
                  <p className="text-sm text-slate-200 whitespace-pre-wrap">{r.message}</p>
                </div>
              ))}
            </div>
            {selectedTicket.status !== "resolved" && selectedTicket.status !== "closed" && (
              <div className="border-t border-border pt-4 flex-shrink-0 space-y-2">
                <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                  placeholder="Type your reply..." rows={3}
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/50" />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                    <input type="checkbox" checked={replyInternal} onChange={e => setReplyInternal(e.target.checked)} className="rounded" />
                    Internal note (hidden from school)
                  </label>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => handleResolveTicket(selectedTicket)}
                      className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 h-8 text-xs px-3">
                      ✓ Resolve
                    </Button>
                    <Button type="button" onClick={handleSendReply} disabled={sendingReply || !replyText.trim()}
                      className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs px-3">
                      {sendingReply ? "Sending..." : "Send Reply"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          MODAL — Archive School
      ═══════════════════════════════════════════════════════════ */}
      {archiveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-red-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-red-400 mb-2">🗄 Archive School</h2>
            <p className="text-slate-400 text-sm mb-4">
              Archive <strong className="text-white">{archiveModal.name}</strong>? This is a soft delete — all data is preserved. The school portal will be deactivated.
            </p>
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4 text-sm text-red-300">
              ⚠️ This action will suspend the school and mark it as archived. You can restore it later from the database.
            </div>
            <div className="space-y-3">
              <Input value={archiveReason} onChange={e => setArchiveReason(e.target.value)}
                placeholder="Archive reason (optional)" className="bg-muted/50 border-border" />
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1 border-border" onClick={() => { setArchiveModal(null); setArchiveReason(""); }}>
                  Cancel
                </Button>
                <Button type="button" onClick={() => handleArchiveSchool(archiveModal)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                  🗄 Confirm Archive
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          MODAL — White-label Branding
      ═══════════════════════════════════════════════════════════ */}
      {brandingSchool && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-purple-500/30 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold text-white">🎨 White-label Branding</h2>
                <p className="text-slate-500 text-xs mt-0.5">{brandingSchool.name}</p>
              </div>
              <button type="button" title="Close branding" onClick={() => setBrandingSchool(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveBranding} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-400 block mb-1">Platform Name</label>
                  <Input value={brandingForm.platform_name || ""} onChange={e => setBrandingForm((f: any) => ({...f, platform_name: e.target.value}))}
                    placeholder="EduNextGen" className="bg-muted/50 border-border text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 block mb-1">Support Email</label>
                  <Input value={brandingForm.support_email || ""} onChange={e => setBrandingForm((f: any) => ({...f, support_email: e.target.value}))}
                    placeholder="support@school.com" className="bg-muted/50 border-border text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 block mb-1">Primary Color</label>
                  <div className="flex gap-2 items-center">
                    <input type="color" title="Primary color" value={brandingForm.primary_color || "#10b981"}
                      onChange={e => setBrandingForm((f: any) => ({...f, primary_color: e.target.value}))}
                      className="w-10 h-9 rounded border border-border bg-transparent cursor-pointer" />
                    <Input value={brandingForm.primary_color || "#10b981"} onChange={e => setBrandingForm((f: any) => ({...f, primary_color: e.target.value}))}
                      className="bg-muted/50 border-border text-sm font-mono flex-1" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 block mb-1">Accent Color</label>
                  <div className="flex gap-2 items-center">
                    <input type="color" title="Accent color" value={brandingForm.accent_color || "#3b82f6"}
                      onChange={e => setBrandingForm((f: any) => ({...f, accent_color: e.target.value}))}
                      className="w-10 h-9 rounded border border-border bg-transparent cursor-pointer" />
                    <Input value={brandingForm.accent_color || "#3b82f6"} onChange={e => setBrandingForm((f: any) => ({...f, accent_color: e.target.value}))}
                      className="bg-muted/50 border-border text-sm font-mono flex-1" />
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-slate-400 block mb-1">Logo URL</label>
                  <Input value={brandingForm.logo_url || ""} onChange={e => setBrandingForm((f: any) => ({...f, logo_url: e.target.value}))}
                    placeholder="https://school.com/logo.png" className="bg-muted/50 border-border text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-slate-400 block mb-1">Custom Domain</label>
                  <Input value={brandingForm.custom_domain || ""} onChange={e => setBrandingForm((f: any) => ({...f, custom_domain: e.target.value}))}
                    placeholder="portal.schoolname.com" className="bg-muted/50 border-border text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-slate-400 block mb-1">Footer Text</label>
                  <Input value={brandingForm.footer_text || ""} onChange={e => setBrandingForm((f: any) => ({...f, footer_text: e.target.value}))}
                    placeholder="© 2025 School Name. Powered by EduNextGen." className="bg-muted/50 border-border text-sm" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1 border-border" onClick={() => setBrandingSchool(null)}>Cancel</Button>
                <Button type="submit" disabled={savingBranding} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white">
                  {savingBranding ? "Saving..." : "💾 Save Branding"}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          MODAL — API Key Management
      ═══════════════════════════════════════════════════════════ */}
      {apiKeysSchool && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-yellow-500/30 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold text-white">🔑 API Keys</h2>
                <p className="text-slate-500 text-xs mt-0.5">{apiKeysSchool.name}</p>
              </div>
              <button type="button" title="Close API keys" onClick={() => { setApiKeysSchool(null); setGeneratedKey(null); }} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {generatedKey && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 mb-4">
                <p className="text-xs text-emerald-400 font-semibold mb-2">✅ New key generated — copy now, it won't be shown again!</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs text-white bg-muted rounded px-2 py-1.5 font-mono break-all">{generatedKey}</code>
                  <Button size="sm" type="button" variant="outline" className="border-emerald-500/30 text-emerald-400 h-8 text-xs"
                    onClick={() => { navigator.clipboard.writeText(generatedKey); toast.success("Copied!"); }}>
                    Copy
                  </Button>
                </div>
              </div>
            )}

            {/* Existing keys */}
            <div className="space-y-2 mb-5">
              {apiKeys.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No API keys yet.</p>
              ) : apiKeys.map(k => (
                <div key={k.id} className={`flex items-center justify-between p-3 rounded-lg border ${k.is_active ? "bg-muted/30 border-border" : "bg-muted/10 border-border/30 opacity-50"}`}>
                  <div>
                    <p className="text-sm font-medium text-white">{k.name}</p>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{k.key_preview}</p>
                    <div className="flex gap-2 mt-1">
                      {k.scopes?.map((scope: string) => (
                        <span key={scope} className="text-xs px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded">{scope}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs px-2 py-0.5 rounded ${k.is_active ? "text-emerald-400" : "text-slate-500"}`}>
                      {k.is_active ? "Active" : "Revoked"}
                    </span>
                    {k.is_active && (
                      <Button size="sm" type="button" variant="outline"
                        onClick={() => handleRevokeApiKey(k.id)}
                        className="h-6 text-xs px-2 border-red-500/30 text-red-400 hover:bg-red-500/10">
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Generate new key */}
            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-sm font-semibold text-slate-300">Generate New Key</p>
              <Input value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
                placeholder="Key name (e.g. Production Integration)" className="bg-muted/50 border-border" />
              <div>
                <label className="text-xs text-slate-400 block mb-1">Scopes</label>
                <div className="flex gap-2 flex-wrap">
                  {(["read","write","webhooks"] as const).map(scope => (
                    <button type="button" key={scope}
                      onClick={() => setNewKeyScopes(prev => prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope])}
                      className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                        newKeyScopes.includes(scope) ? "bg-blue-600 text-white border-blue-500" : "border-border text-slate-400"
                      }`}>{scope}</button>
                  ))}
                </div>
              </div>
              <Button type="button" onClick={handleGenerateApiKey} disabled={!newKeyName.trim()}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white">
                🔑 Generate Key
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
