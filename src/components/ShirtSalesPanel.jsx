import { useState, useEffect, useCallback } from "react";
import { stageClient } from "@/api/stageClient";
import { ShoppingBag, TrendingUp, Coins, Star, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatSTC } from "@/lib/playerValue";

const RANK_STYLE = [
  { ring: "ring-yellow-400/50",  bg: "bg-yellow-400/15", text: "text-yellow-300",  label: "🥇" },
  { ring: "ring-zinc-300/40",    bg: "bg-zinc-300/10",   text: "text-zinc-300",    label: "🥈" },
  { ring: "ring-amber-600/40",   bg: "bg-amber-700/15",  text: "text-amber-500",   label: "🥉" },
  { ring: "ring-white/10",       bg: "bg-white/5",       text: "text-white/40",    label: "4" },
  { ring: "ring-white/10",       bg: "bg-white/5",       text: "text-white/40",    label: "5" },
];

const PERIODS = [
  { key: "all",  label: "All Time" },
  { key: "30d",  label: "30 Days"  },
  { key: "7d",   label: "7 Days"   },
];

export default function ShirtSalesPanel({ club }) {
  const [period, setPeriod]       = useState("30d");
  const [leaderboard, setLeaderboard] = useState(null);
  const [summary, setSummary]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    if (!club?.id) return;
    setLoading(true);
    try {
      const [lbRes, sumRes] = await Promise.all([
        stageClient.functions.invoke("shirtSales", {
          action: "get_leaderboard", club_id: club.id, period, limit: 5,
        }),
        stageClient.functions.invoke("shirtSales", {
          action: "get_club_summary", club_id: club.id, period,
        }),
      ]);
      setLeaderboard(lbRes?.data?.leaderboard || []);
      setSummary(sumRes?.data || { total_shirts: 0, total_revenue: 0, matches_with_sales: 0 });
    } catch {
      setLeaderboard([]);
      setSummary({ total_shirts: 0, total_revenue: 0, matches_with_sales: 0 });
    }
    setLoading(false);
  }, [club?.id, period, refreshKey]);

  useEffect(() => { load(); }, [load]);

  const totalShirts  = Number(summary?.total_shirts  || 0);
  const totalRevenue = Number(summary?.total_revenue || 0);
  const matchCount   = Number(summary?.matches_with_sales || 0);

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-bold text-white flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-emerald-400" /> Virtual Shirt Sales
          </h3>
          <p className="text-[10px] text-white/30 mt-0.5">
            Performance-based fan revenue — auto-generated after every match
          </p>
        </div>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
        </button>
      </div>

      {/* Period filter */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-xl w-fit">
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={cn(
              "px-3 py-1 rounded-lg text-xs font-semibold transition-all",
              period === p.key
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "text-white/40 hover:text-white/60"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2.5">
        <SummaryCard
          label="Shirts Sold"
          value={totalShirts.toLocaleString()}
          icon={<ShoppingBag className="w-3.5 h-3.5" />}
          color="text-emerald-400"
        />
        <SummaryCard
          label="Fan Revenue"
          value={formatSTC(totalRevenue)}
          icon={<Coins className="w-3.5 h-3.5" />}
          color="text-amber-400"
        />
        <SummaryCard
          label="Active Matches"
          value={matchCount.toLocaleString()}
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          color="text-blue-400"
        />
      </div>

      {/* Top 5 leaderboard */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-white/30 font-bold mb-3 flex items-center gap-1.5">
          <Star className="w-3 h-3 text-yellow-400" /> Top Shirt Sellers
        </p>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : leaderboard?.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-10 text-center">
            <ShoppingBag className="w-10 h-10 text-white/15 mx-auto mb-3" />
            <p className="text-sm text-white/40">No shirt sales yet.</p>
            <p className="text-xs text-white/20 mt-1">
              Fans buy player shirts automatically after every match based on performance.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {leaderboard.map((entry, i) => {
              const rank  = RANK_STYLE[i] || RANK_STYLE[4];
              const shirts = Number(entry.total_shirts || 0);
              const rev    = Number(entry.total_revenue || 0);
              return (
                <div
                  key={entry.player_id}
                  className={cn(
                    "flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-all",
                    "bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.05]"
                  )}
                >
                  {/* Rank badge */}
                  <div className={cn(
                    "w-9 h-9 rounded-full ring-1 flex items-center justify-center font-black text-sm shrink-0",
                    rank.ring, rank.bg, rank.text
                  )}>
                    {typeof rank.label === "string" && rank.label.startsWith("🥇") || rank.label.startsWith("🥈") || rank.label.startsWith("🥉")
                      ? <span className="text-base leading-none">{rank.label}</span>
                      : rank.label
                    }
                  </div>

                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                    {entry.avatar_url
                      ? <img src={entry.avatar_url} alt={entry.gamertag} className="w-full h-full object-cover" />
                      : <span className="text-xs font-bold text-white/60">{(entry.gamertag || "?")[0]?.toUpperCase()}</span>
                    }
                  </div>

                  {/* Player info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-sm truncate">{entry.gamertag || "—"}</span>
                      {entry.shirt_number && (
                        <span className="text-[10px] font-mono text-white/40 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 shrink-0">
                          #{entry.shirt_number}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/35 truncate mt-0.5">
                      {entry.club_name || club?.name || "—"}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="text-right shrink-0 space-y-0.5">
                    <div className="flex items-center gap-1 justify-end">
                      <ShoppingBag className="w-3 h-3 text-emerald-400/70" />
                      <span className="text-sm font-black text-emerald-400">{shirts.toLocaleString()}</span>
                    </div>
                    <p className="text-[10px] text-amber-400/70 font-medium">{formatSTC(rev)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Revenue info footer */}
      {totalRevenue > 0 && (
        <div className="flex items-start gap-2.5 px-3 py-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-white/50 leading-relaxed">
            <span className="text-emerald-400 font-semibold">{formatSTC(totalRevenue)}</span> in fan revenue has been automatically credited to the club balance based on player performance.
          </p>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon, color }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
      <div className={cn("flex items-center justify-center gap-1 mb-1", color)}>
        {icon}
      </div>
      <p className={cn("font-heading font-black text-xl leading-tight", color)}>{value}</p>
      <p className="text-[9px] text-white/30 uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}
