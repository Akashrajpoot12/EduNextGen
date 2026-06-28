import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyCaller } from "../_shared/auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function sendWhatsApp(mobile: string, message: string, apiKey: string): Promise<boolean> {
  const res = await fetch("https://www.fast2sms.com/dev/wa", {
    method: "POST",
    headers: { authorization: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ message, numbers: mobile }),
  });
  const data = await res.json();
  return data?.return === true;
}

async function sendSMS(mobile: string, message: string, apiKey: string): Promise<boolean> {
  // Fast2SMS bulk SMS (quick route). For production in India, switch to a
  // DLT-approved route + sender id/template.
  const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
    method: "POST",
    headers: { authorization: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ route: "q", message, numbers: mobile, flash: 0 }),
  });
  const data = await res.json();
  return data?.return === true;
}

// Normalise to a clean 10-digit Indian mobile; returns "" if not valid.
function cleanMobile(raw: unknown): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

type Target = { mobile: string; message: string };

// Send to all targets with bounded concurrency so large blasts don't run
// sequentially (which would exceed the edge-function wall-clock limit).
async function runPool(
  targets: Target[],
  send: (m: string, msg: string, key: string) => Promise<boolean>,
  apiKey: string,
  concurrency = 10,
): Promise<{ sent: number; failed: number }> {
  let sent = 0, failed = 0;
  for (let i = 0; i < targets.length; i += concurrency) {
    const chunk = targets.slice(i, i + concurrency);
    const results = await Promise.all(
      chunk.map((t) => send(t.mobile, t.message, apiKey).catch(() => false)),
    );
    for (const ok of results) ok ? sent++ : failed++;
  }
  return { sent, failed };
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

    // ── Authorization: caller must be an admin/staff/teacher of THIS school ──
    // (super_admin allowed via hasRoleInSchool). Without this, any logged-in user
    // of any school could broadcast to another school and burn the SMS quota.
    const caller = await verifyCaller(req);
    if (!caller) return jsonResp({ error: "Unauthorized" }, 401);
    if (!schoolId || !caller.hasRoleInSchool(schoolId, ["school_admin", "admin", "staff", "teacher"])) {
      return jsonResp({ error: "Forbidden: not an admin of this school" }, 403);
    }

    // Collect recipients, then send them all with bounded concurrency below.
    const targets: Target[] = [];
    let channel: string = "whatsapp";
    let noMobile = 0;

    // ── TYPE: absent_alert ─────────────────────────────────────
    // Send WhatsApp to parents of absent students
    if (type === "absent_alert") {
      const date = payload?.date || new Date().toISOString().split("T")[0];

      const { data: absent } = await supabase
        .from("daily_attendance")
        .select(`
          student:student_id(
            id, first_name, last_name, enrollment_number, phone,
            classes:class_id(grade_level, section)
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
        const mobile = cleanMobile(stu?.phone);
        if (!mobile) { noMobile++; continue; }

        const msg =
          `Dear Parent,\n\n` +
          `Your child *${stu.first_name} ${stu.last_name}* (Class ${stu.classes?.grade_level}-${stu.classes?.section}) ` +
          `was marked *ABSENT* today (${date}) at *${school?.name || "school"}*.\n\n` +
          `If this is incorrect, please contact the class teacher.\n\n` +
          `_-${school?.name || "EduNest"}_`;

        targets.push({ mobile, message: msg });
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
            first_name, last_name, phone
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
        const mobile = cleanMobile(stu?.phone);
        if (!mobile) { noMobile++; continue; }

        const msg =
          `Dear Parent,\n\n` +
          `This is a reminder that the *${(fee.fee_structure as any)?.name || "School Fee"}* ` +
          `of *₹${Number(fee.amount).toLocaleString("en-IN")}* for *${stu.first_name} ${stu.last_name}* ` +
          `was due on *${fee.due_date}*.\n\n` +
          `Please pay at the earliest to avoid late fines. You can pay online via the parent portal.\n\n` +
          `_-${school?.name || "School Administration"}_`;

        targets.push({ mobile, message: msg });
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
            first_name, last_name, phone
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
        const mobile = cleanMobile(stu?.phone);
        if (!mobile) { noMobile++; continue; }

        const totalMarks = (mark.exams as any)?.total_marks || 100;
        const pct = Math.round((mark.marks_obtained / totalMarks) * 100);

        const msg =
          `Dear Parent,\n\n` +
          `*${exam?.title || "Exam"} Results* for *${stu.first_name} ${stu.last_name}*:\n\n` +
          `📊 Marks: *${mark.marks_obtained}/${totalMarks}* (${pct}%)\n` +
          `🎯 Grade: *${mark.grade || "—"}*\n\n` +
          `Login to the parent portal to view detailed results.\n\n` +
          `_-${school?.name || "School"}_`;

        targets.push({ mobile, message: msg });
      }
    }

    // ── TYPE: custom ───────────────────────────────────────────
    // Send to specific numbers. Supports:
    //   - one message to many: { message, numbers, channel? }
    //   - personalised:        { items: [{ mobile, message }], channel? }
    // channel: "whatsapp" (default) | "sms"
    else if (type === "custom") {
      const { message, numbers, items, channel: ch } = payload || {};
      channel = ch === "sms" ? "sms" : "whatsapp";

      if (Array.isArray(items)) {
        for (const it of items) {
          const m = cleanMobile(it?.mobile);
          if (!m) { noMobile++; continue; }
          targets.push({ mobile: m, message: it.message });
        }
      } else {
        for (const mobile of numbers || []) {
          const m = cleanMobile(mobile);
          if (!m) { noMobile++; continue; }
          targets.push({ mobile: m, message });
        }
      }
    }

    // ── TYPE: broadcast ────────────────────────────────────────
    // Resolve recipient numbers by group server-side, then send via the
    // chosen channel ("whatsapp" | "sms").
    else if (type === "broadcast") {
      const { recipientType, channel: ch, message } = payload || {};
      if (!message) throw new Error("message required");
      channel = ch === "sms" ? "sms" : "whatsapp";

      let rows: { phone: string | null }[] = [];
      if (recipientType === "All_Students" || recipientType === "Parents") {
        const { data } = await supabase
          .from("students").select("phone").eq("school_id", schoolId).not("phone", "is", null);
        rows = data || [];
      } else if (recipientType === "All_Teachers") {
        const { data } = await supabase
          .from("users").select("phone").eq("school_id", schoolId).eq("role", "teacher").not("phone", "is", null);
        rows = data || [];
      } else if (recipientType === "Staff") {
        const { data } = await supabase
          .from("users").select("phone").eq("school_id", schoolId).eq("role", "staff").not("phone", "is", null);
        rows = data || [];
      } else {
        throw new Error("Unsupported recipientType: " + recipientType);
      }

      const numbers = [...new Set(rows.map((r) => cleanMobile(r.phone)).filter(Boolean))];
      for (const mobile of numbers) targets.push({ mobile, message });
    }

    // ── Dispatch all collected recipients with bounded concurrency ──
    const sendFn = channel === "sms" ? sendSMS : sendWhatsApp;
    const pooled = await runPool(targets, sendFn, fast2smsKey);
    const sent = pooled.sent;
    const failed = pooled.failed + noMobile;

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
