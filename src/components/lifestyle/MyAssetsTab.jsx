import { useState } from "react";
import { cn } from "@/lib/utils";
import AssetCard from "./AssetCard";
import PropertyCard from "./PropertyCard";
import GarageCard from "./GarageCard";
import ClothingCard from "./ClothingCard";
import { Package, Home, Car, Star, MapPin } from "lucide-react";

const ASSET_GROUPS = [
  { id: "real_estate", label: "Properties",  icon: Home,    categories: ["real_estate"] },
  { id: "vehicle",     label: "Garage",       icon: Car,     categories: ["vehicle"] },
  { id: "other",       label: "Collection",   icon: Star,    categories: ["clothing", "extras", "lifestyle", "event", "charity"] },
];

function formatSTC(v) {
  if (!v) return "0";
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toLocaleString();
}

export default function MyAssetsTab({ purchases, items, playerStc, onUpgraded, onCancelRent, onResidenceChanged }) {
  const [activeGroup, setActiveGroup] = useState("real_estate");

  if (purchases.length === 0) {
    return (
      <div className="text-center py-20">
        <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground/20" />
        <p className="text-muted-foreground text-sm">No assets owned yet.</p>
        <p className="text-xs text-muted-foreground mt-1">Head to the Store and start building your empire!</p>
      </div>
    );
  }

  const currentGroup = ASSET_GROUPS.find(g => g.id === activeGroup);
  const filtered = purchases.filter(p => currentGroup?.categories.includes(p.item_category));

  const totalValue = purchases.reduce((s, p) => s + (p.current_value_stc || p.price_paid_stc || 0), 0);
  const weeklyMaintenance = purchases.reduce((s, p) => s + (p.weekly_maintenance_stc || 0), 0);
  const defaultedCount = purchases.filter(p => p.is_defaulted).length;

  return (
    <div className="space-y-6">
      {/* Current Residence Banner */}
      {(() => {
        const residence = purchases.find(p => p.is_residence === true);
        if (!residence) return (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 border border-primary/30">
            <Home className="w-4 h-4 text-primary shrink-0" />
            <div>
              <p className="text-xs font-bold text-primary">No active residence</p>
              <p className="text-[11px] text-muted-foreground">Set a property as your residence from the store or below.</p>
            </div>
          </div>
        );
        return (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 border border-primary/30">
            <Home className="w-4 h-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-primary uppercase tracking-wider font-bold">Active Residence</p>
              <p className="text-sm font-bold text-foreground truncate">{residence.item_name}{residence.location_city ? ` · ${residence.location_emoji} ${residence.location_city}` : ""}</p>
              <p className="text-[10px] text-muted-foreground capitalize">{residence.purchase_type === "rent" ? "Renting" : "Owned"}</p>
            </div>
          </div>
        );
      })()}

      {/* Portfolio summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="font-heading text-2xl font-black text-foreground">{purchases.length}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Assets</p>
        </div>
        <div className="bg-card border border-success/20 rounded-xl p-3 text-center">
          <p className="font-heading text-2xl font-black text-success">{formatSTC(totalValue)}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Total Value</p>
        </div>
        <div className={cn("bg-card border rounded-xl p-3 text-center", weeklyMaintenance > 0 ? "border-warning/20" : "border-border")}>
          <p className={cn("font-heading text-2xl font-black", weeklyMaintenance > 0 ? "text-warning" : "text-muted-foreground")}>
            {weeklyMaintenance > 0 ? formatSTC(weeklyMaintenance) : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Weekly Cost</p>
        </div>
      </div>

      {/* Defaulted warning */}
      {defaultedCount > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/30">
          <span className="text-lg shrink-0">⚠️</span>
          <div>
            <p className="text-sm font-bold text-destructive">{defaultedCount} asset{defaultedCount > 1 ? "s" : ""} in default</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              You missed maintenance payments. Top up your STC and the next automated run will restore them.
            </p>
          </div>
        </div>
      )}

      {/* Group tabs */}
      <div className="flex gap-2">
        {ASSET_GROUPS.map(g => {
          const count = purchases.filter(p => g.categories.includes(p.item_category)).length;
          if (count === 0) return null;
          return (
            <button
              key={g.id}
              onClick={() => setActiveGroup(g.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all",
                activeGroup === g.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary text-muted-foreground border-border hover:border-primary/30"
              )}
            >
              <g.icon className="w-3.5 h-3.5" />
              {g.label}
              <span className={cn("px-1.5 py-0.5 rounded-full text-[10px]",
                activeGroup === g.id ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Asset list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No assets in this category yet.</p>
        </div>
      ) : activeGroup === "real_estate" ? (
        /* Properties — city-grouped layout */
        (() => {
          const cities = [...new Set(filtered.map(p => p.location_city || "Unknown Location"))];
          return (
            <div className="space-y-6">
              {cities.map(city => {
                const cityPurchases = filtered.filter(p => (p.location_city || "Unknown Location") === city);
                return (
                  <div key={city}>
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className="w-3.5 h-3.5 text-primary" />
                      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{city}</h3>
                      <div className="flex-1 h-px bg-border/50" />
                      <span className="text-[10px] text-muted-foreground">{cityPurchases.length} propert{cityPurchases.length > 1 ? "ies" : "y"}</span>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {cityPurchases.map(purchase => {
                        const item = items.find(i => i.id === purchase.item_id);
                        return (
                          <PropertyCard
                            key={purchase.id}
                            purchase={purchase}
                            item={item}
                            playerStc={playerStc}
                            onUpgraded={(id, data) => onUpgraded?.(id, data)}
                            onCancelRent={(id) => onCancelRent?.(id)}
                            onResidenceChanged={onResidenceChanged}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()
      ) : activeGroup === "vehicle" ? (
        /* Garage — grid layout */
        <div className="grid sm:grid-cols-2 gap-4">
          {filtered.map(purchase => {
            const item = items.find(i => i.id === purchase.item_id);
            return (
              <GarageCard
                key={purchase.id}
                purchase={purchase}
                item={item}
                playerStc={playerStc}
                onUpgraded={(id, data) => onUpgraded?.(id, data)}
                onCancelRent={(id) => onCancelRent?.(id)}
              />
            );
          })}
        </div>
      ) : (
        /* Other items — clothing and collections */
        <div className="grid sm:grid-cols-2 gap-4">
          {filtered.map(purchase => {
            const item = items.find(i => i.id === purchase.item_id);
            return item?.category === "clothing" ? (
              <ClothingCard
                key={purchase.id}
                purchase={purchase}
                item={item}
              />
            ) : (
              <AssetCard
                key={purchase.id}
                purchase={purchase}
                item={item}
                playerStc={playerStc}
                onUpgraded={(purchaseId, data) => onUpgraded?.(purchaseId, data)}
                onCancelRent={(purchaseId) => onCancelRent?.(purchaseId)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}