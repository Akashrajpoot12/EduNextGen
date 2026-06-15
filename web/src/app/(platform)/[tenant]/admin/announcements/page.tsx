"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Megaphone, Plus, BellRing, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AnnouncementsPage() {
  const params = useParams();
  const tenant = params.tenant as string;
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [schoolId, setSchoolId] = useState("");
  
  // Form State
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [targetAudience, setTargetAudience] = useState("all");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchAnnouncements();
  }, [tenant]);

  async function fetchAnnouncements() {
    setLoading(true);
    try {
      const { data: school } = await supabase
        .from('schools')
        .select('id')
        .eq('subdomain', tenant)
        .single();

      if (!school) return;
      setSchoolId(school.id);

      const { data: annData } = await supabase
        .from('announcements')
        .select(`
          id, title, content, target_audience, created_at,
          users:created_by(full_name)
        `)
        .eq('school_id', school.id)
        .order('created_at', { ascending: false });

      if (annData) setAnnouncements(annData);
    } catch (error) {
      console.error("Error fetching announcements:", error);
    } finally {
      setLoading(false);
    }
  }

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from('announcements').insert({
        school_id: schoolId,
        title,
        content,
        target_audience: targetAudience,
        created_by: user.id
      });

      if (error) throw error;
      
      setTitle("");
      setContent("");
      setTargetAudience("all");
      setIsDialogOpen(false);
      fetchAnnouncements();
      
    } catch (error: any) {
      console.error("Error posting announcement:", error);
      alert(`Failed to post: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Notice Board</h1>
          <p className="text-sm text-slate-400 mt-1">Broadcast important information to students and staff.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" />}>
              <Plus className="w-4 h-4 mr-2" /> Post Notice
            </DialogTrigger>
          <DialogContent className="bg-slate-900 border-white/10 text-white sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Notice</DialogTitle>
              <DialogDescription className="text-slate-400">
                This notice will be visible on the dashboard of the selected audience.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handlePostAnnouncement} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="title">Notice Title</Label>
                <Input 
                  id="title" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  placeholder="e.g. Annual Sports Day"
                  required 
                  className="bg-slate-950 border-white/10 text-white" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Message</Label>
                <textarea 
                  id="content" 
                  value={content} 
                  onChange={(e) => setContent(e.target.value)} 
                  required 
                  rows={4}
                  className="w-full flex min-h-[80px] rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="audience">Target Audience</Label>
                <Select value={targetAudience} onValueChange={(val) => setTargetAudience(val || "")} required>
                  <SelectTrigger className="bg-slate-950 border-white/10 text-white">
                    <SelectValue placeholder="Select audience" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10 text-white">
                    <SelectItem value="all">Everyone</SelectItem>
                    <SelectItem value="teachers">Teachers Only</SelectItem>
                    <SelectItem value="students">Students Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={isSubmitting} className="bg-emerald-500 hover:bg-emerald-600 text-white w-full">
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Megaphone className="w-4 h-4 mr-2" />}
                  Broadcast Notice
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
      ) : announcements.length === 0 ? (
        <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-white/5">
              <BellRing className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Notice board is empty</h3>
            <p className="text-slate-400 mb-6 max-w-sm">There are no announcements currently published for your school.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {announcements.map((ann, idx) => (
              <motion.div
                key={ann.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden hover:border-emerald-500/30 transition-all">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-bold text-white">{ann.title}</h3>
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                            ann.target_audience === 'all' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                            ann.target_audience === 'teachers' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                            'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}>
                            {ann.target_audience === 'all' ? 'Broadcast' : ann.target_audience}
                          </span>
                        </div>
                        <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{ann.content}</p>
                      </div>
                      
                      <div className="shrink-0 text-right space-y-1">
                        <div className="flex items-center justify-end text-xs text-slate-500">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDate(ann.created_at)}
                        </div>
                        <p className="text-xs text-emerald-400 font-medium">
                          Posted by {ann.users?.full_name || "Admin"}
                        </p>
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