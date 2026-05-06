import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import { ShoppingBag, TrendingUp, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatShirtPrice } from "@/lib/shirtEconomy";

const RANK_STYLE = [
  "bg-yellow-500/20 text-yellow-400",
  "bg-zinc-400/20 text-zinc-300",
  "bg-amber-700/20 text-amber-500",
  "bg-white/5 text-white/40",
  "bg-white/5 text-white/40",
];

export default function ShirtSalesPanel({ club }) {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!club?.id) return;
    stageClient.entities.ShirtSale
      .filter({ club_id: club.id }, "-created_date", 200)
      .then(data => { setSales(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [club?.id]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="w-6 h-6 border-2 border-white/10 border-t-blue-400 rounded-full animate-spin" />
      </div>
    );
  }

  // Aggregate per player
  const map = new Map();
  for (const s of sales) {
    if (!map.has(s.player_id)) {
      map.set(s.player_id, {
        player_id:        s.player_id,
        gamertag:         s.player_gamertag,
        shirt_number:     s.shirt_number,
        sales_count:      0,
        revenue_stc:      0,
      });
    }
    const e = map.get(s.player_id);
    e.sales_count  += 1;
    e.revenue_stc  += s.price_stc || 0;
  }

  const sorted  = [...map.values()].sort((a, b) => b.sales_count - a.sales_count);
  const top5    = sorted.slice(0, 5);
  const totalSales   = sales.length;
  const totalRevenue = sales.reduce((sum, s) => sum + (s.price_stc || 0), 0);

  return (
    <div className="space-y-6">

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
          <p className="font-heading text-3xl font-black text-emerald-400">{totalSales}</p>
          <p className="text-[10px] text-white/40 uppercase tracking-wider mt-1">Shirts Sold</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
          <p className="font-heading text-2xl font-black text-amber-400 leading-tight">{formatShirtPrice(totalRevenue)}</p>
          <p className="text-[10px] text-white/40 uppercase tracking-wider mt-1">Total Revenue</p>
        </div>
      </div>

      {/* Top 5 leaderboard */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-3 px-1">
          Top 5 — Shirt Sales
        </p>

        {top5.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-10 text-center">
            <ShoppingBag className="w-10 h-10 text-white/15 mx-auto mb-3" />
            <p className="text-sm text-white/40">No shirt sales yet.</p>
            <p className="text-xs text-white/25 mt-1">
              Fans buy player shirts directly from player profiles.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {top5.map((entry, i) => (
              <div
                key={entry.player_id}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3"
              >
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0", RANK_STYLE[i])}>
                  {i + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-white text-sm truncate">{entry.gamertag}</p>
                    {entry.shirt_number && (
                      <span className="text-[10px] text-white/40 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 font-mono shrink-0">
                        #{entry.shirt_number}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/40">
                    {entry.sales_count} sold · {formatShirtPrice(entry.revenue_stc)} revenue
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-lg font-black text-emerald-400">{entry.sales_count}</p>
                  <p className="text-[10px] text-white/30">sold</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent activity */}
      {sales.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-3 px-1">
            Recent Activity
          </p>
          <div className="space-y-1.5">
            {sales.slice(0, 12).map(s => (
              <div
                key={s.id}
                className="flex items-center justify-between px-3 py-2 bg-white/[0.03] border border-white/5 rounded-lg"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-3 h-3 text-blue-400" />
                  </div>
                  <span className="text-xs text-white/70 truncate">{s.player_gamertag}</span>
                  {s.shirt_number && (
                    <span className="text-[10px] text-white/30 font-mono shrink-0">#{s.shirt_number}</span>
                  )}
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-xs font-semibold text-emerald-400">{formatShirtPrice(s.price_stc)}</p>
                  <p className="text-[10px] text-white/25">
                    {s.created_date
                      ? new Date(s.created_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
                      : "—"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
