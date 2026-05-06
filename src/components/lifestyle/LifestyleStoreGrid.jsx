import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Check, TrendingUp, Lock, Home, TrendingUp as Invest, CalendarClock, Plus } from "lucide-react";
import { LIFESTYLE_TIER_STYLES } from "@/lib/lifestyleItems";
import { formatSTC } from "@/lib/playerValue";
import PropertyStoreModal from "./PropertyStoreModal";

const ITEM_IMAGES = {
  "Apartment":        "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=500&q=80",
  "City House":       "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=500&q=80",
  "Luxury Villa":     "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=500&q=80",
  "Penthouse":        "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=500&q=80",
  "Airbnb Property":  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=500&q=80",
  "Hatchback":        "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=500&q=80",
  "Sports Car":       "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=500&q=80",
  "Supercar":         "https://images.unsplash.com/photo-1621135802920-133df287f89c?w=500&q=80",
  "SUV":              "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=500&q=80",
  "Luxury Bike":      "https://media.stageClient.com/images/public/69d77ebfc021efa72e236f84/544a25bcf_92BA6151-5122-43A9-9FB1-E2F019BE4A9D.png",
  "Designer Outfit":          "https://media.stageClient.com/images/public/69d77ebfc021efa72e236f84/df5b6d059_photo-output.png",
  "Luxury Brand Collection":  "https://media.stageClient.com/images/public/69d77ebfc021efa72e236f84/5f8bb625d_115052ED-1E2D-4052-BEC1-2D4CAC3B029C.png",
  "Exclusive Drops":          "https://media.stageClient.com/images/public/69d77ebfc021efa72e236f84/246a79d9c_01B57700-2104-494D-B442-B64567C83B15.png",
  "Custom Boots":             "https://media.stageClient.com/images/public/69d77ebfc021efa72e236f84/d92345448_A66E23FA-FAB5-457F-85F6-3DF6953B68C7.png",
  "Pet Dog":      "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=500&q=80",
  "Luxury Watch": "https://media.stageClient.com/images/public/69d77ebfc021efa72e236f84/5b1d94554_photo-output.jpg",
  "Private Jet":  "https://images.unsplash.com/photo-1474302770737-173ee21bab63?w=500&q=80",
  "Yacht":        "https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=500&q=80",
  "Swimming Pool":  "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=500&q=80",
  "Home Gym":       "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=500&q=80",
  "Personal Coach": "https://media.stageClient.com/images/public/69d77ebfc021efa72e236f84/0c7ef5c94_03FB2C32-6EF5-4545-B5D8-C43C26FD7302.png",
  "VIP Party":            "https://media.stageClient.com/images/public/69d77ebfc021efa72e236f84/8af2731af_F4DB93F4-7BF6-43C3-BA01-FDC5E393B180.png",
  "Award Show":           "https://media.stageClient.com/images/public/69d77ebfc021efa72e236f84/d6f024f63_57D3D143-89B0-4B4B-B8E1-E8B18083EC4A.png",
  "Exclusive Experience": "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=500&q=80",
  "Youth Foundation Donation": "https://media.stageClient.com/images/public/69d77ebfc021efa72e236f84/73135f094_photo-output.png",
  "Community Centre":          "https://media.stageClient.com/images/public/69d77ebfc021efa72e236f84/7a11c8e09_photo-output.png",
  "Scholarship Fund":          "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=500&q=80",
};

const CATEGORY_FALLBACKS = {
  real_estate: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=500&q=80",
  vehicle:     "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=500&q=80",
  clothing:    "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=500&q=80",
  extras:      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&q=80",
  lifestyle:   "https://images.unsplash.com/photo-1593079831268-3381b0db4a77?w=500&q=80",
  event:       "https://images.unsplash.com/photo-1505236858219-8359eb29e329?w=500&q=80",
  charity:     "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=500&q=80",
};

function getItemImage(item) {
  return ITEM_IMAGES[item.name] || CATEGORY_FALLBACKS[item.category] || ITEM_IMAGES["Luxury Brand Collection"];
}

// { item, intent } — intent is "buy_live" | "invest"
export default function LifestyleStoreGrid({ items, stc, purchases, purchasing, onBuy, onRent, hasResidence }) {
  const [modal, setModal] = useState(null); // { item, intent }

  function getOwnedInvestCount(itemId) {
    return (purchases || []).filter(p => p.item_id === itemId && ["invest", "buy"].includes(p.purchase_type)).length;
  }
  function getLiveOwned(itemId) {
    return (purchases || []).find(p => p.item_id === itemId && p.purchase_type === "buy_live") || null;
  }
  function getActiveRental(itemId) {
    return (purchases || []).find(p => p.item_id === itemId && p.purchase_type === "rent" && p.rent_active !== false) || null;
  }

  function handlePropertyAction(item, intent) {
    setModal({ item, intent });
  }

  function handleModalConfirm({ item, intent, location_city, location_country, location_emoji }) {
    setModal(null);
    onBuy(item, { location_city, location_country, location_emoji, purchase_intent: intent });
  }

  return (
    <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map(item => {
          const isProperty = item.category === "real_estate";
          const investCount = getOwnedInvestCount(item.id);
          const liveOwned = getLiveOwned(item.id);
          const activeRental = getActiveRental(item.id);

          if (isProperty) {
            return (
              <PropertyItemCard
                key={item.id}
                item={item}
                stc={stc}
                investCount={investCount}
                liveOwned={liveOwned}
                activeRental={activeRental}
                purchasing={purchasing === item.id}
                hasResidence={hasResidence}
                onBuyLive={() => handlePropertyAction(item, "buy_live")}
                onInvest={() => handlePropertyAction(item, "invest")}
                onRent={onRent ? () => onRent(item) : null}
              />
            );
          }

          // Non-property items
          const ownedCount = (purchases || []).filter(p => p.item_id === item.id && p.purchase_type !== "rent").length;
          const activeRentalNonProp = (purchases || []).find(p => p.item_id === item.id && p.purchase_type === "rent" && p.rent_active !== false) || null;
          const isMulti = item.allows_multiple;
          const alreadyOwned = ownedCount > 0;
          const showBlock = alreadyOwned && !isMulti;
          const canAffordBuy = stc >= item.price_stc;
          const canAffordRent = item.can_rent && item.rent_price_stc && stc >= item.rent_price_stc;
          const hasPassive = item.passive_income_stc > 0;
          const imageUrl = getItemImage(item);
          const tierStyle = LIFESTYLE_TIER_STYLES[item.tier] || LIFESTYLE_TIER_STYLES.starter;

          return (
            <div key={item.id} className={cn("bg-card border rounded-2xl overflow-hidden flex flex-col transition-all hover:shadow-xl hover:shadow-black/20 group", tierStyle.bg)}>
              <div className="relative h-44 overflow-hidden">
                <img src={imageUrl} alt={item.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className={cn("absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border backdrop-blur-sm", tierStyle.bg, tierStyle.color)}>{tierStyle.label}</div>
                {alreadyOwned && <div className="absolute top-3 left-3 flex items-center gap-1 bg-success/90 text-black text-[10px] font-bold px-2 py-1 rounded-full"><Check className="w-2.5 h-2.5" />{ownedCount > 1 ? `×${ownedCount}` : "Owned"}</div>}
                {!alreadyOwned && activeRentalNonProp && <div className="absolute top-3 left-3 flex items-center gap-1 bg-primary/90 text-white text-[10px] font-bold px-2 py-1 rounded-full"><CalendarClock className="w-2.5 h-2.5" /> Renting</div>}
                {hasPassive && <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-success/90 text-black text-[10px] font-bold px-2.5 py-1 rounded-full"><TrendingUp className="w-2.5 h-2.5" />+{item.passive_income_stc.toLocaleString()}/{item.passive_income_interval_days}d</div>}
              </div>
              <div className="p-4 flex flex-col flex-1 gap-3">
                <div className="flex-1">
                  <h3 className="font-bold text-foreground text-base leading-tight">{item.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.description}</p>
                </div>
                {!showBlock && (
                  <div className="space-y-2 pt-2 border-t border-border/30">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{alreadyOwned ? "Buy Another" : "Buy"}</p>
                        <p className="text-base font-light text-success tracking-tight">{formatSTC(item.price_stc)}</p>
                      </div>
                      <Button size="sm" onClick={() => onBuy(item, {})} disabled={purchasing || !canAffordBuy}
                        className={cn("text-xs h-8 px-4 font-semibold shrink-0 gap-1", canAffordBuy ? "bg-success text-black hover:bg-success/90" : "bg-secondary text-muted-foreground cursor-not-allowed")}>
                        {purchasing ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : canAffordBuy ? alreadyOwned ? <><Plus className="w-3 h-3" /> Add</> : "Buy" : <><Lock className="w-3 h-3" /> Need STC</>}
                      </Button>
                    </div>
                    {item.can_rent && item.rent_price_stc > 0 && (
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Rent/mo</p>
                          <p className="text-sm font-light text-accent tracking-tight">{formatSTC(item.rent_price_stc)}</p>
                        </div>
                        {activeRentalNonProp ? (
                          <div className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-lg">Active</div>
                        ) : (
                          <Button size="sm" onClick={() => onRent && onRent(item)} disabled={purchasing || !canAffordRent}
                            className={cn("text-xs h-8 px-4 font-semibold shrink-0 gap-1", canAffordRent ? "bg-accent text-white hover:bg-accent/90" : "bg-secondary text-muted-foreground cursor-not-allowed")}>
                            <CalendarClock className="w-3 h-3" /> Rent
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <PropertyStoreModal
          open={!!modal}
          onClose={() => setModal(null)}
          item={modal.item}
          intent={modal.intent}
          playerStc={stc}
          onConfirm={handleModalConfirm}
          purchasing={purchasing === modal.item?.id}
        />
      )}
    </>
  );
}

function PropertyItemCard({ item, stc, investCount, liveOwned, activeRental, purchasing, hasResidence, onBuyLive, onInvest, onRent }) {
  const tierStyle = LIFESTYLE_TIER_STYLES[item.tier] || LIFESTYLE_TIER_STYLES.starter;
  const imageUrl = getItemImage(item);
  const canAfford = stc >= item.price_stc;
  const canAffordRent = item.can_rent && item.rent_price_stc && stc >= item.rent_price_stc;
  const hasPassive = item.passive_income_stc > 0;
  const isMyResidence = liveOwned?.is_residence || activeRental?.is_residence;
  const [renting, setRenting] = useState(false);

  async function handleRent() {
    setRenting(true);
    await onRent?.();
    setRenting(false);
  }

  return (
    <div className={cn("bg-card border rounded-2xl overflow-hidden flex flex-col transition-all hover:shadow-xl hover:shadow-black/20 group", tierStyle.bg)}>
      <div className="relative h-44 overflow-hidden">
        <img src={imageUrl} alt={item.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className={cn("absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border backdrop-blur-sm", tierStyle.bg, tierStyle.color)}>{tierStyle.label}</div>

        {/* Status badges */}
        {isMyResidence && (
          <div className="absolute top-3 left-3 flex items-center gap-1 bg-primary/90 text-white text-[10px] font-bold px-2 py-1 rounded-full">
            <Home className="w-2.5 h-2.5" /> My Residence
          </div>
        )}
        {!isMyResidence && liveOwned && (
          <div className="absolute top-3 left-3 flex items-center gap-1 bg-success/90 text-black text-[10px] font-bold px-2 py-1 rounded-full">
            <Home className="w-2.5 h-2.5" /> Owned (Live)
          </div>
        )}
        {!isMyResidence && !liveOwned && investCount > 0 && (
          <div className="absolute top-3 left-3 flex items-center gap-1 bg-warning/90 text-black text-[10px] font-bold px-2 py-1 rounded-full">
            ×{investCount} Investment{investCount > 1 ? "s" : ""}
          </div>
        )}
        {!liveOwned && activeRental && !isMyResidence && (
          <div className="absolute top-3 left-3 flex items-center gap-1 bg-primary/90 text-white text-[10px] font-bold px-2 py-1 rounded-full">
            <CalendarClock className="w-2.5 h-2.5" /> Renting
          </div>
        )}
        {hasPassive && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-success/90 text-black text-[10px] font-bold px-2.5 py-1 rounded-full">
            <TrendingUp className="w-2.5 h-2.5" />+{item.passive_income_stc.toLocaleString()}/{item.passive_income_interval_days}d
          </div>
        )}
        {item.weekly_maintenance_stc > 0 && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-warning/90 text-black text-[10px] font-bold px-2 py-1 rounded-full">
            ⚙️ {item.weekly_maintenance_stc >= 1000 ? `${(item.weekly_maintenance_stc/1000).toFixed(0)}K` : item.weekly_maintenance_stc}/wk
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1 gap-3">
        <div className="flex-1">
          <h3 className="font-bold text-foreground text-base leading-tight">{item.name}</h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.description}</p>
        </div>

        <div className="pt-2 border-t border-border/30 space-y-2">
          {/* Price row */}
          {item.subcategory !== "airbnb" && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Buy price</span>
              <span className="font-bold text-foreground">{formatSTC(item.price_stc)}</span>
            </div>
          )}

          {/* 3 action buttons */}
          <div className="grid grid-cols-3 gap-1.5">
            {/* Buy (Live) */}
            {item.subcategory === "airbnb" ? (
              <div className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border border-border/20 text-[10px] text-muted-foreground/30 cursor-not-allowed">
                <Home className="w-3.5 h-3.5" />
                <span>N/A</span>
              </div>
            ) : (
              <button
                onClick={onBuyLive}
                disabled={purchasing || !canAfford}
                className={cn(
                  "flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-wide transition-all",
                  canAfford && !purchasing
                    ? "bg-primary/10 border-primary/40 text-primary hover:bg-primary/20"
                    : "bg-secondary/40 border-border/30 text-muted-foreground cursor-not-allowed"
                )}
              >
                {purchasing ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Home className="w-3.5 h-3.5" />}
                <span>Buy (Live)</span>
              </button>
            )}

            {/* Rent */}
            {item.can_rent && item.rent_price_stc > 0 ? (
              activeRental ? (
                <div className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border bg-primary/5 border-primary/20 text-[10px] font-bold text-primary">
                  <CalendarClock className="w-3.5 h-3.5" />
                  <span>Active</span>
                </div>
              ) : (
                <button
                  onClick={handleRent}
                  disabled={renting || !canAffordRent}
                  className={cn(
                    "flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-wide transition-all",
                    canAffordRent
                      ? "bg-accent/10 border-accent/40 text-accent hover:bg-accent/20"
                      : "bg-secondary/40 border-border/30 text-muted-foreground cursor-not-allowed"
                  )}
                >
                  {renting ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <CalendarClock className="w-3.5 h-3.5" />}
                  <span>Rent</span>
                </button>
              )
            ) : (
              <div className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border border-border/20 text-[10px] text-muted-foreground/40 cursor-not-allowed">
                <CalendarClock className="w-3.5 h-3.5" />
                <span>N/A</span>
              </div>
            )}

            {/* Invest */}
            <button
              onClick={onInvest}
              disabled={purchasing || !canAfford}
              className={cn(
                "flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-wide transition-all",
                canAfford && !purchasing
                  ? "bg-warning/10 border-warning/40 text-warning hover:bg-warning/20"
                  : "bg-secondary/40 border-border/30 text-muted-foreground cursor-not-allowed"
              )}
            >
              {purchasing ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Invest className="w-3.5 h-3.5" />}
              <span>Invest</span>
            </button>
          </div>

          {/* Rent price hint */}
          {item.can_rent && item.rent_price_stc > 0 && !activeRental && (
            <p className="text-[10px] text-muted-foreground text-center">Rent: {formatSTC(item.rent_price_stc)}/mo</p>
          )}
        </div>
      </div>
    </div>
  );
}