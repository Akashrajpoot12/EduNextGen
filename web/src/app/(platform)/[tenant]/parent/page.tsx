"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, UserCircle2, Wallet, CalendarCheck, Award, TrendingUp } from "lucide-react";

export default function ParentDashboard() {
  const params = useParams();
  const tenant = params.tenant as string;
  const [loading, setLoading] = useState(true);
  const [parentName, setParentName] = useState("");

  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, [tenant]);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Fetch user profile
        const { data: profile } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', user.id)
          .single();
          
        if (profile) setParentName(profile.full_name);
      }
    } catch (error) {
      console.error("Error fetching parent data:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Welcome, {parentName || "Parent"}!
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Overview of your ward's performance and school activities.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500/50" />
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden group">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
                    <CalendarCheck className="w-6 h-6 text-amber-400" />
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-white mb-1">94%</h3>
                <p className="text-sm text-slate-400">Current Attendance</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden group">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center border border-red-500/30">
                    <Wallet className="w-6 h-6 text-red-400" />
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-white mb-1">₹5,000</h3>
                <p className="text-sm text-slate-400">Total Due Fees</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden group">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                    <Award className="w-6 h-6 text-emerald-400" />
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-white mb-1">A+</h3>
                <p className="text-sm text-slate-400">Last Term Grade</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden group">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                    <TrendingUp className="w-6 h-6 text-blue-400" />
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-white mb-1">Top 5%</h3>
                <p className="text-sm text-slate-400">Class Rank</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2 mt-6">
            <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl h-80 flex flex-col p-6">
              <h3 className="font-bold text-lg text-white mb-4">Upcoming Due Dates</h3>
              <div className="flex-1 flex items-center justify-center border border-dashed border-white/10 rounded-lg">
                <p className="text-slate-500 text-sm">No upcoming payments or assignments due.</p>
              </div>
            </Card>
            
            <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl h-80 flex flex-col p-6">
              <h3 className="font-bold text-lg text-white mb-4">Recent School Updates</h3>
              <div className="flex-1 flex items-center justify-center border border-dashed border-white/10 rounded-lg">
                <p className="text-slate-500 text-sm">No new updates from the principal's office.</p>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
