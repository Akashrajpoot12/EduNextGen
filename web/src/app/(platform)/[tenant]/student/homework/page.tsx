"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, Upload, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function StudentHomeworkPage() {
  const params = useParams();
  const tenant = params.tenant as string;
  const [loading, setLoading] = useState(true);
  const [homeworks, setHomeworks] = useState<any[]>([]);

  const supabase = createClient();

  useEffect(() => {
    fetchHomework();
  }, [tenant]);

  async function fetchHomework() {
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
        .from('homework')
        .select(`
          id, subject, title, description, due_date, created_at,
          teacher:created_by(full_name)
        `)
        .eq('school_id', studentRecord.school_id)
        .eq('class_id', studentRecord.class_id)
        .order('due_date', { ascending: true });

      if (data) {
        // For demo, randomly assigning "submitted" status to some
        const hwWithStatus = data.map(hw => ({
          ...hw,
          submitted: Math.random() > 0.5
        }));
        setHomeworks(hwWithStatus);
      }
    } catch (error) {
      console.error("Error fetching homework:", error);
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">My Homework</h1>
          <p className="text-sm text-slate-400 mt-1">View assignments and submit your work.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500/50" />
        </div>
      ) : homeworks.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/50 rounded-xl border border-white/10 shadow-xl">
          <BookOpen className="w-12 h-12 text-slate-500 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-bold text-white mb-1">No homework assigned</h3>
          <p className="text-slate-400 text-sm">You are all caught up! Enjoy your free time.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {homeworks.map((hw, idx) => (
              <motion.div
                key={hw.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className={`bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl hover:bg-white/[0.02] transition-all relative overflow-hidden ${hw.submitted ? 'opacity-80' : ''}`}>
                  {hw.submitted && (
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-500/20 to-transparent rounded-bl-full pointer-events-none" />
                  )}
                  <CardContent className="p-6 flex flex-col md:flex-row gap-6 relative z-10">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="px-2.5 py-1 rounded-full text-[10px] uppercase font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          {hw.subject}
                        </span>
                        {hw.submitted && (
                          <span className="flex items-center text-xs text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Submitted
                          </span>
                        )}
                        <span className={`text-xs font-mono ml-auto ${hw.submitted ? 'text-slate-500' : 'text-amber-400'}`}>
                          Due: {formatDate(hw.due_date)}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">{hw.title}</h3>
                      <p className="text-sm text-slate-300 mb-4">{hw.description}</p>
                      <div className="text-xs text-slate-500">
                        Assigned by: {hw.teacher?.full_name || 'Teacher'}
                      </div>
                    </div>
                    
                    <div className="flex items-center md:border-l md:border-white/10 md:pl-6">
                      {hw.submitted ? (
                        <Button variant="outline" className="w-full md:w-auto border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300">
                          View Submission
                        </Button>
                      ) : (
                        <Button className="w-full md:w-auto bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/20">
                          <Upload className="w-4 h-4 mr-2" /> Upload Work
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
