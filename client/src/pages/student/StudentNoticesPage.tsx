// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Bell, Megaphone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function StudentNoticesPage() {
  const params = useParams();
  const tenant = params.tenantId as string;
  const [loading, setLoading] = useState(true);
  const [notices, setNotices] = useState<any[]>([]);

  const supabase = createClient();

  useEffect(() => {
    fetchNotices();
  }, [tenant]);

  async function fetchNotices() {
    setLoading(true);
    try {
      const { data: school } = await supabase
        .from('schools')
        .select('id')
        .eq('subdomain', tenant)
        .single();

      if (!school) return;

      const { data } = await supabase
        .from('announcements')
        .select(`
          id, title, content, priority, created_at,
          author:created_by(full_name)
        `)
        .eq('school_id', school.id)
        .order('created_at', { ascending: false });

      if (data) setNotices(data);
    } catch (error) {
      console.error("Error fetching notices:", error);
    } finally {
      setLoading(false);
    }
  }

  const getPriorityColor = (priority: string) => {
    switch(priority.toLowerCase()) {
      case 'high': return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'medium': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      default: return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Notice Board</h1>
          <p className="text-sm text-muted-foreground mt-1">Important announcements and updates from the school.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500/50" />
        </div>
      ) : notices.length === 0 ? (
        <div className="text-center py-12 bg-gradient-to-br from-fuchsia-500/10 via-purple-500/5 to-orange-500/10 rounded-2xl border border-fuchsia-500/20 shadow-xl">
          <Bell className="w-12 h-12 text-fuchsia-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-foreground mb-1">No new notices</h3>
          <p className="text-muted-foreground text-sm">You're all caught up with school announcements.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <AnimatePresence>
            {notices.map((notice, idx) => (
              <motion.div
                key={notice.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="bg-card backdrop-blur-xl border-border shadow-xl hover:bg-muted/30 transition-colors h-full flex flex-col">
                  <CardContent className="p-6 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center border border-border/50">
                          <Megaphone className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${getPriorityColor(notice.priority)}`}>
                            {notice.priority}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">
                        {formatDate(notice.created_at)}
                      </span>
                    </div>

                    <h3 className="text-xl font-bold text-foreground mb-3">{notice.title}</h3>
                    <p className="text-sm text-foreground/80 leading-relaxed flex-grow">{notice.content}</p>

                    <div className="mt-6 pt-4 border-t border-border/50 text-xs text-muted-foreground">
                      Posted by {notice.author?.full_name || 'School Administration'}
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
