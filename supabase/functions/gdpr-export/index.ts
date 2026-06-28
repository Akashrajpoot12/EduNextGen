/**
 * GDPR Data Export — exports all data for a given school as JSON
 * Called by super admin from dashboard
 * Returns a downloadable JSON file with all school-related records
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

    // Verify caller is super admin
    const authHeader   = req.headers.get("Authorization") || "";
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
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

    const { school_id } = await req.json();
    if (!school_id) {
      return new Response(JSON.stringify({ error: "school_id required" }), { status: 400, headers: corsHeaders });
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all school data in parallel
    const [
      schoolRes, studentsRes, userRolesRes, classesRes,
      attendanceRes, feesRes, paymentsRes, logsRes, notesRes,
    ] = await Promise.all([
      admin.from("schools").select("*").eq("id", school_id).single(),
      admin.from("students").select("*").eq("school_id", school_id),
      admin.from("user_roles").select("*, users(id, email, full_name, phone)").eq("school_id", school_id),
      admin.from("classes").select("*").eq("school_id", school_id),
      admin.from("daily_attendance").select("*").eq("school_id", school_id).limit(5000),
      admin.from("student_fee_assignments").select("*").eq("school_id", school_id),
      admin.from("platform_payments").select("*").eq("school_id", school_id),
      admin.from("super_admin_logs").select("*").eq("target_id", school_id),
      admin.from("school_notes").select("*").eq("school_id", school_id),
    ]);

    const exportData = {
      export_metadata: {
        exported_at:      new Date().toISOString(),
        exported_by:      caller.email,
        school_id,
        format_version:   "1.0",
        purpose:          "GDPR Data Export",
      },
      school:        schoolRes.data,
      students:      studentsRes.data || [],
      staff:         userRolesRes.data || [],
      classes:       classesRes.data || [],
      attendance:    attendanceRes.data || [],
      fees:          feesRes.data || [],
      payments:      paymentsRes.data || [],
      activity_logs: logsRes.data || [],
      crm_notes:     notesRes.data || [],
    };

    // Log the export
    await admin.from("super_admin_logs").insert({
      action:      "GDPR_DATA_EXPORT",
      target_type: "school",
      target_id:   school_id,
      target_name: schoolRes.data?.name || "Unknown",
      metadata:    { exported_by: caller.email, record_counts: {
        students: exportData.students.length,
        staff:    exportData.staff.length,
        classes:  exportData.classes.length,
      }},
    });

    const json     = JSON.stringify(exportData, null, 2);
    const filename = `school_export_${school_id}_${new Date().toISOString().split("T")[0]}.json`;

    return new Response(json, {
      headers: {
        ...corsHeaders,
        "Content-Type":        "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
