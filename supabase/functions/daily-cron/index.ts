/**
 * Daily Cron Job — runs every day at midnight
 * 1. Suspend expired trial schools
 * 2. Alert schools whose trial expires in 7 days
 * 3. Send expiry notification emails
 *
 * Setup in Supabase Dashboard → Edge Functions → Schedule:
 * Cron: 0 0 * * *  (every day at midnight UTC)
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

  // Security: only allow internal calls
  const authHeader = req.headers.get("Authorization");
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const supabaseUrl        = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase           = createClient(supabaseUrl, supabaseServiceKey);
  const APP_URL            = Deno.env.get("APP_URL") || "http://localhost:5173";
  const RESEND_API_KEY     = Deno.env.get("RESEND_API_KEY");

  const results: Record<string, any> = {};

  // ── Step 1: Suspend expired trials ────────────────────────────────────────
  const { data: suspended, error: suspendErr } = await supabase
    .rpc("suspend_expired_trials");

  results.suspended = suspended || [];
  if (suspendErr) results.suspendError = suspendErr.message;

  // Send suspension emails to expired schools
  if (suspended && suspended.length > 0) {
    for (const school of suspended) {
      // Get admin email
      const { data: schoolData } = await supabase
        .from("schools")
        .select("admin_email, admin_name, subdomain")
        .eq("id", school.suspended_school_id)
        .maybeSingle();

      if (schoolData?.admin_email && RESEND_API_KEY) {
        await sendEmail(RESEND_API_KEY, {
          to: schoolData.admin_email,
          subject: `⚠️ Your EduNextGen Trial Has Expired — ${school.suspended_school_name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 40px; border-radius: 12px;">
              <h1 style="color: #f97316;">Trial Expired</h1>
              <p>Hi ${schoolData.admin_name || "Admin"},</p>
              <p>Your 30-day free trial for <strong>${school.suspended_school_name}</strong> has expired and your account has been <strong style="color: #f97316;">suspended</strong>.</p>
              <div style="background: #1e293b; border-radius: 8px; padding: 20px; margin: 24px 0; border-left: 4px solid #f97316;">
                <p style="margin: 0;"><strong>To reactivate your account:</strong></p>
                <p>Upgrade to Essential or Premium plan from your school portal.</p>
                <a href="${APP_URL}/${schoolData.subdomain}/admin/subscription"
                   style="display: inline-block; margin-top: 12px; background: #16a34a; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                  Upgrade Now
                </a>
              </div>
              <p style="color: #64748b; font-size: 12px;">EduNextGen SaaS Support</p>
            </div>
          `,
        });
      }

      // Log in super_admin_logs
      await supabase.from("super_admin_logs").insert({
        action:      "TRIAL_EXPIRED_AUTO_SUSPEND",
        target_type: "school",
        target_id:   school.suspended_school_id,
        target_name: school.suspended_school_name,
        metadata:    { auto: true, date: new Date().toISOString() },
      });
    }
  }

  // ── Step 2: Alert about trials expiring in 7 days ─────────────────────────
  await supabase.rpc("alert_trial_expiring");

  // Get schools expiring in 7 days and send warning emails
  const { data: expiringSoon } = await supabase
    .from("schools")
    .select("id, name, subdomain, admin_email, admin_name, subscription_renewal_date")
    .eq("is_active", true)
    .in("subscription_status", ["trialing"])
    .gte("subscription_renewal_date", new Date(Date.now() + 6 * 86400000).toISOString().split("T")[0])
    .lte("subscription_renewal_date", new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]);

  results.expiringSoon = expiringSoon?.length || 0;

  if (expiringSoon && RESEND_API_KEY) {
    for (const school of expiringSoon) {
      if (school.admin_email) {
        await sendEmail(RESEND_API_KEY, {
          to: school.admin_email,
          subject: `⏰ Your EduNextGen Trial Expires in 7 Days — ${school.name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 40px; border-radius: 12px;">
              <h1 style="color: #f59e0b;">Trial Expiring Soon!</h1>
              <p>Hi ${school.admin_name || "Admin"},</p>
              <p>Your free trial for <strong>${school.name}</strong> expires on <strong style="color: #f59e0b;">${new Date(school.subscription_renewal_date).toLocaleDateString("en-IN")}</strong>.</p>
              <p>Upgrade now to keep your school data and continue operations.</p>
              <div style="background: #1e293b; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <p style="margin: 0 0 8px; font-weight: bold;">Available Plans:</p>
                <p>✅ Essential — ₹999/month (500 students)</p>
                <p>🚀 Premium — ₹4,999/month (10,000 students + Face AI)</p>
                <a href="${APP_URL}/${school.subdomain}/admin/subscription"
                   style="display: inline-block; margin-top: 12px; background: #16a34a; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                  Upgrade Now →
                </a>
              </div>
              <p style="color: #64748b; font-size: 12px;">EduNextGen SaaS Team</p>
            </div>
          `,
        });
      }
    }
  }

  results.timestamp = new Date().toISOString();
  results.success   = true;

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

async function sendEmail(apiKey: string, { to, subject, html }: { to: string; subject: string; html: string }) {
  try {
    await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body:    JSON.stringify({ from: "EduNextGen <noreply@edunextgen.in>", to: [to], subject, html }),
    });
  } catch (e) {
    console.error("Email send failed:", e);
  }
}
