// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Camera, Mail, User, Shield, School, BookOpen, Phone, Calendar, CheckCircle, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

export function AccountSettingsPage() {
  const supabase = createClient();
  const { tenantId: schoolId, role } = useTenant();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [authUser, setAuthUser]     = useState<any>(null);
  const [profileRow, setProfileRow] = useState<any>(null); // students / teachers / users row
  const [avatarUrl, setAvatarUrl]   = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => { load(); }, [schoolId]);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setAuthUser(user);

    // Try avatar from user_metadata first
    if (user.user_metadata?.avatar_url) setAvatarUrl(user.user_metadata.avatar_url);

    // Fetch role-specific profile row
    if (role === "student") {
      const { data } = await supabase
        .from("students")
        .select("id, first_name, last_name, roll_number, class_id, phone, avatar_url, classes(name)")
        .eq("user_id", user.id)
        .maybeSingle();
      setProfileRow(data);
      if (data?.avatar_url) setAvatarUrl(data.avatar_url);
      setDisplayName(`${data?.first_name || ""} ${data?.last_name || ""}`.trim() || user.email);
    } else if (role === "teacher") {
      const { data } = await supabase
        .from("users")
        .select("id, full_name, phone, subject, avatar_url, joining_date")
        .eq("id", user.id)
        .maybeSingle();
      setProfileRow(data);
      if (data?.avatar_url) setAvatarUrl(data.avatar_url);
      setDisplayName(data?.full_name || user.email);
    } else if (role === "parent") {
      const { data } = await supabase
        .from("users")
        .select("id, full_name, phone, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      setProfileRow(data);
      if (data?.avatar_url) setAvatarUrl(data.avatar_url);
      setDisplayName(data?.full_name || user.email);
    } else {
      // admin / staff
      const { data } = await supabase
        .from("users")
        .select("full_name, phone, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      setProfileRow(data);
      if (data?.avatar_url) setAvatarUrl(data.avatar_url);
      setDisplayName(data?.full_name || user.email);
    }
    setLoading(false);
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !authUser) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Photo must be under 2MB"); return; }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `avatars/${authUser.id}.${ext}`;

      // Upload to Supabase Storage (bucket: avatars)
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(publicUrl);

      // Update the profile row. Students live in `students` (keyed by user_id);
      // everyone else (teacher/parent/admin/staff) lives in `users` (keyed by id).
      const table = role === "student" ? "students" : "users";
      const idCol = role === "student" ? "user_id" : "id";
      await supabase.from(table).update({ avatar_url: publicUrl }).eq(idCol, authUser.id);

      toast.success("Profile photo updated!");
    } catch {
      toast.error("Failed to upload photo. Make sure 'avatars' storage bucket exists.");
    }
    setUploading(false);
  }

  const initials = displayName
    ? displayName.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()
    : "U";

  const roleLabel: Record<string, string> = {
    student: "Student", teacher: "Teacher", parent: "Parent",
    admin: "Admin", school_admin: "Admin", staff: "Staff",
  };
  const roleColor: Record<string, string> = {
    student: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    teacher: "bg-violet-500/15 text-violet-400 border-violet-500/30",
    parent:  "bg-orange-500/15 text-orange-400 border-orange-500/30",
    admin:   "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30",
    school_admin: "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30",
    staff:   "bg-blue-500/15 text-blue-400 border-blue-500/30",
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="page-header">
        <h1>Account Settings</h1>
        <p>View your profile information</p>
      </div>

      {/* Photo + name card */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-gradient-to-br from-fuchsia-500 to-purple-700 flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-fuchsia-500/20">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : initials}
            </div>
            {/* Camera button */}
            <button
              type="button"
              title="Change photo"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </div>

          {/* Name + role */}
          <div className="text-center sm:text-left">
            <h2 className="text-2xl font-bold text-foreground">{displayName}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{authUser?.email}</p>
            <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${roleColor[role] || roleColor.admin}`}>
              {roleLabel[role] || role}
            </span>
            <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1 justify-center sm:justify-start">
              <Camera className="w-3 h-3" /> Click the camera icon to update your photo
            </p>
          </div>
        </div>
      </div>

      {/* Info fields */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-foreground mb-4">Profile Information</h3>

        <InfoRow icon={Mail} label="Email" value={authUser?.email} />

        {role === "student" && profileRow && <>
          <InfoRow icon={User} label="Full Name" value={`${profileRow.first_name || ""} ${profileRow.last_name || ""}`.trim()} />
          <InfoRow icon={BookOpen} label="Class" value={profileRow.classes?.name} />
          <InfoRow icon={Hash} label="Roll Number" value={profileRow.roll_number} />
          <InfoRow icon={Phone} label="Phone" value={profileRow.phone} />
        </>}

        {role === "teacher" && profileRow && <>
          <InfoRow icon={User} label="Full Name" value={profileRow.full_name} />
          <InfoRow icon={BookOpen} label="Subject" value={profileRow.subject} />
          <InfoRow icon={Phone} label="Phone" value={profileRow.phone} />
          <InfoRow icon={Calendar} label="Joining Date" value={profileRow.joining_date ? new Date(profileRow.joining_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : null} />
        </>}

        {role === "parent" && profileRow && <>
          <InfoRow icon={User} label="Full Name" value={profileRow.full_name} />
          <InfoRow icon={Phone} label="Phone" value={profileRow.phone} />
        </>}

        {(role === "admin" || role === "school_admin" || role === "staff") && profileRow && <>
          <InfoRow icon={User} label="Full Name" value={profileRow.full_name} />
          <InfoRow icon={Phone} label="Phone" value={profileRow.phone} />
        </>}

        <InfoRow icon={Shield} label="Role" value={roleLabel[role] || role} />
      </div>

      {/* Password info */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 flex items-start gap-4">
        <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Lock className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Password managed by administrator</p>
          <p className="text-xs text-muted-foreground mt-1">
            Your login password is set and managed by your school admin or super admin.
            Contact them if you need a password reset.
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
      <CheckCircle className="w-4 h-4 text-green-500/60 flex-shrink-0" />
    </div>
  );
}
