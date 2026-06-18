import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Plus, X, Search, UserSquare2, Mail, Phone, Copy, Eye, EyeOff, Trash2 } from "lucide-react";

type Staff = {
  id: string; name: string; email: string; phone?: string;
  role: string; department?: string; qualification?: string; joining_date?: string;
};

const ROLES      = ["staff", "school_admin"];
const DEPARTMENTS = ["Administration", "Accounts", "Library", "Lab", "Sports", "Transport", "Housekeeping", "Security", "Other"];

const EMPTY = {
  name: "", email: "", phone: "", role: "staff",
  department: "", qualification: "", joining_date: "", tempPassword: "",
};

function genPassword() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#";
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function StaffPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [staffList, setStaffList]     = useState<Staff[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [form, setForm]               = useState({ ...EMPTY, tempPassword: genPassword() });
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");
  const [search, setSearch]           = useState("");
  const [showPass, setShowPass]       = useState(false);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);

  async function fetchStaff() {
    setLoading(true);
    const { data } = await supabase
      .from("users")
      .select("id, name, email, phone, role, department, qualification, joining_date")
      .eq("school_id", schoolId)
      .in("role", ["staff", "school_admin"])
      .order("name");
    setStaffList(data || []);
    setLoading(false);
  }

  useEffect(() => { if (schoolId) fetchStaff(); }, [schoolId]);

  async function handleAdd() {
    if (!form.name || !form.email || !form.tempPassword) {
      setError("Name, email aur password required hai."); return;
    }
    setSaving(true);
    setError("");
    try {
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.tempPassword,
        options: { data: { full_name: form.name } },
      });
      if (authErr) throw new Error(authErr.message);
      if (!authData.user) throw new Error("User creation failed.");

      const uid = authData.user.id;

      const { error: uErr } = await supabase.from("users").upsert({
        id: uid, email: form.email, full_name: form.name, name: form.name,
        school_id: schoolId, role: form.role,
        phone: form.phone || null, department: form.department || null,
        qualification: form.qualification || null, joining_date: form.joining_date || null,
      }, { onConflict: "id" });
      if (uErr) throw new Error(uErr.message);

      await supabase.from("user_roles").upsert(
        { user_id: uid, school_id: schoolId, role: form.role },
        { onConflict: "user_id,school_id,role" }
      );

      setCreatedCreds({ email: form.email, password: form.tempPassword });
      setShowForm(false);
      setForm({ ...EMPTY, tempPassword: genPassword() });
      fetchStaff();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this staff member?")) return;
    await supabase.from("users").delete().eq("id", id);
    fetchStaff();
  }

  const filtered = staffList.filter(s =>
    !search || s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase()) ||
    s.department?.toLowerCase().includes(search.toLowerCase())
  );

  const ROLE_BADGE: Record<string, string> = { staff: "badge-blue", school_admin: "badge-purple" };
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Staff Directory</h1>
          <p>Non-teaching staff — accounts, administration, security, lab assistants</p>
        </div>
        <button type="button"
          onClick={() => { setForm({ ...EMPTY, tempPassword: genPassword() }); setError(""); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" /> Add Staff
        </button>
      </div>

      {createdCreds && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-5 flex items-start justify-between">
          <div>
            <p className="font-semibold text-green-800 text-sm">Staff account created!</p>
            <div className="mt-2 font-mono text-sm bg-white border border-green-200 rounded-lg px-3 py-2 inline-block">
              <span className="text-gray-600">Email:</span> <strong>{createdCreds.email}</strong><br />
              <span className="text-gray-600">Password:</span> <strong>{createdCreds.password}</strong>
            </div>
            <button type="button"
              onClick={() => navigator.clipboard.writeText(`Email: ${createdCreds.email}\nPassword: ${createdCreds.password}`)}
              className="ml-3 text-xs text-green-700 underline flex items-center gap-1 mt-1">
              <Copy className="w-3 h-3" /> Copy
            </button>
          </div>
          <button type="button" title="Dismiss" onClick={() => setCreatedCreds(null)}><X className="w-4 h-4 text-green-600" /></button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-blue">
          <div className="flex items-center gap-2"><UserSquare2 className="w-4 h-4 text-blue-500" /><p className="text-xs text-muted-foreground">Total Staff</p></div>
          <p className="text-2xl font-bold">{staffList.length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-purple">
          <p className="text-xs text-muted-foreground">Admins</p>
          <p className="text-2xl font-bold">{staffList.filter(s => s.role === "school_admin").length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-green">
          <p className="text-xs text-muted-foreground">Departments</p>
          <p className="text-2xl font-bold">{new Set(staffList.map(s => s.department).filter(Boolean)).size}</p>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
        <input title="Search staff" placeholder="Search by name, email, department…" value={search} onChange={e => setSearch(e.target.value)}
          className="pl-9 pr-4 py-2 border border-border rounded-lg text-sm bg-background w-80" />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full edu-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Phone</th><th>Actions</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Loading…</td></tr>}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No staff found. Click "Add Staff" to add one.</td></tr>
            )}
            {filtered.map(s => (
              <tr key={s.id}>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {(s.name || "?")[0].toUpperCase()}
                    </div>
                    <span className="font-medium">{s.name}</span>
                  </div>
                </td>
                <td><div className="flex items-center gap-1 text-sm text-muted-foreground"><Mail className="w-3.5 h-3.5" />{s.email}</div></td>
                <td><span className={`${ROLE_BADGE[s.role] || "badge-gray"} text-xs capitalize`}>{s.role.replace("_", " ")}</span></td>
                <td className="text-sm">{s.department || "—"}</td>
                <td className="text-sm">{s.phone ? <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{s.phone}</span> : "—"}</td>
                <td>
                  <button type="button" title="Delete staff" onClick={() => handleDelete(s.id)}
                    className="text-red-400 hover:text-red-600 p-1 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">Add New Staff Member</h2>
              <button type="button" title="Close" onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>

            {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">{error}</div>}

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Full Name *</label>
                  <input title="Full Name" placeholder="Ramesh Kumar" value={form.name} onChange={e => f("name", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Email *</label>
                  <input title="Email" type="email" placeholder="staff@school.edu" value={form.email} onChange={e => f("email", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              </div>

              <div><label className="text-xs text-muted-foreground block mb-1">Temporary Password *</label>
                <div className="relative">
                  <input title="Temporary Password" placeholder="Auto-generated" type={showPass ? "text" : "password"} value={form.tempPassword} onChange={e => f("tempPassword", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 pr-10 text-sm bg-background font-mono" />
                  <button type="button" title={showPass ? "Hide password" : "Show password"} onClick={() => setShowPass(p => !p)} className="absolute right-3 top-2.5 text-muted-foreground">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Role</label>
                  <select title="Role" value={form.role} onChange={e => f("role", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                    {ROLES.map(r => <option key={r} value={r}>{r === "school_admin" ? "Admin" : "Staff"}</option>)}
                  </select></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Department</label>
                  <select title="Department" value={form.department} onChange={e => f("department", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                    <option value="">— Select —</option>
                    {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                  </select></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Phone</label>
                  <input title="Phone" placeholder="9876543210" value={form.phone} onChange={e => f("phone", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Joining Date</label>
                  <input title="Joining Date" type="date" value={form.joining_date} onChange={e => f("joining_date", e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              </div>

              <div><label className="text-xs text-muted-foreground block mb-1">Qualification</label>
                <input title="Qualification" placeholder="B.Com, M.A., ITI…" value={form.qualification} onChange={e => f("qualification", e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
            </div>

            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-border rounded-lg text-sm">Cancel</button>
              <button type="button" onClick={handleAdd} disabled={saving || !form.name || !form.email}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {saving ? "Creating…" : "Create Staff Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
