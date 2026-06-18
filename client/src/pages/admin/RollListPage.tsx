import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Printer, Download } from "lucide-react";

type Student = {
  id: string;
  name: string;
  roll_number: string;
  admission_number: string;
  father_name: string;
  phone: string;
  blood_group: string;
  gender: string;
  date_of_birth: string;
};

type Class = { id: string; name: string };

const LIST_TYPES = [
  { value: "attendance", label: "Attendance Register", desc: "Roll no, name, 31 date columns" },
  { value: "exam",       label: "Exam Answer Sheet List", desc: "Roll no, name, signature column" },
  { value: "full",       label: "Full Student List", desc: "All details — father name, phone, blood group" },
];

export function RollListPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [listType, setListType] = useState("attendance");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [school, setSchool] = useState<{ name: string; address?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    Promise.all([
      supabase.from("classes").select("id, name").eq("school_id", schoolId).order("name"),
      supabase.from("schools").select("name, address").eq("id", schoolId).single(),
    ]).then(([classRes, schoolRes]) => {
      setClasses(classRes.data || []);
      if (schoolRes.data) setSchool(schoolRes.data as { name: string; address?: string });
    });
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId || !selectedClass) { setStudents([]); return; }
    setLoading(true);
    supabase
      .from("students")
      .select("id, name, roll_number, admission_number, father_name, phone, blood_group, gender, date_of_birth")
      .eq("school_id", schoolId)
      .eq("class_id", selectedClass)
      .order("roll_number")
      .then(({ data }) => { setStudents(data || []); setLoading(false); });
  }, [schoolId, selectedClass]);

  const selectedClassName = classes.find((c) => c.id === selectedClass)?.name || "";
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const daysInMonth = new Date(year, month, 0).getDate();
  const canPrint = selectedClass && students.length > 0;

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Roll List / Register</h1>
          <p>Class-wise student lists — attendance register, exam sheet, full details</p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={!canPrint}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          <Printer className="w-4 h-4" /> Print List
        </button>
      </div>

      {/* Controls */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm mb-6 no-print">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Class *</label>
            <select title="Select class" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
              <option value="">Select class…</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">List Type</label>
            <select title="List type" value={listType} onChange={(e) => setListType(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
              {LIST_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {listType === "attendance" && (
            <>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Month</label>
                <select title="Month" value={month} onChange={(e) => setMonth(Number(e.target.value))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Year</label>
                <select title="Year" value={year} onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                  {[2023, 2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </>
          )}
        </div>
        {selectedClass && students.length > 0 && (
          <p className="text-sm text-muted-foreground mt-3">{students.length} students in {selectedClassName}</p>
        )}
      </div>

      {/* Screen preview */}
      {!selectedClass ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center text-muted-foreground no-print">
          Select a class to preview and print the roll list.
        </div>
      ) : loading ? (
        <div className="text-center text-muted-foreground py-12 no-print">Loading students…</div>
      ) : students.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center text-muted-foreground no-print">
          No students enrolled in this class.
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-x-auto shadow-sm no-print">
          <div className="p-3 border-b border-border text-xs text-muted-foreground font-medium">
            Preview — {LIST_TYPES.find((t) => t.value === listType)?.label}
          </div>
          <table className="w-full edu-table text-xs">
            <thead>
              <tr>
                <th className="w-8">#</th>
                <th>Name</th>
                <th>Roll No</th>
                {listType === "full" && <><th>Father</th><th>Phone</th><th>Blood</th><th>Gender</th></>}
                {listType === "exam" && <th>Signature</th>}
                {listType === "attendance" && <th>Total P</th>}
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={s.id}>
                  <td className="text-muted-foreground">{i + 1}</td>
                  <td className="font-medium">{s.name}</td>
                  <td>{s.roll_number || "—"}</td>
                  {listType === "full" && <><td>{s.father_name || "—"}</td><td>{s.phone || "—"}</td><td>{s.blood_group || "—"}</td><td>{s.gender || "—"}</td></>}
                  {listType === "exam" && <td className="text-muted-foreground">___________</td>}
                  {listType === "attendance" && <td className="text-muted-foreground">___</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── PRINT OUTPUT ─── */}
      {canPrint && (
        <div className="hidden print:block print-full">
          <PrintHeader school={school} className={selectedClassName} listType={listType} month={MONTHS[month - 1]} year={year} studentCount={students.length} />

          {listType === "attendance" && (
            <AttendanceRegister students={students} daysInMonth={daysInMonth} month={MONTHS[month - 1]} year={year} />
          )}

          {listType === "exam" && (
            <ExamSheetList students={students} className={selectedClassName} />
          )}

          {listType === "full" && (
            <FullStudentList students={students} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Print sub-components ──────────────────────────────────────────────────────

function PrintHeader({ school, className, listType, month, year, studentCount }: {
  school: { name: string; address?: string } | null;
  className: string; listType: string; month: string; year: number; studentCount: number;
}) {
  return (
    <div className="text-center mb-4 border-b-2 border-gray-800 pb-3">
      <h1 className="text-lg font-bold uppercase tracking-wide">{school?.name || "School"}</h1>
      {school?.address && <p className="text-xs text-gray-600">{school.address}</p>}
      <h2 className="text-base font-bold mt-1 uppercase">
        {listType === "attendance" ? `Attendance Register — ${month} ${year}` : listType === "exam" ? "Exam Attendance / Answer Sheet List" : "Student Roll List"}
      </h2>
      <div className="flex justify-center gap-8 text-xs text-gray-600 mt-1">
        <span>Class: <strong>{className}</strong></span>
        <span>Total Students: <strong>{studentCount}</strong></span>
        {listType === "attendance" && <span>Month: <strong>{month} {year}</strong></span>}
      </div>
    </div>
  );
}

function AttendanceRegister({ students, daysInMonth, month, year }: { students: Student[]; daysInMonth: number; month: string; year: number }) {
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[8px]" style={{ fontSize: "7px" }}>
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-400 px-1 py-1 text-left w-6">#</th>
            <th className="border border-gray-400 px-1 py-1 text-left" style={{ minWidth: "120px" }}>Student Name</th>
            <th className="border border-gray-400 px-1 py-1 w-8">Roll</th>
            {days.map((d) => (
              <th key={d} className="border border-gray-400 text-center w-4">{d}</th>
            ))}
            <th className="border border-gray-400 px-1 py-1 text-center w-8">P</th>
            <th className="border border-gray-400 px-1 py-1 text-center w-8">A</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s, i) => (
            <tr key={s.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <td className="border border-gray-300 px-1 py-1.5 text-center">{i + 1}</td>
              <td className="border border-gray-300 px-1 py-1.5 font-medium">{s.name}</td>
              <td className="border border-gray-300 px-1 py-1.5 text-center">{s.roll_number || ""}</td>
              {days.map((d) => <td key={d} className="border border-gray-300 text-center py-1.5"> </td>)}
              <td className="border border-gray-300 text-center py-1.5"> </td>
              <td className="border border-gray-300 text-center py-1.5"> </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExamSheetList({ students, className }: { students: Student[]; className: string }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="bg-gray-100">
          <th className="border border-gray-400 px-3 py-2 text-left w-10">#</th>
          <th className="border border-gray-400 px-3 py-2 text-left w-16">Roll No</th>
          <th className="border border-gray-400 px-3 py-2 text-left">Student Name</th>
          <th className="border border-gray-400 px-3 py-2 text-left w-32">Adm No</th>
          <th className="border border-gray-400 px-3 py-2 text-left w-40">Signature</th>
        </tr>
      </thead>
      <tbody>
        {students.map((s, i) => (
          <tr key={s.id}>
            <td className="border border-gray-300 px-3 py-3 text-center">{i + 1}</td>
            <td className="border border-gray-300 px-3 py-3 text-center font-semibold">{s.roll_number || "—"}</td>
            <td className="border border-gray-300 px-3 py-3 font-medium">{s.name}</td>
            <td className="border border-gray-300 px-3 py-3">{s.admission_number || "—"}</td>
            <td className="border border-gray-300 px-3 py-3"> </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FullStudentList({ students }: { students: Student[] }) {
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="bg-gray-100">
          <th className="border border-gray-400 px-2 py-2 text-left w-8">#</th>
          <th className="border border-gray-400 px-2 py-2 text-left w-12">Roll</th>
          <th className="border border-gray-400 px-2 py-2 text-left">Student Name</th>
          <th className="border border-gray-400 px-2 py-2 text-left">Father Name</th>
          <th className="border border-gray-400 px-2 py-2 text-left w-24">Phone</th>
          <th className="border border-gray-400 px-2 py-2 text-center w-12">Blood</th>
          <th className="border border-gray-400 px-2 py-2 text-center w-12">Gender</th>
          <th className="border border-gray-400 px-2 py-2 text-left w-24">DOB</th>
          <th className="border border-gray-400 px-2 py-2 text-left w-24">Adm No</th>
        </tr>
      </thead>
      <tbody>
        {students.map((s, i) => (
          <tr key={s.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
            <td className="border border-gray-300 px-2 py-1.5 text-center">{i + 1}</td>
            <td className="border border-gray-300 px-2 py-1.5 text-center font-semibold">{s.roll_number || "—"}</td>
            <td className="border border-gray-300 px-2 py-1.5 font-medium">{s.name}</td>
            <td className="border border-gray-300 px-2 py-1.5">{s.father_name || "—"}</td>
            <td className="border border-gray-300 px-2 py-1.5">{s.phone || "—"}</td>
            <td className="border border-gray-300 px-2 py-1.5 text-center">{s.blood_group || "—"}</td>
            <td className="border border-gray-300 px-2 py-1.5 text-center">{s.gender?.[0] || "—"}</td>
            <td className="border border-gray-300 px-2 py-1.5">{s.date_of_birth ? new Date(s.date_of_birth).toLocaleDateString("en-IN") : "—"}</td>
            <td className="border border-gray-300 px-2 py-1.5">{s.admission_number || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
