import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { ChevronLeft, ChevronRight, Plus, Trash2, X } from "lucide-react";

type AcademicEvent = {
  id: string;
  school_id: string;
  title: string;
  description: string;
  event_date: string;
  end_date: string;
  event_type: string;
  color: string;
  is_holiday: boolean;
  created_by: string;
  created_at: string;
};

export function CalendarPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<AcademicEvent[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    event_date: "",
    end_date: "",
    event_type: "other",
    color: "#3B82F6",
    is_holiday: false,
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const startDay = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();

  const PRESET_COLORS = ["#EF4444", "#3B82F6", "#8B5CF6", "#22C55E", "#F59E0B", "#6B7280"];

  const EVENT_TYPE_COLORS: Record<string, string> = {
    holiday: "bg-red-100 text-red-700",
    exam: "bg-blue-100 text-blue-700",
    ptm: "bg-purple-100 text-purple-700",
    sports: "bg-green-100 text-green-700",
    cultural: "bg-amber-100 text-amber-700",
    other: "bg-gray-100 text-gray-700",
  };

  async function fetchEvents() {
    const startStr = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
    const { data } = await supabase
      .from("academic_calendar")
      .select("*")
      .eq("school_id", schoolId)
      .gte("event_date", startStr)
      .lte("event_date", endStr)
      .order("event_date");
    setEvents(data || []);
  }

  useEffect(() => {
    if (schoolId) fetchEvents();
  }, [schoolId, year, month]);

  function getEventsForDay(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return events.filter((e) => e.event_date === dateStr);
  }

  async function handleAddEvent() {
    setLoading(true);
    await supabase.from("academic_calendar").insert({ ...form, school_id: schoolId });
    setLoading(false);
    setShowAddDialog(false);
    setForm({ title: "", description: "", event_date: "", end_date: "", event_type: "other", color: "#3B82F6", is_holiday: false });
    fetchEvents();
  }

  async function handleDeleteEvent(id: string) {
    await supabase.from("academic_calendar").delete().eq("id", id);
    fetchEvents();
  }

  const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : [];
  const monthName = currentDate.toLocaleString("en-IN", { month: "long", year: "numeric" });

  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div><h1>Academic Calendar</h1><p>Manage school events, holidays, exams, and PTMs</p></div>
        <button type="button" onClick={() => setShowAddDialog(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" />Add Event
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <button type="button" title="Previous month" onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-1.5 rounded-lg hover:bg-muted"><ChevronLeft className="w-5 h-5" /></button>
            <h2 className="font-bold text-base">{monthName}</h2>
            <button type="button" title="Next month" onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-1.5 rounded-lg hover:bg-muted"><ChevronRight className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((day, idx) => {
              const dayEvts = day ? getEventsForDay(day) : [];
              const isSelected = day === selectedDay;
              const todayD = new Date();
              const isToday = day === todayD.getDate() && month === todayD.getMonth() && year === todayD.getFullYear();
              return (
                <div key={idx} onClick={() => day && setSelectedDay(day)}
                  className={`min-h-[68px] p-1 rounded-lg border cursor-pointer transition-colors ${!day ? "bg-muted/30 border-transparent" : isSelected ? "bg-primary/10 border-primary/40" : "bg-background border-border hover:bg-muted/30"}`}>
                  {day && (
                    <>
                      <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday ? "bg-primary text-primary-foreground" : "text-foreground"}`}>{day}</div>
                      <div className="space-y-0.5">
                        {dayEvts.slice(0, 2).map(e => <div key={e.id} className="w-full h-1.5 rounded-full" style={{ backgroundColor: e.color }} />)}
                        {dayEvts.length > 2 && <div className="text-[10px] text-muted-foreground">+{dayEvts.length - 2}</div>}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <h3 className="font-semibold mb-3 text-sm">
            {selectedDay ? `${selectedDay} ${monthName}` : "This Month's Events"}
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {(selectedDay ? selectedDayEvents : events).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No events</p>
            ) : (
              (selectedDay ? selectedDayEvents : events).map(e => (
                <div key={e.id} className="flex items-start justify-between p-2.5 rounded-lg border border-border bg-muted/30">
                  <div className="flex items-start gap-2">
                    <div className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: e.color }} />
                    <div>
                      <p className="text-sm font-medium">{e.title}</p>
                      <p className="text-xs text-muted-foreground">{e.event_date}</p>
                      <span className={`text-[10px] mt-0.5 inline-block px-1.5 py-0.5 rounded-full ${EVENT_TYPE_COLORS[e.event_type] || EVENT_TYPE_COLORS.other}`}>{e.event_type}</span>
                    </div>
                  </div>
                  <button type="button" title="Delete event" onClick={() => handleDeleteEvent(e.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showAddDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Add Event</h2>
              <button type="button" title="Close" onClick={() => setShowAddDialog(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Event title *" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
              <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description (optional)" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">Start Date *</label><input required type="date" title="Start date" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">End Date</label><input type="date" title="End date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              </div>
              <select title="Event type" value={form.event_type} onChange={e => setForm({ ...form, event_type: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                {["holiday","exam","ptm","sports","cultural","other"].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
              <div>
                <p className="text-xs text-muted-foreground mb-2">Color</p>
                <div className="flex gap-2">
                  {PRESET_COLORS.map(c => (
                    <button key={c} type="button" title={c} onClick={() => setForm({ ...form, color: c })}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.is_holiday} onChange={e => setForm({ ...form, is_holiday: e.target.checked })} />
                Mark as Holiday (no classes)
              </label>
            </div>
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setShowAddDialog(false)} className="flex-1 py-2 border border-border rounded-lg text-sm">Cancel</button>
              <button type="button" onClick={handleAddEvent} disabled={loading || !form.title || !form.event_date} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">{loading ? "Saving…" : "Add Event"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
