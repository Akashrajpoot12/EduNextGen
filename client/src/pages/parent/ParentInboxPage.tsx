// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Mail, Bell, Smartphone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function ParentInboxPage() {
  const params = useParams();
  const tenant = params.tenantId as string;
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);

  const supabase = createClient();

  useEffect(() => {
    fetchMessages();
  }, [tenant]);

  async function fetchMessages() {
    setLoading(true);
    try {
      const { data: school } = await supabase
        .from('schools')
        .select('id')
        .eq('subdomain', tenant)
        .single();

      if (!school) return;
      const { data: { user } } = await supabase.auth.getUser();

      // Merge school broadcasts (communications) + direct teacher→parent messages.
      const [bcastRes, dmRes] = await Promise.all([
        supabase.from('communications')
          .select(`id, subject, body, message_type, created_at`)
          .eq('school_id', school.id)
          .in('recipient_type', ['Parents', 'All_Students'])
          .order('created_at', { ascending: false }),
        user
          ? supabase.from('teacher_parent_messages')
              .select(`id, message, sender_name, created_at`)
              .eq('school_id', school.id)
              .eq('parent_id', user.id)
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const broadcasts = (bcastRes.data || []).map((m: any) => ({
        id: 'c_' + m.id, subject: m.subject, body: m.body,
        message_type: m.message_type || 'notice', created_at: m.created_at,
        senderName: 'Administration',
      }));
      const dms = (dmRes.data || []).map((m: any) => ({
        id: 'm_' + m.id, subject: "Message from teacher", body: m.message,
        message_type: 'message', created_at: m.created_at,
        senderName: m.sender_name || 'Teacher',
      }));
      setMessages([...broadcasts, ...dms].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')));
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  }

  const getMessageIcon = (type: string) => {
    switch(type) {
      case 'email': return <Mail className="w-5 h-5 text-blue-400" />;
      case 'sms': return <Smartphone className="w-5 h-5 text-emerald-400" />;
      default: return <Bell className="w-5 h-5 text-amber-400" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">School Inbox</h1>
          <p className="text-sm text-muted-foreground mt-1">Official communications and alerts from the school administration.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500/50" />
        </div>
      ) : messages.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border shadow-xl">
          <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-bold text-foreground mb-1">Your inbox is empty</h3>
          <p className="text-muted-foreground text-sm">Messages sent by the school will appear here.</p>
        </div>
      ) : (
        <div className="grid gap-4 max-w-4xl">
          <AnimatePresence>
            {messages.map((msg, idx) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="bg-card backdrop-blur-xl border-border shadow-xl hover:bg-white/[0.02] transition-colors relative overflow-hidden group">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500/50 group-hover:bg-amber-400 transition-colors" />
                  <CardContent className="p-6 sm:pl-8 flex gap-4">
                    <div className="hidden sm:flex w-12 h-12 rounded-full bg-muted items-center justify-center border border-border flex-shrink-0">
                      {getMessageIcon(msg.message_type)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-bold text-foreground">{msg.subject}</h3>
                        <span className="text-xs text-muted-foreground font-mono flex-shrink-0 ml-4">
                          {formatDate(msg.created_at)}
                        </span>
                      </div>
                      
                      <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                        {msg.body}
                      </p>
                      
                      <div className="flex items-center text-xs text-muted-foreground">
                        <span>From: <span className="text-muted-foreground">{msg.senderName}</span></span>
                        <span className="mx-2">•</span>
                        <span className="uppercase">{msg.message_type}</span>
                      </div>
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
