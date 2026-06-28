// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
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
    if (schoolId) fetchTransportData();
  }, [schoolId]);

  async function fetchTransportData() {
    setLoading(true);
    try {
      const { data: routesData } = await supabase
        .from('transport_routes')
        .select(`id, route_name, vehicle_number, driver_name, driver_phone, total_capacity, transport_stops(stop_name, stop_order)`)
        .eq('school_id', schoolId)
        .order('route_name');

      setRoutes((routesData || []).map((r: any) => ({
        ...r,
        stopsText: (r.transport_stops || [])
          .sort((a: any, b: any) => (a.stop_order || 0) - (b.stop_order || 0))
          .map((s: any) => s.stop_name)
          .join(", "),
      })));
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
      // 1. Insert the route (vehicle + driver live on transport_routes — the
      //    canonical table that GPS tracking + the parent app read).
      const { data: routeData, error: rError } = await supabase
        .from('transport_routes')
        .insert({
          school_id: schoolId,
          route_name: routeName,
          vehicle_number: vehicleNum,
          driver_name: driverName,
          driver_phone: driverPhone,
          total_capacity: parseInt(capacity),
        })
        .select('id')
        .single();

      if (rError) throw rError;

      // 2. Insert stops (comma-separated) into transport_stops
      const stopList = stops.split(',').map(s => s.trim()).filter(Boolean);
      if (stopList.length > 0) {
        const { error: sError } = await supabase.from('transport_stops').insert(
          stopList.map((stop_name, i) => ({
            school_id: schoolId, route_id: routeData.id, stop_name, stop_order: i + 1,
          }))
        );
        if (sError) throw sError;
      }
      
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
      toast.error(`Failed to create: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Transport Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage buses, routes, and drivers.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" />}>
              <Plus className="w-4 h-4 mr-2" /> Add Route & Vehicle
            </DialogTrigger>
          <DialogContent className="bg-card border-border text-foreground sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Transport Route</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Register a new school bus and define its route.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateRoute} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="routeName">Route Name</Label>
                <Input id="routeName" value={routeName} onChange={(e) => setRouteName(e.target.value)} placeholder="e.g. Route 1 - City Center" required className="bg-background border-border text-foreground" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stops">Stops (Comma separated)</Label>
                <Input id="stops" value={stops} onChange={(e) => setStops(e.target.value)} placeholder="Station A, Mall B, Main Gate" required className="bg-background border-border text-foreground" />
              </div>
              
              <div className="border-t border-border pt-4 mt-2">
                <h4 className="text-sm font-medium mb-3 text-emerald-400">Vehicle Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vehicleNum">Registration Number</Label>
                    <Input id="vehicleNum" value={vehicleNum} onChange={(e) => setVehicleNum(e.target.value)} placeholder="MH-12-AB-1234" required className="bg-background border-border text-foreground" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capacity">Seating Capacity</Label>
                    <Input id="capacity" type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="40" required className="bg-background border-border text-foreground" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="driverName">Driver Name</Label>
                  <Input id="driverName" value={driverName} onChange={(e) => setDriverName(e.target.value)} required className="bg-background border-border text-foreground" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driverPhone">Driver Phone</Label>
                  <Input id="driverPhone" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} required className="bg-background border-border text-foreground" />
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
        <Card className="bg-card backdrop-blur-xl border-border shadow-xl">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 border border-border">
              <Bus className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">No routes found</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">Add buses and define transport routes to start managing school transport.</p>
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
                <Card className="bg-card backdrop-blur-xl border-border shadow-xl overflow-hidden hover:border-emerald-500/30 transition-all">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-foreground">{route.route_name}</h3>
                        <div className="flex items-center text-emerald-400 text-sm mt-1 font-mono">
                          <Bus className="w-3 h-3 mr-1" /> {route.vehicle_number}
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-muted border border-border text-xs text-muted-foreground flex items-center">
                        <Users className="w-3 h-3 mr-1" /> {route.total_capacity} Seats
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted border border-border">
                        <MapPin className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Stops</p>
                          <p className="text-sm text-muted-foreground">{route.stopsText}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted border border-border">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <span className="text-xs text-muted-foreground font-bold">{route.driver_name?.charAt(0)}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{route.driver_name}</p>
                            <div className="flex items-center text-xs text-muted-foreground">
                              <Phone className="w-3 h-3 mr-1" /> {route.driver_phone}
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
