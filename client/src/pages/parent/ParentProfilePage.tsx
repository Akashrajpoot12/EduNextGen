import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { User, Mail, Phone, Users, GraduationCap } from "lucide-react";

export function ParentProfilePage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [children, setChildren] = useState<any[]>([]);

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from("users")
        .select("full_name, email")
        .eq("id", user.id)
        .maybeSingle();

      setProfile({ ...userProfile, email: userProfile?.email || user.email });

      const { data: kids } = await supabase
        .from("students")
        .select("id, enrollment_number, users:user_id(full_name), classes:class_id(grade_level, section)")
        .eq("school_id", schoolId)
        .eq("parent_user_id", user.id);

      setChildren(kids || []);
      setLoading(false);
    })();
  }, [schoolId]);

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "P";

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Your account details</p>
      </div>

      {/* Avatar */}
      <div className="bg-card border border-border rounded-xl p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
          {initials}
        </div>
        <div>
          <h2 className="text-xl font-bold">{profile?.full_name || "Parent"}</h2>
          <p className="text-sm text-muted-foreground">{profile?.email}</p>
          <span className="mt-1 inline-block text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-medium">Parent</span>
        </div>
      </div>

      {/* Account Details */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold flex items-center gap-2">
            <User className="w-4 h-4 text-amber-500" /> Account Details
          </h3>
        </div>
        <div className="divide-y divide-border">
          {[
            { icon: User, label: "Full Name", value: profile?.full_name || "—" },
            { icon: Mail, label: "Email Address", value: profile?.email || "—" },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-4 px-5 py-4">
              <item.icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="font-medium text-sm">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Linked Children */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-500" /> Linked Children
          </h3>
        </div>
        {children.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            No children linked. Contact school admin to link your child's profile.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {children.map(c => (
              <div key={c.id} className="flex items-center gap-4 px-5 py-4">
                <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center font-bold text-amber-600 text-sm">
                  {((c.users as any)?.full_name || "?")[0]}
                </div>
                <div>
                  <p className="font-medium text-sm">{(c.users as any)?.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Class {(c.classes as any)?.grade_level} - {(c.classes as any)?.section}
                    {c.enrollment_number ? ` · ${c.enrollment_number}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        To update your profile details, please contact the school administration.
      </p>
    </div>
  );
}
