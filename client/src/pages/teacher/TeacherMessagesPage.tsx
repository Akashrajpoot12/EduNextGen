import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Send, MessageSquare, Users, Search } from "lucide-react";

type Parent = { id: string; name: string; email: string; student_name: string; class_name: string };
type Message = { id: string; message: string; created_at: string; sender_id: string };

function formatMsgTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  if (isToday) return `Today ${time}`;
  if (isYesterday) return `Yesterday ${time}`;
  return `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} ${time}`;
}

export function TeacherMessagesPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();
  const [parents, setParents] = useState<Parent[]>([]);
  const [selectedParent, setSelectedParent] = useState<Parent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!schoolId) return;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      const { data: students } = await supabase
        .from("students")
        .select("user_id, name, classes:class_id(name), parent_id")
        .eq("school_id", schoolId);

      if (!students) { setLoading(false); return; }

      const parentIds = [...new Set(students.map((s: any) => s.parent_id).filter(Boolean))];
      if (parentIds.length === 0) { setLoading(false); return; }

      const { data: parentUsers } = await supabase
        .from("users").select("id, full_name, email").in("id", parentIds);

      const parentList: Parent[] = (parentUsers || []).map((p: any) => {
        const child = students.find((s: any) => s.parent_id === p.id);
        return {
          id: p.id,
          name: p.full_name || p.email,
          email: p.email,
          student_name: (child as any)?.name || "—",
          class_name: (child as any)?.classes?.name || "—",
        };
      });

      setParents(parentList);
      setLoading(false);
    }
    load();
  }, [schoolId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadMessages(parentId: string, userId: string) {
    // FIXED: correct OR filter — fetch messages between this teacher and this parent
    const { data } = await supabase
      .from("teacher_parent_messages")
      .select("id, message, created_at, sender_id")
      .or(`and(teacher_id.eq.${userId},parent_id.eq.${parentId}),and(teacher_id.eq.${parentId},parent_id.eq.${userId})`)
      .order("created_at", { ascending: true })
      .limit(50);
    setMessages(data || []);
  }

  function selectParent(p: Parent) {
    // Unsubscribe from previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setSelectedParent(p);
    if (!currentUser) return;
    loadMessages(p.id, currentUser.id);

    // Subscribe to real-time new messages
    const channel = supabase
      .channel(`messages-${p.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "teacher_parent_messages",
      }, (payload: any) => {
        const msg = payload.new;
        const isRelevant =
          (msg.teacher_id === currentUser.id && msg.parent_id === p.id) ||
          (msg.teacher_id === p.id && msg.parent_id === currentUser.id);
        if (isRelevant) {
          setMessages(prev => [...prev, { id: msg.id, message: msg.message, created_at: msg.created_at, sender_id: msg.sender_id }]);
        }
      })
      .subscribe();

    channelRef.current = channel;
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  async function sendMessage() {
    if (!newMsg.trim() || !selectedParent || !currentUser) return;
    setSending(true);
    const { error } = await supabase.from("teacher_parent_messages").insert({
      school_id: schoolId,
      teacher_id: currentUser.id,
      parent_id: selectedParent.id,
      message: newMsg.trim(),
      sender_id: currentUser.id,
      sender_name: currentUser.user_metadata?.full_name || "Teacher",
      is_reply: false,
    });
    if (!error) setNewMsg("");
    setSending(false);
  }

  const filtered = parents.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.student_name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex justify-center items-center h-48"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-0">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Parent Messages</h1>
        <p className="text-sm text-muted-foreground mt-1">Communicate directly with parents</p>
      </div>

      <div className="flex gap-4 h-[calc(100vh-240px)] min-h-[400px]">
        {/* Parent List */}
        <div className="w-72 flex-shrink-0 bg-card border border-border rounded-xl flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search parent..." title="Search parents"
                className="w-full h-8 bg-muted rounded-lg pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0
              ? <div className="p-4 text-center text-sm text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No parents found
                </div>
              : filtered.map(p => (
                <button type="button" key={p.id} onClick={() => selectParent(p)}
                  className={`w-full p-3 text-left hover:bg-muted/60 transition-colors border-b border-border/50 ${selectedParent?.id === p.id ? "bg-primary/10" : ""}`}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">Parent of {p.student_name}</p>
                    </div>
                  </div>
                </button>
              ))
            }
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 bg-card border border-border rounded-xl flex flex-col overflow-hidden">
          {!selectedParent
            ? <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
                  <p className="font-medium">Select a parent to start messaging</p>
                </div>
              </div>
            : <>
              {/* Header */}
              <div className="p-4 border-b border-border flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
                  {selectedParent.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold">{selectedParent.name}</p>
                  <p className="text-xs text-muted-foreground">Parent of {selectedParent.student_name} · Class {selectedParent.class_name}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0
                  ? <div className="flex items-center justify-center h-full">
                      <p className="text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
                    </div>
                  : messages.map(m => (
                    <div key={m.id} className={`flex ${m.sender_id === currentUser?.id ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-xs rounded-2xl px-4 py-2.5 text-sm ${m.sender_id === currentUser?.id ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm"}`}>
                        <p>{m.message}</p>
                        <p className={`text-xs mt-1 ${m.sender_id === currentUser?.id ? "text-primary-foreground/70 text-right" : "text-muted-foreground"}`}>
                          {formatMsgTime(m.created_at)}
                        </p>
                      </div>
                    </div>
                  ))
                }
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-border flex gap-2">
                <input value={newMsg} onChange={e => setNewMsg(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder="Type a message..." title="Message input"
                  className="flex-1 h-10 bg-muted rounded-lg px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                <button type="button" onClick={sendMessage} disabled={sending || !newMsg.trim()}
                  className="h-10 w-10 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground rounded-lg flex items-center justify-center transition-colors">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          }
        </div>
      </div>
    </div>
  );
}
