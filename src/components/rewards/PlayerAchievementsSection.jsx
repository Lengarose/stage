import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { BADGE_STYLE } from "@/lib/rewardsEngine";
import { Trophy, Medal } from "lucide-react";
import { cn } from "@/lib/utils";

function BadgePill({ badgeType }) {
  const style = BADGE_STYLE[badgeType] || BADGE_STYLE.participant;
  return (
    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border", style.bg, style.text, style.border)}>
      {style.label}
    </span>
  );
}

export default function PlayerAchievementsSection({ playerId }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!playerId) { setLoading(false); return; }
    (base44.entities.PlayerAchievement?.filter({ player_id: playerId }, "-season_number", 100) ?? Promise.resolve([]))
      .catch(() => [])
      .then(rows => {
        setItems(rows.sort((a, b) => {
          const typeDiff = a.source_type === "competition" ? -1 : b.source_type === "competition" ? 1 : 0;
          if (typeDiff !== 0) return typeDiff;
          const bdgOrder = { winner: 0, finalist: 1, semi_finalist: 2, top_4: 3, participant: 4 };
          const bDiff = (bdgOrder[a.badge_type] ?? 5) - (bdgOrder[b.badge_type] ?? 5);
          if (bDiff !== 0) return bDiff;
          return (b.season_number || 0) - (a.season_number || 0);
        }));
        setLoading(false);
      });
  }, [playerId]);

  if (loading) return <p className="text-xs text-white/40 py-4 text-center">Loading achievements…</p>;
  if (!items.length) return null;

  const winnerCount = items.filter(i => i.badge_type === "winner").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold flex items-center gap-1.5">
          <Medal className="w-3.5 h-3.5" /> Season Achievements
        </p>
        {winnerCount > 0 && (
          <span className="text-[9px] font-bold text-yellow-400 px-1.5 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/20">
            {winnerCount} Title{winnerCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
            {item.trophy_image_url ? (
              <img src={item.trophy_image_url} alt={item.source_name} className="w-8 h-8 object-contain shrink-0" />
            ) : (
              <Trophy className="w-5 h-5 text-white/20 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{item.source_name}</p>
              <p className="text-[10px] text-white/40">
                {item.club_name} · {item.season_label || `Season ${item.season_number}`}
              </p>
            </div>
            <BadgePill badgeType={item.badge_type} />
          </div>
        ))}
      </div>
    </div>
  );
}
