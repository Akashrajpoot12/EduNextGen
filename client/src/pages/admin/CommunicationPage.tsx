// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Search, Send, MessageSquare, Mail, Smartphone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function CommunicationPage() {
  const params = useParams();
  const tenant = params.tenantId as string;
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [schoolId, setSchoolId] = useState("");
  
  // Form State
  const [recipientType, setRecipientType] = useState("");
  const [messageType, setMessageType] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchInitialData();
  }, [tenant]);

  async function fetchInitialData() {
    setLoading(true);
    try {
      const { data: school } = await supabase
        .from('schools')
        .select('id')
        .eq('subdomain', tenant)
        .single();

      if (!school) return;
      setSchoolId(school.id);

      fetchMessages(school.id);
    } catch (error) {
      console.error("Error fetching initial data:", error);
      setLoading(false);
    }
  }

  async function fetchMessages(sId: string) {
    try {
      const { data } = await supabase
        .from('communications')
        .select(`
          id, recipient_type, message_type, subject, body, status, created_at,
          sender:sender_id(full_name)
        `)
        .eq('school_id', sId)
        .order('created_at', { ascending: false });

      if (data) setMessages(data);
    } catch (error) {
      console.error("Error fetching communications:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Note: In a real system, you would call a Server Action here that triggers Twilio SMS or Resend Email API.
      // We are just logging the intent to the database for this UI module.
      
      const { error } = await supabase.from('communications').insert({
        school_id: schoolId,
        sender_id: user?.id,
        recipient_type: recipientType,
        message_type: messageType,
        subject,
        body,
        status: 'sent',
      });

      if (error) throw error;
      
      setRecipientType("");
      setMessageType("");
      setSubject("");
      setBody("");
      setIsDialogOpen(false);
      fetchMessages(schoolId);
      
    } catch (error: any) {
      console.error("Error sending message:", error);
      alert(`Failed to send message: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMessageIcon = (type: string) => {
    switch(type) {
      case 'email': return <Mail className="w-4 h-4" />;
      case 'sms': return <Smartphone className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
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
          <h1 className="text-3xl font-bold tracking-tight text-white">Communications Center</h1>
          <p className="text-sm text-slate-400 mt-1">Send and track bulk SMS, Emails, and App notifications.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" />}>
            <Send className="w-4 h-4 mr-2" /> Send Notification
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-white/10 text-white sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>New Communication</DialogTitle>
              <DialogDescription className="text-slate-400">
                Compose a message to be sent to a specific group.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSendMessage} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="recipient">To (Target Group)</Label>
                  <Select value={recipientType} onValueChange={setRecipientType} required>
                    <SelectTrigger className="bg-slate-950 border-white/10 text-white">
                      <SelectValue placeholder="Select recipients" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 text-white">
                      <SelectItem value="All_Students">All Students</SelectItem>
                      <SelectItem value="All_Teachers">All Teachers</SelectItem>
                      <SelectItem value="Parents">Parents / Guardians</SelectItem>
                      <SelectItem value="Staff">Non-Teaching Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="channel">Channel</Label>
                  <Select value={messageType} onValueChange={setMessageType} required>
                    <SelectTrigger className="bg-slate-950 border-white/10 text-white">
                      <SelectValue placeholder="Select channel" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 text-white">
                      <SelectItem value="email">Email Notification</SelectItem>
                      <SelectItem value="sms">SMS Text Message</SelectItem>
                      <SelectItem value="push">In-App Push</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject / Heading</Label>
                <Input 
                  id="subject" 
                  value={subject} 
                  onChange={(e) => setSubject(e.target.value)} 
                  placeholder="e.g. Urgent Update: School Holiday"
                  required 
                  className="bg-slate-950 border-white/10 text-white" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">Message Content</Label>
                <textarea 
                  id="body" 
                  value={body} 
                  onChange={(e) => setBody(e.target.value)} 
                  required 
                  rows={5}
                  placeholder="Type your message here..."
                  className="w-full flex rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                />
              </div>
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={isSubmitting} className="bg-emerald-500 hover:bg-emerald-600 text-white w-full">
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  Dispatch Message
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" />
        </div>
      ) : messages.length === 0 ? (
        <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-white/5">
              <Send className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No communication history</h3>
            <p className="text-slate-400 mb-6 max-w-sm">Messages sent from the dashboard will be logged here for auditing.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {messages.map((msg, idx) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl hover:border-emerald-500/30 transition-all group overflow-hidden flex flex-col h-full">
                  <CardContent className="p-6 relative z-10 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center text-slate-300">
                        <span className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center mr-3 border border-white/10">
                          {getMessageIcon(msg.message_type)}
                        </span>
                        <div>
                          <p className="text-xs text-slate-500">To: {msg.recipient_type.replace('_', ' ')}</p>
                          <p className="text-xs text-slate-500">{formatDate(msg.created_at)}</p>
                        </div>
                      </div>
                      <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs capitalize">
                        {msg.status}
                      </span>
                    </div>
                    
                    <h3 className="text-md font-bold text-white mb-2">{msg.subject}</h3>
                    <p className="text-sm text-slate-400 mb-4 line-clamp-4 flex-grow">{msg.body}</p>
                    
                    <div className="pt-4 border-t border-white/5 mt-auto text-xs text-slate-500">
                      Sent by: {msg.sender?.full_name || 'Administrator'}
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
