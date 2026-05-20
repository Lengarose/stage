import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import { BADGE_STYLE } from "@/lib/rewardsEngine";
import { Trophy, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

function BadgePill({ badgeType }) {
  const style = BADGE_STYLE[badgeType] || BADGE_STYLE.participant;
  return (
    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border", style.bg, style.text, style.border)}>
      {style.label}
    </span>
  );
}

export default function TrophyHistorySection({ sourceId, trophyImageUrl, className }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen]       = useState(false);

  useEffect(() => {
    if (!sourceId) { setLoading(false); return; }
    (stageClient.entities.ClubAchievement?.filter({ source_id: sourceId }, "-season_number", 50) ?? Promise.resolve([]))
      .catch(() => [])
      .then(rows => {
        // Keep only notable positions (winner + runner-up + semi-final) and sort by season desc
        const notable = rows
          .filter(r => r.badge_type !== "participant" && r.badge_type !== "top_4")
          .sort((a, b) => (b.season_number || 0) - (a.season_number || 0));
        setItems(notable);
        setLoading(false);
      });
  }, [sourceId]);

  if (loading || items.length === 0) return null;

  // Group by season_number
  const seasons = {};
  items.forEach(item => {
    const s = item.season_number;
    if (!seasons[s]) seasons[s] = { label: item.season_label || `Season ${s}`, number: s, results: [] };
    seasons[s].results.push(item);
  });
  const seasonList = Object.values(seasons).sort((a, b) => b.number - a.number);

  return (
    <div className={cn("space-y-3", className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left group"
      >
        <Trophy className="w-4 h-4 text-accent shrink-0" />
        <p className="text-xs font-bold uppercase tracking-widest text-foreground flex-1">Trophy History</p>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-3 pl-1">
          {seasonList.map(season => (
            <div key={season.number} className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{season.label}</p>
              {season.results.map((item, i) => (
                <div key={i} className="flex items-center gap-3 bg-secondary/40 border border-border rounded-lg px-3 py-2">
                  {(item.trophy_image_url || trophyImageUrl) ? (
                    <img
                      src={item.trophy_image_url || trophyImageUrl}
                      alt="Trophy"
                      className="w-7 h-7 object-contain shrink-0"
                    />
                  ) : (
                    <Trophy className="w-5 h-5 text-muted-foreground/30 shrink-0" />
                  )}
                  {item.club_logo_url && (
                    <img src={item.club_logo_url} alt={item.club_name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{item.club_name}</p>
                  </div>
                  <BadgePill badgeType={item.badge_type} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
