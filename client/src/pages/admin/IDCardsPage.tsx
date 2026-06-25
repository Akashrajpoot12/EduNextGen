import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Printer, Search } from "lucide-react";

type Student = {
  id: string;
  name: string;
  roll_number: string;
  admission_number: string;
  father_name: string;
  phone: string;
  blood_group: string;
  class_id: string;
  date_of_birth: string;
  classes?: { name: string } | null;
};

type School = { name: string; address?: string; phone?: string };

export function IDCardsPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [students, setStudents] = useState<Student[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [classFilter, setClassFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [printed, setPrinted] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    async function fetchData() {
      const [studsRes, schoolRes, classRes] = await Promise.all([
        supabase.from("students").select("id, name, roll_number, admission_number, father_name, phone, blood_group, class_id, date_of_birth, classes(name)").eq("school_id", schoolId).order("name"),
        supabase.from("schools").select("name, address, phone").eq("id", schoolId).single(),
        supabase.from("classes").select("id, name").eq("school_id", schoolId).order("name"),
      ]);
      setStudents(studsRes.data || []);
      if (schoolRes.data) setSchool(schoolRes.data as School);
      setClasses(classRes.data || []);
    }
    fetchData();
  }, [schoolId]);

  const filtered = students.filter((s) => {
    const matchSearch = !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.roll_number?.includes(search);
    const matchClass = classFilter === "all" || s.class_id === classFilter;
    return matchSearch && matchClass;
  });

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(filtered.map((s) => s.id)));
  }

  function clearAll() {
    setSelected(new Set());
  }

  const printStudents = filtered.filter((s) => selected.has(s.id));

  function handlePrint() {
    setPrinted(true);
    window.print();
  }

  return (
    <div>
      <div className="page-header flex items-center justify-between no-print">
        <div>
          <h1>ID Cards</h1>
          <p>Print student identity cards with class, roll number, blood group and parent contact</p>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          disabled={selected.size === 0}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          <Printer className="w-4 h-4" /> Print {selected.size > 0 ? `${selected.size} Cards` : "Selected"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 no-print">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or roll no…" className="border border-border rounded-lg pl-9 pr-3 py-2 text-sm bg-background w-64" />
        </div>
        <select title="Filter by class" value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
          <option value="all">All Classes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button type="button" onClick={selectAll} className="text-xs border border-border px-3 py-1.5 rounded-lg hover:bg-muted">Select All ({filtered.length})</button>
        {selected.size > 0 && <button type="button" onClick={clearAll} className="text-xs border border-border px-3 py-1.5 rounded-lg hover:bg-muted">Clear</button>}
        <span className="text-sm text-muted-foreground ml-auto">{selected.size} selected</span>
      </div>

      {/* Student grid for selection */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6 no-print">
        {filtered.map((s) => {
          const isSelected = selected.has(s.id);
          const cls = (s.classes as { name: string } | null)?.name || "—";
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggleSelect(s.id)}
              className={`text-left p-3 rounded-xl border transition-all text-sm ${isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card hover:bg-muted/30"}`}
            >
              <div className="flex items-start justify-between mb-1">
                <p className="font-medium truncate flex-1">{s.name}</p>
                <span className={`w-4 h-4 rounded border flex-shrink-0 ml-1 mt-0.5 flex items-center justify-center ${isSelected ? "bg-primary border-primary" : "border-border"}`}>
                  {isSelected && <span className="text-foreground text-[10px] font-bold">✓</span>}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{cls} · Roll {s.roll_number || "—"}</p>
              {s.blood_group && <p className="text-xs text-red-500 mt-0.5">Blood: {s.blood_group}</p>}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-4 text-center text-muted-foreground text-sm py-10">No students found.</div>
        )}
      </div>

      {/* Print output — only visible during print */}
      {printStudents.length > 0 && (
        <div className="print-full hidden print:block">
          <div className="grid grid-cols-2 gap-4 p-4" style={{ gridTemplateColumns: "repeat(2, 8.5cm)", gap: "0.5cm" }}>
            {printStudents.map((s) => {
              const cls = (s.classes as { name: string } | null)?.name || "—";
              return (
                <div key={s.id} className="border-2 border-gray-800 rounded-lg overflow-hidden" style={{ width: "8.5cm", height: "5.5cm", fontFamily: "Arial, sans-serif" }}>
                  {/* Header */}
                  <div className="bg-blue-700 text-white text-center py-1.5 px-2">
                    <p className="font-bold text-xs uppercase tracking-wide truncate">{school?.name || "School Name"}</p>
                    {school?.address && <p className="text-[8px] opacity-80 truncate">{school.address}</p>}
                  </div>
                  {/* Body */}
                  <div className="p-2 flex gap-2 h-full">
                    {/* Photo placeholder */}
                    <div className="w-14 h-14 border-2 border-gray-300 rounded flex items-center justify-center bg-gray-50 flex-shrink-0 text-[8px] text-gray-400 text-center">
                      Photo
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-gray-900 truncate">{s.name}</p>
                      <p className="text-[9px] text-gray-600">Class: <span className="font-semibold">{cls}</span></p>
                      <p className="text-[9px] text-gray-600">Roll No: <span className="font-semibold">{s.roll_number || "—"}</span></p>
                      <p className="text-[9px] text-gray-600">Adm No: <span className="font-semibold">{s.admission_number || "—"}</span></p>
                      {s.blood_group && <p className="text-[9px] text-red-700 font-bold">Blood: {s.blood_group}</p>}
                      {s.father_name && <p className="text-[8px] text-gray-500 truncate">Father: {s.father_name}</p>}
                      {s.phone && <p className="text-[8px] text-gray-500">Ph: {s.phone}</p>}
                    </div>
                  </div>
                  {/* Footer */}
                  <div className="bg-gray-100 text-center text-[7px] text-gray-500 py-0.5 border-t border-gray-200">
                    {school?.phone && <>School: {school.phone}</>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
