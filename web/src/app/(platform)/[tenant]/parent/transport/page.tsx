"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Bus, MapPin, PhoneCall, Route } from "lucide-react";
import { motion } from "framer-motion";

export default function ParentTransportPage() {
  const params = useParams();
  const tenant = params.tenant as string;
  const [loading, setLoading] = useState(true);
  const [transportData, setTransportData] = useState<any[]>([]);

  const supabase = createClient();

  useEffect(() => {
    fetchTransport();
  }, [tenant]);

  async function fetchTransport() {
    setLoading(true);
    try {
      const { data: school } = await supabase
        .from('schools')
        .select('id')
        .eq('subdomain', tenant)
        .single();

      if (!school) return;

      const { data } = await supabase
        .from('transport_vehicles')
        .select('*')
        .eq('school_id', school.id)
        .limit(1);

      if (data) setTransportData(data);
    } catch (error) {
      console.error("Error fetching transport:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Transport Tracker</h1>
          <p className="text-sm text-slate-400 mt-1">Live status of your child's assigned school bus.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500/50" />
        </div>
      ) : transportData.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/50 rounded-xl border border-white/10 shadow-xl">
          <Bus className="w-12 h-12 text-slate-500 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-bold text-white mb-1">No transport assigned</h3>
          <p className="text-slate-400 text-sm">Your child is not currently enrolled in the school transport facility.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1 space-y-6">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden relative">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-500/20 to-transparent rounded-bl-full pointer-events-none" />
                <CardContent className="p-6 relative z-10">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4">
                    <Bus className="w-6 h-6 text-amber-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-1">{transportData[0].vehicle_number}</h3>
                  <p className="text-amber-400 font-medium mb-6">Route: {transportData[0].route_name}</p>
                  
                  <div className="space-y-4">
                    <div className="bg-slate-950/50 p-3 rounded-lg border border-white/5">
                      <p className="text-xs text-slate-500 mb-1">Driver Details</p>
                      <p className="text-sm text-white font-medium">{transportData[0].driver_name}</p>
                      <p className="text-sm text-slate-400 flex items-center mt-1">
                        <PhoneCall className="w-3 h-3 mr-1" /> {transportData[0].driver_phone || 'Not available'}
                      </p>
                    </div>
                    
                    <div className="bg-slate-950/50 p-3 rounded-lg border border-white/5">
                      <p className="text-xs text-slate-500 mb-1">Vehicle Capacity</p>
                      <p className="text-sm text-white font-medium">{transportData[0].capacity} Seats</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
          
          <div className="lg:col-span-2">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="h-full">
              <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl h-full flex flex-col min-h-[400px]">
                <CardContent className="p-0 flex-1 relative overflow-hidden flex items-center justify-center bg-[#050B14]">
                  {/* Simulated Map Background */}
                  <div className="absolute inset-0 opacity-10 bg-[url('https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=2074&auto=format&fit=crop')] bg-cover bg-center grayscale mix-blend-screen" />
                  
                  <div className="relative z-10 text-center">
                    <div className="w-16 h-16 rounded-full bg-slate-800/80 backdrop-blur border border-white/10 flex items-center justify-center mx-auto mb-4 relative">
                      <motion.div 
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="absolute inset-0 rounded-full border-2 border-amber-500"
                      />
                      <MapPin className="w-8 h-8 text-amber-500" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">Live Tracking Offline</h3>
                    <p className="text-slate-400 text-sm max-w-sm mx-auto">GPS tracking will activate automatically when the bus starts its journey for pickup or drop-off.</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      )}
    </div>
  );
}
