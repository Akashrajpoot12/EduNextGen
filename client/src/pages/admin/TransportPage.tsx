// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, Bus, MapPin, Users, Phone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function TransportPage() {
  const { tenantId: schoolId } = useTenant();
  const [routes, setRoutes] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Form State
  const [routeName, setRouteName] = useState("");
  const [stops, setStops] = useState("");
  const [vehicleNum, setVehicleNum] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [capacity, setCapacity] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchTransportData();
  }, [tenant]);

  async function fetchTransportData() {
    setLoading(true);
    try {
      const { data: school } = await supabase
        .from('schools')
        .select('id')
        .eq('subdomain', tenant)
        .single();

      if (!school) return;
      setSchoolId(school.id);

      const { data: routesData } = await supabase
        .from('routes')
        .select(`
          id, route_name, stops,
          vehicles(vehicle_number, driver_name, driver_phone, capacity)
        `)
        .eq('school_id', school.id);

      if (routesData) setRoutes(routesData);
    } catch (error) {
      console.error("Error fetching transport data:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // 1. Insert vehicle first
      const { data: vehicleData, error: vError } = await supabase
        .from('vehicles')
        .insert({
          school_id: schoolId,
          vehicle_number: vehicleNum,
          driver_name: driverName,
          driver_phone: driverPhone,
          capacity: parseInt(capacity)
        })
        .select('id')
        .single();

      if (vError) throw vError;
      
      // 2. Insert route linked to vehicle
      const { error: rError } = await supabase
        .from('routes')
        .insert({
          school_id: schoolId,
          vehicle_id: vehicleData.id,
          route_name: routeName,
          stops: stops
        });

      if (rError) throw rError;
      
      setRouteName("");
      setStops("");
      setVehicleNum("");
      setDriverName("");
      setDriverPhone("");
      setCapacity("");
      setIsDialogOpen(false);
      fetchTransportData();
      
    } catch (error: any) {
      console.error("Error creating route:", error);
      alert(`Failed to create: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Transport Manager</h1>
          <p className="text-sm text-slate-400 mt-1">Manage buses, routes, and drivers.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" />}>
              <Plus className="w-4 h-4 mr-2" /> Add Route & Vehicle
            </DialogTrigger>
          <DialogContent className="bg-slate-900 border-white/10 text-white sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Transport Route</DialogTitle>
              <DialogDescription className="text-slate-400">
                Register a new school bus and define its route.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateRoute} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="routeName">Route Name</Label>
                <Input id="routeName" value={routeName} onChange={(e) => setRouteName(e.target.value)} placeholder="e.g. Route 1 - City Center" required className="bg-slate-950 border-white/10 text-white" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stops">Stops (Comma separated)</Label>
                <Input id="stops" value={stops} onChange={(e) => setStops(e.target.value)} placeholder="Station A, Mall B, Main Gate" required className="bg-slate-950 border-white/10 text-white" />
              </div>
              
              <div className="border-t border-white/10 pt-4 mt-2">
                <h4 className="text-sm font-medium mb-3 text-emerald-400">Vehicle Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vehicleNum">Registration Number</Label>
                    <Input id="vehicleNum" value={vehicleNum} onChange={(e) => setVehicleNum(e.target.value)} placeholder="MH-12-AB-1234" required className="bg-slate-950 border-white/10 text-white" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capacity">Seating Capacity</Label>
                    <Input id="capacity" type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="40" required className="bg-slate-950 border-white/10 text-white" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="driverName">Driver Name</Label>
                  <Input id="driverName" value={driverName} onChange={(e) => setDriverName(e.target.value)} required className="bg-slate-950 border-white/10 text-white" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driverPhone">Driver Phone</Label>
                  <Input id="driverPhone" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} required className="bg-slate-950 border-white/10 text-white" />
                </div>
              </div>
              
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={isSubmitting} className="bg-emerald-500 hover:bg-emerald-600 text-white w-full">
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bus className="w-4 h-4 mr-2" />}
                  Save Route & Vehicle
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" />
        </div>
      ) : routes.length === 0 ? (
        <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-white/5">
              <Bus className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No routes found</h3>
            <p className="text-slate-400 mb-6 max-w-sm">Add buses and define transport routes to start managing school transport.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <AnimatePresence>
            {routes.map((route, idx) => (
              <motion.div
                key={route.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden hover:border-emerald-500/30 transition-all">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-white">{route.route_name}</h3>
                        <div className="flex items-center text-emerald-400 text-sm mt-1 font-mono">
                          <Bus className="w-3 h-3 mr-1" /> {route.vehicles?.vehicle_number}
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-slate-800 border border-white/10 text-xs text-slate-300 flex items-center">
                        <Users className="w-3 h-3 mr-1" /> {route.vehicles?.capacity} Seats
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-950/50 border border-white/5">
                        <MapPin className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Stops</p>
                          <p className="text-sm text-slate-300">{route.stops}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/50 border border-white/5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
                            <span className="text-xs text-slate-400 font-bold">{route.vehicles?.driver_name?.charAt(0)}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{route.vehicles?.driver_name}</p>
                            <div className="flex items-center text-xs text-slate-400">
                              <Phone className="w-3 h-3 mr-1" /> {route.vehicles?.driver_phone}
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10">Manage</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
