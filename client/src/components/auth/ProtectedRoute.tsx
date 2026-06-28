import React, { useEffect, useState } from "react";
import { Navigate, useParams, useLocation } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  isSuperAdminRoute?: boolean;
}

export function ProtectedRoute({ children, allowedRoles, isSuperAdminRoute = false }: ProtectedRouteProps) {
  const params = useParams();
  const location = useLocation();
  const tenant = params.tenantId as string;
  const supabase = createClient();

  const [authLoading, setAuthLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [resolvedRole, setResolvedRole] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (isMounted) {
            setHasAccess(false);
            setAuthLoading(false);
          }
          return;
        }

        if (isSuperAdminRoute) {
          // Check if global super_admin
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id)
            .eq("role", "super_admin")
            .limit(1)
            .maybeSingle();

          if (isMounted) {
            setResolvedRole(roleData?.role || null);
            setHasAccess(roleData?.role === "super_admin");
            setAuthLoading(false);
          }
        } else {
          // Under Tenant context
          // Resolve school first
          const { data: school } = await supabase
            .from("schools")
            .select("id")
            .eq("subdomain", tenant)
            .single();

          if (!school) {
            if (isMounted) {
              setHasAccess(false);
              setAuthLoading(false);
            }
            return;
          }

          // Map auth user to public user id via email to support pre-provisioned school admins
          const { data: publicUser } = await supabase
            .from("users")
            .select("id")
            .eq("email", session.user.email)
            .limit(1)
            .maybeSingle();

          const mappedUserId = publicUser?.id || session.user.id;

          // Fetch user role for this school
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", mappedUserId)
            .eq("school_id", school.id)
            .limit(1)
            .maybeSingle();

          // Also check if they are a super_admin accessing a tenant page
          const { data: superAdminRole } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id)
            .eq("role", "super_admin")
            .limit(1)
            .maybeSingle();

          const role = roleData?.role || superAdminRole?.role || null;
          
          if (isMounted) {
            setResolvedRole(role);
            if (!allowedRoles) {
              setHasAccess(true);
            } else {
              // Map school_admin to admin check if allowedRoles includes either
              const mappedRole = role === "school_admin" ? "admin" : role;
              const normalizedAllowed = allowedRoles.map(r => r === "school_admin" ? "admin" : r);
              
              // super_admin bypasses any portal restriction
              setHasAccess(role === "super_admin" || (role && normalizedAllowed.includes(mappedRole)));
            }
            setAuthLoading(false);
          }
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        if (isMounted) {
          setHasAccess(false);
          setAuthLoading(false);
        }
      }
    }

    checkAuth();
    return () => { isMounted = false; };
  }, [tenant, isSuperAdminRoute]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mx-auto mb-4" />
          <p className="text-muted-foreground text-sm font-medium">Checking authorization...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    if (isSuperAdminRoute) {
      return <Navigate to="/super-admin/login" replace state={{ from: location }} />;
    } else {
      return <Navigate to={`/${tenant}/login`} replace state={{ from: location }} />;
    }
  }

  return <>{children}</>;
}
