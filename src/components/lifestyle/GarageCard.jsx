import { useState } from "react";
import { stageClient } from "@/api/stageClient";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LIFESTYLE_TIER_STYLES } from "@/lib/lifestyleItems";
import { getUpgradesForCategory, calcUpgradeCost, getMaintenanceBreakdown, getMaintenanceLabel } from "@/lib/lifestyleUpgrades";
import {
  ArrowUp, Lock, Zap, AlertTriangle, Wrench,
  ChevronDown, ChevronUp, ReceiptText, CalendarClock, XCircle,
} from "lucide-react";

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

const VEHICLE_IMAGES = {
  "Hatchback":   "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=600&q=80",
  "Sports Car":  "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600&q=80",
  "Supercar":    "https://images.unsplash.com/photo-1621135802920-133df287f89c?w=600&q=80",
  "SUV":         "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=600&q=80",
  "Luxury Bike": "https://media.stageClient.com/images/public/69d77ebfc021efa72e236f84/544a25bcf_92BA6151-5122-43A9-9FB1-E2F019BE4A9D.png",
};
const FALLBACK = "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=600&q=80";

// Plate color per tier
const PLATE_STYLES = {
  starter:  "bg-slate-600 text-white",
  mid:      "bg-blue-700 text-white",
  premium:  "bg-purple-700 text-white",
  luxury:   "bg-yellow-500 text-black",
  elite:    "bg-red-600 text-white",
};

export default function GarageCard({ purchase, item, playerStc, onUpgraded, onCancelRent }) {
  const [showUpgrades, setShowUpgrades] = useState(false);
  const [showMaint, setShowMaint] = useState(false);
  const [upgrading, setUpgrading] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [notification, setNotification] = useState(null);

  const tierStyle = LIFESTYLE_TIER_STYLES[item?.tier || purchase.item_tier] || LIFESTYLE_TIER_STYLES.starter;
  const plateStyle = PLATE_STYLES[item?.tier || purchase.item_tier] || PLATE_STYLES.starter;
  const upgrades = getUpgradesForCategory("vehicle");
  const appliedIds = (purchase.upgrade_slots || []).map(s => s.id);
  const maxLevel = item?.max_upgrade_level || 8;
  const currentLevel = purchase.upgrade_level || 0;
  const isMaxed = currentLevel >= maxLevel;
  const isDefaulted = purchase.is_defaulted;
  const isRental = purchase.purchase_type === "rent";
  const basePrice = purchase.price_paid_stc || 0;
  const currentValue = purchase.current_value_stc || basePrice;
  const weeklyMaint = purchase.weekly_maintenance_stc || 0;
  const maintBreakdown = getMaintenanceBreakdown(basePrice, "vehicle", purchase.item_tier || item?.tier || "starter");
  const rentExpiry = purchase.rent_expiry_at ? new Date(purchase.rent_expiry_at) : null;
  const daysLeft = rentExpiry ? Math.max(0, Math.ceil((rentExpiry - new Date()) / (1000 * 60 * 60 * 24))) : null;
  const imgUrl = VEHICLE_IMAGES[item?.name || purchase.item_name] || FALLBACK;
  const displayName = purchase.custom_name || purchase.item_name || item?.name || "Vehicle";
  const subcategory = purchase.item_subcategory || item?.subcategory || "";

  function showNotif(msg, type) {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  }

  async function handleUpgrade(upgradeId) {
    if (isDefaulted) { showNotif("Asset defaulted — pay overdue maintenance first", "error"); return; }
    setUpgrading(upgradeId);
    try {
      const res = await stageClient.functions.invoke("upgradeLifestyleAsset", { purchase_id: purchase.id, upgrade_id: upgradeId });
      showNotif(`Upgrade applied — Level ${res.data.upgrade_level}`, "success");
      onUpgraded?.(purchase.id, res.data);
    } catch (err) {
      showNotif(err.response?.data?.error || err.message || "Upgrade failed", "error");
    }
    setUpgrading(null);
  }

  async function handleCancelRent() {
    setCancelling(true);
    try {
      await stageClient.entities.LifestylePurchase.update(purchase.id, { rent_active: false });
      showNotif("Rental cancelled.", "success");
      onCancelRent?.(purchase.id);
    } catch (err) {
      showNotif("Failed to cancel rental", "error");
    }
    setCancelling(false);
  }

  return (
    <div className={cn("border rounded-2xl overflow-hidden transition-all", tierStyle.bg, isDefaulted && "border-destructive/50")}>
      {/* Car image with dark overlay */}
      <div className="relative h-40 overflow-hidden bg-black">
        <img src={imgUrl} alt={displayName} className="w-full h-full object-cover opacity-85" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-black/30" />

        {/* Left: name + plate */}
        <div className="absolute bottom-3 left-3">
          <p className="text-white font-heading font-black text-lg uppercase tracking-tight drop-shadow">{displayName}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-white/60 capitalize">{subcategory}</span>
            {/* Mock license plate */}
            <div className={cn("px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border border-white/30", plateStyle)}>
              {(item?.tier || purchase.item_tier || "MID").slice(0, 3).toUpperCase()}-LVL{currentLevel}
            </div>
          </div>
        </div>

        {/* Right: tier badge */}
        <div className={cn("absolute top-3 right-3 text-[10px] font-bold px-2 py-1 rounded-full uppercase border backdrop-blur-sm", tierStyle.bg, tierStyle.color)}>
          {tierStyle.label}
        </div>

        {/* Status badges */}
        {isRental && (
          <div className="absolute top-3 left-3 flex items-center gap-1 bg-primary/90 text-white text-[10px] font-bold px-2 py-1 rounded-full">
            <CalendarClock className="w-2.5 h-2.5" /> Rental
          </div>
        )}
        {isDefaulted && (
          <div className="absolute top-3 left-3 flex items-center gap-1 bg-destructive/90 text-white text-[10px] font-bold px-2 py-1 rounded-full">
            <AlertTriangle className="w-2.5 h-2.5" /> Default
          </div>
        )}
      </div>

      {/* Notification */}
      {notification && (
        <div className={cn("px-4 py-2 text-xs font-medium border-b",
          notification.type === "success" ? "bg-success/15 text-success border-success/20" : "bg-destructive/15 text-destructive border-destructive/20"
        )}>{notification.msg}</div>
      )}

      <div className="p-4 space-y-3">
        {/* Key data grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Type",          value: subcategory || "Vehicle",      color: "text-foreground" },
            { label: "Base Price",    value: formatSTC(basePrice),          color: "text-foreground" },
            { label: "Current Value", value: formatSTC(currentValue),       color: "text-success" },
            { label: "Acquired",      value: formatDate(purchase.created_date), color: "text-muted-foreground" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-black/15 rounded-xl px-3 py-2 text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
              <p className={cn("text-xs font-bold mt-0.5 truncate capitalize", color)}>{value}</p>
            </div>
          ))}
        </div>

        {/* Upgrade level bar */}
        {upgrades.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><Zap className="w-2.5 h-2.5 text-primary" /> Tune Level</span>
              <span>{currentLevel}/{maxLevel} {isMaxed && "— MAX"}</span>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: maxLevel }).map((_, i) => (
                <div key={i} className={cn("h-1.5 flex-1 rounded-full", i < currentLevel ? "bg-primary" : "bg-white/10")} />
              ))}
            </div>
          </div>
        )}

        {/* Weekly maintenance row */}
        {weeklyMaint > 0 && (
          <div className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border text-xs",
            isDefaulted ? "bg-destructive/10 border-destructive/20" : "bg-warning/10 border-warning/20"
          )}>
            <Wrench className={cn("w-3 h-3 shrink-0", isDefaulted ? "text-destructive" : "text-warning")} />
            <span className={cn("font-semibold", isDefaulted ? "text-destructive" : "text-warning")}>{formatSTC(weeklyMaint)}/wk</span>
            <span className="text-muted-foreground">maintenance</span>
            {isDefaulted && <span className="ml-auto text-[10px] font-bold text-destructive">OVERDUE</span>}
          </div>
        )}

        {/* Rental info */}
        {isRental && rentExpiry && (
          <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 text-xs">
              <CalendarClock className="w-3.5 h-3.5 text-primary" />
              <span className="text-primary font-semibold">{daysLeft}d left</span>
              <span className="text-muted-foreground">· expires {rentExpiry.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
            </div>
            <button onClick={handleCancelRent} disabled={cancelling} className="flex items-center gap-1 text-[10px] font-bold text-destructive/70 hover:text-destructive transition-colors">
              {cancelling ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> : <><XCircle className="w-3 h-3" /> Cancel</>}
            </button>
          </div>
        )}

        {/* Maintenance breakdown */}
        {maintBreakdown.length > 0 && (
          <div>
            <button onClick={() => setShowMaint(!showMaint)} className="w-full flex items-center justify-between text-[10px] text-muted-foreground hover:text-foreground transition-colors py-1">
              <span className="flex items-center gap-1 uppercase tracking-wider font-bold"><ReceiptText className="w-3 h-3" /> Cost Breakdown</span>
              {showMaint ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {showMaint && (
              <div className="mt-2 rounded-xl bg-black/20 border border-white/5 overflow-hidden">
                {maintBreakdown.map((line, i) => (
                  <div key={line.id} className={cn("flex items-center justify-between px-3 py-2 text-xs", i > 0 && "border-t border-white/5")}>
                    <span className="flex items-center gap-1.5 text-muted-foreground"><span>{line.emoji}</span>{line.label}</span>
                    <span className={cn("font-semibold", isDefaulted ? "text-destructive" : "text-warning")}>{formatSTC(line.weekly_cost)}/wk</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-2 border-t border-white/10 bg-white/5 text-xs font-bold">
                  <span className="text-foreground">Total Weekly</span>
                  <span className={isDefaulted ? "text-destructive" : "text-warning"}>{formatSTC(weeklyMaint)}/wk</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Upgrade section */}
        {upgrades.length > 0 && !isMaxed && !isDefaulted && (
          <div>
            <button
              onClick={() => setShowUpgrades(!showUpgrades)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 transition-all"
            >
              <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider"><ArrowUp className="w-3 h-3" /> Tune / Upgrade</span>
              {showUpgrades ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {showUpgrades && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {upgrades.map(upg => {
                  const alreadyApplied = appliedIds.includes(upg.id);
                  const cost = calcUpgradeCost(basePrice, upg.base_cost_multiplier, currentLevel);
                  const canAfford = (playerStc || 0) >= cost;
                  return (
                    <div key={upg.id} className={cn("flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all",
                      alreadyApplied ? "bg-success/10 border-success/20" : canAfford ? "bg-secondary/60 border-border hover:border-primary/40" : "bg-secondary/30 border-border/30 opacity-50"
                    )}>
                      <span className="text-base shrink-0">{upg.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-xs font-bold", alreadyApplied ? "text-success" : "text-foreground")}>{upg.label}</p>
                        {!alreadyApplied && <p className="text-[10px] text-muted-foreground">{formatSTC(cost)}</p>}
                      </div>
                      {alreadyApplied ? (
                        <span className="text-success text-xs font-bold">✓</span>
                      ) : (
                        <Button size="sm" disabled={!canAfford || upgrading === upg.id} onClick={() => handleUpgrade(upg.id)}
                          className={cn("h-6 px-2.5 text-[10px] shrink-0", canAfford ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground cursor-not-allowed")}
                        >
                          {upgrading === upg.id ? <div className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" /> : canAfford ? <><ArrowUp className="w-2.5 h-2.5" /> Tune</> : <Lock className="w-2.5 h-2.5" />}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {isMaxed && <div className="text-center text-xs text-warning font-bold py-1">🏎️ Fully Tuned</div>}
      </div>
    </div>
  );
}