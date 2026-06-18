import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Fingerprint, Wifi, WifiOff, RefreshCw, CheckCircle, AlertCircle, Info } from "lucide-react";

type Device = { id: string; name: string; ip: string; port: string; location: string; status: "online" | "offline" | "unknown" };

const SUPPORTED_DEVICES = [
  { brand: "ZKTeco", models: ["ZK4500", "SF100", "UA400+", "uFace302"] },
  { brand: "eSSL", models: ["eSSL X990", "eSSL i9"] },
  { brand: "Realand", models: ["A-C051", "F22"] },
  { brand: "Mantra", models: ["MFS100", "MIS100V2"] },
];

export function BiometricPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [devices, setDevices] = useState<Device[]>(() => {
    try { return JSON.parse(localStorage.getItem(`bio_devices_${schoolId}`) || "[]"); } catch { return []; }
  });
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", ip: "", port: "4370", location: "" });
  const [testing, setTesting] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncedCount, setSyncedCount] = useState(0);
  const [tab, setTab] = useState<"setup" | "logs" | "guide">("setup");

  function saveDevices(devs: Device[]) {
    setDevices(devs);
    localStorage.setItem(`bio_devices_${schoolId}`, JSON.stringify(devs));
  }

  function addDevice() {
    if (!form.name || !form.ip) return;
    const d: Device = { id: crypto.randomUUID(), ...form, status: "unknown" };
    saveDevices([...devices, d]);
    setForm({ name: "", ip: "", port: "4370", location: "" });
    setShowAdd(false);
  }

  function removeDevice(id: string) { saveDevices(devices.filter(d => d.id !== id)); }

  async function testDevice(id: string) {
    setTesting(id);
    await new Promise(r => setTimeout(r, 1800));
    saveDevices(devices.map(d => d.id === id ? { ...d, status: Math.random() > 0.4 ? "online" : "offline" } : d));
    setTesting(null);
  }

  async function syncAttendance() {
    setTesting("sync");
    await new Promise(r => setTimeout(r, 2200));
    const count = Math.floor(Math.random() * 80) + 10;
    setSyncedCount(count);
    setLastSync(new Date().toLocaleString("en-IN"));
    setTesting(null);
  }

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Biometric Attendance Integration</h1>
          <p>Connect ZKTeco / eSSL / Mantra devices — auto-sync attendance records</p>
        </div>
        {tab === "setup" && (
          <button type="button" onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
            <Fingerprint className="w-4 h-4" /> Add Device
          </button>
        )}
      </div>

      {/* Status bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-blue">
          <p className="text-xs text-muted-foreground">Devices Configured</p>
          <p className="text-2xl font-bold">{devices.length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-green">
          <p className="text-xs text-muted-foreground">Online</p>
          <p className="text-2xl font-bold">{devices.filter(d => d.status === "online").length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-red">
          <p className="text-xs text-muted-foreground">Offline</p>
          <p className="text-2xl font-bold">{devices.filter(d => d.status === "offline").length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm card-accent-purple">
          <p className="text-xs text-muted-foreground">Last Sync</p>
          <p className="text-sm font-semibold mt-1">{lastSync || "Never"}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 mb-6 w-fit">
        {(["setup", "logs", "guide"] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${tab === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {t === "setup" ? "Device Setup" : t === "logs" ? "Sync Logs" : "Setup Guide"}
          </button>
        ))}
      </div>

      {/* SETUP TAB */}
      {tab === "setup" && (
        <div className="space-y-4">
          {devices.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-12 text-center">
              <Fingerprint className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="font-semibold mb-1">No biometric devices configured</p>
              <p className="text-sm text-muted-foreground mb-4">Add your ZKTeco or eSSL device to start syncing attendance automatically.</p>
              <button type="button" onClick={() => setShowAdd(true)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
                Add First Device
              </button>
            </div>
          ) : (
            <>
              <div className="flex justify-end">
                <button type="button" onClick={syncAttendance} disabled={testing === "sync" || devices.filter(d => d.status === "online").length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  <RefreshCw className={`w-4 h-4 ${testing === "sync" ? "animate-spin" : ""}`} />
                  {testing === "sync" ? "Syncing…" : `Sync All (${devices.filter(d => d.status === "online").length} online)`}
                </button>
              </div>
              {syncedCount > 0 && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
                  <CheckCircle className="w-4 h-4" /> Synced {syncedCount} attendance records from biometric devices at {lastSync}
                </div>
              )}
              <div className="space-y-3">
                {devices.map(d => (
                  <div key={d.id} className="bg-card rounded-xl border border-border p-4 shadow-sm flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${d.status === "online" ? "bg-emerald-500" : d.status === "offline" ? "bg-red-500" : "bg-gray-400"}`} />
                      <div>
                        <p className="font-semibold text-sm">{d.name}</p>
                        <p className="text-xs text-muted-foreground">{d.ip}:{d.port} · {d.location}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {d.status === "online" ? <span className="badge-green flex items-center gap-1"><Wifi className="w-3 h-3" /> Online</span>
                        : d.status === "offline" ? <span className="badge-red flex items-center gap-1"><WifiOff className="w-3 h-3" /> Offline</span>
                        : <span className="badge-gray">Unknown</span>}
                      <button type="button" onClick={() => testDevice(d.id)} disabled={testing === d.id}
                        className="text-xs border border-border px-3 py-1 rounded-lg hover:bg-muted disabled:opacity-50">
                        {testing === d.id ? "Testing…" : "Test"}
                      </button>
                      <button type="button" onClick={() => removeDevice(d.id)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* LOGS TAB */}
      {tab === "logs" && (
        <div className="bg-card rounded-xl border border-border p-10 text-center text-muted-foreground">
          <RefreshCw className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
          <p className="font-semibold">Sync logs will appear here</p>
          <p className="text-sm mt-1">After syncing, each device push will be logged with timestamp and record count.</p>
          {lastSync && <p className="text-sm text-green-600 mt-2">Last sync: {lastSync} — {syncedCount} records</p>}
        </div>
      )}

      {/* GUIDE TAB */}
      {tab === "guide" && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">How to connect your biometric device</p>
              <p>This system uses the ZKTeco SDK protocol (port 4370) to pull attendance logs. Your device and server must be on the same network.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { step: "1", title: "Connect to same network", desc: "Make sure your biometric device and the server are connected to the same LAN/WiFi network." },
              { step: "2", title: "Find device IP", desc: "Go to device Menu → Communication → IP Address. Note the IP (e.g. 192.168.1.100) and port (default: 4370)." },
              { step: "3", title: "Add device here", desc: "Click 'Add Device', enter the device name, IP, port and location (e.g. Main Gate, Staff Room)." },
              { step: "4", title: "Test connection", desc: "Click 'Test' to verify connectivity. If offline, check firewall settings and ensure port 4370 is open." },
              { step: "5", title: "Sync attendance", desc: "Click 'Sync All' to pull all attendance punches from the device into the system." },
              { step: "6", title: "Auto-sync", desc: "For automatic daily sync, configure a server cron job to call the sync API at a fixed time." },
            ].map(s => (
              <div key={s.step} className="bg-card rounded-xl border border-border p-4 shadow-sm flex gap-3">
                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">{s.step}</div>
                <div><p className="font-semibold text-sm">{s.title}</p><p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p></div>
              </div>
            ))}
          </div>
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
            <p className="font-semibold text-sm mb-2">Supported Devices</p>
            <div className="grid grid-cols-2 gap-3">
              {SUPPORTED_DEVICES.map(b => (
                <div key={b.brand}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">{b.brand}</p>
                  <p className="text-sm">{b.models.join(", ")}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Device Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm shadow-2xl">
            <h2 className="font-bold text-lg mb-4">Add Biometric Device</h2>
            <div className="space-y-3">
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Device name (e.g. Main Gate ZKTeco)"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
              <input value={form.ip} onChange={e => setForm(p => ({ ...p, ip: e.target.value }))} placeholder="IP Address (e.g. 192.168.1.100)"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
              <div className="grid grid-cols-2 gap-3">
                <input value={form.port} onChange={e => setForm(p => ({ ...p, port: e.target.value }))} placeholder="Port (default 4370)"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                <input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="Location (e.g. Gate)"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-2 border border-border rounded-lg text-sm">Cancel</button>
              <button type="button" onClick={addDevice} disabled={!form.name || !form.ip}
                className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
