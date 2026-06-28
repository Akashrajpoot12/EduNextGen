# EduNextGen — School Management Software
## Complete Product Features Guide

> Multi-Tenant SaaS · 5 Panels · 120+ Features · Built with React + Supabase

---

## 🆕 v1.1 Updates (recently completed)

These previously-partial items are now fully functional:

| Area | What changed |
|------|--------------|
| **Face Attendance (real AI)** | New standalone `services/face-attendance` (Python · InsightFace SCRFD+ArcFace, 512-d). Enroll 10-15+ photos/person → `face_embeddings`; live recognition marks `daily_attendance`/`staff_attendance`. Students **and** staff/teachers. |
| **Web Face Enrollment** | Admin → Face AI → "AI Enroll (15 photos)" captures from the browser and sends to the service (set `VITE_FACE_SERVICE_URL`). |
| **GPS / Bus Tracking** | New `services/gps-tracking` (device → `/ping` → Supabase `bus_locations`). Admin & Parent pages show a **live Leaflet map** (realtime). |
| **WhatsApp / SMS (real send)** | Communications + Bulk Messages now dispatch via the Fast2SMS edge function (WhatsApp + SMS), not just wa.me links. |
| **Analytics charts** | Real recharts: monthly fee collection (bar) + 7-day attendance trend (area). |
| **Student Homework Submit** | Upload note + file to Supabase Storage (`homework` bucket) → `homework_submissions`; shows graded status. |
| **Student Fee Receipt** | Printable receipt (window.print) for paid fees. |
| **Subscription persistence** | Selected plan saved to `schools.subscription_plan` and restored on load. |
| **Biometric page** | Old localStorage stub retired → redirects to the real Face AI system. |

> Migrations added: `00032` (face embeddings), `00033` (bus locations), `00034` (homework storage bucket).

---

## 📋 Table of Contents

1. [Global Features](#global-features)
2. [🏫 Admin Panel](#-admin-panel)
3. [👩‍🏫 Teacher Panel](#-teacher-panel)
4. [🎒 Student Panel](#-student-panel)
5. [👨‍👩‍👧 Parent Panel](#-parent-panel)
6. [🌐 Super Admin Panel](#-super-admin-panel)
7. [Tech Stack](#tech-stack)

---

## Global Features

> Ye features sabhi panels mein available hain

| Feature | Description |
|---------|-------------|
| **Dark / Light Mode** | Default dark theme · user toggle se switch kar sakte hain · next-themes powered |
| **Brand Theme** | Primary: Purple/Magenta · Accent: Orange · oklch color space CSS variables |
| **🔍 Global Search** | `Cmd+K` se search modal khulta hai · pages filter hoti hain · click se navigate |
| **🔔 Notifications Bell** | Topbar mein bell icon · school announcements fetch · priority color dots · click-outside se close |
| **👤 Profile Menu** | Topbar mein avatar · name/email/role badge · Account Settings link · Logout button |
| **📱 Responsive Layout** | Sidebar + main content layout · mobile-friendly |
| **Multi-Tenant Routing** | Subdomain-based tenant routing `/:tenantId/` · har school ka alag data |
| **Role-Based Access** | super_admin / admin / teacher / student / parent — alag alag routes |
| **Account Settings Page** | Sabhi portals ke liye ek shared page · photo upload (Supabase Storage) · role-specific info · password notice |

---

## 🏫 Admin Panel

> School ke operations, finance, communication sab ek jagah

---

### 📊 Dashboard

| Feature | Description |
|---------|-------------|
| **🌤️ Good Morning Greeting** | Time-based greeting: Good Morning / Afternoon / Evening · school name in gradient text · Indian date format |
| **Stat Cards (4)** | Total Students · Total Teachers · Total Classes · Pending Fees (count + amount) |
| **Today's Attendance %** | Aaj kitne present hain percentage ke saath |
| **🎂 Today's Birthdays** | Students + Staff jinka aaj birthday hai — auto-fetch from DB |
| **📊 Daily Fee Collection Bar** | Aaj kitna fee collect hua vs target · animated progress bar |
| **⚠️ Absent Students + WhatsApp** | Aaj ke absent students count · "Send WhatsApp to Parents" 1-click button |
| **🔴 Below 75% Attendance Flag** | Kitne students 75% se kam attendance pe hain · warning chip |
| **📆 Exam in ≤3 Days Alert** | Agar koi exam 3 din mein hai toh red/amber banner show hota hai |
| **📈 Admissions Sparkline** | Is hafte ke daily admissions ka SVG line chart (7 days) |
| **👨‍🏫 Staff on Leave Today** | Aaj approved leave pe kaun hai · orange count badge |
| **📅 Fee Due This Week** | Is hafte kitne fees due hain · amber count chip |
| **🏆 Topper of the Month** | Is month ke exam results se top scorer auto-calculate · golden card · "📢 Announce to School" button |
| **🚌 Bus Delay Alert** | Message type karo · "Send WhatsApp to All Parents" button |
| **🏥 Health Record Expiry** | Jinke health records 30 din mein expire honge unki warning list |
| **🎉 All Fees Cleared Confetti** | Jab sab fees clear ho jaaye toh confetti animation + toast |
| **🔔 Realtime New Admission Ping** | Naya admission aate hi real-time toast notification + card pulse |
| **Upcoming Exams** | Agle exams ki list with dates |
| **Recent Admissions** | Naye admission applications |
| **Recently Enrolled Students** | Haal mein add hue students |

---

### 👨‍🎓 Students Management

| Feature | Description |
|---------|-------------|
| **Students Directory** | Search · class filter · paginated table · all students list |
| **Student Profile View** | Full profile: avatar, class, roll no, attendance %, marks, contact info |
| **🆔 Student ID Card Preview** | Har student row mein "ID Card" button · modal mein styled card (school name, photo, name, class, roll no) · Print button |
| **📤 Bulk Export Attendance CSV** | Header mein "Export Attendance CSV" button · monthly data · auto-download |
| **Admissions Page** | Applications list · status change (pending / approved / rejected) · applicant details |
| **Student Profile Edit** | Name, class, DOB, parent info update |

---

### 💰 Finance Management

| Feature | Description |
|---------|-------------|
| **Fee Structure** | Class-wise fee define karo |
| **Fee Assignments** | Students ko fee assign karo |
| **💰 Defaulter List** | Overdue > 30 days wale students · amount · last payment date |
| **📱 Fee Reminder WhatsApp** | 1-click send fee reminder to defaulter parents |
| **🧾 Receipt Auto-generate** | Payment ke baad printable receipt modal · school name, student, amount, date · "Paid" green stamp |
| **Payroll Management** | Teacher payroll records aur payment tracking |

---

### 📚 Academics

| Feature | Description |
|---------|-------------|
| **Classes Management** | Classes create/edit · grade level + section |
| **Timetable Management** | Weekly timetable view aur editing |
| **Syllabus Management** | Subject-wise topic list · completion tracking |
| **Homework Management** | Homework assign · due dates · class targeting |
| **Exam Management** | Exam schedule · marks entry |

---

### 👥 Staff Management

| Feature | Description |
|---------|-------------|
| **Teachers Directory** | Teacher profiles · subject · class assigned |
| **Staff Management** | Non-teaching staff records |
| **Leave Management** | Staff leave applications · approve/reject workflow |
| **Face AI Attendance** | Face recognition se attendance · confidence score badge |

---

### 📢 Communication

| Feature | Description |
|---------|-------------|
| **Announcements** | School-wide notices · audience targeting (all / teachers / students / parents) |
| **Communication Page** | Messaging interface |
| **Message Templates** | WhatsApp template banao aur manage karo |
| **PTM Scheduling** | Parent-Teacher Meeting dates set karo |

---

### 🏫 School Services

| Feature | Description |
|---------|-------------|
| **Library Management** | Books inventory · issue/return tracking |
| **Inventory Management** | School equipment aur supplies tracking |
| **Transport Management** | Bus routes · vehicle details |
| **Analytics Page** | School-wide reports aur charts |

---

## 👩‍🏫 Teacher Panel

> Teaching tools — attendance, marks, homework, parent communication

---

### 📊 Dashboard

| Feature | Description |
|---------|-------------|
| **Stat Cards (4)** | Total Students · My Homework Count · Periods Today · Notices |
| **⏱ Next Class Countdown** | Header mein badge: "Next: Math in 12 min" — timetable se live calculate |
| **📅 PTM Countdown Badge** | Violet badge: "PTM in X days" — ptm_meetings table se fetch |
| **📈 Class Avg vs School Avg** | Chip: "Your class: 78% \| School avg: 71% ↑ +7%" — green/red |
| **📊 Homework Submission Bars** | Har assignment ke liye: X/Y submitted · color bar (red <50%, green ≥50%) |
| **🔴 Performance Drop Alert** | Students jinke marks ≥15% gire hain vs previous exam · list with drop % |
| **👑 Student of the Week** | Auto-pick: Attendance% × 0.5 + Exam avg% × 0.5 = score · golden card · "🌟 Announce" button |
| **Today's Schedule** | Aaj ke periods time-wise |
| **Recent Notices** | School ke latest 3 announcements |
| **Quick Actions** | Mark Attendance · Add Homework · Enter Marks · Message Parents |

---

### ✅ Attendance Management

| Feature | Description |
|---------|-------------|
| **Class Selector** | Teacher ke assigned classes mein se select karo |
| **Student List** | Class ke saare students load hote hain |
| **Present / Absent Toggle** | Har student ke liye P/A toggle |
| **✅ Mark All Present** | Ek tap mein sab present |
| **❌ Mark All Absent** | Ek tap mein sab absent |
| **🟢🔴 Live Summary Bar** | Present X \| Absent Y \| Total Z — real-time update as you toggle |
| **📞 Absent Student Parent Phone** | Absent mark karte hi parent phone chip show · click to copy |
| **📲 WhatsApp Parent from Row** | Har student row mein green WA button · wa.me link new tab mein |
| **⭐ Top 3 Exam Scorers** | Gold/Silver/Bronze badges (⭐🥈🥉) top scorers pe |
| **📊 Class Avg This Month** | Class selector ke neeche mini progress bar · green ≥85%, amber ≥65%, red below |
| **🔁 Yesterday's Absentees Chip** | Yellow chip: "X students were absent yesterday" · click for names dropdown |
| **😊 Class Mood Score** | Attendance% × streak score = mood out of 100 · emoji tier badges |
| **📱 WhatsApp to Absent Parents** | Save karte waqt absent parents ko WhatsApp notification |

---

### 📝 Homework & Assignments

| Feature | Description |
|---------|-------------|
| **Homework List** | Apne saare assignments with class, subject, due date |
| **Create Homework** | Title, description, class, due date ke saath assign karo |
| **📌 Deadline in 24h Banner** | Amber banner agar koi homework aaj/kal due hai |
| **Submissions Page** | Kis student ne submit kiya, kisne nahi · per-assignment view |

---

### 📈 Academics

| Feature | Description |
|---------|-------------|
| **Gradebook** | Student-wise marks enter karo per exam per subject |
| **Marks History** | Historical exam results |
| **Performance Page** | Student performance trends aur graphs |
| **Attendance Report** | Class attendance ka analytics view |
| **Syllabus Progress** | Topic-wise completion mark karo |
| **Timetable** | Apna weekly schedule dekho |
| **Daily Diary** | Lesson notes / diary entries |

---

### 💬 Communication

| Feature | Description |
|---------|-------------|
| **Parent Messages** | Parents ko directly message karo |
| **Notices** | School announcements dekho |
| **Notifications** | Unread count badge · mark as read |
| **Leave Management** | Apni leaves apply karo · status track karo |

---

### Sidebar

| Feature | Description |
|---------|-------------|
| **Teacher Identity Header** | Full name + subject · avatar with initials · "Teacher" violet badge |
| **Unread Notification Badge** | Red count bubble on Notifications nav item |

---

## 🎒 Student Panel

> Learning experience — homework, marks, timetable, notices

---

### 📊 Dashboard

| Feature | Description |
|---------|-------------|
| **Stat Cards (4)** | Attendance % · Homework Due · Pending Fees · Upcoming Exams |
| **🔥 Attendance Streak** | "15 days streak!" counter — consecutive present days |
| **📅 Days Until Next Exam** | Countdown chip: "Exam in X days" |
| **⏰ Next Class Countdown** | "Next: Physics in 18 min" — live calculation |
| **📝 Homework Due Today** | Red urgent badge with count |
| **🥇 Class Rank Badge** | "You are #3 in class of 28" — exam totals se calculate |
| **💸 Fee Due Date Chip** | "₹2,500 due in 5d" — amber/red pill header mein |
| **🔴 Fee Alert Card** | Overdue ya due-soon fees ka red card with amount |
| **📊 Subject-wise Radar Chart** | Pure SVG spider chart — har subject ka performance ek nazar mein |
| **Today's Timetable** | Aaj ke periods list |
| **Upcoming Homework** | Next 7 days homework with urgency colors (red=today, amber=tomorrow, green=later) |
| **Recent Exam Results** | Last 4 exams — subject, marks, percentage |
| **Notice Board Preview** | School ke latest 3 announcements |
| **📖 Syllabus % Completed** | Subject-wise progress bars (max 4 subjects) |
| **🏅 Achievement Badges** | Auto-calculated: 🔥 Perfect Attendance (≥95%) · 🏆 Top Scorer (Rank #1) · 📚 Homework Hero (≥10 submitted) · ⚡ Streak Master (≥10 days) |
| **🎯 Personal Goal Tracker** | Har subject ke liye target % set karo · progress bar vs current avg · "Need X% more" · localStorage mein save |
| **💡 Study Tip of the Day** | 20 subject-based tips · daily rotate (deterministic) · violet card |
| **Quick Actions Bar** | View Marks · My Attendance · Fees · Leave Request |

---

### 📄 Student Pages

| Page | Features |
|------|----------|
| **My Homework** | Subject-wise list · due dates · pending/submitted status |
| **My Marks** | Exam results history · subject breakdown · percentage |
| **My Attendance** | Monthly calendar view · % calculation · present/absent days |
| **Class Timetable** | Weekly schedule with periods |
| **Notice Board** | School announcements list |
| **Fees** | Fee structure · payment status · due dates · history |
| **Leave Requests** | Apply leave · from/to date · reason · status track (pending/approved/rejected) |
| **Documents** | Academic documents download |
| **Messages** | School inbox / messages |
| **My Profile** | Photo upload · personal info · class, roll number · password notice |

---

### Sidebar

| Feature | Description |
|---------|-------------|
| **Student Identity Header** | Full name (4-level fallback: DB → user_metadata → users table → email prefix) · Roll No · avatar initials · "Student" amber badge |

---

## 👨‍👩‍👧 Parent Panel

> Child monitoring — live updates, fees, performance, communication

---

### 📊 Dashboard

| Feature | Description |
|---------|-------------|
| **Child Selector** | Multiple children toggle — ek se zyada bachhe manage karo |
| **📍 Child in School Live Badge** | "✓ In School Today" (green) · "✗ Absent Today" (red) · "Not Yet Marked" (gray) |
| **Stat Cards (4)** | Attendance % · Pending Fees · Latest Grade · Active Homework |
| **📊 Attendance Trend Arrow** | This month % vs last month · ↑↓ difference with icon |
| **🏆 Child's Rank** | "Rank: #3 → #2 ↑" — last 2 exams se comparison |
| **📝 Homework Overdue Alert** | Red chip with overdue homework count |
| **📅 PTM Countdown** | "PTM in X days" — ptm_meetings se fetch |
| **💳 Fee Due Date Chip** | "₹X due by [date]" — red border if pending |
| **📆 Fee Due in 5 Days Chip** | Amber warning chip if fee due within 5 days |
| **✨ Push Notifications** | Browser Notification.requestPermission() · Supabase Realtime subscribe on exam_results · new result aane par browser notification + in-app toast |
| **🔔 Notifications Enabled Badge** | Header mein green chip jab browser permission granted ho |
| **📄 Download Report Card PDF** | Printable HTML new window mein · subject table · grades (A+/A/B+/B/C) · attendance · window.print() |
| **📤 Apply Child Leave** | Inline form: from_date, to_date, reason · student_leaves mein insert · success toast |
| **Quick Actions (6)** | View Attendance · Pay Fees · View Marks · Apply Leave · Messages · Download Report Card |

---

### 📄 Parent Pages

| Page | Features |
|------|----------|
| **Attendance** | Child ka monthly attendance calendar |
| **Exam Results** | Subject-wise marks per exam |
| **Homework** | Child ka homework list with submission status |
| **Daily Diary** | Teacher ke lesson notes |
| **Timetable** | Child ki class timetable |
| **Fees & Payments** | Fee structure · payment history · due dates · pay online |
| **Leave Requests** | Child ki leave apply karo aur track karo |
| **Transport Status** | Bus route info |
| **School Inbox** | School/teacher se messages |
| **My Profile** | Photo upload · personal info |

---

### Sidebar

| Feature | Description |
|---------|-------------|
| **Parent Identity Header** | Full name from parents table · phone number · avatar initials · "Parent" orange badge |

---

## 🌐 Super Admin Panel

> SaaS management — schools, subscriptions, platform health

---

### 📊 Dashboard

| Feature | Description |
|---------|-------------|
| **📡 Active Schools Live Count** | Kitne schools abhi active hain (`is_active = true`) |
| **⚠️ Subscription Expiring Alert** | Schools jinka subscription 7 din mein khatam hoga · warning list |
| **💰 MRR Live Meter** | Monthly Recurring Revenue — active subscriptions se calculate |
| **📈 New School Signups Sparkline** | SVG 7-day line chart of new school registrations this week |
| **🚀 Onboarding Progress per School** | Score: Students+25 · Teachers+25 · Classes+25 · Timetable+25 = 0-100% · mini progress bar |
| **📊 API Usage per School** | WhatsApp/SMS messages sent this month per school · 500 msg limit ke against progress bar · amber/red if near limit |
| **🏫 School Last Active** | "Active 2h ago" / "Active today" chip per school — latest activity se |
| **🔒 Suspend / Reactivate School** | 1-click confirm → `schools.is_active` update · "Suspend" red / "Reactivate" green button |

---

### 🏫 Schools Management

| Feature | Description |
|---------|-------------|
| **Schools Table** | Name · Subdomain · Status · Subscription · API Usage · Onboarding % · Last Active · Actions |
| **🔧 Provision New School Wizard** | Guided multi-step form: school name, subdomain, admin email, plan · creates school record |
| **School Detail View** | Individual school ki stats aur settings |
| **Subscription Management** | Plan tracking · expiry dates · renewal |
| **Suspend / Reactivate** | School access block ya restore karo |

---

## 🗄️ Database Tables

| Table | Use |
|-------|-----|
| `schools` | Multi-tenant school records |
| `users` | Auth users |
| `user_roles` | Role assignments — super_admin / admin / teacher / student / parent |
| `students` | Student profiles — class, roll no, parent info, avatar |
| `teachers` | Teacher profiles — subject, class, avatar |
| `parents` | Parent profiles — linked to students |
| `classes` | Class records — grade level + section |
| `timetables` | Weekly period schedule |
| `daily_attendance` | Per-student daily P/A records |
| `homework` | Homework assignments |
| `homework_submissions` | Student submission records |
| `exam_results` | Student marks per exam per subject |
| `exams` | Exam definitions |
| `announcements` | School-wide notices |
| `student_fee_assignments` | Fee dues per student |
| `fee_payments` | Payment records |
| `student_leaves` | Leave requests — student + parent applied |
| `teacher_leaves` | Staff leave records |
| `ptm_meetings` | Parent-Teacher Meeting schedules |
| `syllabus_topics` | Subject topic completion |
| `whatsapp_logs` | WhatsApp message history |
| `admission_applications` | New admission requests |

---

## ⚡ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 · Vite · TypeScript |
| **Styling** | Tailwind CSS v4 · Shadcn UI · Framer Motion |
| **Backend** | Supabase — PostgreSQL + Auth + RLS + Storage + Realtime + Edge Functions |
| **Auth** | Supabase Auth · JWT · subdomain-based multi-tenant |
| **File Storage** | Supabase Storage — `avatars` bucket |
| **Notifications** | Fast2SMS API · WhatsApp Business API · Browser Push API |
| **Theme** | next-themes · dark default · CSS oklch variables |
| **Charts** | Pure SVG — sparklines, radar chart, progress bars (no external lib) |
| **PDF Export** | `window.print()` — styled HTML in new window |

---

## 📊 Feature Count

| Panel | Features |
|-------|----------|
| Global / Design System | 9 |
| Admin Panel | 35+ |
| Teacher Panel | 28+ |
| Student Panel | 25+ |
| Parent Panel | 22+ |
| Super Admin Panel | 12+ |
| **Total** | **~131 features** |

---

*EduNextGen · v1.0 · Build: High Impact → Medium → Delight*
