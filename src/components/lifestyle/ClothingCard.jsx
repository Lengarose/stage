import { useState } from "react";
import { stageClient } from "@/api/stageClient";
import { cn } from "@/lib/utils";
import { LIFESTYLE_TIER_STYLES } from "@/lib/lifestyleItems";
import { TrendingUp } from "lucide-react";

function formatSTC(v) {
  if (!v && v !== 0) return "—";
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B STC`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M STC`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K STC`;
  return `${v.toLocaleString()} STC`;
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const CLOTHING_IMAGES = {
  "Designer Outfit": "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=600&q=80",
  "Custom Boots": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80",
  "Luxury Brand Collection": "https://images.unsplash.com/photo-1556821552-5f394c4f85b9?w=600&q=80",
  "Exclusive Drops": "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=600&q=80",
};
const FALLBACK = "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=600&q=80";

export default function ClothingCard({ purchase, item }) {
  const [notification, setNotification] = useState(null);

  const tierStyle = LIFESTYLE_TIER_STYLES[item?.tier || purchase.item_tier] || LIFESTYLE_TIER_STYLES.starter;
  const basePrice = purchase.price_paid_stc || 0;
  const imgUrl = CLOTHING_IMAGES[item?.name || purchase.item_name] || FALLBACK;
  const displayName = purchase.custom_name || purchase.item_name || item?.name || "Clothing";
  const passiveIncome = item?.passive_income_stc || 0;
  const passiveInterval = item?.passive_income_interval_days || 0;

  function showNotif(msg, type) {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  }

  return (
    <div className={cn("border rounded-2xl overflow-hidden transition-all", tierStyle.bg)}>
      {/* Image banner */}
      <div className="relative h-36 overflow-hidden">
        <img src={imgUrl} alt={displayName} className="w-full h-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Left: name */}
        <div className="absolute bottom-3 left-3 right-3">
          <p className="text-white font-bold text-sm drop-shadow">{displayName}</p>
          <p className="text-xs text-white/70 mt-0.5">{item?.subcategory || "Clothing"}</p>
        </div>

        {/* Right: tier badge */}
        <div className={cn("absolute top-3 right-3 text-[10px] font-bold px-2 py-1 rounded-full uppercase border backdrop-blur-sm", tierStyle.bg, tierStyle.color)}>
          {tierStyle.label}
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={cn("px-4 py-2 text-xs font-medium border-b",
          notification.type === "success" ? "bg-success/15 text-success border-success/20" : "bg-destructive/15 text-destructive border-destructive/20"
        )}>{notification.msg}</div>
      )}

      <div className="p-4 space-y-3">
        {/* Key data grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            { label: "Base Price", value: formatSTC(basePrice), color: "text-foreground" },
            { label: "Acquired", value: formatDate(purchase.created_date), color: "text-muted-foreground" },
            ...(passiveIncome > 0 ? [{ label: "Revenue", value: formatSTC(passiveIncome), color: "text-success" }] : []),
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-black/15 rounded-xl px-3 py-2 text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
              <p className={cn("text-xs font-bold mt-0.5 truncate", color)}>{value}</p>
            </div>
          ))}
        </div>

        {/* Revenue info */}
        {passiveIncome > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-success/10 border border-success/20 text-xs">
            <TrendingUp className="w-3 h-3 text-success shrink-0" />
            <span className="text-success font-semibold">+{formatSTC(passiveIncome)} every {passiveInterval}d from fan sales</span>
          </div>
        )}

        {/* Description */}
        {item?.description && (
          <p className="text-xs text-muted-foreground italic">{item.description}</p>
        )}
      </div>
    </div>
  );
}