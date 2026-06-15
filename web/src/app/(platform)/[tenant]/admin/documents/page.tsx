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
import { Loader2, Search, FileText, Upload, Download, FileArchive } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function DocumentsPage() {
  const params = useParams();
  const tenant = params.tenant as string;
  const [documents, setDocuments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [schoolId, setSchoolId] = useState("");
  
  // Form State
  const [userId, setUserId] = useState("");
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [fileUrl, setFileUrl] = useState(""); // Simplified: just taking a URL string instead of actual file upload for now
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

      // Fetch students and staff for the dropdown
      const { data: usersData } = await supabase
        .from('user_roles')
        .select('user_id, role, users(full_name)')
        .eq('school_id', school.id);

      if (usersData) {
        setUsers(usersData.map(u => ({ id: u.user_id, name: u.users?.full_name, role: u.role })));
      }

      fetchDocuments(school.id);
    } catch (error) {
      console.error("Error fetching initial data:", error);
      setLoading(false);
    }
  }

  async function fetchDocuments(sId: string) {
    try {
      const { data } = await supabase
        .from('documents')
        .select(`
          id, title, document_type, file_url, created_at,
          users:user_id(full_name)
        `)
        .eq('school_id', sId)
        .order('created_at', { ascending: false });

      if (data) setDocuments(data);
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Note: In production, we would upload the actual file to Supabase Storage first and get the public URL.
      const simulatedUrl = fileUrl || `https://storage.example.com/${documentType.toLowerCase()}_${Date.now()}.pdf`;

      const { error } = await supabase.from('documents').insert({
        school_id: schoolId,
        user_id: userId,
        title,
        document_type: documentType,
        file_url: simulatedUrl,
      });

      if (error) throw error;
      
      setUserId("");
      setTitle("");
      setDocumentType("");
      setFileUrl("");
      setIsDialogOpen(false);
      fetchDocuments(schoolId);
      
    } catch (error: any) {
      console.error("Error uploading document:", error);
      alert(`Failed to upload document: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDocColor = (type: string) => {
    switch(type.toLowerCase()) {
      case 'aadhar': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'marksheet': return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      case 'transfer_certificate': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      default: return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Digital Documents</h1>
          <p className="text-sm text-slate-400 mt-1">Manage and securely store student and staff records.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" />}>
            <Upload className="w-4 h-4 mr-2" /> Upload Document
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-white/10 text-white sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Upload New Document</DialogTitle>
              <DialogDescription className="text-slate-400">
                Securely store a document for a specific user.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUploadDocument} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="user">Assign To (Student/Staff)</Label>
                <select 
                  className="w-full h-10 px-3 py-2 bg-slate-950 border border-white/10 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  required
                >
                  <option value="" disabled>Select User</option>
                  {users.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Document Title</Label>
                  <Input 
                    id="title" 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)} 
                    placeholder="e.g. 10th Marksheet"
                    required 
                    className="bg-slate-950 border-white/10 text-white" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Document Type</Label>
                  <Select value={documentType} onValueChange={setDocumentType} required>
                    <SelectTrigger className="bg-slate-950 border-white/10 text-white">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 text-white">
                      <SelectItem value="Aadhar">Aadhar Card</SelectItem>
                      <SelectItem value="Marksheet">Marksheet</SelectItem>
                      <SelectItem value="Transfer_Certificate">Transfer Certificate</SelectItem>
                      <SelectItem value="Medical_Record">Medical Record</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="file">File URL (Mock Upload)</Label>
                <Input 
                  id="file" 
                  value={fileUrl} 
                  onChange={(e) => setFileUrl(e.target.value)} 
                  placeholder="https://.../document.pdf"
                  className="bg-slate-950 border-white/10 text-white" 
                />
                <p className="text-xs text-slate-500">In production, this would be a file upload input using Supabase Storage.</p>
              </div>
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={isSubmitting} className="bg-emerald-500 hover:bg-emerald-600 text-white w-full">
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  Save Document
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input placeholder="Search documents..." className="pl-9 bg-slate-900/50 border-white/10 text-white" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" />
        </div>
      ) : documents.length === 0 ? (
        <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-white/5">
              <FileArchive className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No documents stored</h3>
            <p className="text-slate-400 mb-6 max-w-sm">Upload Aadhar cards, marksheets, and other important files to the secure vault.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="text-xs uppercase bg-slate-950/80 text-slate-400 border-b border-white/5">
                <tr>
                  <th className="px-6 py-4">Document Title</th>
                  <th className="px-6 py-4">Belongs To</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {documents.map((doc) => (
                    <motion.tr 
                      key={doc.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-white flex items-center">
                        <FileText className="w-4 h-4 mr-3 text-slate-500" />
                        {doc.title}
                      </td>
                      <td className="px-6 py-4 text-slate-300">{doc.users?.full_name || 'Unknown'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold border ${getDocColor(doc.document_type)}`}>
                          {doc.document_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10">
                          <Download className="w-4 h-4 mr-1" /> Download
                        </Button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}