import { ReactNode } from "react";
import { ParentSidebar } from "@/components/parent-sidebar";
import { GlobalTopbar } from "@/components/global-topbar";

export default async function ParentLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Dynamic Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[128px] dark:mix-blend-screen" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-[128px] dark:mix-blend-screen" />
      </div>

      {/* Sidebar - hidden on mobile by default */}
      <div className="relative z-20 hidden md:flex flex-shrink-0 border-r border-border bg-card">
        <ParentSidebar tenant={tenant} />
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
