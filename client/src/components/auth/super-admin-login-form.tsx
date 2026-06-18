"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useNavigate } from "react-router-dom"
import { ShieldCheck } from "lucide-react"

export function SuperAdminLoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  
  const navigate = useNavigate()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
      setIsLoading(false)
      return
    }

    const userId = authData.user?.id;
    if (userId) {
      try {
        // Strict fallback: check if global super_admin
        const { data: superAdminRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('role', 'super_admin')
          .limit(1)
          .maybeSingle();

        if (superAdminRole) {
          navigate('/super-admin');
          setIsLoading(false);
          return;
        }

      } catch (err) {
        console.error("Error detecting super admin role:", err);
      }
    }

    await supabase.auth.signOut();
    setError("Unauthorized Access. This portal is strictly for global administrators.");
    setIsLoading(false);
  }

  return (
    <Card className="w-[400px] border-emerald-500/20 shadow-2xl shadow-emerald-500/10">
      <CardHeader className="text-center">
        <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
        <CardTitle className="text-2xl font-bold tracking-tight">Super Admin Portal</CardTitle>
        <CardDescription>EduNextGen SaaS Operations Center</CardDescription>
      </CardHeader>
      <form onSubmit={handleLogin}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Administrator Email</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="admin@edunextgen.com" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Secure Password</Label>
            <Input 
              id="password" 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <div className="text-sm text-red-500 font-medium bg-red-50 p-2 rounded">{error}</div>}
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" type="submit" disabled={isLoading}>
            {isLoading ? "Authenticating..." : "Authorize"}
          </Button>
          {import.meta.env.DEV && (
          <div className="text-sm text-center text-slate-500 w-full mt-2">
            Local Demo Setup? <br/>
            <button
              type="button"
              className="text-emerald-500 font-bold hover:underline mt-1"
              onClick={async () => {
                if(!email || !password) {
                  setError("Enter email & password to initialize Super Admin.");
                  return;
                }
                setIsLoading(true);
                // Sign up the auth user
                const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
                if (signUpError) {
                  setError(signUpError.message);
                  setIsLoading(false);
                  return;
                }
                
                // Add to public users and user_roles
                if (data.user) {
                  const { data: pUser, error: pUserError } = await supabase.from('users').insert({
                    id: data.user.id,
                    email: email,
                    full_name: 'Global Administrator'
                  }).select('id').single();
                  
                  if (pUserError) {
                     // If it's a duplicate, it's fine, we can try to just insert the role
                     console.log("User might exist in public.users:", pUserError);
                  }
                  
                  const targetUserId = pUser?.id || data.user.id;

                  const { error: roleError } = await supabase.from('user_roles').insert({
                    user_id: targetUserId,
                    role: 'super_admin'
                  });

                  if (roleError) {
                     setError("Role assignment failed: " + roleError.message);
                  } else {
                     setError("Super Admin initialized! Please click 'Authorize' to login.");
                  }
                } else {
                  setError("Signup succeeded but no user data returned. Check if email confirmation is required in your Supabase dashboard.");
                }
                setIsLoading(false);
              }}
            >
              Initialize Super Admin
            </button>
          </div>
          )}
        </CardFooter>
      </form>
    </Card>
  )
}
