# Edunest: Multi-Tenant SaaS School Management ERP

This repository contains the source code for an enterprise-grade, real-world School Management System (ERP). The platform is designed to host hundreds of independent schools using a Single Page Application architecture powered by **Vite**, **React 19**, **React Router 7**, and **Supabase (PostgreSQL + RLS)** with **Deno Edge Functions** for secure backend capabilities.

---

## 📂 Project Directory Structure

- **`/client`**: The frontend Vite React Single Page Application (SPA).
- **`/supabase`**: The backend database migrations, Row Level Security (RLS) policies, and Deno Edge Functions (such as secure Razorpay payment handlers).
- **`package.json`**: Root-level package.json containing scripts to easily run the frontend client or package the application.

---

## 🛠️ Technology Stack

- **Frontend**: React 19, Vite, React Router 7 (client-side dynamic routing), Tailwind CSS, Framer Motion, Shadcn UI, Sonner Toasts
- **Database & Authentication**: Supabase client authentication, PostgreSQL database, pgvector extension, and fine-grained Row Level Security (RLS) policies.
- **Backend / Edge**: Supabase Deno Edge Functions (for secure key isolation like Razorpay secret keys and webhook verification).
- **Payment Processing**: Razorpay Gateway Integration.

---

## 🔐 Security & Access Controls

- **Tenant Subdomain Routing**: The application dynamically resolves subdomains directly in the URL path (e.g. `http://localhost:5173/gems/login`).
- **Role-Based Protected Routes**: All routes are guarded by a `<ProtectedRoute>` component. If a user tries to access a portal they don't have authorization for (e.g., student trying to access `/admin`), they are automatically redirected.
- **Database Row Level Security**: All writes (INSERT, UPDATE, DELETE) are protected at the database schema level. Users can only access data belonging to their respective `school_id` tenant.
- **Biometric Matching**: Includes `pgvector` similarity query search function (`match_student_face`) to securely match biometric facial vectors in the database.

---

## 💻 How to Run Locally

### 1. Install Dependencies
Run in the root directory:
```bash
npm install
```
*(This will install dependencies in the client directory)*

### 2. Start the Development Server
Run in the root directory:
```bash
npm run dev
```
*(The server will boot up and run on `http://localhost:5173/`)*

### 3. Open the App in Browser
Go to:
**`http://localhost:5173/gems/login`**

---

## 📝 Demo Login Credentials & Architecture Flow

The EduNextGen system uses a real-world multi-tenant ERP architecture. Instead of hardcoded links, you provision tenants dynamically from a centralized global panel.

**Step 1: Access Global Super Admin**
1. Visit: `http://localhost:5173/super-admin/login`
2. First time? Enter any email (e.g., `super@edunextgen.com`) and password (e.g., `password123`).
3. Click **"Initialize Super Admin"** to setup your local database.
4. Then click **"Authorize"** to login.

**Step 2: Provision a School**
1. From the Super Admin Dashboard, click the **"Provision School"** tab.
2. Create a school (e.g., Subdomain: `dps`, Email: `admin@dps.edu.in`).

**Step 3: School Admin Portal**
1. Visit the provisioned tenant portal: `http://localhost:5173/dps/login`
2. Enter the email you used (`admin@dps.edu.in`) and a secure password.
3. Click **"Initialize Admin Account"** (because it's the first time you are logging into this provisioned school locally).
4. Click **"Sign In"** to access your isolated School ERP!
