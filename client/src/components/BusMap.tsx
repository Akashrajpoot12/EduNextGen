import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
}

export type BusMarker = {
  id: string;
  label: string;          // route name / vehicle number
  lat: number;
  lng: number;
  sub?: string;           // e.g. "28 km/h · 10:42 AM"
  stale?: boolean;        // greyed out when the fix is old
};

/**
 * Lightweight Leaflet map (vanilla, no react-leaflet — React 19 safe).
 * Renders one marker per bus, updates positions in place, and auto-fits bounds.
 * Tiles: OpenStreetMap. Needs a fixed height (handled inline).
 */
export function BusMap({
  buses,
  height = 320,
}: {
  buses: BusMarker[];
  height?: number;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const fittedKeyRef = useRef<string>("");

  // init once
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, { zoomControl: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    map.setView([20.5937, 78.9629], 5); // India default until data arrives
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 120);
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
  }, []);

  // update markers when buses change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const seen = new Set<string>();
    buses.forEach((b) => {
      if (typeof b.lat !== "number" || typeof b.lng !== "number") return;
      seen.add(b.id);
      const color = b.stale ? "#9ca3af" : "#2563eb";
      const html = `
        <div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-6px)">
          <div style="background:${color};border-radius:9999px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 6px rgba(0,0,0,.4)">🚌</div>
          <div style="background:#111827;color:#fff;font-size:10px;line-height:1;padding:2px 5px;border-radius:4px;margin-top:3px;white-space:nowrap">${esc(b.label)}</div>
        </div>`;
      const icon = L.divIcon({ html, className: "", iconSize: [30, 42], iconAnchor: [15, 21] });

      let m = markersRef.current[b.id];
      if (m) {
        m.setLatLng([b.lat, b.lng]);
        m.setIcon(icon);
      } else {
        m = L.marker([b.lat, b.lng], { icon }).addTo(map);
        markersRef.current[b.id] = m;
      }
      m.bindPopup(`<b>${esc(b.label)}</b>${b.sub ? `<br/>${esc(b.sub)}` : ""}`);
    });

    // drop markers that disappeared
    Object.keys(markersRef.current).forEach((id) => {
      if (!seen.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // Only re-fit the view when the SET of buses changes — not on every position
    // tick (otherwise an admin who zooms/pans gets yanked back each GPS update).
    const key = buses.map((b) => b.id).sort().join(",");
    if (key !== fittedKeyRef.current) {
      fittedKeyRef.current = key;
      const pts = buses
        .filter((b) => typeof b.lat === "number" && typeof b.lng === "number")
        .map((b) => [b.lat, b.lng]) as [number, number][];
      if (pts.length === 1) map.setView(pts[0], 15);
      else if (pts.length > 1) map.fitBounds(L.latLngBounds(pts).pad(0.25));
    }
  }, [buses]);

  return (
    <div
      ref={elRef}
      style={{ height, width: "100%", borderRadius: 12, overflow: "hidden", zIndex: 0 }}
    />
  );
}
