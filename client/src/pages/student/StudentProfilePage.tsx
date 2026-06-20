// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, User, GraduationCap, Mail, Hash, BookOpen, Calendar } from "lucide-react";

export function StudentProfilePage() {
  const params = useParams();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => { fetchProfile(); }, []);

  async function fetchProfile() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: authUser } = await supabase
        .from("users")
        .select("full_name, email")
        .eq("id", user.id)
        .maybeSingle();

      const { data: student } = await supabase
        .from("students")
        .select(`
          first_name, last_name, enrollment_number,
          class:class_id(grade_level, section),
          school:school_id(name)
        `)
        .eq("user_id", user.id)
        .maybeSingle();

      setProfile({ user, authUser, student });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const fullName = profile?.student
    ? `${profile.student.first_name} ${profile.student.last_name}`
    : profile?.authUser?.full_name || profile?.user?.email?.split("@")[0] || "Student";

  const initials = fullName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  const infoItems = profile ? [
    { icon: Mail,        label: "Email",             value: profile.user?.email },
    { icon: Hash,        label: "Enrollment No.",    value: profile.student?.enrollment_number || "—" },
    { icon: GraduationCap, label: "Class",           value: profile.student?.class ? `Class ${profile.student.class.grade_level}${profile.student.class.section ? " - " + profile.student.class.section : ""}` : "—" },
    { icon: BookOpen,    label: "School",            value: profile.student?.school?.name || "—" },
    { icon: Calendar,    label: "Academic Year",     value: "2025 – 2026" },
  ] : [];

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">My Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Your personal and academic information.</p>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500/50" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Avatar card */}
          <Card className="bg-card border-border shadow-xl">
            <CardContent className="p-8 flex flex-col sm:flex-row items-center gap-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-3xl font-bold text-foreground shadow-lg shadow-purple-500/30 flex-shrink-0">
                {initials}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">{fullName}</h2>
                <p className="text-purple-400 font-medium mt-1">
                  {profile?.student?.class
                    ? `Class ${profile.student.class.grade_level}${profile.student.class.section ? " – Sec " + profile.student.class.section : ""}`
                    : "Student"}
                </p>
                <p className="text-muted-foreground text-sm mt-1">{profile?.student?.school?.name}</p>
              </div>
            </CardContent>
          </Card>

          {/* Info card */}
          <Card className="bg-card border-border shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-foreground text-lg flex items-center gap-2">
                <User className="w-5 h-5 text-purple-400" /> Account Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-2 space-y-0">
              {infoItems.map((item, i) => (
                <div key={i} className={`flex items-center gap-4 py-3.5 ${i < infoItems.length - 1 ? "border-b border-border/50" : ""}`}>
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{item.label}</p>
                    <p className="text-sm text-foreground font-medium mt-0.5">{item.value}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Notice */}
          <Card className="bg-amber-500/5 border-amber-500/20">
            <CardContent className="p-4 text-sm text-amber-300/80">
              To update your personal information (phone, address, guardian details), please contact your school administrator.
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
