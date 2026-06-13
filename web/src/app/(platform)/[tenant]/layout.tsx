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

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider>
      <div className="min-h-screen flex flex-col">
        {/* Placeholder for tenant-specific universal top navigation or sidebar */}
        <header className="bg-slate-900 text-white p-4">
          <div className="container mx-auto">
            Tenant Header - Loaded via Domain Routing
          </div>
        </header>
        <main className="flex-1 container mx-auto p-4">{children}</main>
      </div>
    </TenantProvider>
  );
}
