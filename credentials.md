# EduNextGen — GEMS International School Demo Credentials

## 🌐 Login URL (sabke liye same)
```
http://localhost:5173/gems/login
```

---

## 👑 School Admin
| Field    | Value           |
|----------|-----------------|
| Email    | admin@gems.edu  |
| Password | Admin@gems123   |

---

## 👨‍🏫 Teachers

| Name          | Email            | Password     | Subject     |
|---------------|-----------------|--------------|-------------|
| Rajesh Kumar  | rajesh@gems.edu | Teacher@1234 | Mathematics |
| Priya Sharma  | priya@gems.edu  | Teacher@1234 | English     |

**Teacher Portal:** `http://localhost:5173/gems/teacher`

---

## 👩‍🎓 Students — Password sabka: `Student@1234`

### Email Pattern: `c{class}s{01-10}@gems.edu`

| Class | Student 1        | Student 2        | ... | Student 10        |
|-------|-----------------|-----------------|-----|------------------|
| 1     | c1s01@gems.edu  | c1s02@gems.edu  | ... | c1s10@gems.edu   |
| 2     | c2s01@gems.edu  | c2s02@gems.edu  | ... | c2s10@gems.edu   |
| 3     | c3s01@gems.edu  | c3s02@gems.edu  | ... | c3s10@gems.edu   |
| 4     | c4s01@gems.edu  | c4s02@gems.edu  | ... | c4s10@gems.edu   |
| 5     | c5s01@gems.edu  | c5s02@gems.edu  | ... | c5s10@gems.edu   |
| 6     | c6s01@gems.edu  | c6s02@gems.edu  | ... | c6s10@gems.edu   |
| 7     | c7s01@gems.edu  | c7s02@gems.edu  | ... | c7s10@gems.edu   |
| 8     | c8s01@gems.edu  | c8s02@gems.edu  | ... | c8s10@gems.edu   |
| 9     | c9s01@gems.edu  | c9s02@gems.edu  | ... | c9s10@gems.edu   |
| 10    | c10s01@gems.edu | c10s02@gems.edu | ... | c10s10@gems.edu  |
| 11    | c11s01@gems.edu | c11s02@gems.edu | ... | c11s10@gems.edu  |
| 12    | c12s01@gems.edu | c12s02@gems.edu | ... | c12s10@gems.edu  |

**Total: 120 students**

---

## 📊 Demo Data (After Seed Script Runs)
- 1 School: GEMS International School
- 12 Classes (Class 1–12, Section A), Academic Year 2025-2026
- 2 Teachers + 120 Students
- Timetable: Classes 9–12 (Mon–Sat, 6 periods/day)
- 5 Announcements
- 5 Homework assignments
- 1 Exam (First Unit Test) + Marks for Class 10
- Attendance: Class 10, last 7 days
- 10 Syllabus entries for Class 10

---

## ▶️ Seed Script Run Karne Ka Tarika

```powershell
# 1. Project root mein jao
cd "d:\worloard\sms(scoole management  software )"

# 2. Dependency install karo (agar nahi hai)
npm install @supabase/supabase-js

# 3. Service Role Key set karo
# (Supabase Dashboard → Settings → API → service_role secret key copy karo)
$env:SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."

# 4. Script run karo
node supabase/seed_full_demo.js
```

> Script ~5-10 min mein complete ho jaayegi (123 auth users ban rahe hain)
