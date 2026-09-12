import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import {
  categoryEmoji,
  categoryLabel,
  formatSTC,
  getAssetImage,
  LIFESTYLE_CATEGORIES,
  LIFESTYLE_TIER_STYLES,
  resolveCategory,
} from "@/lib/lifestyleItems";
import { Building2, Car, Coins, Package, Sparkles, TrendingUp, Watch } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORY_VISUALS = {
  houses: {
    title: "Property Portfolio",
    subtitle: "Homes, apartments and private residences.",
    icon: Building2,
    className: "border-sky-300/25 from-sky-500/16 via-black/60 to-cyan-950/55",
  },
  cars: {
    title: "Garage",
    subtitle: "Cars and personal transport.",
    icon: Car,
    className: "border-amber-300/25 from-amber-400/16 via-black/62 to-red-950/45",
  },
  watches: {
    title: "Watch Box",
    subtitle: "Timepieces and rare collectibles.",
    icon: Watch,
    className: "border-violet-300/25 from-violet-400/16 via-black/62 to-slate-950/55",
  },
  fashion: {
    title: "Wardrobe",
    subtitle: "Fashion pieces and player style.",
    icon: Sparkles,
    className: "border-pink-300/25 from-pink-400/14 via-black/64 to-purple-950/45",
  },
  vip_experiences: {
    title: "VIP Access",
    subtitle: "Experiences, events and elite access.",
    icon: Sparkles,
    className: "border-emerald-300/25 from-emerald-400/14 via-black/64 to-teal-950/45",
  },
  personal_services: {
    title: "Lifestyle Services",
    subtitle: "Personal upgrades and premium services.",
    icon: Package,
    className: "border-cyan-300/25 from-cyan-400/14 via-black/64 to-blue-950/45",
  },
};

function ownedItemFor(purchase, items) {
  const item = items.find(i => i.id === purchase.item_id);
  return {
    ...item,
    ...purchase,
    _item: item,
    name: purchase.item_name || item?.name || "Lifestyle Asset",
    category: resolveCategory(purchase.item_category || item?.category),
    emoji: purchase.item_emoji || item?.emoji || categoryEmoji(purchase.item_category || item?.category),
    image_url: purchase.image_url || item?.image_url,
    tier: purchase.item_tier || item?.tier || "standard",
    price_paid_stc: purchase.price_paid_stc || item?.price_stc || 0,
    passive_income_stc: item?.passive_income_stc || purchase.passive_income_stc || 0,
  };
}

export default function PlayerLifestyleTab({ player }) {
  const [purchases, setPurchases] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!player?.id) return;
      const [owned, catalog] = await Promise.all([
        stageClient.entities.LifestylePurchase.filter({ player_id: player.id }, "-created_date", 50),
        stageClient.entities.LifestyleItem.filter({ is_active: true }, "sort_order", 100),
      ]);
      setPurchases(owned);
      setItems(catalog);
      setLoading(false);
    }
    load();
  }, [player?.id]);

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (purchases.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" />
        <p className="text-sm text-muted-foreground">No lifestyle items yet.</p>
      </div>
    );
  }

  const ownedItems = purchases.map((purchase) => ownedItemFor(purchase, items));

  // Group by display category
  const grouped = {};
  for (const purchase of ownedItems) {
    const cat = purchase.category || "personal_services";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(purchase);
  }

  const totalValue = purchases.reduce((s, p) => s + (p.price_paid_stc || 0), 0);
  const heroItems = ownedItems.slice(0, 3);
  const publicCategories = LIFESTYLE_CATEGORIES
    .filter(cat => !cat.hidden && grouped[cat.id])
    .concat(Object.keys(grouped)
      .filter(id => !LIFESTYLE_CATEGORIES.some(cat => !cat.hidden && cat.id === id))
      .map(id => ({ id, label: categoryLabel(id), emoji: categoryEmoji(id) })));

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden border border-cyan-300/20 bg-[#06111d] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.32)] sm:p-6">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_14%_8%,rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_86%_28%,rgba(245,158,11,0.14),transparent_30%)]" />
        <div className="relative z-[1] grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <p className="font-heading text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200/55">Lifestyle Collection</p>
            <h3 className="mt-2 font-heading text-3xl font-black uppercase leading-none text-white sm:text-4xl">
              {player?.gamertag || "Player"} Assets
            </h3>
            <p className="mt-2 max-w-xl text-sm text-white/50">
              Public showcase of owned cars, properties, watches and luxury items.
            </p>
            <div className="mt-4 grid max-w-lg grid-cols-2 gap-3">
              <div className="border border-white/10 bg-black/28 p-3">
                <p className="font-heading text-2xl font-black text-white">{purchases.length}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-white/42">Items Owned</p>
              </div>
              <div className="border border-emerald-300/20 bg-emerald-400/8 p-3">
                <p className="font-heading text-2xl font-black text-emerald-200">{formatSTC(totalValue)}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-white/42">STC Invested</p>
              </div>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {heroItems.map((asset, index) => (
              <div key={asset.id || `${asset.name}-${index}`} className={cn("relative overflow-hidden border border-white/10 bg-black/40", index === 0 && "sm:col-span-2")}>
                <div className="aspect-[16/10] bg-cover bg-center" style={{ backgroundImage: `url(${getAssetImage(asset)})` }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/18 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="truncate font-heading text-sm font-black uppercase text-white">{asset.name}</p>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/46">{categoryLabel(asset.category)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {player.stc > 0 && (
        <div className="flex w-fit items-center gap-2 border border-emerald-300/20 bg-emerald-400/10 px-4 py-2.5">
          <Coins className="h-4 w-4 text-emerald-300" />
          <span className="font-bold text-emerald-200">{formatSTC(player.stc)} STC</span>
          <span className="text-xs text-white/45">balance</span>
        </div>
      )}

      {publicCategories.map(cat => {
        const visual = CATEGORY_VISUALS[cat.id] || CATEGORY_VISUALS.personal_services;
        const Icon = visual.icon;
        return (
        <section key={cat.id} className={cn("overflow-hidden border bg-gradient-to-br shadow-[0_18px_55px_rgba(0,0,0,0.24)]", visual.className)}>
          <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/18 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-white/10 bg-black/35">
                <Icon className="h-5 w-5 text-white/75" />
              </span>
              <div className="min-w-0">
                <h4 className="truncate font-heading text-base font-black uppercase tracking-[0.12em] text-white">{visual.title || cat.label}</h4>
                <p className="truncate text-xs text-white/42">{visual.subtitle || cat.label}</p>
              </div>
            </div>
            <span className="font-heading text-xl font-black text-white/70">{grouped[cat.id].length}</span>
          </div>
          <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {grouped[cat.id].map((asset) => {
              const tierStyle = LIFESTYLE_TIER_STYLES[asset.tier] || LIFESTYLE_TIER_STYLES.standard;
              const hasPassive = asset.passive_income_stc > 0;
              return (
                <article key={asset.id} className="group overflow-hidden border border-white/10 bg-black/38">
                  <div className="relative aspect-[16/9] overflow-hidden bg-black">
                    <img src={getAssetImage(asset)} alt={asset.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/86 via-black/10 to-transparent" />
                    <div className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center border border-white/15 bg-black/55 text-lg">
                      {asset.emoji}
                    </div>
                    <span className={cn("absolute right-3 top-3 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em]", tierStyle.badge)}>
                      {tierStyle.label}
                    </span>
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <p className="line-clamp-1 font-heading text-base font-black uppercase text-white">{asset.name}</p>
                      <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">{categoryLabel(asset.category)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-white/10 px-3 py-2.5">
                    <span className="text-xs font-bold text-white/58">{formatSTC(asset.price_paid_stc)} STC</span>
                    {hasPassive ? (
                      <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-300">
                        <TrendingUp className="h-3 w-3" />
                        {formatSTC(asset.passive_income_stc)}
                      </span>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
        );
      })}
    </div>
  );
}
