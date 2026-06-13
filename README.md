# Multi-Tenant SaaS School Management ERP

This repository contains the source code for an enterprise-grade, multi-tenant School Management System (ERP). The platform is designed to securely host hundreds of independent schools using advanced PostgreSQL Row-Level Security (RLS) and cutting-edge AI features.

---

## 🚀 Project Architecture & Completed Features

We have successfully executed the master 7-Phase architectural blueprint, transforming this repository into a production-ready SaaS product.

### ✅ Phase 1: Database Schema & Tenant Isolation
The foundational PostgreSQL database architecture has been successfully locked down (located in `supabase/migrations/`).
* **Multi-Tenant Schema Generated**: Hierarchical tables created (`registration_requests` -> `schools` -> `academic_years` -> `classes` -> `users` -> `user_roles` -> `students` -> `daily_attendance`).
* **Absolute Data Security**: Strict Supabase Row-Level Security (RLS) policies have been written so that a school can only ever query data matching their exact `school_id`.
* **Self-Serve Automation**: Written PostgreSQL database triggers that automatically create the school tenant and assign the `school_admin` role the moment a Super Admin clicks "Approve".

### ✅ Phase 2: Frontend Scaffolding & Multi-Tenant Routing
* **Subdomain Routing Middleware**: Developed a critical `middleware.ts` engine. It intercepts the incoming request (e.g., `school-a.yoursaas.com`), and silently rewrites the path to serve the correct tenant dashboard seamlessly.
* **Global Tenant Context**: Built the `TenantProvider` layout that reads the extracted URL parameter, validates the school against Supabase, and cascades the current `school_id` down to all nested React components.

### ✅ Phase 3: Authentication & Multi-Role Setup
* **Supabase SSR Clients**: Configured fully robust `server.ts`, `client.ts`, and `middleware.ts` utilities for managing session cookies.
* **Role-Based Login Engine**: Created a beautifully styled Shadcn login portal that attempts authentication and is staged to check the `user_roles` bridging table to dynamically route to the Super Admin, School Admin, Teacher, or Parent dashboards.

### ✅ Phase 4: Core Dashboards
* **Super Admin Portal**: Global tracking for active hardware biometric scanners, MRR, and school registration requests.
* **School Admin Portal**: Tenant-isolated metrics showing total students, pending fees, and active classes.
* **Teacher Portal**: Live attendance metrics and pending gradebook assignments.

### ✅ Phase 5: The Bulk CSV Migration Engine
* **Client-Side Parsing**: Integrated `papaparse` directly into the frontend to parse heavy Excel/CSV spreadsheets directly in the browser.
* **Dynamic Upload Tool**: The `CsvUploader` allows School Admins to upload hundreds of student records instantly and sync them into the `students` table.

### ✅ Phase 6: AI Biometric & Real-Time Implementation
* **pgvector Facial Recognition**: Built the `match_student_face` RPC in SQL that utilizes `vector(128)` to measure cosine similarity (`<=>`) between incoming hardware face scans and the database.
* **Real-Time WebSockets**: Implemented `LiveAttendance` via `supabase.channel('postgres_changes')` to instantly update the teacher's dashboard UI the exact second a student is marked present by the biometric API.

### ✅ Phase 7: Monetization & Security Gates
* **Stripe Webhook Interceptor**: Configured `/api/webhooks/stripe` to detect `payment_failed` events and instantly demote a school's status to `past_due`, freezing their platform access.
* **Automated Quota Enforcement**: Implemented the `/api/tenant/quota` edge function that blocks massive CSV ingestions if a school exceeds their paid student tier limit.

---

## 🛠 Tech Stack

* **Frontend**: Next.js 15 (App Router), React, TypeScript, Tailwind CSS, Shadcn UI
* **Backend Backend/Auth**: Supabase (PostgreSQL, Auth, Realtime, pgvector)
* **API Endpoints**: Next.js Serverless Route Handlers
