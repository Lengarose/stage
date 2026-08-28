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
  const panelClip = { clipPath: "polygon(18px 0, 100% 0, calc(100% - 18px) 100%, 0 100%)" };
  const chipClip = { clipPath: "polygon(9px 0, 100% 0, calc(100% - 9px) 100%, 0 100%)" };

  return (
    <div className="relative overflow-hidden border border-cyan-200/15 bg-[#07121f]/90 shadow-[0_0_38px_rgba(148,163,184,0.08)]" style={panelClip}>
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-slate-200/55 to-transparent" />
      <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.03] px-5 py-4">
        <Trophy className="w-5 h-5 text-cyan-100" />
        <span className="font-heading text-sm font-black uppercase tracking-[0.16em] text-foreground">Tournament Leaderboard</span>
      </div>

      {/* Sub tabs */}
      <div className="flex overflow-x-auto border-b border-white/10 px-4">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              type="button"
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "relative flex min-w-max items-center justify-center gap-1.5 px-4 py-3 font-heading text-[10px] font-black uppercase tracking-[0.16em] transition-colors",
                tab === t.key ? "text-cyan-100" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
              {tab === t.key && (
                <span className="absolute inset-x-3 bottom-0 h-[2px] bg-gradient-to-r from-cyan-200 via-slate-100 to-transparent" />
              )}
            </button>
          );
        })}
      </div>

      {sorted.length === 0 ? (
        <div className="py-10 text-center text-muted-foreground text-sm">No stats recorded yet.</div>
      ) : (
        <div className="divide-y divide-white/10">
          {sorted.map((p, i) => (
            <div key={p.email} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.025]">
              <span className={cn(
                "flex h-8 w-9 shrink-0 items-center justify-center border text-sm font-black leading-relaxed",
                i === 0 ? "border-amber-200/35 bg-amber-300/10 text-amber-100" :
                i === 1 ? "border-slate-200/25 bg-slate-200/8 text-slate-100" :
                i === 2 ? "border-cyan-200/25 bg-cyan-300/8 text-cyan-100" :
                "border-white/10 bg-white/[0.035] text-muted-foreground"
              )}
                style={chipClip}>
                {i + 1}
              </span>
              <p className="min-w-0 flex-1 truncate font-heading text-sm font-black uppercase tracking-wide leading-relaxed text-foreground">{p.gamertag || p.email}</p>
              <div className="flex items-center gap-4 text-sm shrink-0">
                <span className="text-muted-foreground text-xs">{p.matches}g</span>
                {tab === "goals" && <span className="w-8 text-right font-heading text-lg font-black leading-relaxed text-cyan-100">{p.goals}</span>}
                {tab === "assists" && <span className="w-8 text-right font-heading text-lg font-black leading-relaxed text-cyan-100">{p.assists}</span>}
                {tab === "rating" && <span className="w-12 text-right font-heading text-lg font-black leading-relaxed text-cyan-100">{p.avg_rating}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
