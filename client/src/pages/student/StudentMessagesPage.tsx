// @ts-nocheck
"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare, Send } from "lucide-react";

export function StudentMessagesPage() {
  const params = useParams();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [newMessage, setNewMessage] = useState("");
  const [student, setStudent] = useState<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: studentRec } = await supabase
        .from("students")
        .select("id, school_id, class_id")
        .eq("user_id", user.id)
        .maybeSingle();

      setStudent({ ...studentRec, user_id: user.id });

      if (studentRec) {
        // Get teachers who teach this student's class
        const { data: ttData } = await supabase
          .from("timetables")
          .select("teacher_id")
          .eq("school_id", studentRec.school_id)
          .eq("class_id", studentRec.class_id);

        const teacherIds = [...new Set((ttData || []).map((t: any) => t.teacher_id))];

        if (teacherIds.length > 0) {
          const { data: teacherData } = await supabase
            .from("users")
            .select("id, full_name")
            .in("id", teacherIds);
          setTeachers(teacherData || []);
          if (teacherData && teacherData.length > 0) {
            setSelectedTeacher(teacherData[0]);
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedTeacher && student) fetchMessages();
  }, [selectedTeacher]);

  async function fetchMessages() {
    if (!selectedTeacher || !student) return;
    const { data } = await supabase
      .from("messages")
      .select("id, sender_id, content, created_at")
      .or(`and(sender_id.eq.${student.user_id},receiver_id.eq.${selectedTeacher.id}),and(sender_id.eq.${selectedTeacher.id},receiver_id.eq.${student.user_id})`)
      .order("created_at", { ascending: true });
    setMessages(data || []);
  }

  async function sendMessage() {
    if (!newMessage.trim() || !student || !selectedTeacher) return;
    setSending(true);
    try {
      await supabase.from("messages").insert({
        sender_id: student.user_id,
        receiver_id: selectedTeacher.id,
        school_id: student.school_id,
        content: newMessage.trim(),
      });
      setNewMessage("");
      fetchMessages();
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  }

  const formatTime = (ts: string) => new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const formatDate = (ts: string) => new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Messages</h1>
        <p className="text-sm text-muted-foreground mt-1">Chat with your teachers directly.</p>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-purple-500/50" /></div>
      ) : teachers.length === 0 ? (
        <Card className="bg-gradient-to-br from-fuchsia-500/10 via-purple-500/5 to-orange-500/10 rounded-2xl border border-fuchsia-500/20 shadow-xl">
          <CardContent className="p-12 text-center">
            <MessageSquare className="w-12 h-12 text-fuchsia-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-foreground mb-1">No teachers found</h3>
            <p className="text-muted-foreground text-sm">Teachers will appear here once timetable is assigned.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[400px]">
          {/* Teacher list */}
          <Card className="bg-card border-border shadow-xl w-56 flex-shrink-0">
            <CardContent className="p-0">
              <p className="text-xs font-semibold uppercase text-muted-foreground px-4 pt-4 pb-2 tracking-wider">Teachers</p>
              <div className="space-y-0.5 px-2 pb-2">
                {teachers.map(t => (
                  <button key={t.id} onClick={() => setSelectedTeacher(t)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${selectedTeacher?.id === t.id ? "bg-purple-500/20 text-purple-300" : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"}`}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-400 flex-shrink-0">
                        {t.full_name?.charAt(0) || "T"}
                      </div>
                      <span className="truncate">{t.full_name || "Teacher"}</span>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Chat area */}
          <Card className="bg-card border-border shadow-xl flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-border flex items-center gap-3 flex-shrink-0">
              <div className="w-9 h-9 rounded-full bg-purple-500/20 flex items-center justify-center font-bold text-purple-400">
                {selectedTeacher?.full_name?.charAt(0) || "T"}
              </div>
              <div>
                <p className="text-foreground font-semibold text-sm">{selectedTeacher?.full_name}</p>
                <p className="text-muted-foreground text-xs">Teacher</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                  <MessageSquare className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isMine = msg.sender_id === student?.user_id;
                  const showDate = i === 0 || formatDate(messages[i - 1].created_at) !== formatDate(msg.created_at);
                  return (
                    <div key={msg.id}>
                      {showDate && (
                        <div className="text-center text-xs text-muted-foreground/60 my-2">{formatDate(msg.created_at)}</div>
                      )}
                      <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[72%] px-4 py-2.5 rounded-2xl text-sm ${isMine ? "bg-purple-600 text-foreground rounded-br-sm" : "bg-muted text-foreground/80 rounded-bl-sm"}`}>
                          <p>{msg.content}</p>
                          <p className={`text-[10px] mt-1 ${isMine ? "text-purple-200/70 text-right" : "text-muted-foreground"}`}>{formatTime(msg.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-border flex items-center gap-3 flex-shrink-0">
              <input
                type="text"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Type a message..."
                className="flex-1 bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
              <Button onClick={sendMessage} disabled={!newMessage.trim() || sending}
                className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl w-10 h-10 p-0 shadow-lg shadow-purple-500/20">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
