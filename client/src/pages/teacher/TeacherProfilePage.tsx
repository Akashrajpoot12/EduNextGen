import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Save, Eye, EyeOff, User } from "lucide-react";

export function TeacherProfilePage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [profile, setProfile]   = useState({ name: "", email: "", phone: "", subject: "", qualification: "", department: "", joining_date: "" });
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [userId, setUserId]     = useState("");
  const [showPassForm, setShowPassForm] = useState(false);
  const [passwords, setPasswords] = useState({ current: "", newPass: "", confirm: "" });
  const [passError, setPassError]  = useState("");
  const [passSaved, setPassSaved]  = useState(false);
  const [showNew, setShowNew]      = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from("users").select("name, full_name, email, phone, subject, qualification, department, joining_date").eq("id", user.id).single();
      if (data) setProfile({
        name: data.name || data.full_name || "",
        email: data.email || user.email || "",
        phone: data.phone || "",
        subject: data.subject || "",
        qualification: data.qualification || "",
        department: data.department || "",
        joining_date: data.joining_date || "",
      });
    };
    load();
  }, [schoolId]);

  async function handleSave() {
    if (!userId) return;
    setSaving(true);
    await supabase.from("users").update({
      name: profile.name, full_name: profile.name, phone: profile.phone,
      subject: profile.subject, qualification: profile.qualification,
      department: profile.department, joining_date: profile.joining_date || null,
    }).eq("id", userId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleChangePassword() {
    setPassError("");
    if (!passwords.newPass || passwords.newPass !== passwords.confirm) {
      setPassError("New passwords do not match."); return;
    }
    if (passwords.newPass.length < 6) {
      setPassError("Password must be at least 6 characters."); return;
    }
    const { error } = await supabase.auth.updateUser({ password: passwords.newPass });
    if (error) { setPassError(error.message); return; }
    setPassSaved(true);
    setPasswords({ current: "", newPass: "", confirm: "" });
    setShowPassForm(false);
    setTimeout(() => setPassSaved(false), 3000);
  }

  const f = (k: string, v: string) => setProfile(p => ({ ...p, [k]: v }));

  return (
    <div className="max-w-2xl">
      <div className="page-header">
        <h1>My Profile</h1>
        <p>Update your personal details and change password</p>
      </div>

      {passSaved && <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-sm text-green-800">Password changed successfully!</div>}

      {/* Profile Card */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm mb-5">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl font-bold">
            {(profile.name || "T")[0].toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-lg">{profile.name || "Teacher"}</p>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
            {profile.subject && <span className="badge-green text-xs">{profile.subject}</span>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs text-muted-foreground block mb-1">Full Name</label>
            <input title="Full Name" value={profile.name} onChange={e => f("name", e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
          <div><label className="text-xs text-muted-foreground block mb-1">Phone</label>
            <input title="Phone" value={profile.phone} onChange={e => f("phone", e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
          <div><label className="text-xs text-muted-foreground block mb-1">Subject</label>
            <input title="Subject" value={profile.subject} onChange={e => f("subject", e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
          <div><label className="text-xs text-muted-foreground block mb-1">Qualification</label>
            <input title="Qualification" value={profile.qualification} onChange={e => f("qualification", e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
          <div><label className="text-xs text-muted-foreground block mb-1">Department</label>
            <input title="Department" value={profile.department} onChange={e => f("department", e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
          <div><label className="text-xs text-muted-foreground block mb-1">Joining Date</label>
            <input title="Joining Date" type="date" value={profile.joining_date} onChange={e => f("joining_date", e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
        </div>

        <button type="button" onClick={handleSave} disabled={saving}
          className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
          <Save className="w-4 h-4" />
          {saved ? "Saved!" : saving ? "Saving…" : "Save Profile"}
        </button>
      </div>

      {/* Change Password */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2"><User className="w-4 h-4" /> Change Password</h3>
          <button type="button" onClick={() => setShowPassForm(p => !p)}
            className="text-sm text-primary hover:underline">{showPassForm ? "Cancel" : "Change"}</button>
        </div>
        {!showPassForm && <p className="text-sm text-muted-foreground">Click "Change" to update your password.</p>}
        {showPassForm && (
          <div className="space-y-3">
            {passError && <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-sm text-red-700">{passError}</div>}
            <div><label className="text-xs text-muted-foreground block mb-1">New Password</label>
              <div className="relative">
                <input title="New Password" type={showNew ? "text" : "password"} value={passwords.newPass}
                  onChange={e => setPasswords(p => ({ ...p, newPass: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 pr-10 text-sm bg-background" />
                <button type="button" title="Toggle" onClick={() => setShowNew(p => !p)} className="absolute right-3 top-2.5 text-muted-foreground">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div><label className="text-xs text-muted-foreground block mb-1">Confirm Password</label>
              <input title="Confirm Password" type="password" value={passwords.confirm}
                onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
            <button type="button" onClick={handleChangePassword}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
              Update Password
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
