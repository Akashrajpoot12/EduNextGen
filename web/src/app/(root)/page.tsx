"use client";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import Link from "next/link";
import { Check, Fingerprint, Database, FileSpreadsheet, PlusCircle } from "lucide-react";
import { useState } from "react";

export default function LandingPage() {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <div className="flex flex-col items-center">
      {/* HERO SECTION */}
      <section className="w-full py-24 md:py-32 lg:py-40 flex flex-col items-center justify-center text-center px-4 relative overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 -z-10 h-full w-full bg-white dark:bg-neutral-950">
          <div className="absolute bottom-auto left-auto right-0 top-0 h-[500px] w-[500px] -translate-x-[30%] translate-y-[20%] rounded-full bg-blue-500/10 opacity-50 blur-[80px]"></div>
          <div className="absolute bottom-auto left-0 right-auto top-0 h-[500px] w-[500px] translate-x-[30%] translate-y-[20%] rounded-full bg-purple-500/10 opacity-50 blur-[80px]"></div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-[800px] space-y-6"
        >
          <div className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400 shadow-sm mb-4">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
            Welcome to SMS by Blueate.in
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl bg-clip-text text-transparent bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-500 dark:from-white dark:via-neutral-200 dark:to-neutral-500">
            AI-Powered School Management
          </h1>
          <p className="mx-auto max-w-[600px] text-lg text-neutral-500 dark:text-neutral-400 md:text-xl leading-relaxed">
            Automate attendance with facial recognition, manage homework, timetable, exams, fees, payroll, and transport from a single, beautiful dashboard.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link href="/register">
              <Button size="lg" className="h-12 px-8 rounded-full shadow-lg shadow-blue-500/20">
                Register Your School
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="h-12 px-8 rounded-full">
              Book a Demo
            </Button>
          </div>
        </motion.div>
      </section>

      {/* FEATURE GRID */}
      <section id="features" className="w-full py-24 bg-neutral-50 dark:bg-neutral-900/50">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Built for the Future</h2>
            <p className="mt-4 text-lg text-neutral-500 dark:text-neutral-400">Everything you need to run a modern educational institution.</p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {/* Feature 1 */}
            <motion.div
              whileHover={{ y: -5 }}
              className="group relative overflow-hidden rounded-2xl border bg-background p-8 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                <Fingerprint className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-bold">AI Biometric Attendance</h3>
              <p className="text-muted-foreground leading-relaxed">
                Powered by pgvector. Scan student faces in milliseconds using our advanced cosine-similarity AI matching engine. No more manual roll calls.
              </p>
            </motion.div>

            {/* Feature 2 */}
            <motion.div
              whileHover={{ y: -5 }}
              className="group relative overflow-hidden rounded-2xl border bg-background p-8 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
                <Database className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-bold">Absolute Data Security</h3>
              <p className="text-muted-foreground leading-relaxed">
                Enterprise-grade PostgreSQL Row Level Security (RLS) guarantees complete data isolation for every school. Your data is yours alone.
              </p>
            </motion.div>

            {/* Feature 3 */}
            <motion.div
              whileHover={{ y: -5 }}
              className="group relative overflow-hidden rounded-2xl border bg-background p-8 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-bold">1-Click Bulk Uploads</h3>
              <p className="text-muted-foreground leading-relaxed">
                Migrating from legacy software? Upload your CSVs and our intelligent parser will securely onboard thousands of students instantly.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* PRICING SECTION - EDUNEST TIERS */}
      <section id="pricing" className="w-full py-24">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-white">SMS Plans</h2>
            <p className="mt-4 text-lg text-emerald-400">A scalable solution for schools of all sizes.</p>
          </div>

          <div className="flex justify-center mb-12">
            <div className="bg-muted p-1 rounded-full inline-flex">
              <button 
                onClick={() => setIsYearly(false)} 
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${!isYearly ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Monthly
              </button>
              <button 
                onClick={() => setIsYearly(true)} 
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${isYearly ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Yearly <span className="ml-1 text-emerald-500 text-xs">-16%</span>
              </button>
            </div>
          </div>

          <div className="grid gap-8 md:grid-cols-4 items-stretch">
            
            {/* Free */}
            <div className="rounded-3xl border bg-background p-8 shadow-sm flex flex-col">
              <h3 className="text-xl font-bold">Free</h3>
              <p className="text-sm text-muted-foreground mt-2">Trial / Very small setups</p>
              <div className="mt-6 flex items-baseline text-4xl font-extrabold">
                ₹0
              </div>
              <p className="text-sm text-muted-foreground mt-1">Forever</p>
              <ul className="mt-8 space-y-3 text-sm flex-1">
                <li className="flex items-center"><Check className="mr-3 h-4 w-4 text-emerald-500" /> Up to 50 Students</li>
                <li className="flex items-center"><Check className="mr-3 h-4 w-4 text-emerald-500" /> Up to 5 Teachers</li>
                <li className="flex items-center"><Check className="mr-3 h-4 w-4 text-emerald-500" /> Admin Portal Access</li>
              </ul>
              <Button className="mt-8 w-full" variant="outline">Start Free Trial</Button>
            </div>

            {/* Silver */}
            <div className="rounded-3xl border bg-background p-8 shadow-sm flex flex-col">
              <h3 className="text-xl font-bold text-slate-500">Silver</h3>
              <p className="text-sm text-muted-foreground mt-2">For growing academies</p>
              <div className="mt-6 flex items-baseline text-4xl font-extrabold">
                {isYearly ? '₹9,990' : '₹999'}
              </div>
              <p className="text-sm text-muted-foreground mt-1">per {isYearly ? 'year' : 'month'}</p>
              <ul className="mt-8 space-y-3 text-sm flex-1">
                <li className="flex items-center"><Check className="mr-3 h-4 w-4 text-primary" /> Up to 300 Students</li>
                <li className="flex items-center"><Check className="mr-3 h-4 w-4 text-primary" /> Up to 25 Teachers</li>
                <li className="flex items-center"><Check className="mr-3 h-4 w-4 text-primary" /> Teacher & Student Web Portal</li>
                <li className="flex items-center"><Check className="mr-3 h-4 w-4 text-primary" /> Attendance, Homework, Exams</li>
                <li className="flex items-center"><Check className="mr-3 h-4 w-4 text-primary" /> Fee Management</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-4 flex items-center"><PlusCircle className="mr-1 h-3 w-3" /> Extra student: {isYearly ? '₹49/yr' : '₹9/mo'}</p>
              <Button className="mt-4 w-full" variant="outline">Choose Silver</Button>
            </div>

            {/* Gold */}
            <div className="rounded-3xl border-2 border-amber-400 bg-background p-8 shadow-lg relative transform md:-translate-y-4 flex flex-col">
              <div className="absolute top-0 right-6 -translate-y-1/2 rounded-full bg-amber-400 text-black px-3 py-1 text-xs font-bold">
                Most Popular
              </div>
              <h3 className="text-xl font-bold text-amber-500">Gold</h3>
              <p className="text-sm text-muted-foreground mt-2">For established schools</p>
              <div className="mt-6 flex items-baseline text-4xl font-extrabold">
                {isYearly ? '₹19,990' : '₹1,999'}
              </div>
              <p className="text-sm text-muted-foreground mt-1">per {isYearly ? 'year' : 'month'}</p>
              <ul className="mt-8 space-y-3 text-sm flex-1">
                <li className="flex items-center font-medium"><Check className="mr-3 h-4 w-4 text-amber-500" /> Everything in Silver, plus:</li>
                <li className="flex items-center"><Check className="mr-3 h-4 w-4 text-amber-500" /> Up to 500 Students</li>
                <li className="flex items-center"><Check className="mr-3 h-4 w-4 text-amber-500" /> Up to 60 Teachers</li>
                <li className="flex items-center"><Check className="mr-3 h-4 w-4 text-amber-500" /> Mobile Apps (Android/iOS)</li>
                <li className="flex items-center"><Check className="mr-3 h-4 w-4 text-amber-500" /> Online MCQ Tests & Results</li>
                <li className="flex items-center"><Check className="mr-3 h-4 w-4 text-amber-500" /> Online Fee Payment Gateway</li>
                <li className="flex items-center"><Check className="mr-3 h-4 w-4 text-amber-500" /> Bulk SMS Notifications</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-4 flex items-center"><PlusCircle className="mr-1 h-3 w-3" /> Extra student: {isYearly ? '₹49/yr' : '₹9/mo'}</p>
              <Button className="mt-4 w-full bg-amber-500 hover:bg-amber-600 text-white border-0">Choose Gold</Button>
            </div>

            {/* Platinum */}
            <div className="rounded-3xl border bg-background p-8 shadow-sm flex flex-col">
              <h3 className="text-xl font-bold text-purple-500">Platinum</h3>
              <p className="text-sm text-muted-foreground mt-2">For large institutions</p>
              <div className="mt-6 flex items-baseline text-4xl font-extrabold">
                {isYearly ? '₹34,990' : '₹3,499'}
              </div>
              <p className="text-sm text-muted-foreground mt-1">per {isYearly ? 'year' : 'month'}</p>
              <ul className="mt-8 space-y-3 text-sm flex-1">
                <li className="flex items-center font-medium"><Check className="mr-3 h-4 w-4 text-purple-500" /> Everything in Gold, plus:</li>
                <li className="flex items-center"><Check className="mr-3 h-4 w-4 text-purple-500" /> Up to 700 Students</li>
                <li className="flex items-center"><Check className="mr-3 h-4 w-4 text-purple-500" /> Up to 150 Teachers</li>
                <li className="flex items-center"><Check className="mr-3 h-4 w-4 text-purple-500" /> Parent Portal & App</li>
                <li className="flex items-center"><Check className="mr-3 h-4 w-4 text-purple-500" /> Face AI Attendance</li>
                <li className="flex items-center"><Check className="mr-3 h-4 w-4 text-purple-500" /> Transport & Payroll Manager</li>
                <li className="flex items-center"><Check className="mr-3 h-4 w-4 text-purple-500" /> WhatsApp Bot Alerts</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-4 flex items-center"><PlusCircle className="mr-1 h-3 w-3" /> Extra student: {isYearly ? '₹49/yr' : '₹9/mo'}</p>
              <Button className="mt-4 w-full" variant="outline">Choose Platinum</Button>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
}
