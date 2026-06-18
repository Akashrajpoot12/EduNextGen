import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to_email, admin_name, school_name, subdomain, action, invite_token } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const APP_URL = Deno.env.get("APP_URL") || "http://localhost:5173";

    if (!RESEND_API_KEY) {
      // Fallback: log and return success (email not configured)
      console.log(`[EMAIL SKIPPED] To: ${to_email}, Action: ${action}, School: ${school_name}`);
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let subject = "";
    let html = "";

    if (action === "approved") {
      const portalUrl  = `${APP_URL}/${subdomain}/login`;
      const setupUrl   = invite_token ? `${APP_URL}/setup?token=${invite_token}&subdomain=${subdomain}` : portalUrl;

      subject = `🎉 Your School "${school_name}" is Approved — EduNextGen`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 40px; border-radius: 12px;">
          <h1 style="color: #34d399; margin-bottom: 8px;">Welcome to EduNextGen! 🎉</h1>
          <p style="color: #94a3b8;">Hi ${admin_name},</p>
          <p>Your school <strong style="color: #fff;">${school_name}</strong> has been <strong style="color: #34d399;">approved</strong> and is now live!</p>

          <div style="background: #1e293b; border-radius: 8px; padding: 24px; margin: 24px 0; border-left: 4px solid #34d399;">
            <p style="margin: 0 0 16px 0; font-weight: bold; font-size: 16px;">🚀 Setup Your Account</p>
            <p style="margin: 0 0 8px; color: #94a3b8; font-size: 14px;">Click below to set your password and access your school portal:</p>
            <a href="${setupUrl}"
               style="display: inline-block; background: #16a34a; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; margin-top: 8px;">
              ✅ Setup My Account →
            </a>
            <p style="margin: 16px 0 0; color: #64748b; font-size: 12px;">⚠️ This link expires in 7 days.</p>
          </div>

          <div style="background: #1e293b; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0 0 8px; font-weight: bold;">📋 Your School Details:</p>
            <table style="width: 100%; font-size: 14px; color: #94a3b8;">
              <tr><td style="padding: 4px 0;">School Name:</td><td style="color: #fff; font-weight: bold;">${school_name}</td></tr>
              <tr><td style="padding: 4px 0;">Admin Email:</td><td style="color: #34d399;">${to_email}</td></tr>
              <tr><td style="padding: 4px 0;">Portal URL:</td><td><a href="${portalUrl}" style="color: #34d399;">${portalUrl}</a></td></tr>
              <tr><td style="padding: 4px 0;">Subdomain:</td><td style="color: #fff;">${subdomain}</td></tr>
            </table>
          </div>

          <p style="font-size: 14px;"><strong>After Setup — What to do:</strong></p>
          <ol style="color: #94a3b8; font-size: 14px; line-height: 1.8;">
            <li>Add your academic year and classes</li>
            <li>Invite teachers and staff</li>
            <li>Enroll students</li>
            <li>Start taking attendance!</li>
          </ol>

          <p style="color: #64748b; font-size: 12px; margin-top: 32px; border-top: 1px solid #1e293b; padding-top: 16px;">
            EduNextGen SaaS — Empowering Schools Digitally<br/>
            Need help? Reply to this email.
          </p>
        </div>
      `;
    } else if (action === "rejected") {
      subject = `Update on your EduNextGen Registration — ${school_name}`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 40px; border-radius: 12px;">
          <h1 style="color: #f87171;">Registration Update</h1>
          <p>Hi ${admin_name},</p>
          <p>Unfortunately, your registration request for <strong>${school_name}</strong> could not be approved at this time.</p>
          <p>Please contact our support team for more information.</p>
          <p style="color: #64748b; font-size: 12px; margin-top: 32px;">EduNextGen SaaS Support</p>
        </div>
      `;
    } else if (action === "suspended") {
      subject = `Important: Your School Account has been Suspended — EduNextGen`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 40px; border-radius: 12px;">
          <h1 style="color: #f97316;">Account Suspended</h1>
          <p>Hi ${admin_name},</p>
          <p>Your school <strong>${school_name}</strong> has been temporarily suspended. Please contact our support team to resolve the issue.</p>
          <p style="color: #64748b; font-size: 12px; margin-top: 32px;">EduNextGen SaaS Support</p>
        </div>
      `;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "EduNextGen <noreply@edunextgen.in>",
        to: [to_email],
        subject,
        html,
      }),
    });

    const data = await res.json();

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
