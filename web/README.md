# Edunest: Multi-Tenant SaaS School Management ERP

This repository contains the source code for an enterprise-grade, real-world School Management System (ERP). The platform is designed to securely host hundreds of independent schools using advanced PostgreSQL Multi-Tenancy (Row Level Security), AI Biometric Attendance, and Subdomain Routing.

## 🚀 Features Built So Far (Project Status)

### 1. Advanced Multi-Tenant Subdomain Routing (Next.js 16)
- **Dynamic Tenant Resolution:** Built a powerful Next.js Middleware that automatically detects subdomains (e.g., `gems.edunest.com`) and securely routes traffic to the specific school's data.
- **Root Domain Bypass:** Configured the routing engine to bypass the marketing site and point specific traffic to the `super-admin` global dashboard.
- **Auth Collision Fix:** Engineered a robust workaround for Supabase SSR cookies overwriting Next.js rewrites, ensuring perfectly stable Hot Module Reloads (HMR).

### 2. Marketing Website & Self-Serve Registration
- **High-Impact Landing Page:** Built a stunning marketing page (`app/(root)/page.tsx`) with Framer Motion animations.
- **Real-World Pricing Tiers:** Implemented the exact Edunest business logic with Monthly/Yearly toggles for Free, Silver (₹999), Gold (₹1,999), and Platinum (₹3,499) plans.
- **SaaS Onboarding Flow:** Created a multi-step registration form using `react-hook-form` and strict `zod` validation to ensure subdomains and school details are properly formatted before provisioning.

### 3. Live Supabase Database Architecture (PostgreSQL)
We fully deployed four massive SQL schemas directly to the live Supabase cloud:
- **`00001_initial_schema.sql`**: Configured global tables for `schools`, `users`, `students`, `classes`, and `attendance` with bulletproof **Row Level Security (RLS)**.
- **`00002_biometric_matching.sql`**: Deployed `pgvector` extensions to store AI Face Embeddings and wrote an optimized PostgreSQL RPC function (`match_student_face`) to instantly recognize student faces via cosine similarity.
- **`00003_subscription_billing.sql`**: Added Stripe Customer IDs and student quotas to automate billing logic.
- **`00004_edunest_core_modules.sql`**: Expanded the database to handle the full ERP suite: `homework`, `exams`, `timetables`, `announcements`, and `leave_applications`.

### 4. Beautiful UI Dashboards & Portals
- **The Super Admin Dashboard (`/super-admin`)**: A command center for the SaaS owner to track Total MRR, Active Biometric Scanners, and approve pending school registrations.
- **The School Admin Portal (`/admin`)**: A customized tenant dashboard displaying active classes, pending fees, total students, and a custom **CSV Uploader component** to migrate legacy student data.
- **Enterprise ERP Sidebar:** We replaced the basic navigation with a massive Sidebar housing all 21 Edunest features (Homework, Exams, Payroll, Transport, Face AI, Inventory, etc.).
- **The Teacher Biometric Portal (`/teacher`)**: A high-tech dashboard for teachers featuring a live webcam scanner to automate student attendance using face recognition.

---

## 🛠️ Tech Stack
- **Frontend**: Next.js 16 (App Router), React, Tailwind CSS, Framer Motion, Shadcn UI
- **Backend**: Next.js Server Actions & API Routes
- **Database**: Supabase (PostgreSQL, pgvector, Row Level Security)
- **Forms & Validation**: React Hook Form + Zod
- **Authentication**: Supabase SSR Auth

## 💻 How to Run Locally

Because we use Subdomain Routing, you must access the platform using Localhost subdomains!

1. Start the server:
```bash
cd web
npm run dev
```

2. Open these exact URLs in your browser to test the routing:
- **Marketing Site:** `http://localhost:3000`
- **Super Admin:** `http://admin.localhost:3000/super-admin`
- **School Admin:** `http://gems.localhost:3000/admin`

*(Next.js will automatically route `gems` to the `[tenant]` folder structure and isolate the UI!)*
