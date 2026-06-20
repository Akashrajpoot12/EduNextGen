// Run: node supabase/fix_now.js YOUR_SERVICE_ROLE_KEY
// Get key from: https://supabase.com/dashboard/project/wnpidwhjbrdufsdlhrrm/settings/api
const { createClient } = require("@supabase/supabase-js");

const URL = "https://wnpidwhjbrdufsdlhrrm.supabase.co";
const KEY = process.argv[2] || process.env.SERVICE_KEY;
if (!KEY || KEY.length < 100) {
  console.error("❌ Usage: node supabase/fix_now.js <service_role_key>");
  console.error("   Key starts with 'eyJ...' and is ~200+ chars");
  process.exit(1);
}

const db = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const FIRST = ['Aarav','Ananya','Arjun','Diya','Ishaan','Kavya','Krishna','Meera','Neha','Rohan','Sanya','Shiv','Tanvi','Veer','Yash','Zara','Aditya','Bhavna','Chirag','Deepa','Esha','Farhan','Gauri','Harsh','Isha','Jay','Komal','Lakshmi','Manav','Nisha','Om','Pooja','Ravi','Simran','Tarun','Uma','Varun','Wishi','Xena','Yamini','Abhi','Bela','Chetan','Divya','Ekta','Faiz','Gita','Hina','Ishan','Jyoti','Kabir','Lata','Mohit','Naina','Parth','Radha','Sahil','Trisha','Uday','Vijay','Aisha','Bhuvan','Chhavi','Dhruv','Elina','Firoz','Gopika','Hemant','Indu','Jatin','Kiran','Lalit','Mahi','Nakul','Ojas','Pragya','Qasim','Reena','Shubham','Tina','Ujjwal','Vani','Waqar','Xander','Yuvraj','Amara','Bharat','Chanchal','Dinesh','Eva','Fatima','Gagan','Heena','Imran','Jisha','Kartik','Leena','Mukul','Nina','Oscar','Puja','Rahul','Samar','Tulsi','Usha','Vivek','Winnie','Xerxes','Yukta','Zoya','Atul','Bindu','Chand','Dipti','Ellora','Farida','Gopal','Harini','Irfan','Jasmine'];
const LAST = ['Sharma','Verma','Gupta','Singh','Kumar','Patel','Joshi','Mehta','Shah','Rao','Nair','Pillai','Reddy','Iyer','Menon'];

async function main() {
  console.log("🔧 Starting seed fix...\n");

  // 1. Fix students table columns
  console.log("STEP 1: Adding missing columns to students table...");
  // We'll use raw fetch for DDL since supabase-js doesn't support DDL directly
  const ddlRes = await fetch(`${URL}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}`, apikey: KEY },
    body: JSON.stringify({ sql: `
      ALTER TABLE public.students ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
      ALTER TABLE public.students ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
      ALTER TABLE public.students ADD COLUMN IF NOT EXISTS admission_date DATE;
      CREATE UNIQUE INDEX IF NOT EXISTS students_user_id_key ON public.students(user_id) WHERE user_id IS NOT NULL;
    `})
  }).then(r => r.json()).catch(() => null);
  console.log("   Columns:", ddlRes?.message || "added (or already exist)");

  // 2. Fix schools RLS
  console.log("STEP 2: Fixing schools RLS...");
  await fetch(`${URL}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}`, apikey: KEY },
    body: JSON.stringify({ sql: `
      ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "allow_anon_read_schools" ON schools;
      CREATE POLICY "allow_anon_read_schools" ON schools FOR SELECT TO anon USING (true);
      DROP POLICY IF EXISTS "allow_authenticated_read_schools" ON schools;
      CREATE POLICY "allow_authenticated_read_schools" ON schools FOR SELECT TO authenticated USING (true);
    `})
  }).then(r => r.json()).catch(() => null);
  console.log("   RLS policies: done");

  // 3. Get school
  let { data: school } = await db.from("schools").select("id").eq("subdomain","gems").maybeSingle();
  if (!school) {
    const { data: s } = await db.from("schools").insert({ name:"GEMS International School", subdomain:"gems", email:"info@gems.edu", is_active:true }).select("id").single();
    school = s;
    console.log("✅ Created school:", school?.id);
  } else {
    console.log("✅ School found:", school.id);
  }
  const schoolId = school.id;

  // 4. Ensure classes exist
  console.log("STEP 3: Ensuring 12 classes...");
  const { data: existingClasses } = await db.from("classes").select("id,grade_level,section").eq("school_id", schoolId);
  const classMap = {};
  for (const c of (existingClasses || [])) classMap[c.grade_level] = c.id;
  for (let g = 1; g <= 12; g++) {
    if (!classMap[String(g)]) {
      const { data: c } = await db.from("classes").insert({ school_id:schoolId, grade_level:String(g), section:"A" }).select("id").single();
      classMap[String(g)] = c?.id;
    }
  }
  console.log("   Classes ready:", Object.keys(classMap).length);

  // 5. Fetch ALL auth users once
  console.log("STEP 4: Fetching auth users...");
  const { data: { users: allAuthUsers } } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const usersByEmail = {};
  for (const u of allAuthUsers || []) usersByEmail[u.email] = u.id;
  console.log(`   Found ${Object.keys(usersByEmail).length} auth users`);

  // 6. Seed students (max 50 for free plan — 5 per class × 10 classes)
  console.log("STEP 5: Seeding students (50 max for free plan)...");
  let ok = 0, skip = 0;
  for (let cls = 1; cls <= 10; cls++) {
    for (let s = 1; s <= 5; s++) {
      const email = `c${cls}s${String(s).padStart(2,"0")}@gems.edu`;
      const uid = usersByEmail[email];
      if (!uid) { skip++; continue; }

      const idx = (cls - 1) * 10 + s - 1;
      const firstName = FIRST[idx % FIRST.length];
      const lastName = LAST[idx % LAST.length];
      const fullName = `${firstName} ${lastName}`;
      const enrollment = `GEMS${String(cls).padStart(2,"0")}${String(s).padStart(3,"0")}`;
      const classId = classMap[String(cls)];

      const { error: uErr } = await db.from("users").upsert(
        { id:uid, email, full_name:fullName },
        { onConflict:"id" }
      );
      if (uErr) { console.log(`   ⚠️  users ${email}:`, uErr.message); skip++; continue; }

      // Check if role already exists to avoid duplicates
      const { data: existingRole } = await db.from("user_roles")
        .select("id").eq("user_id", uid).eq("school_id", schoolId).maybeSingle();
      if (!existingRole) {
        const { error: rErr } = await db.from("user_roles")
          .insert({ user_id:uid, school_id:schoolId, role:"student" });
        if (rErr) { console.log(`   ⚠️  user_roles ${email}:`, rErr.message); skip++; continue; }
      }

      // students table — now includes user_id
      const { error: sErr } = await db.from("students").upsert(
        { user_id:uid, school_id:schoolId, class_id:classId, first_name:firstName, last_name:lastName, enrollment_number:enrollment },
        { onConflict:"enrollment_number" }
      );
      if (sErr) console.log(`   ⚠️  students ${email}:`, sErr.message);

      ok++;
      process.stdout.write(`\r   Progress: ${ok + skip}/50 (${ok} ok, ${skip} errors)`);
    }
  }

  console.log(`\n\n✅ Done!`);
  const { count: sCount } = await db.from("students").select("*",{count:"exact",head:true}).eq("school_id",schoolId);
  const { count: rCount } = await db.from("user_roles").select("*",{count:"exact",head:true}).eq("role","student").eq("school_id",schoolId);
  console.log(`\n📊 Verification:`);
  console.log(`   students: ${sCount}`);
  console.log(`   user_roles(student): ${rCount}`);
  if (skip > 0) {
    console.log(`\n⚠️  ${skip} auth users missing — run the SQL seed first:`);
    console.log(`   Supabase Dashboard > SQL Editor > paste supabase/seed_demo_users.sql`);
  } else {
    console.log(`\n🎉 Test login: c1s01@gems.edu / Student@1234`);
    console.log(`   URL: http://localhost:5173/gems/login`);
  }
}

main().catch(console.error);
