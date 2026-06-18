import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle2, Eye, EyeOff, ShieldCheck, AlertTriangle } from "lucide-react";

const supabase = createClient();

export default function SetupPage() {
  const [params] = useSearchParams();
  const navigate  = useNavigate();

  const token     = params.get("token");
  const subdomain = params.get("subdomain");

  const [school, setSchool]       = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [tokenErr, setTokenErr]   = useState("");

  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [saving, setSaving]       = useState(false);
  const [done, setDone]           = useState(false);

  // ── Verify invite token ───────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !subdomain) {
      setTokenErr("Invalid setup link. Please contact your administrator.");
      setLoading(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("id, name, subdomain, admin_email, admin_name, invite_token, invite_expires_at, setup_completed")
        .eq("subdomain", subdomain)
        .eq("invite_token", token)
        .maybeSingle();

      if (error || !data) {
        setTokenErr("Setup link is invalid or has expired. Please contact your administrator.");
      } else if (data.setup_completed) {
        setTokenErr("Account setup is already complete. Please login to your school portal.");
      } else if (data.invite_expires_at && new Date(data.invite_expires_at) < new Date()) {
        setTokenErr("Setup link has expired (7-day limit). Please contact your administrator for a new link.");
      } else {
        setSchool(data);
      }
      setLoading(false);
    })();
  }, [token, subdomain]);

  // ── Set Password ──────────────────────────────────────────────────────────
  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }

    setSaving(true);
    const toastId = toast.loading("Setting up your account...");

    try {
      // Sign up (or sign in if already exists) with the admin email
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email:    school.admin_email,
        password,
        options:  { data: { full_name: school.admin_name || "School Admin" } },
      });

      if (signUpErr) {
        // If user already exists, try updating password via admin (limited in anon context)
        // Ask them to use forgot password on login page instead
        if (signUpErr.message?.includes("already registered")) {
          toast.error("Account already exists. Please use 'Forgot Password' on your login page.", { id: toastId });
          setSaving(false);
          return;
        }
        throw signUpErr;
      }

      // Mark setup completed in schools table
      await supabase.from("schools").update({
        setup_completed:    true,
        setup_completed_at: new Date().toISOString(),
        invite_token:       null,       // invalidate token
      }).eq("id", school.id);

      toast.success("Account setup complete! Redirecting to your portal...", { id: toastId, duration: 3000 });
      setDone(true);

      setTimeout(() => navigate(`/${subdomain}/login`), 3000);
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Verifying your setup link...</p>
        </div>
      </div>
    );
  }

  if (tokenErr) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-red-500/30 bg-card">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
            <h2 className="text-xl font-bold text-red-400">Invalid Setup Link</h2>
            <p className="text-slate-400 text-sm">{tokenErr}</p>
            <Button variant="outline" className="border-border" onClick={() => navigate("/")}>
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-emerald-500/30 bg-card">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto" />
            <h2 className="text-2xl font-bold text-white">All Done!</h2>
            <p className="text-slate-400">Your account is ready. Redirecting to your school portal...</p>
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-500/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />

      <Card className="w-full max-w-md border-border bg-card z-10 shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-7 h-7 text-emerald-400" />
          </div>
          <CardTitle className="text-2xl font-bold">Welcome to EduNextGen</CardTitle>
          <CardDescription className="text-slate-400">
            Set your password for <span className="text-emerald-400 font-semibold">{school?.name}</span>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {/* School info badge */}
          <div className="bg-muted/50 border border-border rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">School</span>
              <span className="text-white font-medium">{school?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Admin Email</span>
              <span className="text-emerald-400">{school?.admin_email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Portal URL</span>
              <span className="text-blue-400 text-xs">{window.location.origin}/{subdomain}/login</span>
            </div>
          </div>

          <form onSubmit={handleSetup} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300">New Password</label>
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="bg-muted/50 border-border pr-10"
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300">Confirm Password</label>
              <Input
                type="password"
                placeholder="Repeat your password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                minLength={8}
                className={`bg-muted/50 border-border ${confirm && confirm !== password ? "border-red-500/50" : ""}`}
              />
              {confirm && confirm !== password && (
                <p className="text-red-400 text-xs mt-1">Passwords do not match</p>
              )}
            </div>

            <Button type="submit" disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-11">
              {saving ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> Setting up...</>
              ) : (
                <><CheckCircle2 className="w-4 h-4 mr-2" /> Complete Setup & Login</>
              )}
            </Button>
          </form>

          <p className="text-center text-slate-500 text-xs">
            Already set up?{" "}
            <a href={`/${subdomain}/login`} className="text-emerald-400 hover:underline">
              Login to your portal
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
