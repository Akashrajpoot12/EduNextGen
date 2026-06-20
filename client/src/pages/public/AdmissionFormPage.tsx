// @ts-nocheck
import { useState } from "react";
import { useParams } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2, Loader2, GraduationCap } from "lucide-react";

const CLASSES = ["Nursery","LKG","UKG","Class 1","Class 2","Class 3","Class 4","Class 5","Class 6","Class 7","Class 8","Class 9","Class 10","Class 11","Class 12"];
const GENDERS = ["Male","Female","Other"];

const EMPTY = {
  student_name: "", date_of_birth: "", gender: "", applying_for_class: "",
  father_name: "", mother_name: "", parent_phone: "", parent_email: "",
  address: "", previous_school: "", academic_year: new Date().getFullYear() + "-" + (new Date().getFullYear() + 1),
};

export function AdmissionFormPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const supabase = createClient();

  const [form, setForm]       = useState({ ...EMPTY });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [schoolLoaded, setSchoolLoaded] = useState(false);
  const [schoolId, setSchoolId]     = useState<string | null>(null);

  // Resolve school from tenantId (subdomain slug)
  if (!schoolLoaded) {
    setSchoolLoaded(true);
    supabase
      .from("schools")
      .select("id, name")
      .eq("subdomain", tenantId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) { setSchoolId(data.id); setSchoolName(data.name); }
      });
  }

  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId) { setError("School not found. Check the URL."); return; }
    setSubmitting(true);
    setError(null);

    const { error: err } = await supabase.from("admission_applications").insert({
      school_id: schoolId,
      ...form,
      status: "pending",
    });

    if (err) { setError(err.message); setSubmitting(false); return; }
    setSubmitted(true);
    setSubmitting(false);
  }

  if (submitted) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Application Submitted!</h2>
        <p className="text-slate-300 mb-1">
          Thank you for applying to <strong>{schoolName}</strong>.
        </p>
        <p className="text-slate-400 text-sm">
          The school team will contact you within 2-3 working days to schedule an interview.
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <GraduationCap className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">
            {schoolName ? `${schoolName}` : "School"} Admission
          </h1>
          <p className="text-slate-400 mt-1 text-sm">Fill out the form below to apply for admission</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6">
          {/* Student Info */}
          <section>
            <h3 className="text-white font-semibold mb-4 pb-2 border-b border-white/10">Student Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-300 mb-1">Student's Full Name *</label>
                <input required value={form.student_name} onChange={set("student_name")}
                  placeholder="e.g. Aanya Sharma"
                  className="w-full bg-slate-800 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Date of Birth *</label>
                <input required type="date" value={form.date_of_birth} onChange={set("date_of_birth")}
                  className="w-full bg-slate-800 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Gender *</label>
                <select required value={form.gender} onChange={set("gender")}
                  className="w-full bg-slate-800 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="">Select gender</option>
                  {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Applying for Class *</label>
                <select required value={form.applying_for_class} onChange={set("applying_for_class")}
                  className="w-full bg-slate-800 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="">Select class</option>
                  {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Academic Year</label>
                <input value={form.academic_year} onChange={set("academic_year")}
                  className="w-full bg-slate-800 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-300 mb-1">Previous School (if any)</label>
                <input value={form.previous_school} onChange={set("previous_school")}
                  placeholder="Name of previous school"
                  className="w-full bg-slate-800 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
          </section>

          {/* Parent/Guardian Info */}
          <section>
            <h3 className="text-white font-semibold mb-4 pb-2 border-b border-white/10">Parent / Guardian Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Father's Name *</label>
                <input required value={form.father_name} onChange={set("father_name")}
                  placeholder="Father's full name"
                  className="w-full bg-slate-800 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Mother's Name</label>
                <input value={form.mother_name} onChange={set("mother_name")}
                  placeholder="Mother's full name"
                  className="w-full bg-slate-800 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Contact Phone *</label>
                <input required type="tel" value={form.parent_phone} onChange={set("parent_phone")}
                  placeholder="+91 98765 43210"
                  className="w-full bg-slate-800 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Email Address</label>
                <input type="email" value={form.parent_email} onChange={set("parent_email")}
                  placeholder="parent@email.com"
                  className="w-full bg-slate-800 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-300 mb-1">Home Address *</label>
                <textarea required value={form.address} onChange={set("address")}
                  rows={3} placeholder="Full residential address"
                  className="w-full bg-slate-800 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
              </div>
            </div>
          </section>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button type="submit" disabled={submitting || !schoolId}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
            {submitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
              : "Submit Application"}
          </button>

          <p className="text-xs text-center text-slate-500">
            By submitting this form, you agree that the school may contact you regarding the admission process.
          </p>
        </form>
      </div>
    </div>
  );
}
