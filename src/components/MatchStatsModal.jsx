import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Target, Zap, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MatchStatsModal({ match, open, onClose }) {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !match) return;
    setLoading(true);
    base44.entities.MatchPlayerStat.filter({ match_id: match.id }).then(data => {
      setStats(data);
      setLoading(false);
    });
  }, [open, match]);

  if (!match) return null;

  const homeStats = stats.filter(s => s.club_id === match.home_club_id);
  const awayStats = stats.filter(s => s.club_id === match.away_club_id);

  function StatRow({ stat }) {
    return (
      <div className="flex items-center justify-between py-1 px-2 hover:bg-secondary/40 rounded-lg transition-colors">
        <span className="text-xs leading-relaxed font-semibold text-foreground truncate flex-1">{stat.player_gamertag || stat.player_email}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {stat.goals > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-success leading-relaxed font-bold">
              <Target className="w-2.5 h-2.5" />{stat.goals}
            </span>
          )}
          {stat.assists > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-primary leading-relaxed font-bold">
              <Zap className="w-2.5 h-2.5" />{stat.assists}
            </span>
          )}
          <span className={cn(
            "flex items-center gap-0.5 text-[10px] leading-relaxed font-bold",
            stat.rating >= 7 ? "text-success" : stat.rating >= 6 ? "text-warning" : "text-muted-foreground"
          )}>
            <Star className="w-2.5 h-2.5" />{stat.rating?.toFixed(1) || "6.0"}
          </span>
        </div>
      </div>
    );
  }

  function TeamSection({ name, teamStats, isWinner }) {
    return (
      <div className="flex-1 min-w-0">
        <div className={cn("text-[10px] leading-relaxed uppercase tracking-wider font-bold mb-1 px-2 truncate", isWinner ? "text-success" : "text-muted-foreground")}>
          {name} {isWinner && "🏆"}
        </div>
        {teamStats.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-2">No stats recorded.</p>
        ) : (
          teamStats.map(s => <StatRow key={s.id} stat={s} />)
        )}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="leading-relaxed text-base sm:text-xl">
            {match.home_club_name} {match.home_score} – {match.away_score} {match.away_club_name}
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex gap-2 mt-2">
            <TeamSection name={match.home_club_name} teamStats={homeStats} isWinner={match.winner_club_id === match.home_club_id} />
            <div className="w-px bg-border shrink-0" />
            <TeamSection name={match.away_club_name} teamStats={awayStats} isWinner={match.winner_club_id === match.away_club_id} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}