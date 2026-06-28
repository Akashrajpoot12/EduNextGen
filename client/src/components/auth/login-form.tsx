"use client"

import { useState } from "react"
// Removed useRouter
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useNavigate, useParams } from "react-router-dom"

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  
  const navigate = useNavigate()
  const params = useParams()
  const supabase = createClient()
  const tenantId = "mock-uuid-for-" + (params.tenantId as string) // Read tenant from React Router URL

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
        // 1. Resolve school from subdomain (maybeSingle to avoid throwing)
        const { data: school } = await supabase
          .from('schools')
          .select('id')
          .eq('subdomain', params.tenantId)
          .maybeSingle();

        if (school) {
          // 2. Try user_roles with auth UID directly
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', userId)
            .eq('school_id', school.id)
            .limit(1)
            .maybeSingle();

          if (roleData) {
            redirectByRole(roleData.role);
            setIsLoading(false);
            return;
          }

          // 3. Fallback: check users table by email (handles pre-provisioned accounts
          //    where user_roles was inserted with a different UUID before auth signup)
          const { data: publicUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .maybeSingle();

          if (publicUser && publicUser.id !== userId) {
            const { data: roleData2 } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', publicUser.id)
              .eq('school_id', school.id)
              .limit(1)
              .maybeSingle();

            if (roleData2) {
              redirectByRole(roleData2.role);
              setIsLoading(false);
              return;
            }
          }

          // 4. Fallback: check students table directly (bypasses user_roles UUID mismatch)
          const { data: studentRec } = await supabase
            .from('students')
            .select('user_id')
            .eq('user_id', userId)
            .maybeSingle();

          if (studentRec) {
            navigate(`/${params.tenantId}/student`);
            setIsLoading(false);
            return;
          }

          // 5. Fallback: check users table for a teacher/staff role
          const { data: teacherRec } = await supabase
            .from('users')
            .select('id')
            .eq('id', userId)
            .in('role', ['teacher', 'staff'])
            .maybeSingle();

          if (teacherRec) {
            navigate(`/${params.tenantId}/teacher`);
            setIsLoading(false);
            return;
          }
        }

        // 6. Check super_admin
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
        console.error("Error detecting user role:", err);
      }
    }

    setError("Invalid school portal or unauthorized access. Please check the URL.");
    setIsLoading(false);

    function redirectByRole(role: string) {
      if (role === 'school_admin' || role === 'admin' || role === 'staff') {
        navigate(`/${params.tenantId}/admin`);
      } else if (role === 'teacher') {
        navigate(`/${params.tenantId}/teacher`);
      } else if (role === 'student') {
        navigate(`/${params.tenantId}/student`);
      } else if (role === 'parent') {
        navigate(`/${params.tenantId}/parent`);
      } else {
        navigate(`/${params.tenantId}/admin`);
      }
    }
  }

  return (
    <Card className="w-[400px]">
      <CardHeader>
        <CardTitle>Welcome Back</CardTitle>
        <CardDescription>Enter your credentials to access your portal</CardDescription>
      </CardHeader>
      <form onSubmit={handleLogin}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="name@example.com" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input 
              id="password" 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <div className="text-sm text-red-500">{error}</div>}
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button className="w-full" type="submit" disabled={isLoading}>
            {isLoading ? "Authenticating..." : "Sign In"}
          </Button>
          <div className="text-sm text-center text-muted-foreground w-full">
            Is this a newly provisioned school? <br/>
            <button 
              type="button" 
              className="text-fuchsia-400 font-bold hover:underline mt-1"
              onClick={async () => {
                if(!email || !password) {
                  setError("Please enter email and password to initialize your account.");
                  return;
                }
                setIsLoading(true);
                const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
                if (signUpError) {
                  setError(signUpError.message);
                } else {
                  setError("Account initialized! Please click 'Sign In' again.");
                }
                setIsLoading(false);
              }}
            >
              Initialize Admin Account
            </button>
          </div>
        </CardFooter>
      </form>
    </Card>
  )
}
