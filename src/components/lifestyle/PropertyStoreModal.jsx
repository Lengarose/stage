import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, Coins, Home, TrendingUp } from "lucide-react";
import { PROPERTY_CITIES } from "@/lib/lifestyleUpgrades";
import { cn } from "@/lib/utils";

function formatSTC(v) {
  if (!v) return "0 STC";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M STC`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K STC`;
  return `${v.toLocaleString()} STC`;
}

const INTENT_CONFIG = {
  buy_live: {
    icon: Home,
    label: "Buy to Live",
    color: "text-primary",
    bg: "bg-primary/10 border-primary/30",
    cta: "Buy & Move In",
    description: "This will become your active residence. You own it and live there.",
  },
  invest: {
    icon: TrendingUp,
    label: "Invest",
    color: "text-warning",
    bg: "bg-warning/10 border-warning/30",
    cta: "Buy as Investment",
    description: "You own this property as an investment. You do not live there — it generates value and passive income.",
  },
};

export default function PropertyStoreModal({ open, onClose, item, intent = "invest", playerStc, onConfirm, purchasing }) {
  const [selectedCity, setSelectedCity] = useState(null);

  if (!item) return null;

  const cfg = INTENT_CONFIG[intent] || INTENT_CONFIG.invest;
  const Icon = cfg.icon;
  const price = item.price_stc;
  const canAfford = playerStc >= price;
  const isProperty = item.category === "real_estate";

  function handleConfirm() {
    onConfirm({
      item,
      intent,
      location_city: selectedCity?.city || "",
      location_country: selectedCity?.country || "",
      location_emoji: selectedCity?.emoji || "",
    });
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-card border-border max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{item.emoji || "🏠"}</span>
            {item.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Intent badge */}
          <div className={cn("flex items-center gap-2 px-4 py-3 rounded-xl border", cfg.bg)}>
            <Icon className={cn("w-4 h-4 shrink-0", cfg.color)} />
            <div className="flex-1 min-w-0">
              <p className={cn("text-sm font-bold", cfg.color)}>{cfg.label}</p>
              <p className="text-xs text-muted-foreground">{cfg.description}</p>
            </div>
          </div>

          {/* Price */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-secondary border border-border">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-warning" />
              <span className="text-sm font-bold text-foreground">{formatSTC(price)}</span>
            </div>
            <span className={cn("text-xs font-semibold", canAfford ? "text-success" : "text-destructive")}>
              {canAfford ? `Balance: ${formatSTC(playerStc)}` : "Insufficient STC"}
            </span>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground">{item.description}</p>

          {/* Maintenance note */}
          {item.weekly_maintenance_stc > 0 && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-warning/10 border border-warning/20">
              <span className="text-sm shrink-0">⚙️</span>
              <p className="text-xs text-warning">
                Weekly maintenance: <strong>{formatSTC(item.weekly_maintenance_stc)}/wk</strong> — automatically deducted from your STC.
              </p>
            </div>
          )}

          {/* City picker (properties only) */}
          {isProperty && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-2 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Choose Location (optional)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {PROPERTY_CITIES.map(city => (
                  <button
                    key={city.id}
                    onClick={() => setSelectedCity(selectedCity?.id === city.id ? null : city)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all text-xs",
                      selectedCity?.id === city.id
                        ? "bg-primary/10 border-primary text-foreground"
                        : "bg-secondary border-border text-muted-foreground hover:border-primary/30"
                    )}
                  >
                    <span className="text-base shrink-0">{city.emoji}</span>
                    <div>
                      <p className="font-bold text-foreground text-xs">{city.city}</p>
                      <p className="text-[10px] text-muted-foreground">{city.country}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Confirm */}
          <Button
            onClick={handleConfirm}
            disabled={!canAfford || purchasing}
            className={cn("w-full gap-2", intent === "buy_live" ? "bg-primary text-primary-foreground" : "bg-warning text-black hover:bg-warning/90")}
          >
            {purchasing
              ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              : <><Icon className="w-4 h-4" /> {cfg.cta} — {formatSTC(price)}</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}