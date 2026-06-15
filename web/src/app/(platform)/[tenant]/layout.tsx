"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useParams } from "next/navigation";
// import { createClient } from "@/lib/supabase/client"; // Will be added when we set up Supabase SDK

interface TenantContextType {
  tenantId: string | null;
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextType>({
  tenantId: null,
  isLoading: true,
});

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const tenant = params.tenant as string;
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function resolveTenant() {
      // In a real implementation, you would fetch from your Supabase 'schools' table
      // e.g., const { data } = await supabase.from('schools').select('id').eq('subdomain', tenant).single();
      console.log("Resolving tenant:", tenant);
      
      // Mocking successful resolution for scaffolding testing
      setTenantId("mock-uuid-for-" + tenant);
      setIsLoading(false);
    }
    
    if (tenant) {
      resolveTenant();
    }
  }, [tenant]);

  return (
    <TenantContext.Provider value={{ tenantId, isLoading }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}

import { TenantSidebar } from "@/components/tenant-sidebar";
import { GlobalTopbar } from "@/components/global-topbar";

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <TenantSidebar />
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Subtle gradient orb behind main content */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none dark:mix-blend-screen" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none dark:mix-blend-screen" />

          {/* Top navigation / header area */}
          <GlobalTopbar />
          
          {/* Scrollable Main Content */}
          <main className="flex-1 overflow-y-auto bg-background/50">
            <div className="max-w-6xl mx-auto p-4 md:p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </TenantProvider>
  );
}
