import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { ArrowRight, CheckCircle, AlertCircle, Users } from "lucide-react";

type Class = { id: string; name: string };
type Student = { id: string; name: string; roll_number: string; admission_number: string; class_id: string };

type PromotionRule = {
  fromClassId: string;
  toClassId: string;
};

export function ClassPromotionPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [rules, setRules] = useState<PromotionRule[]>([{ fromClassId: "", toClassId: "" }]);
  const [preview, setPreview] = useState<{ student: Student; fromClass: Class; toClass: Class }[]>([]);
  const [promoting, setPromoting] = useState(false);
  const [done, setDone] = useState(false);
  const [promotedCount, setPromotedCount] = useState(0);
  const [step, setStep] = useState<"setup" | "preview" | "done">("setup");

  useEffect(() => {
    if (!schoolId) return;
    async function fetchData() {
      const [classRes, studsRes] = await Promise.all([
        supabase.from("classes").select("id, name").eq("school_id", schoolId).order("name"),
        supabase.from("students").select("id, name, roll_number, admission_number, class_id").eq("school_id", schoolId).order("name"),
      ]);
      setClasses(classRes.data || []);
      setStudents(studsRes.data || []);
    }
    fetchData();
  }, [schoolId]);

  function addRule() {
    setRules((prev) => [...prev, { fromClassId: "", toClassId: "" }]);
  }

  function removeRule(i: number) {
    setRules((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateRule(i: number, key: keyof PromotionRule, value: string) {
    setRules((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }

  function buildPreview() {
    const result: typeof preview = [];
    const classMap = Object.fromEntries(classes.map((c) => [c.id, c]));
    rules.forEach((rule) => {
      if (!rule.fromClassId || !rule.toClassId) return;
      const fromClass = classMap[rule.fromClassId];
      const toClass = classMap[rule.toClassId];
      if (!fromClass || !toClass) return;
      students
        .filter((s) => s.class_id === rule.fromClassId)
        .forEach((s) => result.push({ student: s, fromClass, toClass }));
    });
    setPreview(result);
    setStep("preview");
  }

  async function handlePromote() {
    if (preview.length === 0) return;
    setPromoting(true);
    let count = 0;
    for (const entry of preview) {
      const { error } = await supabase
        .from("students")
        .update({ class_id: entry.toClass.id })
        .eq("id", entry.student.id);
      if (!error) count++;
    }
    setPromotedCount(count);
    setPromoting(false);
    setStep("done");
  }

  return (
    <div>
      <div className="page-header">
        <h1>Class Promotion</h1>
        <p>Year-end bulk promotion — move students from one class to the next</p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-3 mb-8">
        {(["setup", "preview", "done"] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <div className="w-8 h-px bg-border" />}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${step === s ? "bg-primary text-primary-foreground" : step === "done" && i < 2 ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
              <span>{i + 1}</span>
              <span className="capitalize">{s === "setup" ? "Set Rules" : s === "preview" ? "Preview" : "Done"}</span>
            </div>
          </div>
        ))}
      </div>

      {step === "setup" && (
        <div className="max-w-2xl space-y-4">
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <h2 className="font-semibold text-sm mb-4">Promotion Rules</h2>
            <div className="space-y-3">
              {rules.map((rule, i) => (
                <div key={i} className="flex items-center gap-3">
                  <select
                    title="From class"
                    value={rule.fromClassId}
                    onChange={(e) => updateRule(i, "fromClassId", e.target.value)}
                    className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background"
                  >
                    <option value="">From class…</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <select
                    title="To class"
                    value={rule.toClassId}
                    onChange={(e) => updateRule(i, "toClassId", e.target.value)}
                    className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background"
                  >
                    <option value="">To class…</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {rules.length > 1 && (
                    <button type="button" onClick={() => removeRule(i)} className="text-red-500 hover:text-red-700 text-xs px-2 py-1 border border-red-200 rounded">
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={addRule} className="mt-3 text-xs text-primary hover:underline">
              + Add another class mapping
            </button>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <p className="font-semibold mb-1">Before you proceed:</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs">
              <li>This will permanently update each student's class to the target class.</li>
              <li>Make sure you've completed all exams, marks, and reports for this academic year.</li>
              <li>Students who are leaving (TC issued) should be removed from the directory first.</li>
            </ul>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={buildPreview}
              disabled={rules.every((r) => !r.fromClassId || !r.toClassId)}
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              Preview Promotions
            </button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              <span className="font-semibold">{preview.length} students will be promoted</span>
            </div>
            <button type="button" onClick={() => setStep("setup")} className="text-sm text-primary hover:underline">
              ← Edit rules
            </button>
          </div>

          {preview.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
              No students found for the selected class mappings.
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
              <table className="w-full edu-table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Adm No.</th>
                    <th>Roll No.</th>
                    <th>Current Class</th>
                    <th>Promoted To</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((entry) => (
                    <tr key={entry.student.id}>
                      <td className="font-medium">{entry.student.name}</td>
                      <td className="font-mono text-sm">{entry.student.admission_number || "—"}</td>
                      <td>{entry.student.roll_number || "—"}</td>
                      <td><span className="badge-blue">{entry.fromClass.name}</span></td>
                      <td>
                        <span className="flex items-center gap-1">
                          <ArrowRight className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="badge-green">{entry.toClass.name}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {preview.length > 0 && (
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setStep("setup")} className="px-4 py-2.5 border border-border rounded-lg text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePromote}
                disabled={promoting}
                className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {promoting ? "Promoting…" : `Confirm & Promote ${preview.length} Students`}
              </button>
            </div>
          )}
        </div>
      )}

      {step === "done" && (
        <div className="max-w-md mx-auto text-center py-12">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold mb-2">Promotion Complete!</h2>
          <p className="text-muted-foreground mb-6">
            <strong>{promotedCount}</strong> students have been successfully promoted to their new classes.
          </p>
          <button
            type="button"
            onClick={() => { setStep("setup"); setRules([{ fromClassId: "", toClassId: "" }]); setPreview([]); }}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
          >
            Promote Another Batch
          </button>
        </div>
      )}
    </div>
  );
}
