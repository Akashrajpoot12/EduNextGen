import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Plus, Trash2, ExternalLink, Upload, X } from "lucide-react";

type SchoolDocument = {
  id: string;
  school_id: string;
  student_id: string | null;
  doc_type: string;
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  description: string;
  created_at: string;
  students?: { name: string } | null;
};

type Student = { id: string; name: string };

const DOC_TYPE_COLORS: Record<string, string> = {
  general: "bg-gray-100 text-gray-700",
  tc: "bg-blue-100 text-blue-700",
  bonafide: "bg-purple-100 text-purple-700",
  birth_cert: "bg-green-100 text-green-700",
  aadhar: "bg-orange-100 text-orange-700",
  photo: "bg-pink-100 text-pink-700",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  general: "General",
  tc: "Transfer Cert",
  bonafide: "Bonafide",
  birth_cert: "Birth Certificate",
  aadhar: "Aadhar",
  photo: "Photo",
};

export function DocumentsPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();
  const [documents, setDocuments] = useState<SchoolDocument[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [docTypeFilter, setDocTypeFilter] = useState("all");
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(false);
  const [form, setForm] = useState({ doc_type: "general", student_id: "", description: "" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  async function fetchDocuments() {
    let query = supabase.from("school_documents").select("*, students(name)").eq("school_id", schoolId).order("created_at", { ascending: false });
    if (docTypeFilter !== "all") query = query.eq("doc_type", docTypeFilter);
    const { data } = await query;
    setDocuments(data || []);
  }

  async function fetchStudents() {
    const { data } = await supabase.from("students").select("id, name").eq("school_id", schoolId).order("name");
    setStudents(data || []);
  }

  useEffect(() => { if (schoolId) { fetchDocuments(); fetchStudents(); } }, [schoolId]);
  useEffect(() => { if (schoolId) fetchDocuments(); }, [docTypeFilter]);

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    setUploadProgress(true);
    const path = `${schoolId}/${form.doc_type}/${Date.now()}_${selectedFile.name}`;
    const { data: storageData, error: storageError } = await supabase.storage.from("documents").upload(path, selectedFile);
    if (storageError) { setUploading(false); setUploadProgress(false); return; }
    const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
    await supabase.from("school_documents").insert({
      school_id: schoolId,
      student_id: form.student_id || null,
      doc_type: form.doc_type,
      file_name: selectedFile.name,
      file_url: urlData.publicUrl,
      file_size: selectedFile.size,
      mime_type: selectedFile.type,
      description: form.description,
    });
    setUploading(false);
    setUploadProgress(false);
    setShowUpload(false);
    setForm({ doc_type: "general", student_id: "", description: "" });
    setSelectedFile(null);
    fetchDocuments();
  }

  async function handleDelete(doc: SchoolDocument) {
    const urlParts = doc.file_url.split("/documents/");
    if (urlParts.length > 1) {
      await supabase.storage.from("documents").remove([urlParts[1]]);
    }
    await supabase.from("school_documents").delete().eq("id", doc.id);
    fetchDocuments();
  }

  function formatFileSize(bytes: number) {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const typeCounts: Record<string, number> = {};
  documents.forEach((d) => { typeCounts[d.doc_type] = (typeCounts[d.doc_type] || 0) + 1; });

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div><h1>Documents</h1><p>Upload and manage school and student documents</p></div>
        <button type="button" onClick={() => setShowUpload(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" />Upload Document
        </button>
      </div>

      <div className="grid grid-cols-6 gap-3 mb-6">
        {Object.entries(DOC_TYPE_LABELS).map(([type, label]) => (
          <button key={type} type="button" onClick={() => setDocTypeFilter(type === docTypeFilter ? "all" : type)}
            className={`bg-card rounded-xl p-3 border shadow-sm text-left transition-all hover:shadow-md ${docTypeFilter === type ? "border-primary ring-1 ring-primary/30" : "border-border"}`}>
            <div className="text-xl font-bold">{(typeCounts[type] || 0).toLocaleString("en-IN")}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4 mb-4">
        <select title="Filter by doc type" value={docTypeFilter} onChange={e => setDocTypeFilter(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
          <option value="all">All Types</option>
          {Object.entries(DOC_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <span className="text-sm text-muted-foreground">{documents.length.toLocaleString("en-IN")} documents</span>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <table className="w-full edu-table">
          <thead><tr><th>Type</th><th>File Name</th><th>Student</th><th>Description</th><th>Size</th><th>Uploaded</th><th>Actions</th></tr></thead>
          <tbody>
            {documents.length === 0 && <tr><td colSpan={7} className="text-center text-muted-foreground py-10">No documents found.</td></tr>}
            {documents.map(doc => (
              <tr key={doc.id}>
                <td><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DOC_TYPE_COLORS[doc.doc_type] || "bg-gray-100 text-gray-700"}`}>{DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}</span></td>
                <td className="font-medium max-w-[200px] truncate">{doc.file_name}</td>
                <td>{(doc.students as Record<string, string> | null)?.name || "—"}</td>
                <td className="text-muted-foreground max-w-[160px] truncate text-sm">{doc.description || "—"}</td>
                <td className="text-sm text-muted-foreground">{formatFileSize(doc.file_size)}</td>
                <td className="text-sm">{doc.created_at ? new Date(doc.created_at).toLocaleDateString("en-IN") : "—"}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <button type="button" title="View document" onClick={() => window.open(doc.file_url, "_blank")} className="text-blue-500 hover:text-blue-700 p-1"><ExternalLink className="w-3.5 h-3.5" /></button>
                    <button type="button" title="Delete document" onClick={() => handleDelete(doc)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Upload Document</h2>
              <button type="button" title="Close" onClick={() => setShowUpload(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div><label className="text-xs text-muted-foreground block mb-1">Document Type</label>
                <select title="Document type" value={form.doc_type} onChange={e => setForm({ ...form, doc_type: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                  {Object.entries(DOC_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-muted-foreground block mb-1">Student (optional)</label>
                <select title="Select student" value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                  <option value="">No student linked</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description (optional)" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
              <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-xl cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors">
                <Upload className="w-7 h-7 text-muted-foreground mb-1" />
                {selectedFile ? <p className="text-sm font-medium text-foreground">{selectedFile.name}</p> : <p className="text-sm text-muted-foreground">Click to select file</p>}
                <input type="file" className="hidden" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
              </label>
              {uploadProgress && (
                <div className="flex items-center gap-2 text-sm text-blue-500">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />Uploading…
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setShowUpload(false)} className="flex-1 py-2 border border-border rounded-lg text-sm">Cancel</button>
              <button type="button" onClick={handleUpload} disabled={uploading || !selectedFile} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">{uploading ? "Uploading…" : "Upload"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
