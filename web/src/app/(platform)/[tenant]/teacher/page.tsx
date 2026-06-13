import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Users, BookMarked } from "lucide-react";
import { LiveAttendance } from "@/components/teacher/live-attendance";

export default function TeacherPortal() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Teacher Portal</h1>
      <p className="text-muted-foreground">Manage your classes, students, and attendance.</p>
      
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Assigned Classes</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Pending Assignments</CardTitle>
            <BookMarked className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
          </CardContent>
        </Card>

      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Integrating the Supabase WebSockets Live Biometric Component */}
        <div className="col-span-4">
          <LiveAttendance />
        </div>
        
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>My Daily Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Class timetable interface will be rendered here.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
