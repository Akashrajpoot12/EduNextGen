import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Pencil, X } from "lucide-react";

type Student = {
  id: string;
  name: string;
  roll_number: string;
};

type StudentHealth = {
  id?: string;
  student_id: string;
  school_id: string;
  blood_group: string;
  height_cm: number | null;
  weight_kg: number | null;
  vision: string;
  medical_conditions: string;
  allergies: string;
  medications: string;
  emergency_contact: string;
  emergency_phone: string;
  last_checkup_date: string;
  doctor_name: string;
  notes: string;
};

type StudentWithHealth = Student & { health?: StudentHealth };

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

function getBMICategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: "Underweight", color: "text-blue-600" };
  if (bmi < 25) return { label: "Normal", color: "text-green-600" };
  if (bmi < 30) return { label: "Overweight", color: "text-orange-600" };
  return { label: "Obese", color: "text-red-600" };
}

export function HealthPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();
  const [students, setStudents] = useState<StudentWithHealth[]>([]);
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentWithHealth | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Omit<StudentHealth, "id" | "student_id" | "school_id">>({
    blood_group: "",
    height_cm: null,
    weight_kg: null,
    vision: "",
    medical_conditions: "",
    allergies: "",
    medications: "",
    emergency_contact: "",
    emergency_phone: "",
    last_checkup_date: "",
    doctor_name: "",
    notes: "",
  });

  async function fetchData() {
    const { data: studs } = await supabase.from("students").select("id, name, roll_number").eq("school_id", schoolId).order("name");
    const { data: healthRecords } = await supabase.from("student_health").select("*").eq("school_id", schoolId);
    const combined: StudentWithHealth[] = (studs || []).map((s) => ({
      ...s,
      health: (healthRecords || []).find((h) => h.student_id === s.id),
    }));
    setStudents(combined);
  }

  useEffect(() => { if (schoolId) fetchData(); }, [schoolId]);

  function openEdit(student: StudentWithHealth) {
    setSelectedStudent(student);
    setForm({
      blood_group: student.health?.blood_group || "",
      height_cm: student.health?.height_cm ?? null,
      weight_kg: student.health?.weight_kg ?? null,
      vision: student.health?.vision || "",
      medical_conditions: student.health?.medical_conditions || "",
      allergies: student.health?.allergies || "",
      medications: student.health?.medications || "",
      emergency_contact: student.health?.emergency_contact || "",
      emergency_phone: student.health?.emergency_phone || "",
      last_checkup_date: student.health?.last_checkup_date || "",
      doctor_name: student.health?.doctor_name || "",
      notes: student.health?.notes || "",
    });
    setShowDialog(true);
  }

  async function handleSave() {
    if (!selectedStudent) return;
    setLoading(true);
    await supabase.from("student_health").upsert(
      { ...form, student_id: selectedStudent.id, school_id: schoolId },
      { onConflict: "student_id" }
    );
    setLoading(false);
    setShowDialog(false);
    fetchData();
  }

  const filtered = students.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="page-header">
        <h1>Student Health Records</h1>
        <p>Blood group, BMI, medical conditions, emergency contacts</p>
      </div>

      <div className="mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by student name…" title="Search students" className="border border-border rounded-lg px-3 py-2 text-sm bg-background w-72" />
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <table className="w-full edu-table">
          <thead><tr><th>Student Name</th><th>Roll No</th><th>Blood Group</th><th>Height</th><th>Weight</th><th>BMI</th><th>Medical Conditions</th><th>Last Checkup</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={9} className="text-center text-muted-foreground py-10">No students found.</td></tr>}
            {filtered.map(student => {
              const h = student.health;
              const bmi = h?.height_cm && h?.weight_kg ? (h.weight_kg / Math.pow(h.height_cm / 100, 2)) : null;
              const bmiCat = bmi ? getBMICategory(bmi) : null;
              return (
                <tr key={student.id} className="cursor-pointer" onClick={() => openEdit(student)}>
                  <td className="font-medium">{student.name}</td>
                  <td>{student.roll_number || "—"}</td>
                  <td>{h?.blood_group ? <span className="badge-red">{h.blood_group}</span> : <span className="text-muted-foreground">—</span>}</td>
                  <td>{h?.height_cm ? `${h.height_cm} cm` : "—"}</td>
                  <td>{h?.weight_kg ? `${h.weight_kg} kg` : "—"}</td>
                  <td>{bmi && bmiCat ? <span className={`font-medium text-sm ${bmiCat.color}`}>{bmi.toFixed(1)} <span className="font-normal text-xs">({bmiCat.label})</span></span> : "—"}</td>
                  <td className="max-w-[150px] truncate text-sm">{h?.medical_conditions || "—"}</td>
                  <td className="text-sm">{h?.last_checkup_date || "—"}</td>
                  <td>
                    <button type="button" title="Edit health record" onClick={e => { e.stopPropagation(); openEdit(student); }} className="text-primary hover:opacity-70 p-1">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showDialog && selectedStudent && (() => {
        const bmi = form.height_cm && form.weight_kg ? (form.weight_kg / Math.pow(form.height_cm / 100, 2)) : null;
        const bmiCat = bmi ? getBMICategory(bmi) : null;
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg">Health Record — {selectedStudent.name}</h2>
                <button type="button" title="Close" onClick={() => setShowDialog(false)}><X className="w-5 h-5" /></button>
              </div>
              {bmi && bmiCat && (
                <div className={`p-3 rounded-lg border bg-muted/50 text-sm font-medium mb-4 ${bmiCat.color}`}>
                  BMI: {bmi.toFixed(1)} — {bmiCat.label}
                </div>
              )}
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Blood Group</label>
                  <select title="Blood group" value={form.blood_group} onChange={e => setForm({ ...form, blood_group: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                    <option value="">Select</option>
                    {BLOOD_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div><label className="text-xs text-muted-foreground block mb-1">Height (cm)</label><input type="number" title="Height" value={form.height_cm ?? ""} onChange={e => setForm({ ...form, height_cm: e.target.value ? parseFloat(e.target.value) : null })} placeholder="e.g. 150" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Weight (kg)</label><input type="number" title="Weight" value={form.weight_kg ?? ""} onChange={e => setForm({ ...form, weight_kg: e.target.value ? parseFloat(e.target.value) : null })} placeholder="e.g. 45" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              </div>
              <div className="space-y-3">
                <input value={form.vision} onChange={e => setForm({ ...form, vision: e.target.value })} placeholder="Vision (e.g. 6/6)" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                <input value={form.medical_conditions} onChange={e => setForm({ ...form, medical_conditions: e.target.value })} placeholder="Medical conditions" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                <input value={form.allergies} onChange={e => setForm({ ...form, allergies: e.target.value })} placeholder="Allergies (food, drug, environmental)" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                <input value={form.medications} onChange={e => setForm({ ...form, medications: e.target.value })} placeholder="Current medications" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                <div className="grid grid-cols-2 gap-3">
                  <input value={form.emergency_contact} onChange={e => setForm({ ...form, emergency_contact: e.target.value })} placeholder="Emergency contact name" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                  <input value={form.emergency_phone} onChange={e => setForm({ ...form, emergency_phone: e.target.value })} placeholder="Emergency phone" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-muted-foreground block mb-1">Last Checkup</label><input type="date" title="Last checkup date" value={form.last_checkup_date} onChange={e => setForm({ ...form, last_checkup_date: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
                  <input value={form.doctor_name} onChange={e => setForm({ ...form, doctor_name: e.target.value })} placeholder="Doctor's name" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background mt-5" />
                </div>
                <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
              </div>
              <div className="flex gap-2 mt-4">
                <button type="button" onClick={() => setShowDialog(false)} className="flex-1 py-2 border border-border rounded-lg text-sm">Cancel</button>
                <button type="button" onClick={handleSave} disabled={loading} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">{loading ? "Saving…" : "Save Record"}</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
