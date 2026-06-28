// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Calendar } from "lucide-react";
import { motion } from "framer-motion";

export function TeacherTimetablePage() {
  const { tenantId: schoolId } = useTenant();
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<any[]>([]);

  const supabase = createClient();

  useEffect(() => {
    if (!schoolId) return;
    async function fetchTimetable() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data } = await supabase
          .from('timetables')
          .select(`id, day_of_week, start_time, end_time, subject, classes:class_id(grade_level, section)`)
          .eq('school_id', schoolId)
          .eq('teacher_id', user?.id)
          .order('start_time', { ascending: true });
        if (data) setSchedule(data);
      } catch (error) {
        console.error("Error fetching timetable:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchTimetable();
  }, [schoolId]);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">My Timetable</h1>
          <p className="text-sm text-muted-foreground mt-1">Your weekly teaching schedule and class assignments.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" />
        </div>
      ) : schedule.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border shadow-xl">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-bold text-foreground mb-1">No schedule assigned</h3>
          <p className="text-muted-foreground text-sm">You currently don't have any classes assigned to you.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {days.map((day, idx) => {
            // timetables.day_of_week is an INT index (Monday=0 … Saturday=5)
            const daySchedule = schedule.filter(s => s.day_of_week === idx);
            if (daySchedule.length === 0) return null;

            return (
              <motion.div
                key={day}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card className="bg-card backdrop-blur-xl border-border shadow-xl h-full flex flex-col">
                  <div className="px-6 py-4 border-b border-border bg-background/30">
                    <h3 className="font-bold text-lg text-emerald-400">{day}</h3>
                  </div>
                  <CardContent className="p-0 flex-1">
                    <div className="divide-y divide-white/5">
                      {daySchedule.map((period) => (
                        <div key={period.id} className="p-4 hover:bg-muted/50 transition-colors">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-bold text-foreground text-sm">{period.subject}</span>
                            <span className="text-xs text-muted-foreground font-mono">
                              {period.start_time.substring(0,5)} - {period.end_time.substring(0,5)}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
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
