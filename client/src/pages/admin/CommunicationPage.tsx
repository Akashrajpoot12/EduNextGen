// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Send, MessageSquare, Mail, Smartphone, MessageCircle, CalendarX, Wallet, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export function CommunicationPage() {
  const { tenantId: schoolId } = useTenant();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Form State
  const [recipientType, setRecipientType] = useState("");
  const [messageType, setMessageType] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sendingWA, setSendingWA] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    if (schoolId) fetchMessages();
  }, [schoolId]);

  async function fetchMessages() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('communications')
        .select(`id, recipient_type, message_type, subject, body, status, created_at, sender:sender_id(full_name)`)
        .eq('school_id', schoolId)
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
      fetchMessages();
      
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

  async function sendWhatsAppAlert(type: string, label: string, extraPayload?: any) {
    setSendingWA(type);
    const toastId = toast.loading(`Sending ${label}...`);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ type, schoolId, data: extraPayload || {} }),
        }
      );
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      toast.success(`${label}: ${result.sent} sent, ${result.failed} failed`, { id: toastId });
    } catch (err: any) {
      toast.error("Failed: " + err.message, { id: toastId });
    }
    setSendingWA(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Communications Center</h1>
          <p className="text-sm text-muted-foreground mt-1">Send and track bulk SMS, Emails, and App notifications.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" />}>
            <Send className="w-4 h-4 mr-2" /> Send Notification
          </DialogTrigger>
          <DialogContent className="bg-card border-border text-foreground sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>New Communication</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Compose a message to be sent to a specific group.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSendMessage} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="recipient">To (Target Group)</Label>
                  <Select value={recipientType} onValueChange={setRecipientType} required>
                    <SelectTrigger className="bg-background border-border text-foreground">
                      <SelectValue placeholder="Select recipients" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
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
                    <SelectTrigger className="bg-background border-border text-foreground">
                      <SelectValue placeholder="Select channel" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
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
                  className="bg-background border-border text-foreground" 
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
                  className="w-full flex rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
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

      {/* WhatsApp Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-green-400" /> WhatsApp Bulk Alerts
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Absent Alert */}
          <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <CalendarX className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Absent Alert Today</p>
              <p className="text-xs text-muted-foreground mt-0.5">Send WhatsApp to parents of all students absent today</p>
            </div>
            <Button
              onClick={() => sendWhatsAppAlert("absent_alert", "Absent Alert")}
              disabled={sendingWA !== null}
              className="bg-green-600 hover:bg-green-700 text-white w-full mt-auto"
            >
              {sendingWA === "absent_alert"
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
                : <><Send className="w-4 h-4 mr-2" /> Send Alert</>}
            </Button>
          </div>

          {/* Fees Due */}
          <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Fees Due Reminder</p>
              <p className="text-xs text-muted-foreground mt-0.5">Remind parents of all overdue fee assignments via WhatsApp</p>
            </div>
            <Button
              onClick={() => sendWhatsAppAlert("fees_due", "Fees Reminder")}
              disabled={sendingWA !== null}
              className="bg-green-600 hover:bg-green-700 text-white w-full mt-auto"
            >
              {sendingWA === "fees_due"
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
                : <><Send className="w-4 h-4 mr-2" /> Send Reminder</>}
            </Button>
          </div>

          {/* Custom */}
          <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Custom Broadcast</p>
              <p className="text-xs text-muted-foreground mt-0.5">Compose and send a custom WhatsApp message to all parents</p>
            </div>
            <Button
              onClick={() => setIsDialogOpen(true)}
              disabled={sendingWA !== null}
              variant="outline"
              className="border-border text-foreground hover:bg-muted w-full mt-auto"
            >
              <Send className="w-4 h-4 mr-2" /> Compose
            </Button>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-2">
        <h2 className="text-lg font-semibold text-foreground mb-4">Message History</h2>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" />
        </div>
      ) : messages.length === 0 ? (
        <Card className="bg-card backdrop-blur-xl border-border shadow-xl">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 border border-border">
              <Send className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">No communication history</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">Messages sent from the dashboard will be logged here for auditing.</p>
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
                <Card className="bg-card backdrop-blur-xl border-border shadow-xl hover:border-emerald-500/30 transition-all group overflow-hidden flex flex-col h-full">
                  <CardContent className="p-6 relative z-10 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center text-muted-foreground">
                        <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center mr-3 border border-border">
                          {getMessageIcon(msg.message_type)}
                        </span>
                        <div>
                          <p className="text-xs text-muted-foreground">To: {msg.recipient_type.replace('_', ' ')}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(msg.created_at)}</p>
                        </div>
                      </div>
                      <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs capitalize">
                        {msg.status}
                      </span>
                    </div>
                    
                    <h3 className="text-md font-bold text-foreground mb-2">{msg.subject}</h3>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-4 flex-grow">{msg.body}</p>
                    
                    <div className="pt-4 border-t border-border mt-auto text-xs text-muted-foreground">
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
