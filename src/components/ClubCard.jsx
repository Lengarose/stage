import { Link } from "react-router-dom";
import { Shield, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ClubCard({ club, rank, showChallenge: _showChallenge, onChallenge: _onChallenge }) {
  // Note: ClubCard displays stored entity stats (club.wins/losses/draws)
  // For live-calculated stats, see ClubDetail.jsx which filters by confirmed/completed matches
  const totalGames = (club.wins || 0) + (club.losses || 0) + (club.draws || 0);
  const winRate = totalGames > 0 ? Math.round(((club.wins || 0) / totalGames) * 100) : 0;

  return (
    <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-all duration-300 group-hover:glow-primary group">
      <div className="flex items-start gap-4">
          {rank && (
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center leading-relaxed font-bold text-sm shrink-0",
              rank === 1 ? "bg-warning/20 text-warning" :
              rank === 2 ? "bg-foreground/10 text-foreground" :
              rank === 3 ? "bg-chart-5/20 text-chart-5" :
              "bg-secondary text-muted-foreground"
            )}>
              {rank}
            </div>
          )}
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
            {club.logo_url ? (
              <img src={club.logo_url} alt={club.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              <Shield className="w-6 h-6 text-primary" />
            )}
          </div>
          <Link to={`/clubs/${club.id}`} className="flex-1 min-w-0 block">
            <div className="flex items-center gap-2">
              <h3 className="leading-relaxed font-bold text-foreground truncate group-hover:text-primary transition-colors">{club.name}</h3>
              <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-mono">[{club.tag}]</span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span>{club.platform}</span>
              <span>•</span>
              <span>{club.region}</span>
            </div>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5 text-xs">
                <Trophy className="w-3 h-3 text-primary" />
                <span className="text-muted-foreground">{club.trophies || 0} trophies</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {club.wins || 0}W {club.draws || 0}D {club.losses || 0}L
              </div>
              <div className="text-xs font-medium text-success">{winRate}% WR</div>
            </div>
          </Link>

        </div>
      </div>
  );
}