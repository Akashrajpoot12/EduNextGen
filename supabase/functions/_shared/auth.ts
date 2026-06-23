// ============================================================================
// Shared authorization helper for Edge Functions.
//
// Edge Functions that use the SERVICE_ROLE key bypass all Row Level Security,
// so they MUST verify the caller's identity and role themselves. Use
// `verifyCaller()` at the top of any privileged function and reject when the
// caller is not allowed.
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export type CallerRole = {
  role: string;
  school_id: string | null;
};

export type Caller = {
  id: string;
  email: string | null;
  roles: CallerRole[];
  isSuperAdmin: boolean;
  /** True if the caller holds one of `roles` in the given school. */
  hasRoleInSchool: (schoolId: string, roles: string[]) => boolean;
};

/**
 * Resolves the caller from the request's Authorization header and loads their
 * roles. The caller's JWT is validated by Supabase Auth — it cannot be forged
 * without the project's JWT secret. Roles are read with the service-role key so
 * the lookup is not itself subject to (and cannot be blocked by) RLS.
 *
 * Returns `null` when there is no valid authenticated user.
 */
export async function verifyCaller(req: Request): Promise<Caller | null> {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // 1. Validate the JWT and identify the user.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error } = await callerClient.auth.getUser();
  if (error || !user) return null;

  // 2. Load the caller's roles with the service-role key (bypasses RLS).
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: roleRows } = await admin
    .from("user_roles")
    .select("role, school_id")
    .eq("user_id", user.id);

  const roles: CallerRole[] = roleRows ?? [];
  const isSuperAdmin = roles.some((r) => r.role === "super_admin");

  return {
    id: user.id,
    email: user.email ?? null,
    roles,
    isSuperAdmin,
    hasRoleInSchool: (schoolId, allowed) =>
      isSuperAdmin ||
      roles.some((r) => r.school_id === schoolId && allowed.includes(r.role)),
  };
}
