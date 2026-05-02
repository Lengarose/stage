import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LIFESTYLE_TIER_STYLES } from "@/lib/lifestyleItems";
import {
  getUpgradesForCategory,
  calcUpgradeCost,
  getMaintenanceBreakdown,
  getMaintenanceLabel,
} from "@/lib/lifestyleUpgrades";
import {
  ArrowUp, Lock, Zap, MapPin, AlertTriangle,
  TrendingUp, ChevronDown, ChevronUp, Wrench, ReceiptText, CalendarClock, XCircle,
} from "lucide-react";

function formatSTC(v) {
  if (!v && v !== 0) return "—";
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B STC`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M STC`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K STC`;
  return `${v.toLocaleString()} STC`;
}

export default function AssetCard({ purchase, item, playerStc, onUpgraded, onCancelRent }) {
  const [showUpgrades, setShowUpgrades] = useState(false);
  const [showMaint, setShowMaint] = useState(false);
  const [upgrading, setUpgrading] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [notification, setNotification] = useState(null);

  const isRental = purchase.purchase_type === 'rent';
  const rentExpiry = purchase.rent_expiry_at ? new Date(purchase.rent_expiry_at) : null;
  const daysLeft = rentExpiry ? Math.max(0, Math.ceil((rentExpiry - new Date()) / (1000 * 60 * 60 * 24))) : null;

  async function handleCancelRent() {
    setCancelling(true);
    try {
      await base44.entities.LifestylePurchase.update(purchase.id, { rent_active: false });
      showNotif("Rental cancelled.", "success");
      onCancelRent?.(purchase.id);
    } catch (err) {
      showNotif("Failed to cancel rental", "error");
    }
    setCancelling(false);
  }

  const tierStyle = LIFESTYLE_TIER_STYLES[item?.tier || purchase.item_tier] || LIFESTYLE_TIER_STYLES.starter;
  const upgrades = getUpgradesForCategory(purchase.item_category);
  const appliedIds = (purchase.upgrade_slots || []).map(s => s.id);
  const maxLevel = item?.max_upgrade_level || 8;
  const currentLevel = purchase.upgrade_level || 0;
  const isMaxed = currentLevel >= maxLevel;
  const isDefaulted = purchase.is_defaulted;
  const basePrice = purchase.price_paid_stc || 0;
  const weeklyMaint = purchase.weekly_maintenance_stc || 0;
  const maintBreakdown = (purchase.item_category === "real_estate" || purchase.item_category === "vehicle")
    ? getMaintenanceBreakdown(basePrice, purchase.item_category, purchase.item_tier || item?.tier || "starter")
    : [];

  function showNotif(msg, type) {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  }

  async function handleUpgrade(upgradeId) {
    if (isDefaulted) {
      showNotif("Asset is defaulted — pay overdue maintenance first", "error");
      return;
    }
    setUpgrading(upgradeId);
    try {
      const res = await base44.functions.invoke("upgradeLifestyleAsset", {
        purchase_id: purchase.id,
        upgrade_id: upgradeId,
      });
      showNotif(`Upgrade applied — now Level ${res.data.upgrade_level}`, "success");
      onUpgraded?.(purchase.id, res.data);
    } catch (err) {
      showNotif(err.response?.data?.error || err.message || "Upgrade failed", "error");
    }
    setUpgrading(null);
  }

  const displayName = purchase.custom_name || purchase.item_name || item?.name || "Asset";
  const currentValue = purchase.current_value_stc || basePrice;

  return (
    <div className={cn(
      "border rounded-2xl overflow-hidden transition-all",
      tierStyle.bg,
      isDefaulted ? "border-destructive/50" : ""
    )}>
      {/* Defaulted banner */}
      {isDefaulted && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-destructive/20 border-b border-destructive/40">
          <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
          <div>
            <p className="text-xs font-bold text-destructive">Asset Defaulted — Missed Maintenance</p>
            <p className="text-[10px] text-destructive/70 mt-0.5">Upgrades are blocked. Top up STC — next cycle will restore this asset.</p>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div className={cn("px-4 py-2 text-xs font-medium border-b",
          notification.type === "success"
            ? "bg-success/15 text-success border-success/20"
            : "bg-destructive/15 text-destructive border-destructive/20"
        )}>
          {notification.msg}
        </div>
      )}

      <div className="p-4 space-y-3">
        {/* ── Header row ── */}
        <div className="flex items-start gap-3">
          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0", isDefaulted ? "bg-destructive/10" : "bg-black/20")}>
            {purchase.item_emoji || item?.emoji || "📦"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-foreground text-sm truncate">{displayName}</p>
              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase", tierStyle.color, "bg-black/20")}>
                {item?.tier || purchase.item_tier}
              </span>
              {isMaxed && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-warning/20 text-warning uppercase">MAX</span>}
              {isDefaulted && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-destructive/20 text-destructive uppercase">DEFAULT</span>}
            </div>

            {purchase.location_city && (
              <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                <MapPin className="w-2.5 h-2.5" />
                <span>{purchase.location_emoji} {purchase.location_city}, {purchase.location_country}</span>
              </div>
            )}
          </div>

          {/* Current Value */}
          <div className="text-right shrink-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Value</p>
            <p className="font-bold text-sm text-foreground">{formatSTC(currentValue)}</p>
          </div>
        </div>

        {/* ── Stats row ── */}
        <div className="flex items-center gap-3 flex-wrap text-xs">
          {upgrades.length > 0 && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Zap className="w-2.5 h-2.5 text-primary" />
              <span>Level {currentLevel}/{maxLevel}</span>
            </div>
          )}
          {weeklyMaint > 0 && (
            <div className={cn("flex items-center gap-1", isDefaulted ? "text-destructive" : "text-warning")}>
              <Wrench className="w-2.5 h-2.5" />
              <span>{getMaintenanceLabel(weeklyMaint)}</span>
            </div>
          )}
          {item?.passive_income_stc > 0 && (
            <div className="flex items-center gap-1 text-success">
              <TrendingUp className="w-2.5 h-2.5" />
              <span>+{formatSTC(item.passive_income_stc)}/{item.passive_income_interval_days}d</span>
            </div>
          )}
        </div>

        {/* ── Rental info row ── */}
        {isRental && (
          <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 text-xs">
              <CalendarClock className="w-3.5 h-3.5 text-primary shrink-0" />
              <div>
                <span className="font-bold text-primary">Rental</span>
                {rentExpiry && (
                  <span className="text-muted-foreground ml-1.5">
                    · {daysLeft}d left (expires {rentExpiry.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })})
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleCancelRent}
              disabled={cancelling}
              className="flex items-center gap-1 text-[10px] font-bold text-destructive/70 hover:text-destructive transition-colors"
            >
              {cancelling
                ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                : <><XCircle className="w-3 h-3" /> Cancel</>}
            </button>
          </div>
        )}

        {/* ── Upgrade level bar ── */}
        {upgrades.length > 0 && (
          <div className="flex gap-1">
            {Array.from({ length: maxLevel }).map((_, i) => (
              <div key={i} className={cn("h-1 flex-1 rounded-full", i < currentLevel ? "bg-primary" : "bg-white/10")} />
            ))}
          </div>
        )}

        {/* ── Maintenance breakdown toggle ── */}
        {maintBreakdown.length > 0 && (
          <div>
            <button
              onClick={() => setShowMaint(!showMaint)}
              className="w-full flex items-center justify-between text-[10px] text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              <span className="flex items-center gap-1 uppercase tracking-wider font-bold">
                <ReceiptText className="w-3 h-3" /> Cost Breakdown
              </span>
              {showMaint ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {showMaint && (
              <div className="mt-2 rounded-xl bg-black/20 border border-white/5 overflow-hidden">
                {maintBreakdown.map((line, i) => (
                  <div key={line.id} className={cn("flex items-center justify-between px-3 py-2 text-xs", i > 0 && "border-t border-white/5")}>
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span>{line.emoji}</span>
                      {line.label}
                    </span>
                    <span className={cn("font-semibold", isDefaulted ? "text-destructive" : "text-warning")}>
                      {formatSTC(line.weekly_cost)}/wk
                    </span>
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

        {/* ── Upgrade section ── */}
        {upgrades.length > 0 && (
          <div>
            <button
              onClick={() => setShowUpgrades(!showUpgrades)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs transition-all",
                isDefaulted
                  ? "bg-destructive/5 border-destructive/20 text-destructive/60 cursor-not-allowed"
                  : isMaxed
                  ? "bg-warning/5 border-warning/20 text-warning cursor-default"
                  : "bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 cursor-pointer"
              )}
              disabled={isDefaulted}
            >
              <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
                <ArrowUp className="w-3 h-3" />
                {isMaxed ? "Fully Upgraded" : isDefaulted ? "Upgrades Blocked" : "Upgrade Asset"}
              </span>
              {!isDefaulted && !isMaxed && (
                showUpgrades ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
              )}
            </button>

            {showUpgrades && !isDefaulted && !isMaxed && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {upgrades.map(upg => {
                  const alreadyApplied = appliedIds.includes(upg.id);
                  const cost = calcUpgradeCost(basePrice, upg.base_cost_multiplier, currentLevel);
                  const canAfford = (playerStc || 0) >= cost;

                  return (
                    <div
                      key={upg.id}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all",
                        alreadyApplied
                          ? "bg-success/10 border-success/20"
                          : canAfford
                          ? "bg-secondary/60 border-border hover:border-primary/40"
                          : "bg-secondary/30 border-border/30 opacity-50"
                      )}
                    >
                      <span className="text-base shrink-0">{upg.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-xs font-bold", alreadyApplied ? "text-success" : "text-foreground")}>{upg.label}</p>
                        {!alreadyApplied && (
                          <p className="text-[10px] text-muted-foreground">{formatSTC(cost)}</p>
                        )}
                      </div>
                      {alreadyApplied ? (
                        <span className="text-success text-xs font-bold shrink-0">✓</span>
                      ) : (
                        <Button
                          size="sm"
                          disabled={!canAfford || upgrading === upg.id}
                          onClick={() => handleUpgrade(upg.id)}
                          className={cn("h-6 px-2.5 text-[10px] shrink-0 gap-0.5",
                            canAfford
                              ? "bg-primary text-primary-foreground hover:bg-primary/90"
                              : "bg-secondary text-muted-foreground cursor-not-allowed"
                          )}
                        >
                          {upgrading === upg.id
                            ? <div className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
                            : canAfford
                            ? <><ArrowUp className="w-2.5 h-2.5" /> Buy</>
                            : <><Lock className="w-2.5 h-2.5" /></>}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}