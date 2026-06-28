// ================================================================
// RICH DEMO SEED SCRIPT — EduNextGen School Management
// Run: node supabase/seed_rich_demo.js
// Adds: 8 teachers, 10 parent accounts, 30-day attendance for all classes,
//       5 exams + marks, fees, payroll, library, leaves, health, transport,
//       complaints, visitor logs, daily diary, announcements, circulars, etc.
// ================================================================
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://wnpidwhjbrdufsdlhrrm.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error("❌ Set SUPABASE_SERVICE_ROLE_KEY env variable first!");
  console.error("   Run: $env:SUPABASE_SERVICE_ROLE_KEY='your_service_role_key'");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── HELPERS ────────────────────────────────────────────────────
function pad(n) { return String(n).padStart(2, "0"); }
function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[rnd(0, arr.length - 1)]; }
function dateStr(daysAgo) {
  const d = new Date("2026-06-20");
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}
function futureDate(daysAhead) {
  const d = new Date("2026-06-20");
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split("T")[0];
}

async function createAuthUser(email, password, fullName) {
  const { data, error } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) {
    if (error.message.includes("already") || error.message.includes("exists")) {
      const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      return users.find((u) => u.email === email)?.id || null;
    }
    console.error(`  ❌ Auth error for ${email}:`, error.message);
    return null;
  }
  return data.user.id;
}

// ─── CONSTANTS ──────────────────────────────────────────────────
const SCHOOL_SUBDOMAIN = "gems";

const NEW_TEACHERS = [
  { name: "Amit Verma",       email: "amit@gems.edu",    subject: "Physics",          department: "Science",     qualification: "M.Sc Physics",          phone: "9812345001" },
  { name: "Sunita Joshi",     email: "sunita@gems.edu",  subject: "Chemistry",        department: "Science",     qualification: "M.Sc Chemistry",         phone: "9812345002" },
  { name: "Raman Singh",      email: "raman@gems.edu",   subject: "History",          department: "Social",      qualification: "M.A. History",           phone: "9812345003" },
  { name: "Kavitha Pillai",   email: "kavitha@gems.edu", subject: "Geography",        department: "Social",      qualification: "M.A. Geography",         phone: "9812345004" },
  { name: "Sanjay Mehta",     email: "sanjay@gems.edu",  subject: "Computer Science", department: "Technology",  qualification: "M.Tech CS",              phone: "9812345005" },
  { name: "Deepa Nair",       email: "deepa@gems.edu",   subject: "Biology",          department: "Science",     qualification: "M.Sc Biology",           phone: "9812345006" },
  { name: "Harsh Malhotra",   email: "harsh@gems.edu",   subject: "Hindi",            department: "Languages",   qualification: "M.A. Hindi",             phone: "9812345007" },
  { name: "Pooja Reddy",      email: "pooja@gems.edu",   subject: "Social Studies",   department: "Social",      qualification: "B.Ed Social",            phone: "9812345008" },
];

const SUBJECTS_BY_CLASS = {
  "1":  ["English","Hindi","Mathematics","EVS","Art"],
  "2":  ["English","Hindi","Mathematics","EVS","Art"],
  "3":  ["English","Hindi","Mathematics","Science","Social Studies"],
  "4":  ["English","Hindi","Mathematics","Science","Social Studies"],
  "5":  ["English","Hindi","Mathematics","Science","Social Studies"],
  "6":  ["English","Hindi","Mathematics","Science","Social Studies","Computer"],
  "7":  ["English","Hindi","Mathematics","Science","Social Studies","Computer"],
  "8":  ["English","Hindi","Mathematics","Science","Social Studies","Computer"],
  "9":  ["English","Hindi","Mathematics","Physics","Chemistry","Biology","History","Geography","Computer"],
  "10": ["English","Hindi","Mathematics","Physics","Chemistry","Biology","History","Geography","Computer"],
  "11": ["English","Mathematics","Physics","Chemistry","Biology","Computer Science"],
  "12": ["English","Mathematics","Physics","Chemistry","Biology","Computer Science"],
};

// ─── MAIN ────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 Starting RICH DEMO seed for GEMS International School...\n");

  // ── Get existing school ──
  const { data: school } = await supabase.from("schools").select("id").eq("subdomain", SCHOOL_SUBDOMAIN).single();
  if (!school) { console.error("❌ School not found! Run seed_full_demo.js first."); process.exit(1); }
  const schoolId = school.id;
  console.log(`✅ Found school: ${schoolId}`);

  const { data: year } = await supabase.from("academic_years").select("id").eq("school_id", schoolId).eq("is_active", true).single();
  const yearId = year?.id;
  console.log(`✅ Found academic year: ${yearId}`);

  // Get existing teachers
  const { data: existingTeacherRows } = await supabase.from("users").select("id").eq("school_id", schoolId).eq("role", "teacher");
  let teacherIds = (existingTeacherRows || []).map((r) => r.id);
  console.log(`✅ Existing teachers: ${teacherIds.length}`);

  // Get existing classes
  const { data: classRows } = await supabase.from("classes").select("id, grade_level").eq("school_id", schoolId);
  const classIds = {};
  for (const c of classRows || []) {
    const grade = parseInt(c.grade_level.replace("Class ", ""));
    classIds[grade] = c.id;
  }
  console.log(`✅ Found ${Object.keys(classIds).length} classes`);

  // Get all students
  const { data: studentRows } = await supabase.from("students").select("id, class_id, user_id").eq("school_id", schoolId);
  const allStudents = studentRows || [];
  const studentsByClass = {};
  for (const s of allStudents) {
    const grade = Object.keys(classIds).find((g) => classIds[g] === s.class_id);
    if (grade) {
      if (!studentsByClass[grade]) studentsByClass[grade] = [];
      studentsByClass[grade].push(s);
    }
  }
  console.log(`✅ Found ${allStudents.length} students\n`);

  // ── 1. NEW TEACHERS ──────────────────────────────────────────────
  console.log("👨‍🏫 Adding 8 more teachers...");
  for (const t of NEW_TEACHERS) {
    const uid = await createAuthUser(t.email, "Teacher@1234", t.name);
    if (uid) {
      await supabase.from("users").upsert({
        id: uid, email: t.email, full_name: t.name, name: t.name,
        school_id: schoolId, role: "teacher",
        subject: t.subject, department: t.department, qualification: t.qualification,
        phone: t.phone, joining_date: "2024-06-01",
      }, { onConflict: "id" });
      await supabase.from("user_roles").upsert(
        { user_id: uid, school_id: schoolId, role: "teacher" },
        { onConflict: "user_id,school_id,role" }
      );
      if (!teacherIds.includes(uid)) teacherIds.push(uid);
    }
  }
  console.log(`  ✅ Total teachers now: ${teacherIds.length}`);

  // ── 2. PARENT ACCOUNTS (10 parents, 2 children each) ────────────
  console.log("\n👪 Creating 10 parent accounts...");
  const parentNames = [
    ["Vijay Sharma","vijay.parent@gems.edu"],["Meena Patel","meena.parent@gems.edu"],
    ["Suresh Verma","suresh.parent@gems.edu"],["Rekha Singh","rekha.parent@gems.edu"],
    ["Arun Kumar","arun.parent@gems.edu"],["Smita Gupta","smita.parent@gems.edu"],
    ["Rajiv Joshi","rajiv.parent@gems.edu"],["Kavya Nair","kavya.parent@gems.edu"],
    ["Dinesh Rao","dinesh.parent@gems.edu"],["Anita Mishra","anita.parent@gems.edu"],
  ];
  let parentIdx = 0;
  for (const [pName, pEmail] of parentNames) {
    const uid = await createAuthUser(pEmail, "Parent@1234", pName);
    if (uid) {
      await supabase.from("users").upsert({
        id: uid, email: pEmail, full_name: pName, name: pName,
        school_id: schoolId, role: "parent", phone: `9900${pad(parentIdx)}${pad(parentIdx + 1)}00`,
      }, { onConflict: "id" });
      await supabase.from("user_roles").upsert(
        { user_id: uid, school_id: schoolId, role: "parent" },
        { onConflict: "user_id,school_id,role" }
      );
      // Link to 2 students
      const grade1 = (parentIdx % 12) + 1;
      const grade2 = ((parentIdx + 3) % 12) + 1;
      const studs1 = studentsByClass[grade1] || [];
      const studs2 = studentsByClass[grade2] || [];
      if (studs1[parentIdx % studs1.length]) {
        await supabase.from("students").update({ parent_id: uid }).eq("id", studs1[parentIdx % studs1.length].id);
      }
      if (studs2[(parentIdx + 1) % Math.max(studs2.length, 1)]) {
        await supabase.from("students").update({ parent_id: uid }).eq("id", studs2[(parentIdx + 1) % studs2.length].id);
      }
      parentIdx++;
    }
  }
  console.log("  ✅ 10 parents created and linked to students");

  // ── 3. ATTENDANCE — 30 days for ALL classes ──────────────────────
  console.log("\n📋 Creating 30-day attendance for all classes...");
  for (const grade of Object.keys(classIds)) {
    const students = studentsByClass[grade] || [];
    if (!students.length) continue;
    let count = 0;
    for (let d = 29; d >= 0; d--) {
      const dt = dateStr(d);
      const dow = new Date(dt).getDay();
      if (dow === 0) continue; // skip Sunday
      for (const stu of students) {
        const rand = Math.random();
        const status = rand > 0.88 ? "absent" : rand > 0.82 ? "late" : "present";
        await supabase.from("daily_attendance").upsert({
          school_id: schoolId, student_id: stu.id,
          class_id: stu.class_id, date: dt,
          status, marked_by: teacherIds[0],
        }, { onConflict: "student_id,date" });
      }
      count++;
    }
    process.stdout.write(`  ✅ Class ${grade}: ${count} days done\n`);
  }

  // ── 4. MULTIPLE EXAMS + MARKS ────────────────────────────────────
  console.log("\n📊 Creating 5 exams with marks for all classes...");
  const EXAMS_DEF = [
    { name: "First Unit Test",  type: "unit_test",    start: "2026-04-15", end: "2026-04-19", max: 25  },
    { name: "Mid-Term Exam",    type: "mid_term",     start: "2026-05-10", end: "2026-05-18", max: 50  },
    { name: "Second Unit Test", type: "unit_test",    start: "2026-06-01", end: "2026-06-05", max: 25  },
    { name: "Term-End Exam",    type: "term_end",     start: "2026-06-20", end: "2026-06-28", max: 100 },
    { name: "Practical Exam",   type: "practical",    start: "2026-06-10", end: "2026-06-12", max: 30  },
  ];
  const examIds = [];
  for (const ed of EXAMS_DEF) {
    const { data: ex, error } = await supabase.from("exams").insert({
      school_id: schoolId, academic_year_id: yearId,
      name: ed.name, exam_type: ed.type,
      start_date: ed.start, end_date: ed.end, total_marks: ed.max,
    }).select("id").single();
    if (ex) examIds.push({ id: ex.id, max: ed.max, name: ed.name });
    console.log(`  ✅ Exam created: ${ed.name}`);
  }

  // Add marks for all classes × all exams × core subjects
  console.log("  📝 Adding marks for all students...");
  const GRADE_SUBJECTS = { high: ["Mathematics","Physics","Chemistry"], low: ["English","Hindi"] };
  for (const ex of examIds) {
    for (const grade of ["9","10","11","12"]) {
      const students = studentsByClass[grade] || [];
      const subjects = SUBJECTS_BY_CLASS[grade].slice(0, 5);
      for (const stu of students) {
        for (const subj of subjects) {
          const marks = rnd(Math.floor(ex.max * 0.45), ex.max);
          const pct = marks / ex.max;
          const grade_letter = pct >= 0.9 ? "A+" : pct >= 0.8 ? "A" : pct >= 0.7 ? "B+" : pct >= 0.6 ? "B" : pct >= 0.5 ? "C" : "D";
          await supabase.from("exam_marks").upsert({
            school_id: schoolId, exam_id: ex.id, student_id: stu.id,
            subject: subj, marks_obtained: marks, max_marks: ex.max,
            grade: grade_letter, recorded_by: teacherIds[0],
          }, { onConflict: "exam_id,student_id,subject" });
        }
      }
    }
  }
  console.log("  ✅ Marks added for Classes 9-12");

  // ── 5. HOMEWORK — all classes ────────────────────────────────────
  console.log("\n📝 Creating homework for all classes...");
  const HW_DATA = [
    [10,"Mathematics","Quadratic Equations Ex 4.3","Solve Q1–Q15, show working.",2],
    [10,"Physics","Laws of Motion Numericals","10 numericals from Ch.3.",3],
    [9,"English","Essay: My Favourite Festival","300-word essay.",1],
    [12,"Chemistry","Organic Reactions","Write all reactions from Ch.12.",8],
    [11,"Mathematics","Trigonometry Practice","Complete 20 problems.",7],
    [8,"Science","Photosynthesis Diagram","Draw and label diagram.",4],
    [7,"Social Studies","Map Work: Rivers of India","Mark 15 rivers.",5],
    [6,"Computer","HTML Basics","Create a simple web page.",4],
    [5,"Mathematics","Fractions Worksheet","Complete exercise 5.2.",2],
    [4,"English","Story Writing","Write a 150-word story.",3],
    [3,"EVS","My Neighbourhood","Draw and describe.",2],
    [2,"Hindi","10 sentences about family","Write in Hindi.",1],
    [1,"Art","Draw and colour a tree","Crayons required.",2],
    [11,"Physics","Kinematics Problems","15 problems from module.",6],
    [12,"Biology","Genetics Notes","Write notes on Mendelian genetics.",5],
  ];
  for (const [grade, subject, title, desc, daysAhead] of HW_DATA) {
    const classId = classIds[grade];
    if (!classId) continue;
    const teacherIdx = (grade + subject.length) % teacherIds.length;
    await supabase.from("homework").insert({
      school_id: schoolId, class_id: classId,
      teacher_id: teacherIds[teacherIdx],
      title, description: desc, subject,
      due_date: futureDate(daysAhead),
      created_by: teacherIds[teacherIdx],
    });
  }
  console.log("  ✅ 15 homework assignments across all classes");

  // ── 6. FEE STRUCTURE + PAYMENTS ─────────────────────────────────
  console.log("\n💰 Creating fee assignments and payments...");
  const FEE_BY_GRADE = { 1:2500,2:2500,3:3000,4:3000,5:3000,6:3500,7:3500,8:3500,9:4500,10:4500,11:5000,12:5000 };
  for (const grade of Object.keys(classIds)) {
    const students = studentsByClass[grade] || [];
    const amount = FEE_BY_GRADE[grade] || 3000;
    for (const stu of students) {
      // Fee assignment
      const { data: fa } = await supabase.from("student_fee_assignments").upsert({
        school_id: schoolId, student_id: stu.id,
        academic_year_id: yearId,
        fee_type: "tuition", amount, due_date: "2026-06-30",
        status: "active",
      }, { onConflict: "student_id,academic_year_id,fee_type" }).select("id").single();

      // Payment (85% students have paid)
      if (Math.random() > 0.15 && fa) {
        await supabase.from("fee_payments").insert({
          school_id: schoolId, student_id: stu.id,
          fee_assignment_id: fa.id,
          amount_paid: amount, payment_date: dateStr(rnd(5, 25)),
          payment_mode: pick(["online","cash","cheque","upi"]),
          receipt_number: `RCPT${grade}${stu.id.slice(-4).toUpperCase()}`,
          status: "paid",
        }).select("id").single().catch(() => {});
      }
    }
  }
  console.log("  ✅ Fee assignments and payments for all students");

  // ── 7. PAYROLL ───────────────────────────────────────────────────
  console.log("\n💼 Creating payroll records for teachers...");
  const SALARY_MAP = {
    "Mathematics":52000,"Physics":50000,"Chemistry":50000,"English":48000,
    "Hindi":45000,"Biology":50000,"Computer Science":55000,"History":44000,
    "Geography":44000,"Social Studies":43000,"Science":47000,"Art":38000,"EVS":38000,
  };
  for (let m = 0; m < 3; m++) {
    const monthDate = dateStr(30 * (m + 1));
    for (const tid of teacherIds) {
      const { data: tu } = await supabase.from("users").select("subject").eq("id", tid).single();
      const base = SALARY_MAP[tu?.subject] || 45000;
      await supabase.from("payroll").insert({
        school_id: schoolId, user_id: tid,
        month: monthDate.slice(0, 7),
        basic_salary: base, allowances: rnd(3000, 8000), deductions: rnd(1000, 3000),
        net_salary: base + rnd(2000, 5000) - rnd(500, 2000),
        payment_date: monthDate,
        payment_mode: pick(["bank_transfer","cheque"]),
        status: m < 2 ? "paid" : "pending",
      }).select("id").single().catch(() => {});
    }
  }
  console.log("  ✅ 3 months payroll for all teachers");

  // ── 8. STAFF ATTENDANCE ──────────────────────────────────────────
  console.log("\n🕐 Creating staff attendance (last 15 days)...");
  for (let d = 14; d >= 0; d--) {
    const dt = dateStr(d);
    if (new Date(dt).getDay() === 0) continue;
    for (const tid of teacherIds) {
      await supabase.from("staff_attendance").upsert({
        school_id: schoolId, user_id: tid, date: dt,
        status: Math.random() > 0.08 ? "present" : "absent",
        check_in: "08:30:00", check_out: "16:30:00",
      }, { onConflict: "user_id,date" }).catch(() => {});
    }
  }
  console.log("  ✅ Staff attendance for last 15 days");

  // ── 9. LEAVE APPLICATIONS ────────────────────────────────────────
  console.log("\n🏖️ Creating leave applications...");
  const leaveTypes = ["sick","casual","maternity","earned"];
  for (let i = 0; i < 20; i++) {
    const tid = teacherIds[i % teacherIds.length];
    const start = dateStr(rnd(2, 20));
    const end = dateStr(rnd(0, 2));
    await supabase.from("leave_applications").insert({
      school_id: schoolId, user_id: tid,
      leave_type: pick(leaveTypes),
      start_date: start, end_date: end,
      reason: pick([
        "Fever and cold, doctor advised rest",
        "Family function out of town",
        "Medical appointment",
        "Personal emergency",
        "Child's school event",
        "High fever — self",
      ]),
      status: pick(["approved","pending","rejected"]),
      applied_on: dateStr(rnd(21, 30)),
    }).select("id").single().catch(() => {});
  }
  // Student leave applications
  for (let i = 0; i < 15; i++) {
    const grade = rnd(1, 12);
    const students = studentsByClass[grade] || [];
    if (!students.length) continue;
    const stu = students[i % students.length];
    await supabase.from("leave_applications").insert({
      school_id: schoolId, student_id: stu.id,
      leave_type: pick(["sick","casual"]),
      start_date: dateStr(rnd(2, 15)),
      end_date: dateStr(rnd(0, 1)),
      reason: pick(["Viral fever","Family trip","Medical checkup","Stomach pain"]),
      status: pick(["approved","pending"]),
      applied_on: dateStr(rnd(15, 20)),
    }).select("id").single().catch(() => {});
  }
  console.log("  ✅ 35 leave applications (staff + students)");

  // ── 10. LIBRARY BOOKS ────────────────────────────────────────────
  console.log("\n📚 Adding library books...");
  const BOOKS = [
    ["NCERT Mathematics Class 10","NCERT","Mathematics","9780000001"],
    ["NCERT Physics Part 1 Class 12","NCERT","Physics","9780000002"],
    ["NCERT Chemistry Part 2 Class 12","NCERT","Chemistry","9780000003"],
    ["Wings of Fire — A. P. J. Abdul Kalam","APJ Abdul Kalam","Biography","9780000004"],
    ["The Discovery of India — Nehru","Jawaharlal Nehru","History","9780000005"],
    ["Introduction to Algorithms","Cormen et al","Computer Science","9780000006"],
    ["Animal Farm","George Orwell","Fiction","9780000007"],
    ["The Alchemist","Paulo Coelho","Fiction","9780000008"],
    ["NCERT Biology Class 12","NCERT","Biology","9780000009"],
    ["Maths Olympiad Problems","Sharma","Mathematics","9780000010"],
    ["English Grammar in Use","Raymond Murphy","English","9780000011"],
    ["Indian Geography","Majid Husain","Geography","9780000012"],
    ["Modern History of India","Bipan Chandra","History","9780000013"],
    ["Computer Networks","Andrew Tanenbaum","Computer Science","9780000014"],
    ["Organic Chemistry","Morrison Boyd","Chemistry","9780000015"],
    ["Feynman Lectures on Physics","Feynman","Physics","9780000016"],
    ["Hindi Vyakaran","Kamta Prasad Guru","Hindi","9780000017"],
    ["Environmental Science","Kaushik & Kaushik","EVS","9780000018"],
    ["Drawing & Painting Guide","Art Faculty","Art","9780000019"],
    ["NCERT Social Science Class 8","NCERT","Social Studies","9780000020"],
  ];
  const bookIds = [];
  for (const [title, author, category, isbn] of BOOKS) {
    const total = rnd(3, 8);
    const { data: bk } = await supabase.from("library_books").upsert({
      school_id: schoolId, title, author, category,
      isbn, total_copies: total, available_copies: total,
      publication_year: rnd(2015, 2024),
      shelf_location: `Shelf-${pick(["A","B","C","D"])}-${rnd(1,5)}`,
    }, { onConflict: "school_id,isbn" }).select("id").single();
    if (bk) bookIds.push(bk.id);
  }
  console.log("  ✅ 20 library books added");

  // Library issues
  for (let i = 0; i < 25; i++) {
    const grade = rnd(6, 12);
    const students = studentsByClass[grade] || [];
    if (!students.length || !bookIds.length) continue;
    const stu = students[i % students.length];
    const issueDate = dateStr(rnd(5, 25));
    const returned = Math.random() > 0.4;
    await supabase.from("library_issues").insert({
      school_id: schoolId, book_id: bookIds[i % bookIds.length],
      student_id: stu.id, issued_date: issueDate,
      due_date: futureDate(14 - rnd(0, 5)),
      return_date: returned ? dateStr(rnd(0, 4)) : null,
      status: returned ? "returned" : "issued",
    }).select("id").single().catch(() => {});
  }
  console.log("  ✅ 25 library issues created");

  // ── 11. BUS ROUTES / TRANSPORT ───────────────────────────────────
  console.log("\n🚌 Creating bus routes...");
  const ROUTES = [
    { name: "Route A — Civil Lines", stops: ["Civil Lines","Kanak Nagar","Shastri Nagar","School"] },
    { name: "Route B — Rajpur Road",  stops: ["Rajpur Road","Jakhan","Dehradun Club","School"] },
    { name: "Route C — Prem Nagar",   stops: ["Prem Nagar","Ballupur","Race Course","School"] },
    { name: "Route D — Dalanwala",    stops: ["Dalanwala","Rispana","Clock Tower","School"] },
  ];
  for (const r of ROUTES) {
    await supabase.from("bus_routes").upsert({
      school_id: schoolId, route_name: r.name,
      stops: r.stops,
      driver_name: pick(["Ram Prasad","Suresh Lal","Ganesh Yadav","Mohan Singh"]),
      driver_phone: `9811${rnd(100000, 999999)}`,
      vehicle_number: `UK07PA${rnd(1000, 9999)}`,
      capacity: 40,
    }, { onConflict: "school_id,route_name" }).catch(() => {});
  }
  console.log("  ✅ 4 bus routes created");

  // ── 12. HEALTH RECORDS ──────────────────────────────────────────
  console.log("\n🏥 Creating health records...");
  const CONDITIONS = ["Asthma","Diabetes Type 1","Allergic Rhinitis","None","Myopia","Colour Blindness"];
  const BLOODGROUPS = ["A+","A-","B+","B-","O+","O-","AB+","AB-"];
  for (let g = 9; g <= 12; g++) {
    const students = studentsByClass[g] || [];
    for (const stu of students) {
      await supabase.from("health_records").upsert({
        school_id: schoolId, student_id: stu.id,
        blood_group: pick(BLOODGROUPS),
        allergies: Math.random() > 0.7 ? pick(["Peanuts","Dust","Pollen","None"]) : "None",
        medical_conditions: pick(CONDITIONS),
        emergency_contact: `98${rnd(10000000, 99999999)}`,
        last_checkup_date: dateStr(rnd(30, 120)),
        next_checkup_date: futureDate(rnd(30, 90)),
        height_cm: rnd(145, 175), weight_kg: rnd(40, 70),
        vision_left: pick(["6/6","6/9","6/12"]), vision_right: pick(["6/6","6/9"]),
        doctor_name: pick(["Dr. Mehta","Dr. Sharma","Dr. Patel"]),
      }, { onConflict: "school_id,student_id" }).catch(() => {});
    }
  }
  console.log("  ✅ Health records for Classes 9-12");

  // ── 13. ANNOUNCEMENTS & CIRCULARS ───────────────────────────────
  console.log("\n📢 Creating more announcements and circulars...");
  const MORE_ANNOUNCEMENTS = [
    { title: "School Reopens After Summer Break — 21 June 2026", content: "All students must report in full uniform at 8:00 AM on June 21. New academic schedule will be distributed.", target: "all" },
    { title: "Inter-School Science Exhibition — 10 July 2026", content: "Students from Classes 8-12 can register for the annual Science Exhibition. Last date: 30 June. Register with science teacher.", target: "students" },
    { title: "Parent-Teacher Meeting — 5 July 2026", content: "PTM scheduled for Classes 6-10 on 5 July from 9 AM to 1 PM. Parents must collect progress report slips.", target: "parents" },
    { title: "Teacher Training Workshop — 22 June", content: "All teaching staff must attend the digital classroom training from 10 AM to 4 PM on 22 June.", target: "teachers" },
    { title: "Annual Fee Hike Notice AY 2026-27", content: "Fee structure for AY 2026-27 has been revised. New fee schedule available at admin office and school portal.", target: "parents" },
    { title: "Yoga & Wellness Day — 21 June", content: "International Yoga Day celebration at 7 AM on school grounds. Attendance compulsory for all classes.", target: "all" },
    { title: "New Computer Lab Inaugurated", content: "The new 40-seat computer lab with high-speed internet is now open for students of Classes 6-12.", target: "all" },
  ];
  for (const ann of MORE_ANNOUNCEMENTS) {
    await supabase.from("announcements").insert({
      school_id: schoolId, title: ann.title, content: ann.content,
      audience: ann.target,
      created_by: teacherIds[0],
    }).catch(() => {});
  }

  // Circulars
  const CIRCULARS = [
    { title: "Uniform Policy Update", content: "From July 2026 onwards, boys must wear white shirt with navy blue trousers. Girls to wear salwar kameez as per school colours.", issued_to: "all" },
    { title: "No-Junk-Food Policy", content: "Canteen will no longer serve junk food items. Only nutritious options available. Students not to bring outside food.", issued_to: "students" },
    { title: "Mobile Phone Ban", content: "Mobile phones are strictly prohibited on school premises for students. Violation leads to confiscation and parent meeting.", issued_to: "students" },
    { title: "Emergency Exit Drill — 25 June", content: "Fire drill and emergency exit drill scheduled on 25 June at 11 AM. All students to participate.", issued_to: "all" },
  ];
  for (const circ of CIRCULARS) {
    await supabase.from("circulars").insert({
      school_id: schoolId, title: circ.title, content: circ.content,
      issued_to: circ.issued_to, issued_by: teacherIds[0],
      issued_date: dateStr(rnd(0, 10)),
    }).select("id").single().catch(() => {});
  }
  console.log("  ✅ 7 announcements + 4 circulars created");

  // ── 14. VISITOR LOGS ─────────────────────────────────────────────
  console.log("\n🚶 Creating visitor logs...");
  const VISITOR_PURPOSES = ["Parent meeting","Job interview","Inspection","Delivery","Repair work","Vendor meeting"];
  for (let i = 0; i < 20; i++) {
    await supabase.from("visitor_logs").insert({
      school_id: schoolId,
      visitor_name: `${pick(["Ramesh","Suresh","Geeta","Preeti","Arjun","Mohan"])} ${pick(["Sharma","Patel","Verma","Singh","Kumar"])}`,
      purpose: pick(VISITOR_PURPOSES),
      phone: `98${rnd(10000000, 99999999)}`,
      visit_date: dateStr(rnd(0, 14)),
      check_in: `${pad(rnd(9, 14))}:${pick(["00","15","30","45"])}:00`,
      check_out: `${pad(rnd(15, 17))}:${pick(["00","15","30","45"])}:00`,
      met_with: teacherIds[i % teacherIds.length],
      id_proof: pick(["Aadhar","PAN","Driving Licence","Voter ID"]),
      status: "checked_out",
    }).select("id").single().catch(() => {});
  }
  console.log("  ✅ 20 visitor log entries");

  // ── 15. COMPLAINTS ───────────────────────────────────────────────
  console.log("\n📋 Creating complaints...");
  const COMPLAINTS = [
    { subject: "Classroom fan not working in 9A", type: "infrastructure", priority: "medium" },
    { subject: "Library books in poor condition", type: "academics", priority: "low" },
    { subject: "Bus Route C running late daily", type: "transport", priority: "high" },
    { subject: "Canteen food quality issue", type: "facilities", priority: "medium" },
    { subject: "Drinking water cooler not functional", type: "infrastructure", priority: "high" },
    { subject: "Homework too heavy for Class 3 students", type: "academics", priority: "medium" },
    { subject: "Bullying complaint — Class 7 student", type: "discipline", priority: "high" },
    { subject: "Uniform shop overcharging", type: "other", priority: "low" },
  ];
  for (const [i, c] of COMPLAINTS.entries()) {
    const grade = rnd(3, 12);
    const students = studentsByClass[grade] || [];
    const stu = students[i % Math.max(students.length, 1)];
    await supabase.from("complaints").insert({
      school_id: schoolId,
      subject: c.subject, complaint_type: c.type, priority: c.priority,
      status: pick(["open","in_progress","resolved"]),
      raised_by: stu?.user_id || teacherIds[0],
      raised_on: dateStr(rnd(2, 20)),
      description: `Complaint regarding: ${c.subject}. Please look into this matter urgently.`,
      resolved_on: Math.random() > 0.5 ? dateStr(rnd(0, 2)) : null,
    }).select("id").single().catch(() => {});
  }
  console.log("  ✅ 8 complaints created");

  // ── 16. DAILY DIARY (teacher notes) ─────────────────────────────
  console.log("\n📓 Creating teacher daily diary entries...");
  for (let d = 0; d < 10; d++) {
    const dt = dateStr(d);
    if (new Date(dt).getDay() === 0) continue;
    for (const [i, tid] of teacherIds.slice(0, 4).entries()) {
      const grade = [9, 10, 11, 12][i % 4];
      const classId = classIds[grade];
      if (!classId) continue;
      await supabase.from("daily_diary").insert({
        school_id: schoolId, teacher_id: tid,
        class_id: classId, date: dt,
        subject: pick(SUBJECTS_BY_CLASS[String(grade)]),
        topics_covered: pick([
          "Completed Chapter 3 revision","Introduced new concept","Practice problems solved",
          "Doubt clearing session","Group activity conducted","Test preparation"
        ]),
        homework_given: pick(["Exercise 4.1","Read pages 55-60","Complete worksheet","No homework"]),
        remarks: pick(["Good participation","Students were attentive","Need more practice","Excellent class"]),
      }).select("id").single().catch(() => {});
    }
  }
  console.log("  ✅ Daily diary entries for last 10 days");

  // ── 17. PTM MEETINGS ─────────────────────────────────────────────
  console.log("\n🤝 Creating PTM meetings...");
  const PTM_SESSIONS = [
    { date: futureDate(15), time: "09:00", class: 10, teacher: teacherIds[0] },
    { date: futureDate(15), time: "10:00", class: 9,  teacher: teacherIds[1] || teacherIds[0] },
    { date: futureDate(15), time: "11:00", class: 12, teacher: teacherIds[2] || teacherIds[0] },
    { date: futureDate(15), time: "12:00", class: 11, teacher: teacherIds[3] || teacherIds[0] },
  ];
  for (const p of PTM_SESSIONS) {
    const classId = classIds[p.class];
    if (!classId) continue;
    await supabase.from("ptm_meetings").insert({
      school_id: schoolId, class_id: classId,
      teacher_id: p.teacher,
      meeting_date: p.date, meeting_time: p.time,
      topic: `Parent-Teacher Meeting — Class ${p.class}`,
      status: "scheduled",
      notes: "Parents are requested to bring the progress report slip.",
    }).select("id").single().catch(() => {});
  }
  console.log("  ✅ 4 PTM meetings scheduled");

  // ── 18. INVENTORY ────────────────────────────────────────────────
  console.log("\n📦 Creating inventory items...");
  const INVENTORY_ITEMS = [
    ["Whiteboard Marker (Box)","Stationery",50,2],
    ["A4 Paper Ream","Stationery",100,10],
    ["Projector — BenQ","Electronics",5,1],
    ["Laptop — Dell","Electronics",20,2],
    ["Science Lab Microscope","Lab Equipment",15,3],
    ["Football","Sports",10,2],
    ["Cricket Bat","Sports",8,1],
    ["First Aid Kit","Medical",4,1],
    ["Printer Cartridge HP","Electronics",12,3],
    ["Chalk Box","Stationery",200,20],
  ];
  for (const [name, category, qty, minQty] of INVENTORY_ITEMS) {
    await supabase.from("inventory").upsert({
      school_id: schoolId, item_name: name, category,
      quantity: qty, minimum_quantity: minQty,
      unit: pick(["nos","box","ream","set"]),
      last_updated: dateStr(rnd(0, 10)),
    }, { onConflict: "school_id,item_name" }).catch(() => {});
  }
  console.log("  ✅ 10 inventory items");

  // ── 19. EXPENSES LEDGER ──────────────────────────────────────────
  console.log("\n💳 Creating expenses ledger...");
  const EXPENSE_CATS = ["Utilities","Maintenance","Stationery","Sports","Lab","Salaries","Transport","Canteen"];
  for (let i = 0; i < 15; i++) {
    await supabase.from("expenses_ledger").insert({
      school_id: schoolId,
      category: pick(EXPENSE_CATS),
      description: pick([
        "Electricity bill payment","Water bill","AC repair Class 10","Sports kit purchase",
        "Science lab chemicals","Whiteboard markers bulk order","Bus maintenance",
        "Canteen equipment repair","Printer paper purchase","Gardening supplies",
      ]),
      amount: rnd(500, 25000),
      expense_date: dateStr(rnd(0, 30)),
      payment_mode: pick(["bank_transfer","cash","cheque"]),
      approved_by: teacherIds[0],
    }).select("id").single().catch(() => {});
  }
  console.log("  ✅ 15 expense entries");

  // ── 20. SYLLABUS — all classes ───────────────────────────────────
  console.log("\n📗 Adding syllabus for all classes...");
  const TOPICS = {
    "Mathematics": [["Real Numbers","Ch 1","completed"],["Polynomials","Ch 2","completed"],["Linear Equations","Ch 3","in_progress"],["Quadratic Equations","Ch 4","pending"]],
    "Physics":     [["Motion","Ch 1","completed"],["Force & Laws","Ch 2","completed"],["Gravitation","Ch 3","in_progress"]],
    "English":     [["The Fun They Had","Unit 1","completed"],["The Sound of Music","Unit 2","completed"],["The Little Girl","Unit 3","in_progress"]],
    "Chemistry":   [["Matter in Surroundings","Ch 1","completed"],["Pure Substances","Ch 2","completed"],["Atoms and Molecules","Ch 3","in_progress"]],
    "Hindi":       [["Do Bailon Ki Katha","Ch 1","completed"],["Lhasa Ki Aur","Ch 2","in_progress"],["Upbhogvad Ki Sanskriti","Ch 3","pending"]],
  };
  for (const grade of ["9","10","11","12"]) {
    const classId = classIds[grade];
    if (!classId) continue;
    for (const [subj, topicList] of Object.entries(TOPICS)) {
      for (const [topic, chapter, status] of topicList) {
        await supabase.from("syllabus_topics").upsert({
          school_id: schoolId, class_id: classId,
          teacher_id: teacherIds[0], subject: subj,
          topic, chapter, status,
          academic_year: "2025-2026",
        }, { onConflict: "school_id,class_id,subject,topic" }).catch(() => {
          // try alternate table name
          supabase.from("syllabus").upsert({
            school_id: schoolId, class_id: classId,
            teacher_id: teacherIds[0], subject: subj,
            topic, chapter, status,
            academic_year: "2025-2026",
          }, { onConflict: "school_id,class_id,subject,topic" }).catch(() => {});
        });
      }
    }
  }
  console.log("  ✅ Syllabus topics for Classes 9-12");

  // ── 21. TIMETABLE — all classes ──────────────────────────────────
  console.log("\n🗓️ Adding timetable for all classes...");
  const DAYS = [1,2,3,4,5,6];
  for (const grade of Object.keys(classIds)) {
    const classId = classIds[grade];
    const subjects = SUBJECTS_BY_CLASS[String(grade)] || [];
    if (!classId || !subjects.length) continue;
    for (const day of DAYS) {
      for (let p = 0; p < Math.min(subjects.length, 6); p++) {
        const startHr = 8 + p;
        const tIdx = (parseInt(grade) + p + day) % teacherIds.length;
        await supabase.from("timetables").upsert({
          school_id: schoolId, class_id: classId,
          day_of_week: day, period_number: p + 1,
          subject: subjects[p % subjects.length],
          teacher_id: teacherIds[tIdx],
          start_time: `${pad(startHr)}:00:00`,
          end_time: `${pad(startHr + 1)}:00:00`,
        }, { onConflict: "class_id,day_of_week,period_number" });
      }
    }
  }
  console.log("  ✅ Timetable for all 12 classes");

  // ── DONE ─────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(65));
  console.log("✅  RICH DEMO SEED COMPLETE!");
  console.log("═".repeat(65));
  console.log(`
📌 School: GEMS International School (subdomain: gems)
🌐 Login: http://localhost:5173/gems/login

📊 Data added in this run:
   👨‍🏫  8 new teachers (total ~10)
   👪  10 parent accounts (linked to students)
   📋  30-day attendance for all 12 classes
   📝  15 homework assignments (all classes)
   📊  5 exams + marks for Classes 9-12
   💰  Fee assignments + payments for all 120 students
   💼  3-month payroll for all teachers
   🕐  15-day staff attendance
   🏖️  35 leave applications
   📚  20 library books + 25 issues
   🚌  4 bus routes
   🏥  Health records for Classes 9-12
   📢  7 announcements + 4 circulars
   🚶  20 visitor logs
   📋  8 complaints
   📓  Daily diary entries
   🤝  4 PTM meetings
   📦  10 inventory items
   💳  15 expense entries
   📗  Syllabus for Classes 9-12
   🗓️  Timetable for all 12 classes

🔑 Login Credentials:
   Admin:    admin@gems.edu        / Admin@gems123
   Teacher:  rajesh@gems.edu       / Teacher@1234
   Teacher:  amit@gems.edu         / Teacher@1234
   Student:  c10s01@gems.edu       / Student@1234
   Parent:   vijay.parent@gems.edu / Parent@1234
`);
}

main().catch(console.error);
