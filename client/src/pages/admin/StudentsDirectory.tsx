import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Plus, Search, Pencil, X, Users } from "lucide-react";

type Student = {
  id: string;
  name: string;
  roll_number: string;
  admission_number: string;
  father_name: string;
  mother_name: string;
  phone: string;
  address: string;
  blood_group: string;
  category: string;
  date_of_birth: string;
  gender: string;
  previous_school: string;
  academic_year: string;
  class_id: string;
  classes?: { name: string } | null;
};

type Class = { id: string; name: string };

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const CATEGORIES = ["General", "OBC", "SC", "ST", "EWS"];
const GENDERS = ["Male", "Female", "Other"];

const EMPTY_FORM = {
  name: "",
  roll_number: "",
  admission_number: "",
  father_name: "",
  mother_name: "",
  phone: "",
  address: "",
  blood_group: "",
  category: "General",
  date_of_birth: "",
  gender: "",
  previous_school: "",
  academic_year: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
  class_id: "",
};

export function StudentsDirectory() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [feeStructures, setFeeStructures] = useState<{ id: string; name: string; amount: number; frequency: string }[]>([]);
  const [selectedFeeIds, setSelectedFeeIds] = useState<string[]>([]);

  async function fetchData() {
    setLoading(true);
    const [studsRes, classRes, feesRes] = await Promise.all([
      supabase
        .from("students")
        .select("id, name, roll_number, admission_number, father_name, mother_name, phone, address, blood_group, category, date_of_birth, gender, previous_school, academic_year, class_id, classes(name)")
        .eq("school_id", schoolId)
        .order("name"),
      supabase.from("classes").select("id, name").eq("school_id", schoolId).order("name"),
      supabase.from("fee_structures").select("id, name, amount, frequency").eq("school_id", schoolId).eq("is_active", true).order("name"),
    ]);
    setStudents(studsRes.data || []);
    setClasses(classRes.data || []);
    setFeeStructures(feesRes.data || []);
    setLoading(false);
  }

  async function autoFillRollNumber(classId: string) {
    if (!classId || editStudent) return;
    const { count } = await supabase
      .from("students")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("class_id", classId);
    const nextRoll = String((count || 0) + 1);
    setForm((prev) => ({ ...prev, roll_number: nextRoll }));
  }

  useEffect(() => { if (schoolId) fetchData(); }, [schoolId]);

  function openAdd() {
    setEditStudent(null);
    setForm({ ...EMPTY_FORM });
    setSelectedFeeIds([]);
    setShowForm(true);
  }

  function openEdit(student: Student) {
    setEditStudent(student);
    setForm({
      name: student.name || "",
      roll_number: student.roll_number || "",
      admission_number: student.admission_number || "",
      father_name: student.father_name || "",
      mother_name: student.mother_name || "",
      phone: student.phone || "",
      address: student.address || "",
      blood_group: student.blood_group || "",
      category: student.category || "General",
      date_of_birth: student.date_of_birth || "",
      gender: student.gender || "",
      previous_school: student.previous_school || "",
      academic_year: student.academic_year || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      class_id: student.class_id || "",
    });
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!form.name.trim()) return;
    setSubmitting(true);
    if (editStudent) {
      await supabase.from("students").update({ ...form }).eq("id", editStudent.id);
    } else {
      const { data: newStudent } = await supabase
        .from("students")
        .insert({ ...form, school_id: schoolId })
        .select("id")
        .single();
      // Auto-assign selected fee structures
      if (newStudent && selectedFeeIds.length > 0) {
        const today = new Date();
        const dueDate = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString().split("T")[0];
        const assignments = selectedFeeIds.map((feeId) => {
          const fs = feeStructures.find((f) => f.id === feeId);
          return {
            school_id: schoolId,
            student_id: newStudent.id,
            fee_structure_id: feeId,
            amount: fs?.amount || 0,
            due_date: dueDate,
            status: "pending",
            academic_year: form.academic_year,
          };
        });
        await supabase.from("student_fee_assignments").insert(assignments);
      }
    }
    setSubmitting(false);
    setShowForm(false);
    setSelectedFeeIds([]);
    fetchData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this student? This cannot be undone.")) return;
    await supabase.from("students").delete().eq("id", id);
    fetchData();
  }

  const f = (k: keyof typeof form, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  function toggleFee(id: string) {
    setSelectedFeeIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  const filtered = students.filter((s) => {
    const matchSearch = !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.roll_number?.includes(search) || s.admission_number?.includes(search);
    const matchClass = classFilter === "all" || s.class_id === classFilter;
    return matchSearch && matchClass;
  });

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Students Directory</h1>
          <p>Enroll, manage and view all student records</p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> Enroll Student
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-blue">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-blue-500" />
            <p className="text-xs text-muted-foreground">Total Students</p>
          </div>
          <p className="text-2xl font-bold">{students.length.toLocaleString("en-IN")}</p>
        </div>
        {["Male", "Female", "Other"].slice(0, 3).map((g) => {
          const cnt = students.filter((s) => s.gender === g).length;
          const accent = g === "Male" ? "card-accent-blue" : g === "Female" ? "card-accent-pink" : "card-accent-gray";
          return (
            <div key={g} className={`bg-card rounded-xl p-4 border border-border shadow-sm ${accent}`}>
              <p className="text-xs text-muted-foreground">{g}</p>
              <p className="text-2xl font-bold mt-1">{cnt}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, roll no, adm no…"
            className="border border-border rounded-lg pl-9 pr-3 py-2 text-sm bg-background w-72"
          />
        </div>
        <select
          title="Filter by class"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background"
        >
          <option value="all">All Classes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} students</span>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <table className="w-full edu-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Adm No.</th>
              <th>Roll No.</th>
              <th>Class</th>
              <th>Father</th>
              <th>Phone</th>
              <th>Blood</th>
              <th>Category</th>
              <th>DOB</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={10} className="text-center text-muted-foreground py-10">Loading…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={10} className="text-center text-muted-foreground py-10">No students found. Enroll your first student.</td></tr>
            )}
            {filtered.map((s) => {
              const cls = (s.classes as { name: string } | null)?.name || "—";
              return (
                <tr key={s.id}>
                  <td className="font-medium">{s.name}</td>
                  <td className="text-sm font-mono">{s.admission_number || "—"}</td>
                  <td>{s.roll_number || "—"}</td>
                  <td>{cls}</td>
                  <td className="text-sm">{s.father_name || "—"}</td>
                  <td className="text-sm">{s.phone || "—"}</td>
                  <td>{s.blood_group ? <span className="badge-red">{s.blood_group}</span> : "—"}</td>
                  <td>{s.category ? <span className="badge-blue">{s.category}</span> : "—"}</td>
                  <td className="text-sm">{s.date_of_birth ? new Date(s.date_of_birth).toLocaleDateString("en-IN") : "—"}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button type="button" title="Edit" onClick={() => openEdit(s)} className="text-primary hover:opacity-70 p-1">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" title="Delete" onClick={() => handleDelete(s.id)} className="text-red-500 hover:text-red-700 p-1">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Enrollment / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">{editStudent ? "Edit Student" : "Enroll New Student"}</h2>
              <button type="button" title="Close" onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-4">
              {/* Basic Info */}
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border pb-1">Basic Information</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground block mb-1">Full Name *</label>
                  <input value={form.name} onChange={(e) => f("name", e.target.value)} placeholder="Student full name" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Admission Number</label>
                  <input value={form.admission_number} onChange={(e) => f("admission_number", e.target.value)} placeholder="e.g. 2025-001" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Roll Number</label>
                  <input value={form.roll_number} onChange={(e) => f("roll_number", e.target.value)} placeholder="e.g. 42" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Class</label>
                  <select title="Select class" value={form.class_id} onChange={(e) => { f("class_id", e.target.value); autoFillRollNumber(e.target.value); }} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                    <option value="">Select class…</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Academic Year</label>
                  <input value={form.academic_year} onChange={(e) => f("academic_year", e.target.value)} placeholder="e.g. 2025-2026" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Date of Birth</label>
                  <input type="date" title="Date of birth" value={form.date_of_birth} onChange={(e) => f("date_of_birth", e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Gender</label>
                  <select title="Gender" value={form.gender} onChange={(e) => f("gender", e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                    <option value="">Select…</option>
                    {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Blood Group</label>
                  <select title="Blood group" value={form.blood_group} onChange={(e) => f("blood_group", e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                    <option value="">Select…</option>
                    {BLOOD_GROUPS.map((bg) => <option key={bg} value={bg}>{bg}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Category</label>
                  <select title="Category" value={form.category} onChange={(e) => f("category", e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Guardian Info */}
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border pb-1 mt-2">Guardian Information</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Father's Name</label>
                  <input value={form.father_name} onChange={(e) => f("father_name", e.target.value)} placeholder="Father's full name" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Mother's Name</label>
                  <input value={form.mother_name} onChange={(e) => f("mother_name", e.target.value)} placeholder="Mother's full name" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Phone</label>
                  <input value={form.phone} onChange={(e) => f("phone", e.target.value)} placeholder="Parent contact number" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Previous School</label>
                  <input value={form.previous_school} onChange={(e) => f("previous_school", e.target.value)} placeholder="Previous school name" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground block mb-1">Address</label>
                  <input value={form.address} onChange={(e) => f("address", e.target.value)} placeholder="Home address" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
              </div>
            </div>

            {!editStudent && feeStructures.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border pb-1 mb-3">Assign Fee Structures (optional)</p>
                <div className="grid grid-cols-2 gap-2">
                  {feeStructures.map((fs) => (
                    <label key={fs.id} className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer text-sm transition-all ${selectedFeeIds.includes(fs.id) ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"}`}>
                      <input
                        type="checkbox"
                        checked={selectedFeeIds.includes(fs.id)}
                        onChange={() => toggleFee(fs.id)}
                        className="mt-0.5 flex-shrink-0"
                      />
                      <div>
                        <p className="font-medium text-xs">{fs.name}</p>
                        <p className="text-[11px] text-muted-foreground">₹{fs.amount.toLocaleString("en-IN")} / {fs.frequency}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-border rounded-lg text-sm">Cancel</button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !form.name.trim()}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? "Saving…" : editStudent ? "Save Changes" : "Enroll Student"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
