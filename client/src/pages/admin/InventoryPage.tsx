// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Search, PackageOpen, Plus, Settings2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function InventoryPage() {
  const params = useParams();
  const tenant = params.tenantId as string;
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [schoolId, setSchoolId] = useState("");
  
  // Form State
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [location, setLocation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchInitialData();
  }, [tenant]);

  async function fetchInitialData() {
    setLoading(true);
    try {
      const { data: school } = await supabase
        .from('schools')
        .select('id')
        .eq('subdomain', tenant)
        .single();

      if (!school) return;
      setSchoolId(school.id);

      fetchInventory(school.id);
    } catch (error) {
      console.error("Error fetching initial data:", error);
      setLoading(false);
    }
  }

  async function fetchInventory(sId: string) {
    try {
      const { data } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('school_id', sId)
        .order('created_at', { ascending: false });

      if (data) setItems(data);
    } catch (error) {
      console.error("Error fetching inventory:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase.from('inventory_items').insert({
        school_id: schoolId,
        item_name: itemName,
        category,
        quantity: parseInt(quantity),
        unit_price: unitPrice ? parseFloat(unitPrice) : null,
        location,
      });

      if (error) throw error;
      
      setItemName("");
      setCategory("");
      setQuantity("");
      setUnitPrice("");
      setLocation("");
      setIsDialogOpen(false);
      fetchInventory(schoolId);
      
    } catch (error: any) {
      console.error("Error adding item:", error);
      alert(`Failed to add item: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'good_condition') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (status === 'needs_repair') return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-red-400 bg-red-500/10 border-red-500/20';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Asset Inventory</h1>
          <p className="text-sm text-slate-400 mt-1">Manage school equipment, furniture, and supplies.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" />}>
            <Plus className="w-4 h-4 mr-2" /> Add Item
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-white/10 text-white sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Asset</DialogTitle>
              <DialogDescription className="text-slate-400">
                Record a new item in the school's inventory system.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddItem} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="itemName">Item Name</Label>
                  <Input 
                    id="itemName" 
                    value={itemName} 
                    onChange={(e) => setItemName(e.target.value)} 
                    placeholder="e.g. Dell Monitor"
                    required 
                    className="bg-slate-950 border-white/10 text-white" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={category} onValueChange={setCategory} required>
                    <SelectTrigger className="bg-slate-950 border-white/10 text-white">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 text-white">
                      <SelectItem value="Electronics">Electronics</SelectItem>
                      <SelectItem value="Furniture">Furniture</SelectItem>
                      <SelectItem value="Stationery">Stationery</SelectItem>
                      <SelectItem value="Lab_Equipment">Lab Equipment</SelectItem>
                      <SelectItem value="Sports">Sports Gear</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input 
                    id="quantity" 
                    type="number"
                    min="1"
                    value={quantity} 
                    onChange={(e) => setQuantity(e.target.value)} 
                    required 
                    className="bg-slate-950 border-white/10 text-white" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unitPrice">Unit Price (₹)</Label>
                  <Input 
                    id="unitPrice" 
                    type="number"
                    step="0.01"
                    value={unitPrice} 
                    onChange={(e) => setUnitPrice(e.target.value)} 
                    placeholder="e.g. 1500.00"
                    className="bg-slate-950 border-white/10 text-white" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location / Room</Label>
                <Input 
                  id="location" 
                  value={location} 
                  onChange={(e) => setLocation(e.target.value)} 
                  placeholder="e.g. Computer Lab 1"
                  required 
                  className="bg-slate-950 border-white/10 text-white" 
                />
              </div>
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={isSubmitting} className="bg-emerald-500 hover:bg-emerald-600 text-white w-full">
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PackageOpen className="w-4 h-4 mr-2" />}
                  Save Asset
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input placeholder="Search inventory items..." className="pl-9 bg-slate-900/50 border-white/10 text-white" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" />
        </div>
      ) : items.length === 0 ? (
        <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-white/5">
              <PackageOpen className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No items in inventory</h3>
            <p className="text-slate-400 mb-6 max-w-sm">Start tracking school assets like computers, desks, and supplies.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="text-xs uppercase bg-slate-950/80 text-slate-400 border-b border-white/5">
                <tr>
                  <th className="px-6 py-4">Item Name</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4 text-center">Qty</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {items.map((item) => (
                    <motion.tr 
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-white">{item.item_name}</td>
                      <td className="px-6 py-4 text-slate-400">{item.category.replace('_', ' ')}</td>
                      <td className="px-6 py-4 text-slate-400">{item.location}</td>
                      <td className="px-6 py-4 text-center font-bold text-emerald-400">{item.quantity}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold border ${getStatusColor(item.status)}`}>
                          {item.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10">
                          <Settings2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
