import { ReactNode } from "react";
import { TeacherSidebar } from "@/components/teacher-sidebar";
import { GlobalTopbar } from "@/components/global-topbar";

export default async function TeacherLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Dynamic Background Effects (Reduced opacity for better light/dark adaptability) */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px] dark:mix-blend-screen" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px] dark:mix-blend-screen" />
      </div>

      {/* Sidebar - hidden on mobile by default, handled by mobile-menu component in future */}
      <div className="relative z-20 hidden md:flex flex-shrink-0 border-r border-border bg-card">
        <TeacherSidebar tenant={tenant} />
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        <GlobalTopbar />
        <main className="flex-1 overflow-y-auto bg-background/50">
          <div className="mx-auto max-w-7xl p-4 md:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
