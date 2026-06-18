import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Printer, BookOpen } from "lucide-react";

type Student = { id: string; name: string; roll_number: string; admission_number: string; father_name: string; blood_group: string; classes?: { name: string } | null };
type School = { name: string; address?: string; phone?: string };

export function LibraryCardPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [selectedClass, setSelectedClass] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear() + "-" + String(new Date().getFullYear() + 1).slice(2));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    Promise.all([
      supabase.from("classes").select("id, name").eq("school_id", schoolId).order("name"),
      supabase.from("schools").select("name, address, phone").eq("id", schoolId).single(),
    ]).then(([cRes, scRes]) => {
      setClasses(cRes.data || []);
      if (scRes.data) setSchool(scRes.data as School);
    });
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) return;
    setLoading(true);
    let q = supabase.from("students")
      .select("id, name, roll_number, admission_number, father_name, blood_group, classes(name)")
      .eq("school_id", schoolId).order("name");
    if (selectedClass) q = q.eq("class_id", selectedClass);
    q.then(({ data }) => {
      setStudents(data as Student[] || []);
      setSelectedIds(new Set((data as Student[] || []).map(s => s.id)));
      setLoading(false);
    });
  }, [schoolId, selectedClass]);

  const filtered = students.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.admission_number?.includes(search)
  );
  const printStudents = filtered.filter(s => selectedIds.has(s.id));

  function toggle(id: string) { setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }

  // Generate library member number
  function libNo(s: Student, idx: number) {
    const year = academicYear.replace("-", "");
    return `LIB/${year}/${String(idx + 1).padStart(4, "0")}`;
  }

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Library Member Cards</h1>
          <p>Generate and print student library ID cards with member numbers</p>
        </div>
        <button type="button" onClick={() => window.print()} disabled={printStudents.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
          <Printer className="w-4 h-4" /> Print {printStudents.length > 0 ? `${printStudents.length} Cards` : "Cards"}
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4 no-print">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student…"
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background w-56" />
        <select title="Filter by class" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
          <option value="">All Classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Academic Year:</label>
          <input value={academicYear} onChange={e => setAcademicYear(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background w-24" />
        </div>
        <button type="button" onClick={() => setSelectedIds(new Set(filtered.map(s => s.id)))} className="text-xs border border-border px-3 py-1.5 rounded-lg hover:bg-muted">All</button>
        <button type="button" onClick={() => setSelectedIds(new Set())} className="text-xs border border-border px-3 py-1.5 rounded-lg hover:bg-muted">None</button>
        <span className="text-sm text-muted-foreground ml-auto">{selectedIds.size} selected</span>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm no-print">
        <table className="w-full edu-table">
          <thead><tr><th className="w-8"></th><th>Name</th><th>Class</th><th>Adm No</th><th>Library No</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="text-center text-muted-foreground py-10">Loading…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={5} className="text-center text-muted-foreground py-10">No students found.</td></tr>}
            {filtered.map((s, idx) => {
              const cls = (s.classes as { name: string } | null)?.name || "—";
              return (
                <tr key={s.id} className={selectedIds.has(s.id) ? "bg-primary/5" : ""}>
                  <td><input type="checkbox" title="Select" checked={selectedIds.has(s.id)} onChange={() => toggle(s.id)} /></td>
                  <td className="font-medium">{s.name}</td>
                  <td>{cls}</td>
                  <td className="font-mono text-sm">{s.admission_number || "—"}</td>
                  <td className="font-mono text-sm text-primary">{libNo(s, idx)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ─── PRINT LAYOUT ─── */}
      {printStudents.length > 0 && (
        <div className="hidden print:block print-full px-4 pt-6">
          <p className="text-center text-xs text-gray-400 mb-4">{school?.name} — Library Member Cards — {academicYear}</p>
          {/* 3 cards per row */}
          {Array.from({ length: Math.ceil(printStudents.length / 3) }, (_, rowIdx) => (
            <div key={rowIdx} className={`flex gap-3 ${rowIdx > 0 ? "mt-3" : ""}`}>
              {[0, 1, 2].map(col => {
                const globalIdx = filtered.indexOf(printStudents[rowIdx * 3 + col]);
                const s = printStudents[rowIdx * 3 + col];
                if (!s) return <div key={col} className="flex-1" />;
                const cls = (s.classes as { name: string } | null)?.name || "";
                return (
                  <div key={col} className="flex-1 border-2 border-gray-700 rounded-lg p-3 text-gray-900">
                    {/* Card header */}
                    <div className="flex items-center justify-between border-b border-gray-300 pb-1.5 mb-2">
                      <div>
                        <h1 className="text-[10px] font-bold uppercase leading-tight">{school?.name}</h1>
                        <p className="text-[8px] text-gray-500">Library Membership Card</p>
                      </div>
                      <BookOpen className="w-5 h-5 text-indigo-600" />
                    </div>
                    {/* Student info */}
                    <div className="flex gap-2">
                      <div className="border border-gray-300 w-12 h-14 flex items-center justify-center text-[7px] text-gray-400 rounded flex-shrink-0">
                        Photo
                      </div>
                      <div className="flex-1 text-[9px] space-y-0.5">
                        <p className="font-bold text-[11px] leading-tight">{s.name}</p>
                        <p><span className="text-gray-500">Class:</span> {cls}</p>
                        <p><span className="text-gray-500">Adm No:</span> {s.admission_number || "—"}</p>
                        {s.blood_group && <p><span className="text-gray-500">Blood:</span> <strong className="text-red-600">{s.blood_group}</strong></p>}
                      </div>
                    </div>
                    {/* Library number */}
                    <div className="mt-2 bg-indigo-50 border border-indigo-200 rounded px-2 py-1 text-center">
                      <p className="text-[8px] text-indigo-500 uppercase font-semibold">Member No.</p>
                      <p className="text-[11px] font-bold text-indigo-700 font-mono">{libNo(s, globalIdx >= 0 ? globalIdx : rowIdx * 3 + col)}</p>
                    </div>
                    {/* Validity */}
                    <div className="flex justify-between text-[8px] text-gray-500 mt-1.5">
                      <span>Valid: {academicYear}</span>
                      {school?.phone && <span>Ph: {school.phone}</span>}
                    </div>
                    <div className="border-t border-gray-300 pt-1 mt-1.5 text-center text-[8px] text-gray-400">
                      Librarian Signature
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
