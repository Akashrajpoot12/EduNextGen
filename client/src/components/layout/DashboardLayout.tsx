import React, { createContext, useContext, useEffect, useState } from "react";
import { useParams, Outlet, useNavigate } from "react-router-dom";
import { TenantSidebar } from "@/components/tenant-sidebar";
import { TeacherSidebar } from "@/components/teacher-sidebar";
import { ParentSidebar } from "@/components/parent-sidebar";
import { StudentSidebar } from "@/components/student-sidebar";
import { GlobalTopbar } from "@/components/global-topbar";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { createClient } from "@/lib/supabase/client";

interface TenantContextType {
  tenantId: string | null;
  subdomain: string | null;
  role: string | null;
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextType>({
  tenantId: null,
  subdomain: null,
  role: null,
  isLoading: true,
});

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const navigate = useNavigate();
  const tenant = params.tenantId as string;
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [subdomain, setSubdomain] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function resolveTenant() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (isMounted) navigate(`/${tenant}/login`);
          return;
        }

        // 1. Resolve school from subdomain
        const { data: school, error: schoolErr } = await supabase
          .from("schools")
          .select("id")
          .eq("subdomain", tenant)
          .single();

        if (schoolErr || !school) {
          console.error("School not found:", schoolErr);
          if (isMounted) navigate(`/${tenant}/login`);
          return;
        }

        // 2. Fetch role for this school
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .eq("school_id", school.id)
          .limit(1)
          .maybeSingle();

        // Also check if super_admin
        const { data: superAdminRole } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .eq("role", "super_admin")
          .limit(1)
          .maybeSingle();

        const resolvedRole = roleData?.role || superAdminRole?.role || null;

        if (isMounted) {
          setTenantId(school.id);
          setSubdomain(tenant);
          setRole(resolvedRole);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Error resolving tenant:", err);
        if (isMounted) {
          setIsLoading(false);
          navigate(`/${tenant}/login`);
        }
      }
    }
    
    if (tenant) {
      resolveTenant();
    }
    return () => { isMounted = false; };
  }, [tenant, navigate]);

  return (
    <TenantContext.Provider value={{ tenantId, subdomain, role, isLoading }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}

function RoleSidebar() {
  const { role, subdomain } = useTenant();
  const tenant = subdomain || "";
  if (role === "teacher") return <TeacherSidebar tenant={tenant} />;
  if (role === "parent")  return <ParentSidebar tenant={tenant} />;
  if (role === "student") return <StudentSidebar tenant={tenant} />;
  return <TenantSidebar />;
}

export function DashboardLayout() {
  return (
    <TenantProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <RoleSidebar />
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-fuchsia-500/8 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-orange-500/6 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />

          <GlobalTopbar />
          
          <main className="flex-1 overflow-y-auto bg-background/50">
            <div className="max-w-6xl mx-auto p-4 md:p-6">
              <AnnouncementBanner />
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </TenantProvider>
  );
}
