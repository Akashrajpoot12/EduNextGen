import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIRST_NAMES = [
  "Aarav","Ananya","Arjun","Diya","Ishaan","Kavya","Krishna","Meera","Neha","Rohan",
  "Sanya","Shiv","Tanvi","Veer","Yash","Zara","Aditya","Bhavna","Chirag","Deepa",
  "Esha","Farhan","Gauri","Harsh","Isha","Jay","Komal","Lakshmi","Manav","Nisha",
  "Om","Pooja","Ravi","Simran","Tarun","Uma","Varun","Wishi","Yamini","Abhi",
  "Bela","Chetan","Divya","Ekta","Faiz","Gita","Hina","Ishan","Jyoti","Kabir",
  "Lata","Mohit","Naina","Parth","Radha","Sahil","Trisha","Uday","Vijay","Aisha",
  "Bhuvan","Chhavi","Dhruv","Elina","Firoz","Gopika","Hemant","Indu","Jatin","Kiran",
  "Lalit","Mahi","Nakul","Ojas","Pragya","Rahul","Samar","Tulsi","Usha","Vivek",
  "Fatima","Gagan","Heena","Imran","Kartik","Leena","Mukul","Nina","Puja","Roshan",
  "Sunita","Tarun","Urvi","Vikas","Waqar","Xander","Yuvraj","Alok","Bina","Charu",
  "Deepak","Ela","Farida","Gopal","Harini","Irfan","Jasmine","Kishore","Latika","Madan",
  "Naman","Priti","Rajiv","Shruti","Tasveer","Umesh","Vasant","Yamuna","Zubin","Ankit",
];

const LAST_NAMES = [
  "Sharma","Verma","Singh","Patel","Mehta","Kumar","Gupta","Joshi","Nair","Rao",
  "Reddy","Das","Shah","Malhotra","Pandey","Mishra","Iyer","Pillai","Bose","Khan",
];

function pad(n: number) { return String(n).padStart(2, "0"); }

async function createUser(supabase: any, email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) {
    if (error.message.includes("already") || error.message.includes("exists")) {
      const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      return list?.users?.find((u: any) => u.email === email)?.id ?? null;
    }
    return null;
  }
  return data.user.id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const log: string[] = [];
    let nameIndex = 0;

    // ── SCHOOL ──────────────────────────────────────────────────
    let { data: school } = await supabase.from("schools").select("id").eq("subdomain", "gems").single();
    let schoolId: string;

    if (school) {
      schoolId = school.id;
      log.push("✅ School already exists");
    } else {
      const { data: s, error } = await supabase.from("schools").insert({
        name: "GEMS International School", subdomain: "gems",
        admin_email: "admin@gems.edu", admin_name: "School Admin", is_active: true,
      }).select("id").single();
      if (error) return new Response(JSON.stringify({ error: "School failed: " + error.message }), { status: 400, headers: cors });
      schoolId = s.id;
      log.push("✅ School created: GEMS International School");
    }

    // ── ACADEMIC YEAR ────────────────────────────────────────────
    let { data: existYear } = await supabase.from("academic_years").select("id").eq("school_id", schoolId).eq("is_active", true).single();
    let yearId: string;
    if (existYear) {
      yearId = existYear.id;
    } else {
      const { data: yr } = await supabase.from("academic_years").insert({
        school_id: schoolId, name: "2025-2026",
        start_date: "2025-04-01", end_date: "2026-03-31", is_active: true,
      }).select("id").single();
      yearId = yr.id;
    }
    log.push("✅ Academic Year: 2025-2026");

    // ── ADMIN ────────────────────────────────────────────────────
    const adminUid = await createUser(supabase, "admin@gems.edu", "Admin@gems123", "School Admin");
    if (adminUid) {
      await supabase.from("users").upsert({ id: adminUid, email: "admin@gems.edu", full_name: "School Admin", name: "School Admin", school_id: schoolId, role: "school_admin" }, { onConflict: "id" });
      await supabase.from("user_roles").upsert({ user_id: adminUid, school_id: schoolId, role: "school_admin" }, { onConflict: "user_id,school_id,role" });
      log.push("✅ Admin: admin@gems.edu / Admin@gems123");
    }

    // ── TEACHERS ────────────────────────────────────────────────
    const teacherData = [
      { name: "Rajesh Kumar", email: "rajesh@gems.edu", password: "Teacher@1234", subject: "Mathematics", department: "Science", qualification: "M.Sc Mathematics" },
      { name: "Priya Sharma", email: "priya@gems.edu",  password: "Teacher@1234", subject: "English",     department: "Languages", qualification: "M.A. English" },
    ];
    const teacherIds: string[] = [];
    for (const t of teacherData) {
      const uid = await createUser(supabase, t.email, t.password, t.name);
      if (uid) {
        await supabase.from("users").upsert({
          id: uid, email: t.email, full_name: t.name, name: t.name,
          school_id: schoolId, role: "teacher",
          subject: t.subject, department: t.department, qualification: t.qualification, joining_date: "2024-06-01",
        }, { onConflict: "id" });
        await supabase.from("user_roles").upsert({ user_id: uid, school_id: schoolId, role: "teacher" }, { onConflict: "user_id,school_id,role" });
        teacherIds.push(uid);
        log.push(`✅ Teacher: ${t.email} / ${t.password}`);
      }
    }

    // ── CLASSES + STUDENTS ───────────────────────────────────────
    const classIds: Record<number, string> = {};
    const allStudents: { id: string; uid: string; classId: string; grade: number }[] = [];

    for (let grade = 1; grade <= 12; grade++) {
      const label = `Class ${grade}`;
      let { data: existCls } = await supabase.from("classes").select("id").eq("school_id", schoolId).eq("grade_level", label).eq("section", "A").single();
      let classId: string;
      if (existCls) {
        classId = existCls.id;
      } else {
        const { data: cls } = await supabase.from("classes").insert({
          school_id: schoolId, academic_year_id: yearId, grade_level: label, section: "A",
        }).select("id").single();
        classId = cls.id;
      }
      classIds[grade] = classId;

      for (let s = 1; s <= 10; s++) {
        const fn = FIRST_NAMES[nameIndex % FIRST_NAMES.length];
        const ln = LAST_NAMES[nameIndex % LAST_NAMES.length];
        const fullName = `${fn} ${ln}`;
        const email = `c${grade}s${pad(s)}@gems.edu`;
        nameIndex++;

        const uid = await createUser(supabase, email, "Student@1234", fullName);
        if (uid) {
          await supabase.from("users").upsert({ id: uid, email, full_name: fullName, name: fullName, school_id: schoolId, role: "student" }, { onConflict: "id" });
          await supabase.from("user_roles").upsert({ user_id: uid, school_id: schoolId, role: "student" }, { onConflict: "user_id,school_id,role" });
          const { data: stu } = await supabase.from("students").upsert({
            school_id: schoolId, class_id: classId, user_id: uid,
            first_name: fn, last_name: ln,
            enrollment_number: `GEMS${grade}${pad(s)}26`,
            gender: nameIndex % 2 === 0 ? "Male" : "Female",
          }, { onConflict: "user_id" }).select("id").single();
          if (stu) allStudents.push({ id: stu.id, uid, classId, grade });
        }
      }
      log.push(`✅ Class ${grade}: 10 students`);
    }

    // ── ANNOUNCEMENTS ────────────────────────────────────────────
    const anns = [
      { title: "Annual Sports Day — 25 July 2026", content: "All students must participate. Events include 100m race, long jump, cricket and kabaddi. Register with class teacher by 20 July.", audience: "all" },
      { title: "Mid-Term Exams: 1–10 August 2026", content: "Detailed timetable released. Students must carry hall tickets.", audience: "students" },
      { title: "Staff Meeting — 28 June @ 3 PM", content: "Mandatory meeting in conference hall. Agenda: curriculum planning.", audience: "teachers" },
      { title: "Fee Payment Last Date: 30 June", content: "Pay Q2 fees before 30 June to avoid late charges.", audience: "parents" },
      { title: "200 New Library Books Added", content: "Science, history and fiction books now available. Borrow up to 2 books for 2 weeks.", audience: "all" },
    ];
    for (const ann of anns) {
      await supabase.from("announcements").insert({ school_id: schoolId, title: ann.title, content: ann.content, audience: ann.audience, target_audience: ann.audience, created_by: teacherIds[0] });
    }
    log.push("✅ 5 Announcements created");

    // ── HOMEWORK ─────────────────────────────────────────────────
    const hwItems = [
      { grade: 10, subject: "Mathematics", title: "Quadratic Equations — Ex 4.3", desc: "Solve Q1–15. Show all steps.", due: "2026-06-25" },
      { grade: 10, subject: "Physics",     title: "Laws of Motion Numericals",    desc: "10 numericals from Chapter 3.", due: "2026-06-26" },
      { grade: 9,  subject: "English",     title: "Essay: My Favourite Festival", desc: "300-word essay.", due: "2026-06-24" },
      { grade: 12, subject: "Chemistry",   title: "Organic Reactions",           desc: "All reactions from Ch 12.", due: "2026-06-28" },
      { grade: 11, subject: "Mathematics", title: "Trigonometry Practice",        desc: "20 problems in practice sheet.", due: "2026-06-27" },
    ];
    for (const hw of hwItems) {
      if (classIds[hw.grade]) {
        await supabase.from("homework").insert({
          school_id: schoolId, class_id: classIds[hw.grade], teacher_id: teacherIds[0],
          title: hw.title, description: hw.desc, subject: hw.subject, due_date: hw.due, created_by: teacherIds[0],
        });
      }
    }
    log.push("✅ 5 Homework assignments created");

    // ── EXAM + MARKS ─────────────────────────────────────────────
    const { data: exam } = await supabase.from("exams").insert({
      school_id: schoolId, academic_year_id: yearId,
      name: "First Unit Test 2026", exam_type: "unit_test",
      class_id: classIds[10], subject: "Mathematics",
      start_date: "2026-06-01", end_date: "2026-06-05", total_marks: 100,
    }).select("id").single();
    if (exam) {
      const cls10 = allStudents.filter(s => s.grade === 10);
      for (const stu of cls10) {
        await supabase.from("exam_marks").upsert({
          school_id: schoolId, exam_id: exam.id, student_id: stu.id,
          subject: "Mathematics",
          marks_obtained: Math.floor(Math.random() * 40 + 60),
          max_marks: 100,
          grade: ["A+","A","B+","B","C"][Math.floor(Math.random() * 5)],
          recorded_by: teacherIds[0],
        }, { onConflict: "exam_id,student_id,subject" });
      }
      log.push("✅ Exam + marks for Class 10 created");
    }

    // ── ATTENDANCE (last 7 days) ──────────────────────────────────
    const cls10 = allStudents.filter(s => s.grade === 10);
    const today = new Date();
    for (let d = 6; d >= 0; d--) {
      const dt = new Date(today); dt.setDate(today.getDate() - d);
      if (dt.getDay() === 0) continue;
      const dateStr = dt.toISOString().split("T")[0];
      for (const stu of cls10) {
        await supabase.from("daily_attendance").upsert({
          school_id: schoolId, student_id: stu.id, class_id: stu.classId,
          date: dateStr, status: Math.random() > 0.15 ? "present" : "absent",
          marked_by: teacherIds[0],
        }, { onConflict: "student_id,date" });
      }
    }
    log.push("✅ Attendance: Class 10, last 7 days");

    // ── TIMETABLE ────────────────────────────────────────────────
    const subjectsByGrade: Record<string, string[]> = {
      "9":  ["English","Mathematics","Physics","Chemistry","Biology","Computer"],
      "10": ["English","Mathematics","Physics","Chemistry","Biology","Computer"],
      "11": ["English","Mathematics","Physics","Chemistry","Biology","CS"],
      "12": ["English","Mathematics","Physics","Chemistry","Biology","CS"],
    };
    for (const [g, subs] of Object.entries(subjectsByGrade)) {
      const cId = classIds[Number(g)];
      if (!cId) continue;
      for (let day = 1; day <= 6; day++) {
        for (let p = 0; p < subs.length; p++) {
          const hr = 8 + p;
          await supabase.from("timetables").upsert({
            school_id: schoolId, class_id: cId, day_of_week: day, period_number: p + 1,
            subject: subs[p], teacher_id: teacherIds[p % 2] ?? teacherIds[0],
            start_time: `${pad(hr)}:00:00`, end_time: `${pad(hr + 1)}:00:00`,
          }, { onConflict: "class_id,day_of_week,period_number" });
        }
      }
    }
    log.push("✅ Timetable: Classes 9–12");

    return new Response(JSON.stringify({ success: true, log }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
