import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import { LIFESTYLE_CATEGORIES } from "@/lib/lifestyleItems";
import { cn } from "@/lib/utils";
import { Package, TrendingUp, Coins } from "lucide-react";

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

  // Group by category
  const grouped = {};
  for (const purchase of purchases) {
    const item = items.find(i => i.id === purchase.item_id);
    const cat = purchase.item_category || item?.category || "extras";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({ ...purchase, _item: item });
  }

  const totalValue = purchases.reduce((s, p) => s + (p.price_paid_stc || 0), 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="font-heading text-2xl font-black text-foreground">{purchases.length}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Items Owned</p>
        </div>
        <div className="bg-card border border-success/20 rounded-xl p-3 text-center">
          <p className="font-heading text-2xl font-black text-success">{totalValue.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">STC Invested</p>
        </div>
      </div>

      {/* STC balance shown if public */}
      {player.stc > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-success/10 border border-success/20 rounded-xl w-fit">
          <Coins className="w-4 h-4 text-success" />
          <span className="font-bold text-success">{player.stc.toLocaleString()} STC</span>
          <span className="text-xs text-muted-foreground">balance</span>
        </div>
      )}

      {/* By category */}
      {LIFESTYLE_CATEGORIES.filter(cat => grouped[cat.id]).map(cat => (
        <div key={cat.id}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">{cat.emoji}</span>
            <h4 className="font-bold text-foreground text-sm uppercase tracking-wide">{cat.label}</h4>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {grouped[cat.id].map(p => {
              const item = p._item;
              const hasPassive = item?.passive_income_stc > 0;
              return (
                <div key={p.id} className="bg-card border border-border rounded-xl p-3 flex gap-2 items-start">
                  <span className="text-xl shrink-0">{p.item_emoji || item?.emoji || "📦"}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{p.item_name || item?.name}</p>
                    {hasPassive && (
                      <div className="flex items-center gap-1 mt-0.5 text-success text-[10px]">
                        <TrendingUp className="w-2.5 h-2.5" />
                        {item.passive_income_stc}/day
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