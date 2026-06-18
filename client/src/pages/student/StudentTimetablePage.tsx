// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Calendar } from "lucide-react";
import { motion } from "framer-motion";

export function StudentTimetablePage() {
  const params = useParams();
  const tenant = params.tenantId as string;
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<any[]>([]);

  const supabase = createClient();

  useEffect(() => {
    fetchTimetable();
  }, [tenant]);

  async function fetchTimetable() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: studentRecord } = await supabase
        .from('students')
        .select('class_id, school_id')
        .eq('user_id', user.id)
        .single();
        
      if (!studentRecord) return;

      const { data } = await supabase
        .from('timetable')
        .select(`
          id, day_of_week, start_time, end_time, subject,
          teacher:teacher_id(full_name)
        `)
        .eq('school_id', studentRecord.school_id)
        .eq('class_id', studentRecord.class_id)
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
          <h1 className="text-3xl font-bold tracking-tight text-white">Class Timetable</h1>
          <p className="text-sm text-slate-400 mt-1">Your weekly schedule for lectures and subjects.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500/50" />
        </div>
      ) : schedule.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/50 rounded-xl border border-white/10 shadow-xl">
          <Calendar className="w-12 h-12 text-slate-500 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-bold text-white mb-1">No timetable published</h3>
          <p className="text-slate-400 text-sm">Your class schedule has not been set up yet.</p>
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
                <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl h-full flex flex-col hover:border-purple-500/30 transition-colors">
                  <div className="px-6 py-4 border-b border-white/10 bg-slate-950/30">
                    <h3 className="font-bold text-lg text-purple-400">{day}</h3>
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
                            By {period.teacher?.full_name || 'Staff'}
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
