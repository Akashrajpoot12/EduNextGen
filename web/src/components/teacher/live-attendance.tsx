"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useTenant } from "@/app/(platform)/[tenant]/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity } from "lucide-react"

type AttendanceRecord = {
  id: string;
  student_id: string;
  status: string;
  date: string;
}

export function LiveAttendance() {
  const [recentScans, setRecentScans] = useState<AttendanceRecord[]>([])
  const [presentCount, setPresentCount] = useState(0)
  const supabase = createClient()
  const { tenantId } = useTenant()

  useEffect(() => {
    if (!tenantId) return;

    const today = new Date().toISOString().split('T')[0];

    // Initial fetch of today's attendance count and recent logs
    const fetchInitial = async () => {
      const { data, count } = await supabase
        .from('daily_attendance')
        .select('*', { count: 'exact' })
        .eq('school_id', tenantId)
        .eq('date', today)
        .order('created_at', { ascending: false })
        .limit(5);

      if (data) setRecentScans(data);
      if (count !== null) setPresentCount(count);
    };

    fetchInitial();

    // Supabase Realtime Subscription Listener
    // Instantly intercepts PostgreSQL INSERT events triggered by the biometric scanners
    const channel = supabase
      .channel('live-attendance-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'daily_attendance',
          filter: `school_id=eq.${tenantId}`,
        },
        (payload) => {
          console.log('Realtime Payload received!', payload)
          const newRecord = payload.new as AttendanceRecord;
          if (newRecord.date === today) {
            setPresentCount((prev) => prev + 1);
            setRecentScans((prev) => [newRecord, ...prev].slice(0, 5));
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tenantId, supabase])

  return (
    <Card className="col-span-3 border-green-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2 bg-green-50/50">
        <CardTitle className="text-lg font-bold text-green-700 flex items-center gap-2">
          <Activity className="w-5 h-5 animate-pulse text-green-600" /> Live Biometric Scans
        </CardTitle>
        <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold uppercase tracking-wider">
          System Active
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="mb-4">
          <p className="text-4xl font-black text-slate-900">{presentCount} <span className="text-sm font-medium text-slate-500">students present today</span></p>
        </div>
        
        <div className="space-y-3 mt-6">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Access Grants</h4>
          {recentScans.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No scans recorded yet today.</p>
          ) : (
            recentScans.map((scan, i) => (
              <div key={scan.id || i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                  <p className="text-sm font-medium text-slate-700">Student ID: {scan.student_id.substring(0, 8).toUpperCase()}</p>
                </div>
                <p className="text-xs text-slate-400 font-medium tracking-wide">Just now</p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
