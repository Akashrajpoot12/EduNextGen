# Multi-Tenant SaaS School Management ERP

This repository contains the source code for an enterprise-grade, multi-tenant School Management System (ERP). The platform is designed to securely host hundreds of independent schools using advanced PostgreSQL Row-Level Security (RLS) and cutting-edge AI features.

---

## 🚀 Project Progress & Completed Milestones

Here is the exact breakdown of the architecture and features we have completely finished so far:

### ✅ Phase 1: Database Schema & Tenant Isolation (Completed)
The foundational PostgreSQL database architecture has been successfully written and locked down (located in `supabase/migrations/00001_initial_schema.sql`).
* **Multi-Tenant Schema Generated**: Hierarchical tables created (`registration_requests` -> `schools` -> `academic_years` -> `classes` -> `users` -> `user_roles` -> `students` -> `daily_attendance`).
* **Absolute Data Security**: Strict Supabase Row-Level Security (RLS) policies have been written so that a school can only ever query data matching their exact `school_id`.
* **AI Biometric Readiness**: Enabled the `pgvector` extension and added `face_vector` columns to the `students` and `users` tables to support lightning-fast facial recognition for attendance.
* **Self-Serve Automation**: Written PostgreSQL database triggers that will automatically create the school tenant and assign the `school_admin` role the moment a Super Admin clicks "Approve".

### ✅ Phase 2: Frontend Scaffolding & Multi-Tenant Routing (Completed)
The Next.js 15 frontend application has been fully scaffolded inside the `web/` directory with a highly advanced routing engine.
* **Subdomain Routing Middleware**: Developed a critical `middleware.ts` engine. It reads the incoming request (e.g., `school-a.platform.com`), bypasses the marketing root, and silently rewrites the path to serve the correct tenant dashboard seamlessly.
* **App Router Hierarchy**: Cleanly split the project into `(root)` for marketing/onboarding and `(platform)/[tenant]` for the actual SaaS application.
* **Global Tenant Context**: Built the `TenantProvider` layout that reads the extracted URL parameter, validates the school against Supabase, and cascades the current `school_id` down to all nested React components.
* **Tech Stack Finalized**: Initialized TypeScript, Tailwind CSS, Shadcn UI components, TanStack Query, and the Supabase SSR client.

---

## ⏳ Next Immediate Steps (Phase 3)
We are currently moving into **Phase 3: Authentication & Multi-Role Setup**.
This involves hooking up the Supabase Auth client to enforce login states and reading the `user_roles` table to determine whether the user should be routed to the Super Admin, School Admin, Teacher, or Student dashboard.
