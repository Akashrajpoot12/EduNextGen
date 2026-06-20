import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const {
      studentData,       // student fields (name, class_id, etc.)
      parentName,
      parentEmail,
      parentMobile,
      schoolId,
      schoolName,
      schoolSubdomain,
    } = await req.json();

    if (!parentEmail || !schoolId) {
      throw new Error("parentEmail and schoolId are required");
    }

    // Auto-generate password: Parent@ + last 4 digits of mobile (or 1234 fallback)
    const mobileSuffix = parentMobile?.slice(-4) || "1234";
    const password = `Parent@${mobileSuffix}`;

    // 1. Create parent auth user (or get existing)
    let parentUserId: string;
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: parentEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: parentName },
    });

    if (authError) {
      if (authError.message.toLowerCase().includes("already registered")) {
        // User already exists — fetch their ID
        const { data: { users } } = await supabase.auth.admin.listUsers();
        const existing = users.find((u) => u.email === parentEmail);
        if (!existing) throw new Error("Parent email already exists but could not find user");
        parentUserId = existing.id;
      } else {
        throw new Error(`Auth error: ${authError.message}`);
      }
    } else {
      parentUserId = authData.user!.id;
    }

    // 2. Upsert into public.users
    await supabase.from("users").upsert(
      { id: parentUserId, email: parentEmail, full_name: parentName },
      { onConflict: "id" }
    );

    // 3. Add parent role (if not already exists)
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", parentUserId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (!existingRole) {
      await supabase.from("user_roles").insert({
        user_id: parentUserId,
        school_id: schoolId,
        role: "parent",
      });
    }

    // 4. Insert student record with parent_user_id linked
    const { data: newStudent, error: studentError } = await supabase
      .from("students")
      .insert({ ...studentData, school_id: schoolId, parent_user_id: parentUserId })
      .select("id")
      .single();

    if (studentError) throw new Error(`Student insert error: ${studentError.message}`);

    // 5. Send WhatsApp message via Fast2SMS
    const fast2smsKey = Deno.env.get("FAST2SMS_API_KEY");
    let smsSent = false;
    let smsError = "";

    if (fast2smsKey && parentMobile) {
      const portalUrl = schoolSubdomain
        ? `${schoolSubdomain}.edunest.in`
        : "your school portal";

      const message =
        `Dear ${parentName},\n\n` +
        `Your child has been successfully enrolled at *${schoolName || "our school"}*.\n\n` +
        `*Parent Portal Login Credentials:*\n` +
        `📧 Email: ${parentEmail}\n` +
        `🔑 Password: ${password}\n` +
        `🌐 URL: ${portalUrl}\n\n` +
        `Please login and change your password after first login.\n\n` +
        `_-EduNest School Management_`;

      // Fast2SMS WhatsApp API
      const waRes = await fetch("https://www.fast2sms.com/dev/wa", {
        method: "POST",
        headers: {
          authorization: fast2smsKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          numbers: parentMobile,
        }),
      });

      const waData = await waRes.json();
      smsSent = waData?.return === true;
      if (!smsSent) smsError = waData?.message || JSON.stringify(waData);
      console.log("Fast2SMS WhatsApp response:", waData);
    }

    return new Response(
      JSON.stringify({
        success: true,
        studentId: newStudent.id,
        parentUserId,
        credentials: { email: parentEmail, password },
        smsSent,
        smsError: smsSent ? null : smsError,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("create-student error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
