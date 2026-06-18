// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Users, BookOpen, Clock, CalendarCheck } from "lucide-react";
import { motion } from "framer-motion";

export function TeacherDashboard() {
  const params = useParams();
  const tenant = params.tenantId as string;
  const [loading, setLoading] = useState(true);
  const [teacherName, setTeacherName] = useState("");

  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, [tenant]);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', user.id)
          .single();
          
        if (profile) setTeacherName(profile.full_name);
      }
    } catch (error) {
      console.error("Error fetching teacher data:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Welcome back, {teacherName || "Teacher"}!
          </h1>
          <p className="text-sm text-slate-400 mt-1">Here is your daily academic summary and schedule.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" />
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden group">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                    <Users className="w-6 h-6 text-blue-400" />
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-white mb-1">3</h3>
                <p className="text-sm text-slate-400">Assigned Classes</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden group">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                    <BookOpen className="w-6 h-6 text-emerald-400" />
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-white mb-1">12</h3>
                <p className="text-sm text-slate-400">Active Assignments</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden group">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
                    <Clock className="w-6 h-6 text-purple-400" />
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-white mb-1">5</h3>
                <p className="text-sm text-slate-400">Periods Today</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden group">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
                    <CalendarCheck className="w-6 h-6 text-amber-400" />
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-white mb-1">98%</h3>
                <p className="text-sm text-slate-400">My Attendance</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2 mt-6">
            <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl h-80 flex flex-col p-6">
              <h3 className="font-bold text-lg text-white mb-4">Today's Schedule</h3>
              <div className="flex-1 flex items-center justify-center border border-dashed border-white/10 rounded-lg">
                <p className="text-slate-500 text-sm">Schedule integrated with timetable module.</p>
              </div>
            </Card>
            
            <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl h-80 flex flex-col p-6">
              <h3 className="font-bold text-lg text-white mb-4">Recent Submissions</h3>
              <div className="flex-1 flex items-center justify-center border border-dashed border-white/10 rounded-lg">
                <p className="text-slate-500 text-sm">No new homework submissions today.</p>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
