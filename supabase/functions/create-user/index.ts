import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonError, verifyCaller } from "../_shared/auth.ts";

// Roles a school_admin is allowed to provision. Only a super_admin may create
// privileged (admin / super_admin) accounts.
const SCHOOL_ASSIGNABLE_ROLES = ["teacher", "staff", "student", "parent"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, password, name, school_id, role, phone, subject, department, qualification, joining_date } = await req.json();

    if (!email || !password || !school_id) {
      return jsonError("email, password and school_id are required", 400);
    }
    const targetRole = role || "teacher";

    // ── Authorization ─────────────────────────────────────────────────────────
    // Only a school_admin of THIS school (or a super_admin) may create users.
    const caller = await verifyCaller(req);
    if (!caller) return jsonError("Unauthorized", 401);

    const isSchoolAdmin = caller.hasRoleInSchool(school_id, ["school_admin"]);
    if (!caller.isSuperAdmin && !isSchoolAdmin) {
      return jsonError("Forbidden: must be an admin of this school", 403);
    }
    // A school_admin cannot mint admins or super_admins — prevents privilege escalation.
    if (!caller.isSuperAdmin && !SCHOOL_ASSIGNABLE_ROLES.includes(targetRole)) {
      return jsonError(`Forbidden: cannot assign role '${targetRole}'`, 403);
    }

    // Use service role to create user without sending email
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Create auth user (no email sent with email_confirm: true + no welcome email)
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,  // skip confirmation email entirely
      user_metadata: { full_name: name },
    });

    if (authErr) throw authErr;
    const uid = authData.user.id;

    // Upsert into public.users
    const { error: userErr } = await supabaseAdmin.from("users").upsert({
      id: uid,
      email,
      full_name: name,
      name,
      school_id,
      role: targetRole,
      phone: phone || null,
      subject: subject || null,
      department: department || null,
      qualification: qualification || null,
      joining_date: joining_date || null,
    }, { onConflict: "id" });

    if (userErr) throw userErr;

    // Insert user_role
    const { error: roleErr } = await supabaseAdmin.from("user_roles").upsert({
      user_id: uid,
      school_id,
      role: targetRole,
    }, { onConflict: "user_id,school_id,role" });

    if (roleErr) throw roleErr;

    return new Response(JSON.stringify({ success: true, user_id: uid }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
