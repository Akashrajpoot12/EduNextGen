import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BookOpen, DollarSign } from "lucide-react";
import { CsvUploader } from "@/components/admin/csv-uploader";

export default async function SchoolAdminDashboard({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
      <p className="text-muted-foreground">Manage <span className="uppercase text-primary font-semibold">{tenant}</span>'s core operations.</p>
      
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,240</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Active Classes</CardTitle>
            <BookOpen className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">42</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Pending Fees</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$12,450</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Migrations */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <CsvUploader />
        
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Enrollments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">A table of recently enrolled students will be rendered here.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
