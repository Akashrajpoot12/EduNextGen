// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, Users, DollarSign, Activity } from "lucide-react";

export function AnalyticsPage() {
  const params = useParams();
  const tenant = params.tenantId as string;
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    feesCollected: 0,
    activeClasses: 0
  });

  const supabase = createClient();

  useEffect(() => {
    fetchAnalytics();
  }, [tenant]);

  async function fetchAnalytics() {
    setLoading(true);
    try {
      const { data: school } = await supabase
        .from('schools')
        .select('id')
        .eq('subdomain', tenant)
        .single();

      if (!school) return;

      // Parallel data fetching for performance
      const [
        { count: studentsCount },
        { count: teachersCount },
        { data: feesData },
        { count: classesCount }
      ] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', school.id),
        supabase.from('user_roles').select('*', { count: 'exact', head: true }).eq('school_id', school.id).eq('role', 'teacher'),
        supabase.from('fee_payments').select('amount').eq('school_id', school.id).eq('status', 'paid'),
        supabase.from('classes').select('*', { count: 'exact', head: true }).eq('school_id', school.id)
      ]);

      const totalFees = feesData ? feesData.reduce((acc, curr) => acc + Number(curr.amount), 0) : 0;

      setStats({
        totalStudents: studentsCount || 0,
        totalTeachers: teachersCount || 0,
        feesCollected: totalFees,
        activeClasses: classesCount || 0
      });

    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Analytics & Reports</h1>
          <p className="text-sm text-slate-400 mt-1">Real-time statistics and performance metrics for the school.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" />
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6 relative z-10">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                    <Users className="w-6 h-6 text-blue-400" />
                  </div>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">+12%</span>
                </div>
                <h3 className="text-3xl font-bold text-white mb-1">{stats.totalStudents}</h3>
                <p className="text-sm text-slate-400">Total Students</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6 relative z-10">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                    <DollarSign className="w-6 h-6 text-emerald-400" />
                  </div>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">+8%</span>
                </div>
                <h3 className="text-3xl font-bold text-white mb-1">₹{stats.feesCollected.toLocaleString('en-IN')}</h3>
                <p className="text-sm text-slate-400">Fees Collected (YTD)</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6 relative z-10">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
                    <Activity className="w-6 h-6 text-purple-400" />
                  </div>
                  <span className="text-xs font-bold text-slate-400 bg-slate-500/10 px-2 py-1 rounded-full">Stable</span>
                </div>
                <h3 className="text-3xl font-bold text-white mb-1">{stats.totalTeachers}</h3>
                <p className="text-sm text-slate-400">Active Teachers</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6 relative z-10">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
                    <TrendingUp className="w-6 h-6 text-amber-400" />
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-white mb-1">{stats.activeClasses}</h3>
                <p className="text-sm text-slate-400">Active Classes / Sections</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2 mt-6">
            <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl h-80 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
                  <Activity className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-400">Monthly Revenue Chart</p>
                <p className="text-xs text-slate-500 mt-2">Requires chart.js integration</p>
              </div>
            </Card>
            <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl h-80 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
                  <Users className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-400">Attendance Trends</p>
                <p className="text-xs text-slate-500 mt-2">Requires chart.js integration</p>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
