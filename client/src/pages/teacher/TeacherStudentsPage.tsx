import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Search, Users, Eye } from "lucide-react";

type Student = {
  id: string; name: string; roll_number?: string;
  phone?: string; father_name?: string; gender?: string; class_name?: string; class_id?: string;
};
type Class = { id: string; name: string };

export function TeacherStudentsPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();
  const navigate = useNavigate();

  const [students, setStudents]           = useState<Student[]>([]);
  const [classes, setClasses]             = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState("all");
  const [search, setSearch]               = useState("");
  const [loading, setLoading]             = useState(true);
  const [noClasses, setNoClasses]         = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Step 1: Get only classes assigned to this teacher via timetable
      const { data: timetableRows } = await supabase
        .from("timetables")
        .select("class_id")
        .eq("school_id", schoolId)
        .eq("teacher_id", user.id);

      const teacherClassIds = [...new Set((timetableRows || []).map((r: any) => r.class_id).filter(Boolean))];

      if (teacherClassIds.length === 0) {
        setNoClasses(true);
        setLoading(false);
        return;
      }

      // Step 2: Fetch only those classes and their students
      const [{ data: stu }, { data: cls }] = await Promise.all([
        supabase.from("students")
          .select("id, name, roll_number, phone, father_name, gender, class_id")
          .eq("school_id", schoolId)
          .in("class_id", teacherClassIds)
          .order("name"),
        supabase.from("classes")
          .select("id, name")
          .in("id", teacherClassIds)
          .order("name"),
      ]);

      const cm = Object.fromEntries((cls || []).map((c: Class) => [c.id, c.name]));
      setStudents((stu || []).map((s: any) => ({ ...s, class_name: cm[s.class_id || ""] || "—" })));
      setClasses(cls || []);
      setLoading(false);
    };
    load();
  }, [schoolId]);

  const filtered = students.filter(s => {
    const matchClass  = selectedClass === "all" || s.class_id === selectedClass;
    const matchSearch = !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.roll_number || "").includes(search) ||
      (s.father_name || "").toLowerCase().includes(search.toLowerCase());
    return matchClass && matchSearch;
  });

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>My Students</h1>
          <p>Students from your assigned classes</p>
        </div>
        <span className="text-sm text-muted-foreground">{filtered.length} students</span>
      </div>

      {noClasses ? (
        <div className="bg-card border border-border rounded-xl p-16 text-center text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-1">No classes assigned yet</p>
          <p className="text-sm">Contact admin to assign classes to your timetable.</p>
        </div>
      ) : (
        <>
          <div className="flex gap-3 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <input title="Search students" placeholder="Search name, roll no., father…"
                value={search} onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 border border-border rounded-lg text-sm bg-background w-64" />
            </div>
            <select title="Filter by class" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
              <option value="all">All My Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full edu-table">
              <thead><tr><th>Roll No.</th><th>Name</th><th>Class</th><th>Father's Name</th><th>Gender</th><th>Phone</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Loading…</td></tr>}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No students found.
                  </td></tr>
                )}
                {filtered.map(s => (
                  <tr key={s.id} className="cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => navigate(`/${schoolId}/admin/students/${s.id}`)}>
                    <td className="font-mono text-sm">{s.roll_number || "—"}</td>
                    <td className="font-medium">{s.name}</td>
                    <td><span className="badge-blue text-xs">{s.class_name}</span></td>
                    <td className="text-sm">{s.father_name || "—"}</td>
                    <td className="text-sm capitalize">{s.gender || "—"}</td>
                    <td className="text-sm font-mono">{s.phone || "—"}</td>
                    <td>
                      <button type="button" title="View 360° Profile"
                        onClick={e => { e.stopPropagation(); navigate(`/${schoolId}/admin/students/${s.id}`); }}
                        className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 px-2 py-1 rounded border border-blue-200 hover:bg-blue-50 transition-colors">
                        <Eye className="w-3 h-3" /> Profile
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
