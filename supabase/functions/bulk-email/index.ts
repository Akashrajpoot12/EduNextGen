/**
 * Bulk Email — send announcement to all/filtered school admins
 * Called by super admin from dashboard
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl        = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey    = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY     = Deno.env.get("RESEND_API_KEY");

    // Verify caller is super admin
    const authHeader   = req.headers.get("Authorization") || "";
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { data: role } = await callerClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!role) {
      return new Response(JSON.stringify({ error: "Forbidden: super admin only" }), { status: 403, headers: corsHeaders });
    }

    const { subject, body, filter } = await req.json();
    // filter: 'all' | 'active' | 'trialing' | 'suspended'

    if (!subject || !body) {
      return new Response(JSON.stringify({ error: "subject and body required" }), { status: 400, headers: corsHeaders });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch school admins based on filter
    let query = adminClient.from("schools").select("name, admin_email, admin_name, subdomain, is_active, subscription_status");

    if (filter === "active") {
      query = query.eq("is_active", true).neq("subscription_status", "trialing");
    } else if (filter === "trialing") {
      query = query.eq("subscription_status", "trialing").eq("is_active", true);
    } else if (filter === "suspended") {
      query = query.eq("is_active", false);
    }
    // 'all' — no filter

    const { data: schools, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;

    const recipients = (schools || []).filter(s => s.admin_email);
    if (recipients.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: "No recipients found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    const errors: string[] = [];

    if (RESEND_API_KEY) {
      // Send in batches of 10 to respect rate limits
      const BATCH = 10;
      for (let i = 0; i < recipients.length; i += BATCH) {
        const batch = recipients.slice(i, i + BATCH);
        await Promise.all(batch.map(async (school) => {
          try {
            const html = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 40px; border-radius: 12px;">
                <div style="background: #1e293b; border-radius: 8px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #34d399;">
                  <p style="margin: 0; font-size: 12px; color: #64748b;">EduNextGen Platform Announcement</p>
                  <p style="margin: 4px 0 0; font-size: 14px; color: #94a3b8;">For: <strong style="color: #fff;">${school.name}</strong> (${school.admin_name || "Admin"})</p>
                </div>
                <div style="line-height: 1.7; white-space: pre-wrap; font-size: 15px;">${body.replace(/\n/g, '<br/>')}</div>
                <hr style="border: none; border-top: 1px solid #1e293b; margin: 32px 0;" />
                <p style="color: #64748b; font-size: 12px;">
                  You are receiving this because you are a registered school admin on EduNextGen.<br/>
                  School Portal: <a href="${Deno.env.get("APP_URL") || "http://localhost:5173"}/${school.subdomain}/admin" style="color: #34d399;">${school.subdomain}.edunextgen.in</a>
                </p>
              </div>
            `;
            const res = await fetch("https://api.resend.com/emails", {
              method:  "POST",
              headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body:    JSON.stringify({
                from:    "EduNextGen <noreply@edunextgen.in>",
                to:      [school.admin_email],
                subject,
                html,
              }),
            });
            if (res.ok) sent++;
            else errors.push(`${school.admin_email}: ${res.status}`);
          } catch (e: any) {
            errors.push(`${school.admin_email}: ${e.message}`);
          }
        }));
      }
    } else {
      console.log(`[BULK EMAIL SKIPPED] Subject: ${subject} | Recipients: ${recipients.length}`);
      sent = recipients.length; // simulate success in dev
    }

    // Log the bulk send
    const callerData = await callerClient.from("users").select("full_name").eq("id", caller.id).maybeSingle();
    await adminClient.from("bulk_email_logs").insert({
      subject,
      body,
      recipients:      recipients.map(s => s.admin_email),
      recipient_count: recipients.length,
      sent_by:         caller.id,
      sent_by_name:    callerData.data?.full_name || caller.email,
      filter_applied:  filter || "all",
    });

    return new Response(
      JSON.stringify({ success: true, sent, total: recipients.length, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
