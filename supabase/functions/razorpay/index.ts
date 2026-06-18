import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname;

    const keyId     = Deno.env.get("RAZORPAY_KEY_ID");
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!keyId || !keySecret) {
      throw new Error("Razorpay credentials are not set in Supabase Edge Function environment.");
    }

    const supabaseUrl        = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase           = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();

    // ─── Route: Create Order ──────────────────────────────────────────────────
    if (path.endsWith("/create") || body.action === "create-order") {
      const { amount, receiptNotes } = body;
      if (!amount) throw new Error("Amount is required");

      const auth           = btoa(`${keyId}:${keySecret}`);
      const razorpayAmount = Math.round(Number(amount) * 100); // INR → paise

      const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Basic ${auth}` },
        body: JSON.stringify({
          amount:   razorpayAmount,
          currency: "INR",
          receipt:  receiptNotes?.invoiceId || receiptNotes?.item || "rcpt_" + Date.now(),
          notes:    receiptNotes,
        }),
      });

      if (!rzpRes.ok) {
        const errText = await rzpRes.text();
        throw new Error(`Razorpay Order API error: ${errText}`);
      }

      const orderData = await rzpRes.json();

      // ── Pre-log a PENDING platform payment record ──────────────────────────
      if (receiptNotes?.tenant && receiptNotes?.item && receiptNotes?.item !== "fee") {
        const { data: school } = await supabase
          .from("schools")
          .select("id, name, subdomain, admin_email")
          .eq("subdomain", receiptNotes.tenant)
          .maybeSingle();

        if (school) {
          const now       = new Date();
          const nextMonth = new Date(now);
          nextMonth.setMonth(nextMonth.getMonth() + 1);

          await supabase.from("platform_payments").insert({
            school_id:          school.id,
            school_name:        school.name,
            school_subdomain:   school.subdomain,
            admin_email:        school.admin_email,
            razorpay_order_id:  orderData.id,
            amount:             Number(amount),
            currency:           "INR",
            plan_name:          receiptNotes.item,
            payment_type:       "subscription",
            status:             "pending",
            billing_month:      now.getMonth() + 1,
            billing_year:       now.getFullYear(),
            next_renewal_date:  nextMonth.toISOString().split("T")[0],
            notes:              receiptNotes,
          });
        }
      }

      return new Response(JSON.stringify(orderData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // ─── Route: Verify Payment & Update DB ───────────────────────────────────
    if (path.endsWith("/verify") || body.action === "verify-payment") {
      const {
        razorpay_order_id, razorpay_payment_id, razorpay_signature,
        invoiceId, item, tenant, amount
      } = body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        throw new Error("Missing Razorpay signature verification parameters.");
      }

      // Verify HMAC-SHA256 signature
      const encoder   = new TextEncoder();
      const cryptoKey = await crypto.subtle.importKey(
        "raw", encoder.encode(keySecret),
        { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
      );
      const signatureBuffer  = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(`${razorpay_order_id}|${razorpay_payment_id}`));
      const generatedSignature = Array.from(new Uint8Array(signatureBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

      const signatureValid = generatedSignature === razorpay_signature;

      if (!signatureValid) {
        // Mark payment as failed in platform_payments
        await supabase.from("platform_payments")
          .update({ status: "failed", failure_reason: "Signature mismatch", updated_at: new Date().toISOString() })
          .eq("razorpay_order_id", razorpay_order_id);

        return new Response(JSON.stringify({ success: false, error: "Signature mismatch" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      // ── Payment is valid — update records ────────────────────────────────
      if (invoiceId) {
        // School Fee Payment (student fees)
        const { error } = await supabase
          .from("fee_payments")
          .update({ status: "paid", payment_date: new Date().toISOString() })
          .eq("id", invoiceId);
        if (error) throw error;

      } else if (item && tenant) {
        // SaaS Subscription upgrade
        const isBasic    = ["essential", "basic"].includes(item.toLowerCase());
        const isPremium  = item.toLowerCase() === "premium";
        const planStatus = "active";
        const quota      = isPremium ? 10000 : isBasic ? 500 : 50;
        const planName   = isPremium ? "Premium" : isBasic ? "Essential" : item;

        const now       = new Date();
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);

        // Update school subscription
        const { data: school, error: schoolErr } = await supabase
          .from("schools")
          .update({
            subscription_status:      planStatus,
            subscription_plan:        planName,
            student_quota:            quota,
            subscription_renewal_date: nextMonth.toISOString().split("T")[0],
          })
          .eq("subdomain", tenant)
          .select("id, name, subdomain, admin_email")
          .maybeSingle();

        if (schoolErr) throw schoolErr;

        // Update platform_payments record (pending → captured)
        const { data: existingPayment } = await supabase
          .from("platform_payments")
          .select("id")
          .eq("razorpay_order_id", razorpay_order_id)
          .maybeSingle();

        if (existingPayment) {
          await supabase.from("platform_payments")
            .update({
              razorpay_payment_id: razorpay_payment_id,
              status:              "captured",
              updated_at:          new Date().toISOString(),
            })
            .eq("id", existingPayment.id);
        } else if (school) {
          // Fallback: insert if not pre-logged
          await supabase.from("platform_payments").insert({
            school_id:           school.id,
            school_name:         school.name,
            school_subdomain:    school.subdomain,
            admin_email:         school.admin_email,
            razorpay_order_id:   razorpay_order_id,
            razorpay_payment_id: razorpay_payment_id,
            amount:              Number(amount || 0),
            currency:            "INR",
            plan_name:           planName,
            payment_type:        "subscription",
            status:              "captured",
            billing_month:       now.getMonth() + 1,
            billing_year:        now.getFullYear(),
            next_renewal_date:   nextMonth.toISOString().split("T")[0],
          });
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    throw new Error("Invalid endpoint or path");

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
