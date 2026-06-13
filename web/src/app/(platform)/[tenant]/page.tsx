import { LoginForm } from "@/components/auth/login-form"

export default async function TenantLoginPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  
  return (
    <div className="flex h-[80vh] items-center justify-center">
      <div className="flex flex-col items-center space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">School Login</h1>
          <p className="text-muted-foreground mt-2">
            Sign in to the <span className="font-semibold text-primary">{tenant.toUpperCase()}</span> portal
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
