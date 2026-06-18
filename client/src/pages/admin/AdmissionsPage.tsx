import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Copy, Check, X } from "lucide-react";

type AdmissionApplication = {
  id: string;
  school_id: string;
  student_name: string;
  date_of_birth: string;
  gender: string;
  applying_for_class: string;
  father_name: string;
  mother_name: string;
  parent_phone: string;
  parent_email: string;
  address: string;
  previous_school: string;
  status: string;
  interview_date: string;
  notes: string;
  academic_year: string;
  applied_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  called: "bg-blue-100 text-blue-700",
  admitted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export function AdmissionsPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();
  const [applications, setApplications] = useState<AdmissionApplication[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedApp, setSelectedApp] = useState<AdmissionApplication | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [detailForm, setDetailForm] = useState({ status: "", interview_date: "", notes: "" });
  const [activeTab, setActiveTab] = useState<"applications" | "link">("applications");

  async function fetchApplications() {
    let query = supabase.from("admission_applications").select("*").eq("school_id", schoolId).order("applied_at", { ascending: false });
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    const { data } = await query;
    setApplications(data || []);
  }

  useEffect(() => { if (schoolId) fetchApplications(); }, [schoolId, statusFilter]);

  function openDetail(app: AdmissionApplication) {
    setSelectedApp(app);
    setDetailForm({ status: app.status, interview_date: app.interview_date || "", notes: app.notes || "" });
    setShowDetail(true);
  }

  async function handleSaveDetail() {
    if (!selectedApp) return;
    setLoading(true);
    await supabase.from("admission_applications").update(detailForm).eq("id", selectedApp.id);
    setLoading(false);
    setShowDetail(false);
    fetchApplications();
  }

  function copyLink() {
    const url = `${window.location.origin}/admission/${schoolId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/admission/${schoolId}`;

  const counts = { pending: 0, called: 0, admitted: 0, rejected: 0 };
  applications.forEach((a) => { if (a.status in counts) counts[a.status as keyof typeof counts]++; });

  return (
    <div>
      <div className="page-header"><h1>Admissions</h1><p>Manage admission applications and public form link</p></div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {(Object.entries(counts) as [string, number][]).map(([status, count]) => {
          const colors: Record<string, string> = { pending: "card-accent-yellow", called: "card-accent-blue", admitted: "card-accent-green", rejected: "card-accent-red" };
          return (
            <div key={status} className={`bg-card rounded-xl p-4 border border-border shadow-sm ${colors[status] || ""}`}>
              <p className="text-xs text-muted-foreground capitalize">{status}</p>
              <p className="text-2xl font-bold mt-1">{count.toLocaleString("en-IN")}</p>
            </div>
          );
        })}
      </div>

      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 mb-6 w-fit">
        {(["applications", "link"] as const).map(t => (
          <button key={t} type="button" onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {t === "applications" ? "Applications" : "Public Form Link"}
          </button>
        ))}
      </div>

      {activeTab === "applications" && (
        <div>
          <div className="mb-4">
            <select title="Filter by status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="called">Called</option>
              <option value="admitted">Admitted</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            <table className="w-full edu-table">
              <thead><tr><th>Student Name</th><th>Class Applied</th><th>Parent Phone</th><th>Email</th><th>Applied On</th><th>Status</th></tr></thead>
              <tbody>
                {applications.length === 0 && <tr><td colSpan={6} className="text-center text-muted-foreground py-10">No applications found.</td></tr>}
                {applications.map(app => {
                  const sc: Record<string, string> = { pending: "badge-yellow", called: "badge-blue", admitted: "badge-green", rejected: "badge-red" };
                  return (
                    <tr key={app.id} className="cursor-pointer" onClick={() => openDetail(app)}>
                      <td className="font-medium">{app.student_name}</td>
                      <td>{app.applying_for_class}</td>
                      <td>{app.parent_phone}</td>
                      <td className="text-muted-foreground">{app.parent_email || "—"}</td>
                      <td className="text-sm">{app.applied_at ? new Date(app.applied_at).toLocaleDateString("en-IN") : "—"}</td>
                      <td><span className={sc[app.status] || "badge-gray"}>{app.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "link" && (
        <div className="bg-card rounded-xl border border-border p-6 max-w-2xl shadow-sm">
          <h2 className="font-bold text-base mb-1">Public Admission Form Link</h2>
          <p className="text-sm text-muted-foreground mb-4">Share this link with parents to submit online admission applications. Applications appear as "Pending" in the Applications tab.</p>
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border mb-4">
            <span className="text-sm flex-1 truncate text-foreground">{publicUrl}</span>
            <button type="button" onClick={copyLink} className="flex items-center gap-1.5 text-xs border border-border px-3 py-1.5 rounded-lg hover:bg-muted">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Form collects: student name, DOB, gender, class applying for, parent details, address, and previous school.</p>
        </div>
      )}

      {showDetail && selectedApp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Application — {selectedApp.student_name}</h2>
              <button type="button" title="Close" onClick={() => setShowDetail(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4 bg-muted/30 rounded-xl p-4">
              {[
                ["Date of Birth", selectedApp.date_of_birth || "—"],
                ["Gender", selectedApp.gender || "—"],
                ["Class Applied", selectedApp.applying_for_class],
                ["Academic Year", selectedApp.academic_year || "—"],
                ["Father Name", selectedApp.father_name || "—"],
                ["Mother Name", selectedApp.mother_name || "—"],
                ["Parent Phone", selectedApp.parent_phone],
                ["Parent Email", selectedApp.parent_email || "—"],
              ].map(([k, v]) => (
                <div key={k}><span className="text-muted-foreground">{k}:</span> <span className="font-medium ml-1">{v}</span></div>
              ))}
              <div className="col-span-2"><span className="text-muted-foreground">Address:</span> <span className="font-medium ml-1">{selectedApp.address || "—"}</span></div>
              <div className="col-span-2"><span className="text-muted-foreground">Previous School:</span> <span className="font-medium ml-1">{selectedApp.previous_school || "—"}</span></div>
            </div>
            <div className="space-y-3 border-t border-border pt-4">
              <div><label className="text-xs text-muted-foreground block mb-1">Update Status</label>
                <select title="Update status" value={detailForm.status} onChange={e => setDetailForm({ ...detailForm, status: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                  <option value="pending">Pending</option>
                  <option value="called">Called for Interview</option>
                  <option value="admitted">Admitted</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div><label className="text-xs text-muted-foreground block mb-1">Interview Date</label><input type="date" title="Interview date" value={detailForm.interview_date} onChange={e => setDetailForm({ ...detailForm, interview_date: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              <input value={detailForm.notes} onChange={e => setDetailForm({ ...detailForm, notes: e.target.value })} placeholder="Notes about this application" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
            </div>
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setShowDetail(false)} className="flex-1 py-2 border border-border rounded-lg text-sm">Close</button>
              <button type="button" onClick={handleSaveDetail} disabled={loading} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">{loading ? "Saving…" : "Save Changes"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
