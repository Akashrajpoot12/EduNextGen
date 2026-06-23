import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Plus, Search, Pencil, X, Users, CheckCircle2, Copy, Eye, CreditCard, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";

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
  classes?: { grade_level: string; section: string } | null;
};

type Class = { id: string; grade_level: string; section: string };

const PAGE_SIZE = 50;
const classLabel = (c?: { grade_level?: string; section?: string } | null) =>
  c ? `${c.grade_level ?? ""}${c.section ? " - " + c.section : ""}`.trim() || "—" : "—";

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
  // Parent portal fields
  parent_name: "",
  parent_email: "",
  parent_mobile: "",
};

export function StudentsDirectory() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();
  const navigate = useNavigate();

  const [students, setStudents] = useState<Student[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [stats, setStats] = useState<{ total: number; Male: number; Female: number; Other: number }>({ total: 0, Male: 0, Female: 0, Other: 0 });
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
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [school, setSchool] = useState<{ name: string; subdomain: string } | null>(null);

  // ID Card modal state
  const [idCardStudent, setIdCardStudent] = useState<Student | null>(null);

  // Attendance CSV export state
  const [exportingCsv, setExportingCsv] = useState(false);

  // Bulk CSV import state
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);

  const STUDENT_COLS =
    "id, name, roll_number, admission_number, father_name, mother_name, phone, address, blood_group, category, date_of_birth, gender, previous_school, academic_year, class_id, classes(grade_level, section)";

  // Reference data (classes, fee structures, school) — loaded once.
  async function fetchMeta() {
    const [classRes, feesRes, schoolRes] = await Promise.all([
      supabase.from("classes").select("id, grade_level, section").eq("school_id", schoolId).order("grade_level"),
      supabase.from("fee_structures").select("id, name, amount, frequency").eq("school_id", schoolId).eq("is_active", true).order("name"),
      supabase.from("schools").select("name, subdomain").eq("id", schoolId).maybeSingle(),
    ]);
    setClasses(classRes.data || []);
    setFeeStructures(feesRes.data || []);
    if (schoolRes.data) setSchool(schoolRes.data);
  }

  // School-wide stat counts (not affected by search/page).
  async function fetchStats() {
    const base = () => supabase.from("students").select("*", { count: "exact", head: true }).eq("school_id", schoolId);
    const [t, m, f, o] = await Promise.all([base(), base().eq("gender", "Male"), base().eq("gender", "Female"), base().eq("gender", "Other")]);
    setStats({ total: t.count || 0, Male: m.count || 0, Female: f.count || 0, Other: o.count || 0 });
  }

  // One page of students, filtered + searched server-side.
  async function fetchStudents(p = page) {
    setLoading(true);
    let q = supabase.from("students").select(STUDENT_COLS, { count: "exact" }).eq("school_id", schoolId);
    const term = search.trim().replace(/[%,()]/g, " ");
    if (term) q = q.or(`name.ilike.%${term}%,roll_number.ilike.%${term}%,admission_number.ilike.%${term}%`);
    if (classFilter !== "all") q = q.eq("class_id", classFilter);
    const from = p * PAGE_SIZE;
    const { data, count } = await q.order("name").range(from, from + PAGE_SIZE - 1);
    setStudents((data as unknown as Student[]) || []);
    setTotalCount(count || 0);
    setPage(p);
    setLoading(false);
  }

  // Refresh after a mutation (add/edit/delete): reload current page + counts.
  async function fetchData() {
    await Promise.all([fetchStudents(page), fetchStats()]);
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

  useEffect(() => { if (schoolId) { fetchMeta(); fetchStudents(0); fetchStats(); } }, [schoolId]);

  // Debounced server-side search / class filter — resets to first page.
  useEffect(() => {
    if (!schoolId) return;
    const t = setTimeout(() => fetchStudents(0), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, classFilter]);

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
      // Edit: simple update, no parent account changes
      const { parent_name, parent_email, parent_mobile, ...updateData } = form;
      await supabase.from("students").update(updateData).eq("id", editStudent.id);
      setSubmitting(false);
      setShowForm(false);
      fetchData();
      return;
    }

    // New student enrollment
    const hasParentEmail = form.parent_email.trim() !== "";

    if (hasParentEmail) {
      // Call Edge Function to create student + parent account + send SMS
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const { parent_name, parent_email, parent_mobile, ...studentFields } = form;

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-student`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session?.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({
              studentData: { ...studentFields },
              parentName: parent_name || form.father_name || "Parent",
              parentEmail: parent_email,
              parentMobile: parent_mobile,
              schoolId,
              schoolName: school?.name,
              schoolSubdomain: school?.subdomain,
            }),
          }
        );

        const result = await res.json();

        if (result.error) {
          toast.error(`Enrollment failed: ${result.error}`);
        } else {
          setCreatedCredentials(result.credentials);
          toast.success("Student enrolled & parent account created!");
          // Auto-assign fee structures
          if (result.studentId && selectedFeeIds.length > 0) {
            const today = new Date();
            const dueDate = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString().split("T")[0];
            const assignments = selectedFeeIds.map((feeId) => {
              const fs = feeStructures.find((f) => f.id === feeId);
              return {
                school_id: schoolId,
                student_id: result.studentId,
                fee_structure_id: feeId,
                amount: fs?.amount || 0,
                due_date: dueDate,
                status: "pending",
                academic_year: form.academic_year,
              };
            });
            await supabase.from("student_fee_assignments").insert(assignments);
          }
          setShowForm(false);
          setSelectedFeeIds([]);
          fetchData();
        }
      } catch (err: any) {
        toast.error("Network error: " + err.message);
      }
    } else {
      // No parent email — direct insert without parent account
      const { parent_name, parent_email, parent_mobile, ...studentFields } = form;
      const { data: newStudent } = await supabase
        .from("students")
        .insert({ ...studentFields, school_id: schoolId })
        .select("id")
        .single();

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
      toast.success("Student enrolled successfully!");
      setShowForm(false);
      setSelectedFeeIds([]);
      fetchData();
    }

    setSubmitting(false);
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

  // Server already filtered + paginated; render the current page directly.
  const filtered = students;

  // Fetch every row of a query in 1000-row chunks (beats the default cap).
  async function fetchAllChunked<T>(build: (from: number, to: number) => any): Promise<T[]> {
    const CHUNK = 1000;
    let from = 0;
    const out: T[] = [];
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data } = await build(from, from + CHUNK - 1);
      const batch = (data as T[]) || [];
      out.push(...batch);
      if (batch.length < CHUNK) break;
      from += CHUNK;
    }
    return out;
  }

  // --- Bulk CSV import ---
  const normKey = (x: string) => x.toLowerCase().replace(/\s+/g, "").replace(/[-_]/g, "");
  function resolveClassId(raw: string): string | null {
    if (!raw) return null;
    const target = normKey(raw);
    for (const c of classes) {
      if (normKey(`${c.grade_level}${c.section}`) === target) return c.id;
    }
    const byGrade = classes.filter((c) => normKey(c.grade_level) === target);
    return byGrade.length === 1 ? byGrade[0].id : null;
  }

  function handleCsvFile(file: File) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (res) => {
        setImportRows((res.data as Record<string, string>[]).filter((r) => Object.values(r).some((v) => v)));
        setShowImport(true);
      },
      error: () => toast.error("Could not read CSV file."),
    });
  }

  function downloadCsvTemplate() {
    const sample = "name,class,roll_number,gender,date_of_birth,father_name,mother_name,phone\nAarav Sharma,Class 1 - A,1,Male,2018-05-10,Rajesh Sharma,Sunita Sharma,9876543210\n";
    const url = URL.createObjectURL(new Blob([sample], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "students-template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function runImport() {
    setImporting(true);
    try {
      const toInsert: Record<string, unknown>[] = [];
      let skipped = 0;
      for (const r of importRows) {
        const name = r.name || r.student_name;
        const classId = resolveClassId(r.class || r.class_name || r.grade || "");
        if (!name || !classId) { skipped++; continue; }
        toInsert.push({
          school_id: schoolId, name, class_id: classId,
          roll_number: r.roll_number || r.roll || null,
          gender: r.gender || null,
          date_of_birth: r.date_of_birth || r.dob || null,
          father_name: r.father_name || null,
          mother_name: r.mother_name || null,
          phone: r.phone || r.parent_phone || null,
        });
      }
      if (toInsert.length === 0) { toast.error("No valid rows (check the 'class' column matches an existing class)."); setImporting(false); return; }
      let ok = 0;
      for (let i = 0; i < toInsert.length; i += 500) {
        const { error } = await supabase.from("students").insert(toInsert.slice(i, i + 500));
        if (error) { toast.error(error.message); setImporting(false); return; }
        ok += toInsert.slice(i, i + 500).length;
      }
      toast.success(`Imported ${ok} student(s)${skipped ? `, skipped ${skipped} (missing name/unmatched class)` : ""}.`);
      setShowImport(false); setImportRows([]);
      fetchStudents(0); fetchStats();
    } finally {
      setImporting(false);
    }
  }

  // --- Feature 2: Export Attendance CSV (all students, all month rows) ---
  async function handleExportAttendanceCsv() {
    setExportingCsv(true);
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

      const attendanceRows = await fetchAllChunked<{ student_id: string; status: string }>((from, to) =>
        supabase.from("daily_attendance").select("student_id, status")
          .eq("school_id", schoolId).gte("date", monthStart).lte("date", monthEnd).range(from, to)
      );

      const allStudents = await fetchAllChunked<Student>((from, to) =>
        supabase.from("students").select(STUDENT_COLS).eq("school_id", schoolId).order("name").range(from, to)
      );

      // Build a map: student_id -> { present, absent }
      const attMap: Record<string, { present: number; absent: number }> = {};
      for (const row of attendanceRows) {
        if (!attMap[row.student_id]) attMap[row.student_id] = { present: 0, absent: 0 };
        if (row.status === "present") attMap[row.student_id].present += 1;
        else attMap[row.student_id].absent += 1;
      }

      const headers = ["Student Name", "Roll No", "Class", "Present Days", "Absent Days", "Attendance %"];
      const rows = allStudents.map((s) => {
        const rec = attMap[s.id] || { present: 0, absent: 0 };
        const total = rec.present + rec.absent;
        const pct = total > 0 ? Math.round((rec.present / total) * 100) : 0;
        const cls = classLabel(s.classes);
        return [s.name, s.roll_number || "", cls, rec.present, rec.absent, `${pct}%`];
      });

      const csvLines = [headers, ...rows].map((r) => r.map(String).map((v) => `"${v.replace(/"/g, '""')}"`).join(","));
      const csv = csvLines.join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance-${now.toLocaleString("en-IN", { month: "long", year: "numeric" }).replace(" ", "-")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Attendance CSV exported successfully!");
    } catch {
      toast.error("Failed to export attendance CSV.");
    } finally {
      setExportingCsv(false);
    }
  }

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Students Directory</h1>
          <p>Enroll, manage and view all student records</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportAttendanceCsv}
            disabled={exportingCsv}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted/50 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exportingCsv ? "Exporting…" : "Export Attendance CSV"}
          </button>
          <label className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted/50 cursor-pointer">
            <Upload className="w-4 h-4" /> Import CSV
            <input type="file" accept=".csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvFile(f); e.target.value = ""; }} />
          </label>
          <button
            type="button"
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> Enroll Student
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-blue">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-blue-500" />
            <p className="text-xs text-muted-foreground">Total Students</p>
          </div>
          <p className="text-2xl font-bold">{stats.total.toLocaleString("en-IN")}</p>
        </div>
        {(["Male", "Female", "Other"] as const).map((g) => {
          const cnt = stats[g];
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
          {classes.map((c) => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}
        </select>
        <span className="text-sm text-muted-foreground ml-auto">{totalCount.toLocaleString("en-IN")} students</span>
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
              const cls = classLabel(s.classes);
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
                      <button type="button" title="View 360° Profile"
                        onClick={() => navigate(`/${schoolId}/admin/students/${s.id}`)}
                        className="text-blue-500 hover:text-blue-700 p-1">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {/* Feature 1: ID Card button */}
                      <button type="button" title="ID Card Preview"
                        onClick={() => setIdCardStudent(s)}
                        className="text-fuchsia-500 hover:text-fuchsia-700 p-1">
                        <CreditCard className="w-3.5 h-3.5" />
                      </button>
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

      {/* Pagination */}
      {totalCount > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount.toLocaleString("en-IN")}
          </span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page === 0 || loading} onClick={() => fetchStudents(page - 1)}
              className="px-3 py-1.5 border border-border rounded-lg text-sm disabled:opacity-40 hover:bg-muted/50">Prev</button>
            <span className="text-sm">Page {page + 1} / {Math.max(1, Math.ceil(totalCount / PAGE_SIZE))}</span>
            <button type="button" disabled={(page + 1) * PAGE_SIZE >= totalCount || loading} onClick={() => fetchStudents(page + 1)}
              className="px-3 py-1.5 border border-border rounded-lg text-sm disabled:opacity-40 hover:bg-muted/50">Next</button>
          </div>
        </div>
      )}

      {/* Bulk CSV Import Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-lg">Import Students — {importRows.length} rows</h2>
              <button type="button" title="Close" onClick={() => { setShowImport(false); setImportRows([]); }}><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Required columns: <code>name</code>, <code>class</code> (e.g. "Class 1 - A" or "Class 1"). Optional: roll_number, gender, date_of_birth, father_name, mother_name, phone.
              <button type="button" onClick={downloadCsvTemplate} className="ml-1 text-primary underline">Download template</button>
            </p>
            <div className="border border-border rounded-lg overflow-auto max-h-64 mb-4">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0"><tr><th className="text-left p-2">Name</th><th className="text-left p-2">Class</th><th className="text-left p-2">Match</th></tr></thead>
                <tbody>
                  {importRows.slice(0, 50).map((r, i) => {
                    const matched = !!resolveClassId(r.class || r.class_name || r.grade || "");
                    return (
                      <tr key={i} className="border-t border-border">
                        <td className="p-2">{r.name || r.student_name || <span className="text-red-500">missing</span>}</td>
                        <td className="p-2">{r.class || r.class_name || r.grade || "—"}</td>
                        <td className="p-2">{matched ? <span className="text-emerald-600">✓</span> : <span className="text-red-500">no class</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {importRows.length > 50 && <p className="text-xs text-muted-foreground mb-3">Showing first 50 of {importRows.length} rows.</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowImport(false); setImportRows([]); }} className="flex-1 py-2 border border-border rounded-lg text-sm">Cancel</button>
              <button type="button" onClick={runImport} disabled={importing} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">{importing ? "Importing…" : `Import ${importRows.length} Students`}</button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 1: ID Card Modal */}
      {idCardStudent && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 print:bg-transparent">
          <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-sm overflow-hidden print:shadow-none print:border-none">
            {/* Fuchsia gradient header */}
            <div className="bg-gradient-to-r from-fuchsia-600 to-purple-600 px-6 py-5 text-white">
              <p className="text-xs font-medium opacity-80 uppercase tracking-widest mb-0.5">Student ID Card</p>
              <h2 className="font-bold text-lg leading-tight">{school?.name || "School Name"}</h2>
            </div>

            {/* Card body */}
            <div className="px-6 py-5 flex items-start gap-4">
              {/* Avatar */}
              <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                {idCardStudent.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base text-foreground truncate">{idCardStudent.name}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {(idCardStudent.classes as { name: string } | null)?.name || "—"}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div>
                    <span className="text-muted-foreground">Roll No</span>
                    <p className="font-semibold text-foreground">{idCardStudent.roll_number || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Adm No</span>
                    <p className="font-semibold text-foreground">{idCardStudent.admission_number || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Blood Group</span>
                    <p className="font-semibold text-foreground">{idCardStudent.blood_group || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Gender</span>
                    <p className="font-semibold text-foreground">{idCardStudent.gender || "—"}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer bar */}
            <div className="bg-fuchsia-50 dark:bg-fuchsia-950/30 border-t border-border px-6 py-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                DOB: {idCardStudent.date_of_birth ? new Date(idCardStudent.date_of_birth).toLocaleDateString("en-IN") : "—"}
              </span>
              <span className="text-xs font-mono text-fuchsia-700 dark:text-fuchsia-400">
                {idCardStudent.admission_number || idCardStudent.id.slice(0, 8).toUpperCase()}
              </span>
            </div>

            {/* Action buttons */}
            <div className="px-6 py-4 flex gap-3 print:hidden">
              <button
                type="button"
                onClick={() => setIdCardStudent(null)}
                className="flex-1 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted/50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white rounded-lg text-sm font-medium hover:opacity-90"
              >
                Print ID Card
              </button>
            </div>
          </div>
        </div>
      )}

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

              {/* Parent Portal Account */}
              {!editStudent && (
                <>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border pb-1 mt-2">
                    Parent Portal Account
                    <span className="ml-2 text-[10px] normal-case font-normal text-primary">(auto-creates login & sends SMS)</span>
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Parent Full Name</label>
                      <input value={form.parent_name} onChange={(e) => f("parent_name", e.target.value)}
                        placeholder="e.g. Rajesh Sharma"
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Parent Email *</label>
                      <input type="email" value={form.parent_email} onChange={(e) => f("parent_email", e.target.value)}
                        placeholder="parent@gmail.com"
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Parent Mobile (10 digits)</label>
                      <input type="tel" value={form.parent_mobile} onChange={(e) => f("parent_mobile", e.target.value)}
                        placeholder="98XXXXXXXX"
                        maxLength={10}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                    </div>
                    <div className="flex items-end">
                      <div className="w-full bg-muted/50 rounded-lg px-3 py-2 text-xs text-muted-foreground border border-border">
                        Password auto-generated:<br />
                        <span className="font-mono font-semibold text-foreground">
                          Parent@{form.parent_mobile?.slice(-4) || "XXXX"}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
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

      {/* Credentials success modal */}
      {createdCredentials && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Parent Account Created!</h3>
                <p className="text-sm text-muted-foreground">SMS sent to parent's mobile</p>
              </div>
            </div>

            <div className="bg-muted/50 rounded-xl p-4 space-y-3 border border-border mb-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Email</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-medium">{createdCredentials.email}</span>
                  <button type="button" title="Copy email" onClick={() => { navigator.clipboard.writeText(createdCredentials.email); toast.success("Copied!"); }}>
                    <Copy className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Password</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-semibold text-primary">{createdCredentials.password}</span>
                  <button type="button" title="Copy password" onClick={() => { navigator.clipboard.writeText(createdCredentials.password); toast.success("Copied!"); }}>
                    <Copy className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              Share these credentials with the parent. They can log in at the school portal URL.
            </p>

            <button type="button" onClick={() => setCreatedCredentials(null)}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
