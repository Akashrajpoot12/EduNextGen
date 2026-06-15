"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2, School, GraduationCap, Users, UserSquare, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

export default function TenantLoginPage() {
  const params = useParams();
  const tenant = params.tenant as string;
  const router = useRouter();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<"student" | "parent" | "teacher" | "admin">("admin");

  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const toastId = toast.loading("Verifying credentials...");

    try {
      // 1. Authenticate with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // 2. Fetch User Role & Tenant Verification
      // In a real production scenario, we verify that this user actually belongs to 'tenant'
      // and get their correct role from the `user_roles` table.
      
      // For this demo, we trust the role they selected on the UI or mock it.
      // We will route them based on the selected role to show the functionality.
      
      toast.success("Login Successful!", { id: toastId });
      
      // Redirect to specific portal
      if (role === "admin") router.push(`/${tenant}/admin`);
      else if (role === "teacher") router.push(`/${tenant}/teacher`);
      else if (role === "student") router.push(`/${tenant}/student`);
      else if (role === "parent") router.push(`/${tenant}/parent`);
      
    } catch (error: any) {
      toast.error(error.message || "Invalid credentials", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { id: "admin", label: "Admin", icon: ShieldCheck },
    { id: "teacher", label: "Teacher", icon: UserSquare },
    { id: "student", label: "Student", icon: GraduationCap },
    { id: "parent", label: "Parent", icon: Users },
  ];

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-500/20 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/20 blur-[120px]" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md z-10 px-4"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-card border border-border shadow-xl rounded-2xl flex items-center justify-center mx-auto mb-4">
            <School className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-3xl font-bold text-foreground capitalize">{tenant} Portal</h1>
          <p className="text-muted-foreground mt-2">Sign in to your school management account</p>
        </div>

        <Card className="bg-card/50 backdrop-blur-xl border-border shadow-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-center">Select your role</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2 mb-6">
              {roles.map((r) => {
                const Icon = r.icon;
                const isActive = role === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setRole(r.id as any)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                      isActive 
                        ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-600 dark:text-emerald-400" 
                        : "bg-background border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="w-5 h-5 mb-1" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{r.label}</span>
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="name@school.edu" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-background border-border focus-visible:ring-emerald-500"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password">Password</Label>
                  <a href="#" className="text-xs text-emerald-500 hover:underline">Forgot password?</a>
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-background border-border focus-visible:ring-emerald-500"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white mt-4"
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Sign In to Portal"}
              </Button>
            </form>

            <div className="mt-6 text-center text-xs text-muted-foreground">
              Powered by <span className="font-bold text-foreground">Blueate SMS</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
