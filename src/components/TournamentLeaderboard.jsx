import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import { Trophy, Target, Zap, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export default function TournamentLeaderboard({ tournamentId }) {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("goals");

  useEffect(() => {
    async function load() {
      const data = await stageClient.entities.MatchPlayerStat.filter({ tournament_id: tournamentId });
      setStats(data);
      setLoading(false);
    }
    load();

    const unsub = stageClient.entities.MatchPlayerStat.subscribe((event) => {
      if (event.data?._entity === "MatchPlayerStat" && event.data?.tournament_id === tournamentId) {
        stageClient.entities.MatchPlayerStat.filter({ tournament_id: tournamentId }).then(setStats);
      }
    }, { tournament_id: tournamentId });

    return unsub;
  }, [tournamentId]);

  if (loading) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;

  // Aggregate per player
  const playerMap = {};
  for (const s of stats) {
    const key = s.player_id || s.player_email || s.player_gamertag;
    if (!key) continue;
    if (!playerMap[key]) {
      playerMap[key] = { email: key, gamertag: s.player_gamertag, goals: 0, assists: 0, matches: 0, rating_sum: 0, rating_count: 0 };
    }
    const rating = Number(s.rating);
    playerMap[key].goals += Number(s.goals || 0);
    playerMap[key].assists += Number(s.assists || 0);
    playerMap[key].matches += 1;
    if (Number.isFinite(rating) && rating > 0) {
      playerMap[key].rating_sum += rating;
      playerMap[key].rating_count += 1;
    }
  }

  const players = Object.values(playerMap).map(p => ({
    ...p,
    avg_rating: p.rating_count > 0 ? (p.rating_sum / p.rating_count).toFixed(1) : "—",
  }));

  const tabs = [
    { key: "goals", label: "Top Scorers", icon: Target, sort: (a, b) => b.goals - a.goals },
    { key: "assists", label: "Top Assists", icon: Zap, sort: (a, b) => b.assists - a.assists },
    { key: "rating", label: "Best Rating", icon: Star, sort: (a, b) => (Number.parseFloat(b.avg_rating) || 0) - (Number.parseFloat(a.avg_rating) || 0) },
  ];

  const activeTab = tabs.find(t => t.key === tab);
  const sorted = [...players].sort(activeTab.sort).slice(0, 10);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <Trophy className="w-5 h-5 text-warning" />
        <span className="leading-relaxed text-lg font-bold text-foreground">Tournament Leaderboard</span>
      </div>

      {/* Sub tabs */}
      <div className="flex border-b border-border">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs leading-relaxed uppercase tracking-wider transition-colors",
                tab === t.key ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {sorted.length === 0 ? (
        <div className="py-10 text-center text-muted-foreground text-sm">No stats recorded yet.</div>
      ) : (
        <div className="divide-y divide-border">
          {sorted.map((p, i) => (
            <div key={p.email} className="flex items-center gap-4 px-5 py-3">
              <span className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center leading-relaxed font-bold text-sm shrink-0",
                i === 0 ? "bg-warning/20 text-warning" :
                i === 1 ? "bg-muted-foreground/20 text-muted-foreground" :
                i === 2 ? "bg-amber-700/20 text-amber-600" :
                "text-muted-foreground text-xs"
              )}>
                {i + 1}
              </span>
              <p className="flex-1 leading-relaxed font-semibold text-foreground text-sm truncate">{p.gamertag || p.email}</p>
              <div className="flex items-center gap-4 text-sm shrink-0">
                <span className="text-muted-foreground text-xs">{p.matches}g</span>
                {tab === "goals" && <span className="leading-relaxed font-bold text-success w-6 text-right">{p.goals}</span>}
                {tab === "assists" && <span className="leading-relaxed font-bold text-primary w-6 text-right">{p.assists}</span>}
                {tab === "rating" && <span className={cn("leading-relaxed font-bold w-10 text-right", Number.parseFloat(p.avg_rating) >= 7 ? "text-success" : Number.parseFloat(p.avg_rating) >= 6 ? "text-warning" : "text-muted-foreground")}>{p.avg_rating}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
