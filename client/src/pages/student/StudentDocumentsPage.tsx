// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Download, Award, Shield, ScrollText, GraduationCap } from "lucide-react";

const DOC_TYPES = [
  { key: "bonafide",     label: "Bonafide Certificate",   icon: Shield,       desc: "Proof of enrollment at this school" },
  { key: "tc",           label: "Transfer Certificate",   icon: ScrollText,   desc: "Required for school transfer" },
  { key: "character",    label: "Character Certificate",  icon: Award,        desc: "Conduct and character certificate" },
  { key: "id_card",      label: "Student ID Card",        icon: GraduationCap, desc: "Official school ID card" },
];

export function StudentDocumentsPage() {
  const params = useParams();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<any[]>([]);
  const [student, setStudent] = useState<any>(null);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: studentRec } = await supabase
        .from("students")
        .select("id, school_id, first_name, last_name, enrollment_number")
        .eq("user_id", user.id)
        .maybeSingle();

      setStudent(studentRec);

      if (studentRec) {
        const { data } = await supabase
          .from("student_documents")
          .select("id, doc_type, status, file_url, requested_at, issued_at")
          .eq("student_id", studentRec.id)
          .order("requested_at", { ascending: false });
        setDocuments(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function requestDoc(docType: string) {
    if (!student) return;
    setRequesting(docType);
    setMsg(null);
    try {
      const existing = documents.find(d => d.doc_type === docType && d.status === "pending");
      if (existing) {
        setMsg({ type: "error", text: "You already have a pending request for this document." });
        return;
      }
      const { error } = await supabase.from("student_documents").insert({
        student_id: student.id,
        school_id: student.school_id,
        doc_type: docType,
        status: "pending",
      });
      if (error) throw error;
      setMsg({ type: "success", text: "Document request submitted! Admin will process it shortly." });
      fetchData();
    } catch (e: any) {
      setMsg({ type: "error", text: e.message || "Failed to submit request." });
    } finally {
      setRequesting(null);
    }
  }

  const getDocStatus = (docType: string) => documents.find(d => d.doc_type === docType);

  const statusBadge = (status: string) => {
    if (status === "issued") return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Issued</span>;
    if (status === "pending") return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">Pending</span>;
    return null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Documents</h1>
        <p className="text-sm text-muted-foreground mt-1">Request and download official school documents.</p>
      </div>

      {msg && (
        <div className={`p-4 rounded-xl text-sm border ${msg.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-purple-500/50" /></div>
      ) : (
        <div className="space-y-4">
          {/* Document request cards */}
          <Card className="bg-card border-border shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-foreground text-lg">Available Documents</CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {DOC_TYPES.map(doc => {
                const existing = getDocStatus(doc.key);
                return (
                  <div key={doc.key} className="flex items-start gap-4 p-4 rounded-xl bg-muted/50 border border-border/50 hover:border-border transition-all">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                      <doc.icon className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-foreground text-sm font-semibold">{doc.label}</p>
                        {existing && statusBadge(existing.status)}
                      </div>
                      <p className="text-muted-foreground text-xs mb-3">{doc.desc}</p>
                      {existing?.status === "issued" && existing.file_url ? (
                        <a href={existing.file_url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs">
                            <Download className="w-3 h-3 mr-1.5" /> Download
                          </Button>
                        </a>
                      ) : existing?.status === "pending" ? (
                        <Button size="sm" disabled variant="outline" className="h-7 text-xs border-amber-500/20 text-amber-400">
                          Processing...
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => requestDoc(doc.key)} disabled={requesting === doc.key}
                          className="bg-purple-600 hover:bg-purple-700 text-white h-7 text-xs shadow-md shadow-purple-500/20">
                          {requesting === doc.key ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                          Request
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Request history */}
          {documents.length > 0 && (
            <Card className="bg-card border-border shadow-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-foreground text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-400" /> Request History
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/50">
                  {documents.map(doc => {
                    const docInfo = DOC_TYPES.find(d => d.key === doc.doc_type);
                    return (
                      <div key={doc.id} className="px-6 py-4 flex items-center justify-between">
                        <div>
                          <p className="text-foreground text-sm font-medium">{docInfo?.label || doc.doc_type}</p>
                          <p className="text-muted-foreground text-xs mt-0.5">
                            Requested: {new Date(doc.requested_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                            {doc.issued_at ? ` · Issued: ${new Date(doc.issued_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {statusBadge(doc.status)}
                          {doc.status === "issued" && doc.file_url && (
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground hover:text-foreground">
                                <Download className="w-3.5 h-3.5" />
                              </Button>
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
