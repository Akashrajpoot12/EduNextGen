// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, TrendingUp, Users, DollarSign, Activity } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area,
} from "recharts";

export function AnalyticsPage() {
  const { tenantId: schoolId } = useTenant();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    feesCollected: 0,
    activeClasses: 0
  });
  const [revenue, setRevenue] = useState<{ label: string; amount: number }[]>([]);
  const [attendance, setAttendance] = useState<{ label: string; pct: number }[]>([]);

  const supabase = createClient();

  useEffect(() => {
    if (schoolId) fetchAnalytics();
  }, [schoolId]);

  async function fetchAnalytics() {
    setLoading(true);
    try {
      const since7 = new Date();
      since7.setDate(since7.getDate() - 6);
      const since7iso = since7.toISOString().split("T")[0];

      const [
        { count: studentsCount },
        { count: teachersCount },
        { data: feesData },
        { count: classesCount },
        { data: attData },
      ] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', schoolId),
        supabase.from('user_roles').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('role', 'teacher'),
        supabase.from('fee_receipts').select('amount:amount_paid, payment_date:paid_at, created_at:paid_at').eq('school_id', schoolId),
        supabase.from('classes').select('*', { count: 'exact', head: true }).eq('school_id', schoolId),
        supabase.from('daily_attendance').select('date, status').eq('school_id', schoolId).gte('date', since7iso),
      ]);

      const totalFees = feesData ? feesData.reduce((acc, curr) => acc + Number(curr.amount), 0) : 0;

      setStats({
        totalStudents: studentsCount || 0,
        totalTeachers: teachersCount || 0,
        feesCollected: totalFees,
        activeClasses: classesCount || 0
      });

      // ── Monthly revenue (last 6 months) ──────────────────────
      const now = new Date();
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString("en-IN", { month: "short" }), amount: 0 };
      });
      (feesData || []).forEach((p: any) => {
        const dt = new Date(p.payment_date || p.created_at);
        const key = `${dt.getFullYear()}-${dt.getMonth()}`;
        const m = months.find((x) => x.key === key);
        if (m) m.amount += Number(p.amount) || 0;
      });
      setRevenue(months.map(({ label, amount }) => ({ label, amount })));

      // ── Attendance % (last 7 days) ───────────────────────────
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now);
        d.setDate(d.getDate() - (6 - i));
        return { iso: d.toISOString().split("T")[0], label: d.toLocaleDateString("en-IN", { weekday: "short" }), present: 0, total: 0 };
      });
      (attData || []).forEach((a: any) => {
        const day = days.find((x) => x.iso === a.date);
        if (day) { day.total++; if (a.status !== "absent") day.present++; }
      });
      setAttendance(days.map((d) => ({ label: d.label, pct: d.total ? Math.round((d.present / d.total) * 100) : 0 })));

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
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Analytics & Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time statistics and performance metrics for the school.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" />
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-card backdrop-blur-xl border-border shadow-xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6 relative z-10">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                    <Users className="w-6 h-6 text-blue-400" />
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-foreground mb-1">{stats.totalStudents}</h3>
                <p className="text-sm text-muted-foreground">Total Students</p>
              </CardContent>
            </Card>

            <Card className="bg-card backdrop-blur-xl border-border shadow-xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6 relative z-10">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                    <DollarSign className="w-6 h-6 text-emerald-400" />
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-foreground mb-1">₹{stats.feesCollected.toLocaleString('en-IN')}</h3>
                <p className="text-sm text-muted-foreground">Fees Collected (YTD)</p>
              </CardContent>
            </Card>

            <Card className="bg-card backdrop-blur-xl border-border shadow-xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6 relative z-10">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
                    <Activity className="w-6 h-6 text-purple-400" />
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-foreground mb-1">{stats.totalTeachers}</h3>
                <p className="text-sm text-muted-foreground">Active Teachers</p>
              </CardContent>
            </Card>

            <Card className="bg-card backdrop-blur-xl border-border shadow-xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6 relative z-10">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
                    <TrendingUp className="w-6 h-6 text-amber-400" />
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-foreground mb-1">{stats.activeClasses}</h3>
                <p className="text-sm text-muted-foreground">Active Classes / Sections</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2 mt-6">
            {/* Monthly revenue */}
            <Card className="bg-card backdrop-blur-xl border-border shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign className="w-5 h-5 text-emerald-500" />
                  <h3 className="font-semibold text-foreground">Monthly Fee Collection</h3>
                  <span className="text-xs text-muted-foreground ml-auto">Last 6 months</span>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenue} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))"
                        tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                      <Tooltip
                        formatter={(v: any) => [`₹${Number(v).toLocaleString("en-IN")}`, "Collected"]}
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="amount" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Attendance trend */}
            <Card className="bg-card backdrop-blur-xl border-border shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                  <h3 className="font-semibold text-foreground">Attendance Trend</h3>
                  <span className="text-xs text-muted-foreground ml-auto">Last 7 days</span>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={attendance} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="attFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v}%`} />
                      <Tooltip
                        formatter={(v: any) => [`${v}%`, "Present"]}
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                      <Area type="monotone" dataKey="pct" stroke="#3b82f6" strokeWidth={2} fill="url(#attFill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
