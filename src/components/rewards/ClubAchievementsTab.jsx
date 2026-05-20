import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import { BADGE_STYLE } from "@/lib/rewardsEngine";
import { Trophy, Coins } from "lucide-react";
import { cn } from "@/lib/utils";

function BadgePill({ badgeType }) {
  const style = BADGE_STYLE[badgeType] || BADGE_STYLE.participant;
  return (
    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border", style.bg, style.text, style.border)}>
      {style.label}
    </span>
  );
}

export default function ClubAchievementsTab({ clubId }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clubId) { setLoading(false); return; }
    (stageClient.entities.ClubAchievement?.filter({ club_id: clubId }, "-season_number", 100) ?? Promise.resolve([]))
      .catch(() => [])
      .then(rows => {
        setItems(rows.sort((a, b) => {
          const typeDiff = a.source_type === "competition" ? -1 : b.source_type === "competition" ? 1 : 0;
          if (typeDiff !== 0) return typeDiff;
          return (b.season_number || 0) - (a.season_number || 0);
        }));
        setLoading(false);
      });
  }, [clubId]);

  if (loading) return <p className="text-xs text-white/40 py-8 text-center">Loading achievements…</p>;

  if (!items.length) {
    return (
      <div className="py-12 text-center">
        <Trophy className="w-10 h-10 text-white/10 mx-auto mb-3" />
        <p className="text-xs text-white/40">No achievements yet.</p>
        <p className="text-[11px] text-white/20 mt-1">Complete a season to earn trophies and STC prizes.</p>
      </div>
    );
  }

  // Group by source
  const groups = {};
  items.forEach(item => {
    const key = item.source_id;
    if (!groups[key]) groups[key] = { name: item.source_name, type: item.source_type, items: [] };
    groups[key].items.push(item);
  });

  const totalStc    = items.reduce((s, i) => s + (i.stc_awarded || 0), 0);
  const winnerCount = items.filter(i => i.badge_type === "winner").length;

  return (
    <div className="space-y-5 pb-6">
      {/* Summary bar */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-center">
          <p className="font-heading text-2xl font-black text-yellow-400">{winnerCount}</p>
          <p className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">Trophies Won</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
          <p className="font-heading text-2xl font-black text-emerald-400">
            {totalStc >= 1_000_000
              ? `${(totalStc / 1_000_000).toFixed(1)}M`
              : totalStc >= 1000
              ? `${(totalStc / 1000).toFixed(0)}K`
              : totalStc}
          </p>
          <p className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">STC Earned</p>
        </div>
      </div>

      {Object.values(groups).map((group, gi) => (
        <div key={gi} className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">{group.name}</p>
          {group.items.map((item, i) => (
            <div key={i} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
              {/* Trophy image or placeholder */}
              {item.trophy_image_url ? (
                <img
                  src={item.trophy_image_url}
                  alt={item.source_name}
                  className="w-10 h-10 object-contain rounded shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <Trophy className="w-5 h-5 text-white/20" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-bold text-white">{item.position_label}</p>
                  <BadgePill badgeType={item.badge_type} />
                </div>
                <p className="text-[10px] text-white/40 mt-0.5">{item.season_label || `Season ${item.season_number}`}</p>
              </div>

              {item.stc_awarded > 0 && (
                <div className="flex items-center gap-1 text-emerald-400 shrink-0">
                  <Coins className="w-3 h-3" />
                  <span className="text-[10px] font-bold">
                    {item.stc_awarded >= 1_000_000
                      ? `${(item.stc_awarded / 1_000_000).toFixed(1)}M`
                      : item.stc_awarded >= 1000
                      ? `${(item.stc_awarded / 1000).toFixed(0)}K`
                      : item.stc_awarded}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
