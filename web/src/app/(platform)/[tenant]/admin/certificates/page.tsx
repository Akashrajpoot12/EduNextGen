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
import { Loader2, Search, Award, Plus, Printer } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function CertificatesPage() {
  const params = useParams();
  const tenant = params.tenant as string;
  const [certificates, setCertificates] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [schoolId, setSchoolId] = useState("");
  
  // Form State
  const [studentId, setStudentId] = useState("");
  const [certificateType, setCertificateType] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
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

      // Fetch students for dropdown
      const { data: studentsData } = await supabase
        .from('students')
        .select('user_id, users(full_name)')
        .eq('school_id', school.id);

      if (studentsData) {
        setStudents(studentsData.map((s: any) => ({ id: s.user_id, name: s.users?.full_name })));
      }

      fetchCertificates(school.id);
    } catch (error) {
      console.error("Error fetching initial data:", error);
      setLoading(false);
    }
  }

  async function fetchCertificates(sId: string) {
    try {
      const { data } = await supabase
        .from('certificates')
        .select(`
          id, certificate_type, issue_date, reference_number, created_at,
          student:student_id(full_name),
          issuer:created_by(full_name)
        `)
        .eq('school_id', sId)
        .order('created_at', { ascending: false });

      if (data) setCertificates(data);
    } catch (error) {
      console.error("Error fetching certificates:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleIssueCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from('certificates').insert({
        school_id: schoolId,
        student_id: studentId,
        certificate_type: certificateType,
        issue_date: issueDate,
        reference_number: referenceNumber,
        created_by: user?.id,
      });

      if (error) throw error;
      
      setStudentId("");
      setCertificateType("");
      setIssueDate("");
      setReferenceNumber("");
      setIsDialogOpen(false);
      fetchCertificates(schoolId);
      
    } catch (error: any) {
      console.error("Error issuing certificate:", error);
      alert(`Failed to issue certificate: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Certificates</h1>
          <p className="text-sm text-slate-400 mt-1">Issue and print Transfer Certificates, Bonafides, and more.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" />}>
            <Plus className="w-4 h-4 mr-2" /> Issue Certificate
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-white/10 text-white sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Issue New Certificate</DialogTitle>
              <DialogDescription className="text-slate-400">
                Generate an official document for a student.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleIssueCertificate} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="student">Select Student</Label>
                <select 
                  className="w-full h-10 px-3 py-2 bg-slate-950 border border-white/10 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  required
                >
                  <option value="" disabled>Select a student</option>
                  {students.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Certificate Type</Label>
                <Select value={certificateType} onValueChange={setCertificateType} required>
                  <SelectTrigger className="bg-slate-950 border-white/10 text-white">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10 text-white">
                    <SelectItem value="Transfer_Certificate">Transfer Certificate (TC)</SelectItem>
                    <SelectItem value="Bonafide">Bonafide Certificate</SelectItem>
                    <SelectItem value="Character_Certificate">Character Certificate</SelectItem>
                    <SelectItem value="Migration_Certificate">Migration Certificate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="refNum">Reference No.</Label>
                  <Input 
                    id="refNum" 
                    value={referenceNumber} 
                    onChange={(e) => setReferenceNumber(e.target.value)} 
                    placeholder="e.g. TC-2026-001"
                    required 
                    className="bg-slate-950 border-white/10 text-white" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="issueDate">Issue Date</Label>
                  <Input 
                    id="issueDate" 
                    type="date"
                    value={issueDate} 
                    onChange={(e) => setIssueDate(e.target.value)} 
                    required 
                    className="bg-slate-950 border-white/10 text-white [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]" 
                  />
                </div>
              </div>
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={isSubmitting} className="bg-emerald-500 hover:bg-emerald-600 text-white w-full">
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Award className="w-4 h-4 mr-2" />}
                  Generate Certificate
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input placeholder="Search certificates by ref no or student name..." className="pl-9 bg-slate-900/50 border-white/10 text-white" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" />
        </div>
      ) : certificates.length === 0 ? (
        <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-white/5">
              <Award className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No certificates issued</h3>
            <p className="text-slate-400 mb-6 max-w-sm">Generate Transfer Certificates or Bonafides for students when requested.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="text-xs uppercase bg-slate-950/80 text-slate-400 border-b border-white/5">
                <tr>
                  <th className="px-6 py-4">Ref Number</th>
                  <th className="px-6 py-4">Student Name</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Issue Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {certificates.map((cert) => (
                    <motion.tr 
                      key={cert.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-6 py-4 font-mono text-emerald-400">{cert.reference_number}</td>
                      <td className="px-6 py-4 font-medium text-white">{cert.student?.full_name || 'Unknown'}</td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-full text-[10px] uppercase font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          {cert.certificate_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400">{formatDate(cert.issue_date)}</td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-white/10">
                          <Printer className="w-4 h-4 mr-1" /> Print
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