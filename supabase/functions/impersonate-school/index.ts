/**
 * School Impersonation — generates a magic login link for a school admin
 * Called by super admin to "Login as School Admin" for support
 *
 * Security: Only callable by authenticated super admins (checks user_roles)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl        = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey    = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is super admin using their JWT
    const authHeader = req.headers.get("Authorization") || "";
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    // Check super admin role
    const { data: role } = await callerClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!role) {
      return new Response(JSON.stringify({ error: "Forbidden: super admin only" }), { status: 403, headers: corsHeaders });
    }

    const { admin_email, school_id, school_name, subdomain } = await req.json();
    if (!admin_email) {
      return new Response(JSON.stringify({ error: "admin_email required" }), { status: 400, headers: corsHeaders });
    }

    // Use service role to generate magic link
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const APP_URL = Deno.env.get("APP_URL") || "http://localhost:5173";
    const redirectTo = `${APP_URL}/${subdomain}/admin`;

    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type:       "magiclink",
      email:      admin_email,
      options:    { redirectTo },
    });

    if (linkErr) throw linkErr;

    // Log the impersonation event
    await adminClient.from("super_admin_logs").insert({
      action:      "SCHOOL_IMPERSONATED",
      target_type: "school",
      target_id:   school_id,
      target_name: school_name,
      metadata:    {
        impersonated_email:  admin_email,
        triggered_by_email:  caller.email,
        triggered_by_id:     caller.id,
        timestamp:           new Date().toISOString(),
      },
    });

    return new Response(
      JSON.stringify({ success: true, link: linkData.properties?.action_link }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
