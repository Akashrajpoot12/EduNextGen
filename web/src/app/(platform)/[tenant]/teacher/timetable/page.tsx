"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Calendar } from "lucide-react";
import { motion } from "framer-motion";

export default function TeacherTimetablePage() {
  const params = useParams();
  const tenant = params.tenant as string;
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<any[]>([]);

  const supabase = createClient();

  useEffect(() => {
    fetchTimetable();
  }, [tenant]);

  async function fetchTimetable() {
    setLoading(true);
    try {
      const { data: school } = await supabase
        .from('schools')
        .select('id')
        .eq('subdomain', tenant)
        .single();

      if (!school) return;

      const { data: { user } } = await supabase.auth.getUser();

      const { data } = await supabase
        .from('timetable')
        .select(`
          id, day_of_week, start_time, end_time, subject,
          classes:class_id(grade_level, section)
        `)
        .eq('school_id', school.id)
        .eq('teacher_id', user?.id)
        .order('start_time', { ascending: true });

      if (data) setSchedule(data);
    } catch (error) {
      console.error("Error fetching timetable:", error);
    } finally {
      setLoading(false);
    }
  }

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">My Timetable</h1>
          <p className="text-sm text-slate-400 mt-1">Your weekly teaching schedule and class assignments.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" />
        </div>
      ) : schedule.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/50 rounded-xl border border-white/10 shadow-xl">
          <Calendar className="w-12 h-12 text-slate-500 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-bold text-white mb-1">No schedule assigned</h3>
          <p className="text-slate-400 text-sm">You currently don't have any classes assigned to you.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {days.map((day, idx) => {
            const daySchedule = schedule.filter(s => s.day_of_week === day);
            if (daySchedule.length === 0) return null;

            return (
              <motion.div
                key={day}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl h-full flex flex-col">
                  <div className="px-6 py-4 border-b border-white/10 bg-slate-950/30">
                    <h3 className="font-bold text-lg text-emerald-400">{day}</h3>
                  </div>
                  <CardContent className="p-0 flex-1">
                    <div className="divide-y divide-white/5">
                      {daySchedule.map((period) => (
                        <div key={period.id} className="p-4 hover:bg-white/5 transition-colors">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-bold text-white text-sm">{period.subject}</span>
                            <span className="text-xs text-slate-400 font-mono">
                              {period.start_time.substring(0,5)} - {period.end_time.substring(0,5)}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500">
                            Class {period.classes?.grade_level} {period.classes?.section}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
