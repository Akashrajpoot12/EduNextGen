"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, UserCircle2, BookOpen, Clock, CalendarCheck, Award } from "lucide-react";

export default function StudentDashboard() {
  const params = useParams();
  const tenant = params.tenant as string;
  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState("");
  const [className, setClassName] = useState("");

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
          
        if (profile) setStudentName(profile.full_name);

        // Fetch student class info
        const { data: studentRecord } = await supabase
          .from('students')
          .select('classes(grade_level, section)')
          .eq('user_id', user.id)
          .single();
          
        if (studentRecord && studentRecord.classes) {
          setClassName(`${studentRecord.classes.grade_level} - ${studentRecord.classes.section}`);
        }
      }
    } catch (error) {
      console.error("Error fetching student data:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Welcome, {studentName || "Student"}!
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {className ? `Class: ${className}` : 'Your daily academic overview'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500/50" />
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden group">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
                    <CalendarCheck className="w-6 h-6 text-purple-400" />
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-white mb-1">94%</h3>
                <p className="text-sm text-slate-400">My Attendance</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden group">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center border border-pink-500/30">
                    <BookOpen className="w-6 h-6 text-pink-400" />
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-white mb-1">2</h3>
                <p className="text-sm text-slate-400">Pending Homeworks</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden group">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                    <Clock className="w-6 h-6 text-blue-400" />
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-white mb-1">6</h3>
                <p className="text-sm text-slate-400">Classes Today</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden group">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
                    <Award className="w-6 h-6 text-amber-400" />
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-white mb-1">A+</h3>
                <p className="text-sm text-slate-400">Overall Grade</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2 mt-6">
            <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl h-80 flex flex-col p-6">
              <h3 className="font-bold text-lg text-white mb-4">Upcoming Classes</h3>
              <div className="flex-1 flex items-center justify-center border border-dashed border-white/10 rounded-lg">
                <p className="text-slate-500 text-sm">Timetable will be synced here.</p>
              </div>
            </Card>
            
            <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl h-80 flex flex-col p-6">
              <h3 className="font-bold text-lg text-white mb-4">Latest Announcements</h3>
              <div className="flex-1 flex items-center justify-center border border-dashed border-white/10 rounded-lg">
                <p className="text-slate-500 text-sm">No new notices from the school.</p>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
