"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, GraduationCap, Banknote, CalendarDays, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    students: 0,
    teachers: 0,
    classes: 0,
  });
  const [loading, setLoading] = useState(true);
  
  const params = useParams();
  const tenant = params.tenant as string;
  const supabase = createClient();

  useEffect(() => {
    async function fetchStats() {
      // 1. Get school ID
      const { data: school } = await supabase
        .from('schools')
        .select('id')
        .eq('subdomain', tenant)
        .single();

      if (!school) {
        setLoading(false);
        return;
      }

      // 2. Count Students
      const { count: studentCount } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', school.id);

      // 3. Count Teachers (users with role 'teacher')
      const { count: teacherCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', school.id)
        .eq('role', 'teacher');

      // 4. Count Classes
      const { count: classCount } = await supabase
        .from('classes')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', school.id);

      setStats({
        students: studentCount || 0,
        teachers: teacherCount || 0,
        classes: classCount || 0,
      });
      setLoading(false);
    }

    fetchStats();
  }, [tenant]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard Overview</h1>
          <p className="text-sm text-slate-400 mt-1">Welcome back. Here's what's happening today.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white backdrop-blur-md">Generate Report</Button>
          <Button className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20">Add Student</Button>
        </div>
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden group hover:border-blue-500/50 transition-colors duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
              <CardTitle className="text-sm font-medium text-slate-300">Total Students</CardTitle>
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Users className="h-4 w-4 text-blue-400" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold text-white tracking-tight">{stats.students}</div>
              <p className="text-xs text-blue-400/80 mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> Live Enrolled
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden group hover:border-emerald-500/50 transition-colors duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
              <CardTitle className="text-sm font-medium text-slate-300">Total Teachers</CardTitle>
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <GraduationCap className="h-4 w-4 text-emerald-400" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold text-white tracking-tight">{stats.teachers}</div>
              <p className="text-xs text-emerald-400/80 mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active Staff
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden group hover:border-purple-500/50 transition-colors duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
              <CardTitle className="text-sm font-medium text-slate-300">Total Classes</CardTitle>
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <CalendarDays className="h-4 w-4 text-purple-400" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold text-white tracking-tight">{stats.classes}</div>
              <p className="text-xs text-purple-400/80 mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" /> Active Batches
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden group hover:border-amber-500/50 transition-colors duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
              <CardTitle className="text-sm font-medium text-slate-300">Pending Fees</CardTitle>
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Banknote className="h-4 w-4 text-amber-400" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold text-white tracking-tight">₹0</div>
              <p className="text-xs text-amber-400/80 mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> This Month
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* CSV Uploader Section below the stats */}
      <div className="grid gap-6 md:grid-cols-2 mt-8">
        <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl">
          <CardHeader>
            <CardTitle className="text-white">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-slate-500 flex flex-col justify-center items-center h-32 border-2 border-dashed border-white/10 rounded-xl bg-white/5">
              <p>No recent activity</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
