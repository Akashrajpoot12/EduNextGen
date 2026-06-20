// ================================================================
// FULL DEMO SEED SCRIPT
// Run: node supabase/seed_full_demo.js
// Creates: 1 school, 2 teachers, 12 classes, 120 students + all demo data
// ================================================================
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://wnpidwhjbrdufsdlhrrm.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error("âŒ Set SUPABASE_SERVICE_ROLE_KEY env variable first!");
  console.error("   Run: $env:SUPABASE_SERVICE_ROLE_KEY='your_service_role_key'");
  console.error("   Find it: Supabase Dashboard â†’ Settings â†’ API â†’ service_role key");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// â”€â”€â”€ DEMO DATA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SCHOOL = {
  name: "GEMS International School",
  subdomain: "gems",
  admin_email: "admin@gems.edu",
  admin_password: "Admin@gems123",
  admin_name: "School Admin",
};

const TEACHERS = [
  { name: "Rajesh Kumar",  email: "rajesh@gems.edu",  password: "Teacher@1234", subject: "Mathematics",       department: "Science",     qualification: "M.Sc Mathematics" },
  { name: "Priya Sharma",  email: "priya@gems.edu",   password: "Teacher@1234", subject: "English",           department: "Languages",   qualification: "M.A. English" },
];

const FIRST_NAMES = [
  "Aarav","Ananya","Arjun","Diya","Ishaan","Kavya","Krishna","Meera","Neha","Rohan",
  "Sanya","Shiv","Tanvi","Veer","Yash","Zara","Aditya","Bhavna","Chirag","Deepa",
  "Esha","Farhan","Gauri","Harsh","Isha","Jay","Komal","Lakshmi","Manav","Nisha",
  "Om","Pooja","Ravi","Simran","Tarun","Uma","Varun","Wishi","Xena","Yamini",
  "Abhi","Bela","Chetan","Divya","Ekta","Faiz","Gita","Hina","Ishan","Jyoti",
  "Kabir","Lata","Mohit","Naina","Parth","Radha","Sahil","Trisha","Uday","Vijay",
  "Aisha","Bhuvan","Chhavi","Dhruv","Elina","Firoz","Gopika","Hemant","Indu","Jatin",
  "Kiran","Lalit","Mahi","Nakul","Ojas","Pragya","Qasim","Reena","Shubham","Tina",
  "Ujjwal","Vani","Waqar","Xander","Yuvraj","Amara","Bharat","Chanchal","Dinesh","Eva",
  "Fatima","Gagan","Heena","Imran","Jisha","Kartik","Leena","Mukul","Nina","Oscar",
  "Puja","Rahul","Samar","Tulsi","Usha","Vivek","Winnie","Xerxes","Yukta","Zoya",
  "Atul","Bindu","Chand","Dipti","Ellora","Farida","Gopal","Harini","Irfan","Jasmine",
];

const LAST_NAMES = [
  "Sharma","Verma","Singh","Patel","Mehta","Kumar","Gupta","Joshi","Nair","Rao",
  "Reddy","Das","Shah","Malhotra","Pandey","Mishra","Iyer","Pillai","Bose","Khan",
];

const SUBJECTS_BY_CLASS = {
  "1": ["English","Hindi","Mathematics","EVS","Art"],
  "2": ["English","Hindi","Mathematics","EVS","Art"],
  "3": ["English","Hindi","Mathematics","Science","Social Studies"],
  "4": ["English","Hindi","Mathematics","Science","Social Studies"],
  "5": ["English","Hindi","Mathematics","Science","Social Studies"],
  "6": ["English","Hindi","Mathematics","Science","Social Studies","Computer"],
  "7": ["English","Hindi","Mathematics","Science","Social Studies","Computer"],
  "8": ["English","Hindi","Mathematics","Science","Social Studies","Computer"],
  "9": ["English","Hindi","Mathematics","Physics","Chemistry","Biology","History","Geography","Computer"],
  "10": ["English","Hindi","Mathematics","Physics","Chemistry","Biology","History","Geography","Computer"],
  "11": ["English","Mathematics","Physics","Chemistry","Biology","Computer Science"],
  "12": ["English","Mathematics","Physics","Chemistry","Biology","Computer Science"],
};

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pad(n) { return String(n).padStart(2, "0"); }

async function createAuthUser(email, password, fullName) {
  const { data, error } = await supabase.auth.admin.createUser({
    email, password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) {
    if (error.message.includes("already been registered") || error.message.includes("already exists")) {
      const { data: { users } } = await supabase.auth.admin.listUsers();
      const existing = users.find(u => u.email === email);
      return existing?.id;
    }
    console.error(`  âŒ Auth error for ${email}:`, error.message);
    return null;
  }
  return data.user.id;
}

async function main() {
  console.log("ðŸš€ Starting GEMS International School demo seed...\n");

  // â”€â”€ 1. SCHOOL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log("ðŸ« Creating school...");
  let { data: existingSchool } = await supabase.from("schools").select("id").eq("subdomain", SCHOOL.subdomain).single();
  let schoolId;

  if (existingSchool) {
    schoolId = existingSchool.id;
    console.log(`  âœ… School already exists: ${schoolId}`);
  } else {
    const { data: newSchool, error } = await supabase.from("schools").insert({
      name: SCHOOL.name, subdomain: SCHOOL.subdomain,
      admin_email: SCHOOL.admin_email, admin_name: SCHOOL.admin_name, is_active: true,
    }).select("id").single();
    if (error) { console.error("âŒ School insert failed:", error.message); process.exit(1); }
    schoolId = newSchool.id;
    console.log(`  âœ… School created: ${schoolId}`);
  }

  // â”€â”€ 2. ACADEMIC YEAR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log("ðŸ“… Creating academic year...");
  let { data: existingYear } = await supabase.from("academic_years").select("id").eq("school_id", schoolId).eq("is_active", true).single();
  let yearId;
  if (existingYear) {
    yearId = existingYear.id;
  } else {
    const { data: yr } = await supabase.from("academic_years").insert({
      school_id: schoolId, name: "2025-2026",
      start_date: "2025-04-01", end_date: "2026-03-31", is_active: true,
    }).select("id").single();
    yearId = yr.id;
  }
  console.log(`  âœ… Academic year: 2025-2026`);

  // â”€â”€ 3. ADMIN USER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log("ðŸ‘¤ Creating school admin...");
  const adminUid = await createAuthUser(SCHOOL.admin_email, SCHOOL.admin_password, SCHOOL.admin_name);
  if (adminUid) {
    await supabase.from("users").upsert({
      id: adminUid, email: SCHOOL.admin_email, full_name: SCHOOL.admin_name,
      name: SCHOOL.admin_name, school_id: schoolId, role: "school_admin",
    }, { onConflict: "id" });
    await supabase.from("user_roles").upsert({ user_id: adminUid, school_id: schoolId, role: "school_admin" }, { onConflict: "user_id,school_id,role" });
    console.log(`  âœ… Admin: ${SCHOOL.admin_email}`);
  }

  // â”€â”€ 4. TEACHERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log("\nðŸ‘¨â€ðŸ« Creating teachers...");
  const teacherIds = [];
  for (const t of TEACHERS) {
    const uid = await createAuthUser(t.email, t.password, t.name);
    if (uid) {
      await supabase.from("users").upsert({
        id: uid, email: t.email, full_name: t.name, name: t.name,
        school_id: schoolId, role: "teacher",
        subject: t.subject, department: t.department, qualification: t.qualification,
        joining_date: "2024-06-01", phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      }, { onConflict: "id" });
      await supabase.from("user_roles").upsert({ user_id: uid, school_id: schoolId, role: "teacher" }, { onConflict: "user_id,school_id,role" });
      teacherIds.push(uid);
      console.log(`  âœ… Teacher: ${t.email}`);
    }
  }

  // â”€â”€ 5. CLASSES + STUDENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log("\nðŸ« Creating 12 classes + 10 students each...");
  const classIds = {};
  const allStudentIds = [];
  let nameIndex = 0;

  for (let grade = 1; grade <= 12; grade++) {
    const gradeLabel = `Class ${grade}`;

    // Create class
    let { data: existingClass } = await supabase.from("classes").select("id")
      .eq("school_id", schoolId).eq("grade_level", gradeLabel).eq("section", "A").single();
    let classId;
    if (existingClass) {
      classId = existingClass.id;
    } else {
      const { data: cls } = await supabase.from("classes").insert({
        school_id: schoolId, academic_year_id: yearId,
        grade_level: gradeLabel, section: "A",
      }).select("id").single();
      classId = cls.id;
    }
    classIds[grade] = classId;

    // Create 10 students
    for (let s = 1; s <= 10; s++) {
      const firstName = FIRST_NAMES[nameIndex % FIRST_NAMES.length];
      const lastName = LAST_NAMES[nameIndex % LAST_NAMES.length];
      const fullName = `${firstName} ${lastName}`;
      const email = `c${grade}s${pad(s)}@gems.edu`;
      const enrollNo = `GEMS${grade}${pad(s)}26`;
      nameIndex++;

      const uid = await createAuthUser(email, "Student@1234", fullName);
      if (uid) {
        await supabase.from("users").upsert({
          id: uid, email, full_name: fullName, name: fullName,
          school_id: schoolId, role: "student",
        }, { onConflict: "id" });
        await supabase.from("user_roles").upsert({ user_id: uid, school_id: schoolId, role: "student" }, { onConflict: "user_id,school_id,role" });

        // Insert student record
        const { data: stu } = await supabase.from("students").upsert({
          school_id: schoolId, class_id: classId,
          user_id: uid,
          first_name: firstName, last_name: lastName,
          enrollment_number: enrollNo,
          date_of_birth: `200${Math.floor(Math.random() * 8 + 1)}-${pad(Math.floor(Math.random() * 12 + 1))}-${pad(Math.floor(Math.random() * 28 + 1))}`,
          gender: nameIndex % 2 === 0 ? "Male" : "Female",
          address: `${Math.floor(Math.random() * 999 + 1)}, Demo Nagar, Test City`,
          phone: `97${Math.floor(10000000 + Math.random() * 90000000)}`,
        }, { onConflict: "user_id" }).select("id").single();

        if (stu) allStudentIds.push({ id: stu.id, uid, classId, grade, name: fullName });
      }
    }
    console.log(`  âœ… Class ${grade} â€” 10 students created`);
  }

  // â”€â”€ 6. TIMETABLE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log("\nðŸ“† Creating timetable...");
  const DAYS = [1,2,3,4,5,6]; // Mon-Sat
  for (const grade of [9, 10, 11, 12]) {
    const subjects = SUBJECTS_BY_CLASS[String(grade)];
    const classId = classIds[grade];
    if (!classId) continue;
    const teacher = teacherIds[0];
    let period = 1;
    for (const day of DAYS) {
      for (let p = 0; p < Math.min(subjects.length, 6); p++) {
        const startHr = 8 + p;
        await supabase.from("timetables").upsert({
          school_id: schoolId, class_id: classId,
          day_of_week: day, period_number: p + 1,
          subject: subjects[p % subjects.length],
          teacher_id: teacherIds[p % 2] || teacher,
          start_time: `${pad(startHr)}:00:00`,
          end_time: `${pad(startHr + 1)}:00:00`,
        }, { onConflict: "class_id,day_of_week,period_number" });
      }
    }
  }
  console.log("  âœ… Timetable created for Classes 9-12");

  // â”€â”€ 7. ANNOUNCEMENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log("\nðŸ“¢ Creating announcements...");
  const announcements = [
    { title: "Annual Sports Day â€” 25 July 2026", content: "All students must participate in the Annual Sports Day. Events include 100m race, long jump, cricket, and kabaddi. Register with your class teacher by 20 July.", target_audience: "all" },
    { title: "Mid-Term Examination Schedule Released", content: "Mid-term exams will be held from 1 August to 10 August 2026. Detailed timetable is attached. Students must carry their hall tickets.", target_audience: "students" },
    { title: "Staff Meeting â€” 28 June 2026", content: "Mandatory staff meeting in the conference hall at 3:00 PM. Agenda: curriculum planning for next quarter.", target_audience: "teachers" },
    { title: "Fee Payment Reminder â€” Last Date 30 June", content: "Parents are reminded to pay Q2 fees before 30 June to avoid late charges. Pay online at the school portal.", target_audience: "parents" },
    { title: "New Library Books Available", content: "Over 200 new books have been added to the school library including science, history and fiction. Students can borrow up to 2 books for 2 weeks.", target_audience: "all" },
  ];
  for (const ann of announcements) {
    await supabase.from("announcements").insert({
      school_id: schoolId, ...ann,
      created_by: teacherIds[0] || adminUid,
      audience: ann.target_audience,
    });
  }
  console.log("  âœ… 5 announcements created");

  // â”€â”€ 8. HOMEWORK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log("\nðŸ“ Creating homework...");
  const homeworkItems = [
    { grade: 10, subject: "Mathematics", title: "Quadratic Equations â€” Exercise 4.3", desc: "Solve Q1 to Q15 from NCERT textbook. Show all working steps.", due: "2026-06-25" },
    { grade: 10, subject: "Physics",     title: "Laws of Motion â€” Numericals",        desc: "Solve 10 numericals from chapter 3. Use proper units.", due: "2026-06-26" },
    { grade: 9,  subject: "English",     title: "Essay: My Favourite Festival",        desc: "Write a 300-word essay. Use descriptive language.", due: "2026-06-24" },
    { grade: 12, subject: "Chemistry",   title: "Organic Chemistry â€” Reactions",       desc: "Write all reactions from chapter 12 with mechanisms.", due: "2026-06-28" },
    { grade: 11, subject: "Mathematics", title: "Trigonometry Practice Set",           desc: "Complete all 20 problems in the practice sheet.", due: "2026-06-27" },
  ];
  for (const hw of homeworkItems) {
    const classId = classIds[hw.grade];
    if (!classId) continue;
    await supabase.from("homework").insert({
      school_id: schoolId, class_id: classId,
      teacher_id: teacherIds[0],
      title: hw.title, description: hw.desc,
      subject: hw.subject, due_date: hw.due,
      created_by: teacherIds[0],
    });
  }
  console.log("  âœ… 5 homework assignments created");

  // â”€â”€ 9. EXAMS + MARKS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log("\nðŸ“Š Creating exams + marks...");
  const { data: exam } = await supabase.from("exams").insert({
    school_id: schoolId, academic_year_id: yearId,
    name: "First Unit Test 2026", exam_type: "unit_test",
    start_date: "2026-06-01", end_date: "2026-06-05",
    total_marks: 100,
  }).select("id").single();

  if (exam) {
    const class10Students = allStudentIds.filter(s => s.grade === 10);
    for (const stu of class10Students) {
      await supabase.from("exam_marks").upsert({
        school_id: schoolId, exam_id: exam.id, student_id: stu.id,
        subject: "Mathematics",
        marks_obtained: Math.floor(Math.random() * 40 + 60),
        max_marks: 100,
        grade: ["A+","A","B+","B","C"][Math.floor(Math.random() * 5)],
        recorded_by: teacherIds[0],
      }, { onConflict: "exam_id,student_id,subject" });
    }
    console.log("  âœ… Exam + marks for Class 10 Mathematics created");
  }

  // â”€â”€ 10. ATTENDANCE (last 7 days) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log("\nâœ… Creating attendance records (last 7 days)...");
  const today = new Date();
  const class10Students = allStudentIds.filter(s => s.grade === 10);
  for (let d = 6; d >= 0; d--) {
    const date = new Date(today);
    date.setDate(today.getDate() - d);
    if (date.getDay() === 0) continue; // skip Sunday
    const dateStr = date.toISOString().split("T")[0];
    for (const stu of class10Students) {
      const status = Math.random() > 0.15 ? "present" : "absent";
      await supabase.from("daily_attendance").upsert({
        school_id: schoolId, student_id: stu.id,
        class_id: stu.classId, date: dateStr,
        status, marked_by: teacherIds[0],
      }, { onConflict: "student_id,date" });
    }
  }
  console.log("  âœ… Attendance for Class 10 (last 7 days) created");

  // â”€â”€ 11. SYLLABUS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log("\nðŸ“š Creating syllabus entries...");
  const syllabusItems = [
    { subject: "Mathematics", topic: "Real Numbers", chapter: "Chapter 1", status: "completed" },
    { subject: "Mathematics", topic: "Polynomials", chapter: "Chapter 2", status: "completed" },
    { subject: "Mathematics", topic: "Pair of Linear Equations", chapter: "Chapter 3", status: "completed" },
    { subject: "Mathematics", topic: "Quadratic Equations", chapter: "Chapter 4", status: "in_progress" },
    { subject: "Mathematics", topic: "Arithmetic Progressions", chapter: "Chapter 5", status: "pending" },
    { subject: "Physics", topic: "Light: Reflection and Refraction", chapter: "Chapter 10", status: "completed" },
    { subject: "Physics", topic: "Human Eye", chapter: "Chapter 11", status: "in_progress" },
    { subject: "Chemistry", topic: "Chemical Reactions", chapter: "Chapter 1", status: "completed" },
    { subject: "Chemistry", topic: "Acids, Bases and Salts", chapter: "Chapter 2", status: "completed" },
    { subject: "Chemistry", topic: "Metals and Non-metals", chapter: "Chapter 3", status: "pending" },
  ];
  for (const item of syllabusItems) {
    await supabase.from("syllabus").upsert({
      school_id: schoolId, class_id: classIds[10],
      teacher_id: teacherIds[0], ...item,
      academic_year: "2025-2026",
    }, { onConflict: "school_id,class_id,subject,topic" }).catch(() => {});
  }
  console.log("  âœ… 10 syllabus entries for Class 10 created");

  // â”€â”€ DONE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log("\n" + "=".repeat(60));
  console.log("âœ… DEMO SEED COMPLETE!");
  console.log("=".repeat(60));
  console.log(`\nðŸ“Œ School Subdomain: ${SCHOOL.subdomain}`);
  console.log(`ðŸŒ Login URL: http://localhost:5173/${SCHOOL.subdomain}/login`);
  console.log("\nðŸ“‹ See credentials.md for all login details");
}

main().catch(console.error);

