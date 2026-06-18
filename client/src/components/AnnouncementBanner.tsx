import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { X } from "lucide-react";

const supabase = createClient();

type Announcement = {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "urgent";
  target: string;
};

const typeStyles = {
  info:    "bg-blue-500/10 border-blue-500/30 text-blue-300",
  warning: "bg-yellow-500/10 border-yellow-500/30 text-yellow-300",
  success: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
  urgent:  "bg-red-500/10 border-red-500/30 text-red-300",
};

const typeIcons = { info: "ℹ️", warning: "⚠️", success: "✅", urgent: "🚨" };

export function AnnouncementBanner({ subscriptionStatus }: { subscriptionStatus?: string }) {
  const [banners, setBanners]     = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("platform_announcements")
        .select("id, title, message, type, target")
        .eq("is_active", true)
        .lte("starts_at", new Date().toISOString())
        .or("ends_at.is.null,ends_at.gt." + new Date().toISOString());

      if (!data) return;

      const filtered = data.filter(ann => {
        if (ann.target === "all") return true;
        if (ann.target === "trialing" && subscriptionStatus === "trialing") return true;
        if (ann.target === "paid" && subscriptionStatus !== "trialing") return true;
        return false;
      });

      setBanners(filtered);
    })();
  }, [subscriptionStatus]);

  const visible = banners.filter(b => !dismissed.has(b.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {visible.map(ann => (
        <div key={ann.id} className={`flex items-start gap-3 px-4 py-3 rounded-lg border text-sm ${typeStyles[ann.type] || typeStyles.info}`}>
          <span className="text-base flex-shrink-0 mt-0.5">{typeIcons[ann.type] || "ℹ️"}</span>
          <div className="flex-1 min-w-0">
            <span className="font-semibold">{ann.title}</span>
            {" — "}
            <span className="opacity-90">{ann.message}</span>
          </div>
          <button type="button" title="Dismiss" onClick={() => setDismissed(prev => new Set([...prev, ann.id]))}
            className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
