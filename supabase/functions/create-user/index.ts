import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, password, name, school_id, role, phone, subject, department, qualification, joining_date } = await req.json();

    // Use service role to create user without sending email
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
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
      role: role || "teacher",
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
      role: role || "teacher",
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
