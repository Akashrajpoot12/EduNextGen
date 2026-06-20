import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendWhatsApp(mobile: string, message: string, apiKey: string): Promise<boolean> {
  const res = await fetch("https://www.fast2sms.com/dev/wa", {
    method: "POST",
    headers: { authorization: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ message, numbers: mobile }),
  });
  const data = await res.json();
  return data?.return === true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const fast2smsKey = Deno.env.get("FAST2SMS_API_KEY")!;
    const { type, schoolId, data: payload } = await req.json();

    let sent = 0, failed = 0;

    // ── TYPE: absent_alert ─────────────────────────────────────
    // Send WhatsApp to parents of absent students
    if (type === "absent_alert") {
      const date = payload?.date || new Date().toISOString().split("T")[0];

      const { data: absent } = await supabase
        .from("daily_attendance")
        .select(`
          student:student_id(
            id, first_name, last_name, enrollment_number,
            classes:class_id(grade_level, section),
            parent:parent_user_id(id)
          )
        `)
        .eq("school_id", schoolId)
        .eq("date", date)
        .eq("status", "absent");

      const { data: school } = await supabase
        .from("schools")
        .select("name")
        .eq("id", schoolId)
        .single();

      for (const rec of absent || []) {
        const stu = rec.student as any;
        if (!stu?.parent?.id) continue;

        const { data: parentUser } = await supabase.auth.admin.getUserById(stu.parent.id);
        const mobile = parentUser?.user?.phone || parentUser?.user?.user_metadata?.mobile;
        if (!mobile) { failed++; continue; }

        const msg =
          `Dear Parent,\n\n` +
          `Your child *${stu.first_name} ${stu.last_name}* (Class ${stu.classes?.grade_level}-${stu.classes?.section}) ` +
          `was marked *ABSENT* today (${date}) at *${school?.name || "school"}*.\n\n` +
          `If this is incorrect, please contact the class teacher.\n\n` +
          `_-${school?.name || "EduNest"}_`;

        const ok = await sendWhatsApp(mobile, msg, fast2smsKey);
        ok ? sent++ : failed++;
      }
    }

    // ── TYPE: fees_due ─────────────────────────────────────────
    // Send reminder to parents with pending dues
    else if (type === "fees_due") {
      const { data: overdue } = await supabase
        .from("student_fee_assignments")
        .select(`
          amount, due_date,
          fee_structure:fee_structure_id(name),
          student:student_id(
            first_name, last_name,
            parent:parent_user_id(id)
          )
        `)
        .eq("school_id", schoolId)
        .eq("status", "pending")
        .lt("due_date", new Date().toISOString().split("T")[0]);

      const { data: school } = await supabase
        .from("schools")
        .select("name")
        .eq("id", schoolId)
        .single();

      for (const fee of overdue || []) {
        const stu = fee.student as any;
        if (!stu?.parent?.id) continue;

        const { data: parentUser } = await supabase.auth.admin.getUserById(stu.parent.id);
        const mobile = parentUser?.user?.phone || parentUser?.user?.user_metadata?.mobile;
        if (!mobile) { failed++; continue; }

        const msg =
          `Dear Parent,\n\n` +
          `This is a reminder that the *${(fee.fee_structure as any)?.name || "School Fee"}* ` +
          `of *₹${Number(fee.amount).toLocaleString("en-IN")}* for *${stu.first_name} ${stu.last_name}* ` +
          `was due on *${fee.due_date}*.\n\n` +
          `Please pay at the earliest to avoid late fines. You can pay online via the parent portal.\n\n` +
          `_-${school?.name || "School Administration"}_`;

        const ok = await sendWhatsApp(mobile, msg, fast2smsKey);
        ok ? sent++ : failed++;
      }
    }

    // ── TYPE: exam_result ──────────────────────────────────────
    // Notify parent when exam results are published
    else if (type === "exam_result") {
      const { examId } = payload;
      if (!examId) throw new Error("examId required");

      const { data: exam } = await supabase
        .from("exams")
        .select("title")
        .eq("id", examId)
        .single();

      const { data: marks } = await supabase
        .from("exam_marks")
        .select(`
          marks_obtained, grade,
          exams:exam_id(total_marks),
          student:student_id(
            first_name, last_name,
            parent:parent_user_id(id)
          )
        `)
        .eq("school_id", schoolId)
        .eq("exam_id", examId);

      const { data: school } = await supabase
        .from("schools")
        .select("name")
        .eq("id", schoolId)
        .single();

      for (const mark of marks || []) {
        const stu = mark.student as any;
        if (!stu?.parent?.id) continue;

        const { data: parentUser } = await supabase.auth.admin.getUserById(stu.parent.id);
        const mobile = parentUser?.user?.phone || parentUser?.user?.user_metadata?.mobile;
        if (!mobile) { failed++; continue; }

        const totalMarks = (mark.exams as any)?.total_marks || 100;
        const pct = Math.round((mark.marks_obtained / totalMarks) * 100);

        const msg =
          `Dear Parent,\n\n` +
          `*${exam?.title || "Exam"} Results* for *${stu.first_name} ${stu.last_name}*:\n\n` +
          `📊 Marks: *${mark.marks_obtained}/${totalMarks}* (${pct}%)\n` +
          `🎯 Grade: *${mark.grade || "—"}*\n\n` +
          `Login to the parent portal to view detailed results.\n\n` +
          `_-${school?.name || "School"}_`;

        const ok = await sendWhatsApp(mobile, msg, fast2smsKey);
        ok ? sent++ : failed++;
      }
    }

    // ── TYPE: custom ───────────────────────────────────────────
    // Send custom message to specific numbers
    else if (type === "custom") {
      const { message, numbers } = payload;
      for (const mobile of numbers || []) {
        const ok = await sendWhatsApp(mobile, message, fast2smsKey);
        ok ? sent++ : failed++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, type, sent, failed }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
