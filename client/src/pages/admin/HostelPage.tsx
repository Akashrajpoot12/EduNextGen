import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Plus, X, Home, Users, BedDouble } from "lucide-react";

type Hostel = { id: string; name: string; type: string; warden_name: string; warden_phone: string; total_rooms: number };
type Room = { id: string; hostel_id: string; room_number: string; room_type: string; capacity: number; monthly_fee: number; hostels?: { name: string } | null };
type Assignment = {
  id: string; student_id: string; room_id: string; bed_number: string; join_date: string; is_active: boolean;
  students?: { name: string; classes?: { name: string } | null } | null;
  hostel_rooms?: { room_number: string; hostels?: { name: string } | null } | null;
};
type Student = { id: string; name: string; classes?: { name: string } | null };

export function HostelPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [tab, setTab] = useState<"overview" | "rooms" | "students">("overview");
  const [showHostelForm, setShowHostelForm] = useState(false);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [hostelForm, setHostelForm] = useState({ name: "", type: "boys", warden_name: "", warden_phone: "", total_rooms: "0" });
  const [roomForm, setRoomForm] = useState({ hostel_id: "", room_number: "", room_type: "dormitory", capacity: "4", monthly_fee: "0" });
  const [assignForm, setAssignForm] = useState({ student_id: "", room_id: "", bed_number: "", join_date: new Date().toISOString().split("T")[0] });
  const [saving, setSaving] = useState(false);

  async function fetchAll() {
    const [hRes, rRes, aRes, sRes] = await Promise.all([
      supabase.from("hostels").select("*").eq("school_id", schoolId).order("name"),
      supabase.from("hostel_rooms").select("*, hostels(name)").eq("school_id", schoolId).order("room_number"),
      supabase.from("hostel_assignments").select("*, students(name, classes(name)), hostel_rooms(room_number, hostels(name))").eq("school_id", schoolId).eq("is_active", true),
      supabase.from("students").select("id, name, classes(name)").eq("school_id", schoolId).order("name"),
    ]);
    setHostels(hRes.data as Hostel[] || []);
    setRooms(rRes.data as Room[] || []);
    setAssignments(aRes.data as Assignment[] || []);
    setStudents(sRes.data as Student[] || []);
  }

  useEffect(() => { if (schoolId) fetchAll(); }, [schoolId]);

  async function saveHostel() {
    setSaving(true);
    await supabase.from("hostels").insert({ ...hostelForm, total_rooms: Number(hostelForm.total_rooms), school_id: schoolId });
    setSaving(false); setShowHostelForm(false);
    setHostelForm({ name: "", type: "boys", warden_name: "", warden_phone: "", total_rooms: "0" });
    fetchAll();
  }

  async function saveRoom() {
    setSaving(true);
    await supabase.from("hostel_rooms").insert({ ...roomForm, capacity: Number(roomForm.capacity), monthly_fee: Number(roomForm.monthly_fee), school_id: schoolId });
    setSaving(false); setShowRoomForm(false);
    setRoomForm({ hostel_id: "", room_number: "", room_type: "dormitory", capacity: "4", monthly_fee: "0" });
    fetchAll();
  }

  async function saveAssignment() {
    setSaving(true);
    await supabase.from("hostel_assignments").insert({ ...assignForm, school_id: schoolId, is_active: true });
    setSaving(false); setShowAssignForm(false);
    setAssignForm({ student_id: "", room_id: "", bed_number: "", join_date: new Date().toISOString().split("T")[0] });
    fetchAll();
  }

  async function vacate(id: string) {
    await supabase.from("hostel_assignments").update({ is_active: false, leave_date: new Date().toISOString().split("T")[0] }).eq("id", id);
    fetchAll();
  }

  const assignedStudentIds = new Set(assignments.map(a => a.student_id));
  const availableStudents = students.filter(s => !assignedStudentIds.has(s.id));

  // Occupancy per room
  const roomOccupancy = assignments.reduce<Record<string, number>>((acc, a) => { acc[a.room_id] = (acc[a.room_id] || 0) + 1; return acc; }, {});

  const totalCapacity = rooms.reduce((s, r) => s + r.capacity, 0);
  const occupied = assignments.length;

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Hostel Management</h1>
          <p>Manage hostels, rooms and student bed allocations</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowRoomForm(true)} className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted">
            <Plus className="w-4 h-4" /> Add Room
          </button>
          <button type="button" onClick={() => setShowAssignForm(true)} disabled={availableStudents.length === 0 || rooms.length === 0}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted disabled:opacity-50">
            <BedDouble className="w-4 h-4" /> Assign Bed
          </button>
          <button type="button" onClick={() => setShowHostelForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> Add Hostel
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-blue">
          <div className="flex items-center gap-2"><Home className="w-4 h-4 text-blue-500" /><p className="text-xs text-muted-foreground">Hostels</p></div>
          <p className="text-2xl font-bold">{hostels.length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-purple">
          <div className="flex items-center gap-2"><BedDouble className="w-4 h-4 text-purple-500" /><p className="text-xs text-muted-foreground">Total Rooms</p></div>
          <p className="text-2xl font-bold">{rooms.length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-green">
          <div className="flex items-center gap-2"><Users className="w-4 h-4 text-emerald-500" /><p className="text-xs text-muted-foreground">Occupied / Capacity</p></div>
          <p className="text-2xl font-bold">{occupied} / {totalCapacity}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-orange">
          <p className="text-xs text-muted-foreground">Vacancy</p>
          <p className="text-2xl font-bold">{Math.max(0, totalCapacity - occupied)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 mb-6 w-fit">
        {(["overview", "rooms", "students"] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${tab === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {t === "overview" ? "Hostels" : t === "rooms" ? "Rooms" : "Students"}
          </button>
        ))}
      </div>

      {/* HOSTELS */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {hostels.length === 0 && <div className="col-span-2 bg-card rounded-xl border border-border p-12 text-center text-muted-foreground">No hostels yet. Add your first hostel.</div>}
          {hostels.map(h => {
            const hRooms = rooms.filter(r => r.hostel_id === h.id);
            const hOccupied = hRooms.reduce((s, r) => s + (roomOccupancy[r.id] || 0), 0);
            const hCapacity = hRooms.reduce((s, r) => s + r.capacity, 0);
            return (
              <div key={h.id} className="bg-card rounded-xl border border-border p-5 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-base">{h.name}</h3>
                    <span className={h.type === "boys" ? "badge-blue" : h.type === "girls" ? "badge-purple" : "badge-green"}>{h.type}</span>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold text-2xl">{hOccupied}<span className="text-sm text-muted-foreground">/{hCapacity}</span></p>
                    <p className="text-xs text-muted-foreground">occupied</p>
                  </div>
                </div>
                {h.warden_name && <p className="text-sm text-muted-foreground">Warden: <strong>{h.warden_name}</strong>{h.warden_phone ? ` · ${h.warden_phone}` : ""}</p>}
                <p className="text-sm text-muted-foreground mt-1">{hRooms.length} rooms · {hCapacity} capacity</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ROOMS */}
      {tab === "rooms" && (
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          <table className="w-full edu-table">
            <thead><tr><th>Room</th><th>Hostel</th><th>Type</th><th>Capacity</th><th>Occupied</th><th>Vacancy</th><th>Fee/Month</th></tr></thead>
            <tbody>
              {rooms.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No rooms added yet.</td></tr>}
              {rooms.map(r => {
                const occ = roomOccupancy[r.id] || 0;
                const vacancy = r.capacity - occ;
                const hostel = hostels.find(h => h.id === r.hostel_id);
                return (
                  <tr key={r.id}>
                    <td className="font-semibold">Room {r.room_number}</td>
                    <td>{hostel?.name || "—"}</td>
                    <td className="capitalize">{r.room_type}</td>
                    <td>{r.capacity}</td>
                    <td><span className={occ >= r.capacity ? "badge-red" : "badge-green"}>{occ}</span></td>
                    <td className={vacancy === 0 ? "text-red-500 font-semibold" : "text-emerald-600 font-semibold"}>{vacancy}</td>
                    <td>₹{Number(r.monthly_fee).toLocaleString("en-IN")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* STUDENTS */}
      {tab === "students" && (
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          <table className="w-full edu-table">
            <thead><tr><th>Student</th><th>Class</th><th>Hostel</th><th>Room</th><th>Bed</th><th>Join Date</th><th>Action</th></tr></thead>
            <tbody>
              {assignments.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No students assigned to hostel.</td></tr>}
              {assignments.map(a => {
                const stu = a.students as { name: string; classes?: { name: string } | null } | null;
                const cls = (stu?.classes as { name: string } | null)?.name || "—";
                const room = a.hostel_rooms as { room_number: string; hostels?: { name: string } | null } | null;
                const hostelName = (room?.hostels as { name: string } | null)?.name || "—";
                return (
                  <tr key={a.id}>
                    <td className="font-medium">{stu?.name || "—"}</td>
                    <td>{cls}</td>
                    <td>{hostelName}</td>
                    <td>Room {room?.room_number || "—"}</td>
                    <td>{a.bed_number || "—"}</td>
                    <td className="text-sm">{new Date(a.join_date).toLocaleDateString("en-IN")}</td>
                    <td><button type="button" onClick={() => vacate(a.id)} className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-2 py-1 rounded hover:bg-red-50">Vacate</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Hostel */}
      {showHostelForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">Add Hostel</h2><button type="button" title="Close" onClick={() => setShowHostelForm(false)}><X className="w-5 h-5" /></button></div>
            <div className="space-y-3">
              <input value={hostelForm.name} onChange={e => setHostelForm(p => ({ ...p, name: e.target.value }))} placeholder="Hostel name" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
              <select title="Type" value={hostelForm.type} onChange={e => setHostelForm(p => ({ ...p, type: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                <option value="boys">Boys</option><option value="girls">Girls</option><option value="mixed">Mixed</option>
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input value={hostelForm.warden_name} onChange={e => setHostelForm(p => ({ ...p, warden_name: e.target.value }))} placeholder="Warden name" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                <input value={hostelForm.warden_phone} onChange={e => setHostelForm(p => ({ ...p, warden_phone: e.target.value }))} placeholder="Warden phone" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button type="button" onClick={() => setShowHostelForm(false)} className="flex-1 py-2 border border-border rounded-lg text-sm">Cancel</button>
              <button type="button" onClick={saveHostel} disabled={saving || !hostelForm.name} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving ? "Saving…" : "Add"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Room */}
      {showRoomForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">Add Room</h2><button type="button" title="Close" onClick={() => setShowRoomForm(false)}><X className="w-5 h-5" /></button></div>
            <div className="space-y-3">
              <select title="Hostel" value={roomForm.hostel_id} onChange={e => setRoomForm(p => ({ ...p, hostel_id: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                <option value="">Select Hostel</option>{hostels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input value={roomForm.room_number} onChange={e => setRoomForm(p => ({ ...p, room_number: e.target.value }))} placeholder="Room no. (e.g. 101)" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                <select title="Type" value={roomForm.room_type} onChange={e => setRoomForm(p => ({ ...p, room_type: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                  <option value="dormitory">Dormitory</option><option value="double">Double</option><option value="single">Single</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" value={roomForm.capacity} onChange={e => setRoomForm(p => ({ ...p, capacity: e.target.value }))} placeholder="Capacity" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                <input type="number" value={roomForm.monthly_fee} onChange={e => setRoomForm(p => ({ ...p, monthly_fee: e.target.value }))} placeholder="Monthly fee" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button type="button" onClick={() => setShowRoomForm(false)} className="flex-1 py-2 border border-border rounded-lg text-sm">Cancel</button>
              <button type="button" onClick={saveRoom} disabled={saving || !roomForm.hostel_id || !roomForm.room_number} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving ? "…" : "Add Room"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Bed */}
      {showAssignForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">Assign Bed</h2><button type="button" title="Close" onClick={() => setShowAssignForm(false)}><X className="w-5 h-5" /></button></div>
            <div className="space-y-3">
              <select title="Student" value={assignForm.student_id} onChange={e => setAssignForm(p => ({ ...p, student_id: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                <option value="">Select Student</option>{availableStudents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select title="Room" value={assignForm.room_id} onChange={e => setAssignForm(p => ({ ...p, room_id: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                <option value="">Select Room</option>
                {rooms.map(r => {
                  const occ = roomOccupancy[r.id] || 0;
                  const hostel = hostels.find(h => h.id === r.hostel_id);
                  const full = occ >= r.capacity;
                  return <option key={r.id} value={r.id} disabled={full}>{hostel?.name} — Room {r.room_number} ({occ}/{r.capacity}){full ? " FULL" : ""}</option>;
                })}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input value={assignForm.bed_number} onChange={e => setAssignForm(p => ({ ...p, bed_number: e.target.value }))} placeholder="Bed no. (e.g. B1)" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                <input type="date" title="Join date" value={assignForm.join_date} onChange={e => setAssignForm(p => ({ ...p, join_date: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button type="button" onClick={() => setShowAssignForm(false)} className="flex-1 py-2 border border-border rounded-lg text-sm">Cancel</button>
              <button type="button" onClick={saveAssignment} disabled={saving || !assignForm.student_id || !assignForm.room_id} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving ? "…" : "Assign"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
