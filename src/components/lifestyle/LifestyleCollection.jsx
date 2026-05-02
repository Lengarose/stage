import { cn } from "@/lib/utils";
import { LIFESTYLE_CATEGORIES, LIFESTYLE_TIER_STYLES } from "@/lib/lifestyleItems";
import { TrendingUp, Package, CalendarClock, ShoppingCart } from "lucide-react";

export default function LifestyleCollection({ purchases, items }) {
  if (purchases.length === 0) {
    return (
      <div className="text-center py-20">
        <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground/20" />
        <p className="text-muted-foreground text-sm">Your collection is empty.</p>
        <p className="text-xs text-muted-foreground mt-1">Head to the Store and start building your lifestyle!</p>
      </div>
    );
  }

  // Group by category
  const grouped = {};
  for (const purchase of purchases) {
    const item = items.find(i => i.id === purchase.item_id);
    const category = purchase.item_category || item?.category || "extras";
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push({ ...purchase, _item: item });
  }

  return (
    <div className="space-y-8">
      {LIFESTYLE_CATEGORIES.filter(cat => grouped[cat.id]).map(cat => (
        <div key={cat.id}>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">{cat.emoji}</span>
            <h3 className="font-heading font-bold text-foreground uppercase tracking-wide text-sm">{cat.label}</h3>
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{grouped[cat.id].length}</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {grouped[cat.id].map(purchase => {
              const item = purchase._item;
              const tierStyle = LIFESTYLE_TIER_STYLES[item?.tier] || LIFESTYLE_TIER_STYLES.starter;
              const hasPassive = item?.passive_income_stc > 0;
              return (
                <div key={purchase.id} className={cn("bg-card border rounded-xl p-4 flex gap-3 items-start", tierStyle.bg)}>
                  <div className="w-11 h-11 rounded-xl bg-secondary/80 flex items-center justify-center text-2xl shrink-0">
                    {purchase.item_emoji || item?.emoji || "📦"}
                  </div>
                  <div className="flex-1 min-w-0">
                   <div className="flex items-center gap-2 flex-wrap">
                     <p className="font-bold text-foreground text-sm truncate">{purchase.item_name || item?.name}</p>
                     {purchase.purchase_type === "rent" ? (
                       <span className="flex items-center gap-0.5 text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full">
                         <CalendarClock className="w-2.5 h-2.5" /> Renting
                       </span>
                     ) : (
                       <span className="flex items-center gap-0.5 text-[10px] font-semibold text-success bg-success/10 border border-success/20 px-1.5 py-0.5 rounded-full">
                         <ShoppingCart className="w-2.5 h-2.5" /> Owned
                       </span>
                     )}
                   </div>
                   <p className="text-xs text-muted-foreground">
                     {purchase.purchase_type === "rent"
                       ? `${purchase.monthly_rent_stc?.toLocaleString()} STC/month`
                       : `Paid ${purchase.price_paid_stc?.toLocaleString()} STC`}
                   </p>
                   {hasPassive && (
                     <div className="flex items-center gap-1 mt-1 text-success text-xs">
                       <TrendingUp className="w-3 h-3" />
                       +{item.passive_income_stc.toLocaleString()} STC / {item.passive_income_interval_days}d
                     </div>
                   )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}