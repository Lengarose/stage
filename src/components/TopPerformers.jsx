import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Trophy, Target, Zap, Star, Shield, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "scorers", label: "Top Scorers", icon: Target },
  { id: "assisters", label: "Assisters", icon: Zap },
  { id: "rated", label: "Best Rated", icon: Star },
  { id: "clubs", label: "Top Clubs", icon: Shield },
];

export default function TopPerformers() {
  const [players, setPlayers] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [activeTab, setActiveTab] = useState("scorers");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Stagger to avoid rate-limiting burst alongside other widgets
      await new Promise(r => setTimeout(r, 700));
      const [pl, cl] = await Promise.all([
        base44.entities.Player.list("-goals", 10),
        base44.entities.Club.list("-rating", 5),
      ]);
      setPlayers(pl);
      setClubs(cl);
      setLoading(false);
    }
    load();
  }, []);

  const scorers = [...players].sort((a, b) => (b.goals || 0) - (a.goals || 0)).slice(0, 5);
  const assisters = [...players].sort((a, b) => (b.assists || 0) - (a.assists || 0)).slice(0, 5);
  const rated = [...players].sort((a, b) => (b.avg_match_rating || 0) - (a.avg_match_rating || 0)).slice(0, 5);

  function getMedal(idx) {
    if (idx === 0) return "text-yellow-400";
    if (idx === 1) return "text-slate-300";
    if (idx === 2) return "text-amber-600";
    return "text-muted-foreground";
  }

  const renderPlayerRows = (list, statKey, statLabel) => {
    if (loading) return <Skeleton />;
    if (!list.length || list.every(p => !p[statKey])) {
      return <p className="text-sm text-muted-foreground text-center py-6">No data yet — play some matches!</p>;
    }
    return list.map((p, i) => (
      <Link key={p.id} to={`/players/${p.id}`} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/60 transition-all group">
        <span className={cn("w-5 text-center text-xs font-bold shrink-0", getMedal(i))}>{i + 1}</span>
        <div className="w-8 h-8 rounded-full bg-secondary border border-border shrink-0 overflow-hidden flex items-center justify-center">
          {p.avatar_url
            ? <img src={p.avatar_url} alt={p.gamertag} className="w-full h-full object-cover" style={{ objectPosition: p.avatar_position || "center" }} />
            : <span className="text-[10px] font-bold text-primary">{p.gamertag?.[0]?.toUpperCase()}</span>
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate leading-relaxed">{p.gamertag}</p>
          <p className="text-[10px] text-muted-foreground">{p.position} · {p.matches_played || 0} matches</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-primary leading-relaxed">{p[statKey] || 0}</p>
          <p className="text-[10px] text-muted-foreground">{statLabel}</p>
        </div>
      </Link>
    ));
  };

  const renderClubs = () => {
    if (loading) return <Skeleton />;
    return clubs.map((c, i) => (
      <Link key={c.id} to={`/clubs/${c.id}`} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/60 transition-all group">
        <span className={cn("w-5 text-center text-xs font-bold shrink-0", getMedal(i))}>{i + 1}</span>
        <div className="w-8 h-8 rounded-full bg-secondary border border-border shrink-0 overflow-hidden flex items-center justify-center">
          {c.logo_url
            ? <img src={c.logo_url} alt={c.name} className="w-full h-full object-cover" />
            : <Shield className="w-4 h-4 text-primary" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate leading-relaxed">[{c.tag}] {c.name}</p>
          <p className="text-[10px] text-muted-foreground">{c.wins || 0}W · {c.losses || 0}L · {c.draws || 0}D</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-primary leading-relaxed">{c.rating || 1000}</p>
          <p className="text-[10px] text-muted-foreground">rating</p>
        </div>
      </Link>
    ));
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h2 className="leading-relaxed text-base font-bold text-foreground uppercase tracking-wider">Top Performers</h2>
        </div>
        <Link to="/rankings" className="text-xs text-primary hover:underline leading-relaxed">View All</Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 pb-3 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all leading-relaxed",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <Icon className="w-3 h-3" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="px-2 pb-4 space-y-0.5">
        {activeTab === "scorers" && renderPlayerRows(scorers, "goals", "goals")}
        {activeTab === "assisters" && renderPlayerRows(assisters, "assists", "assists")}
        {activeTab === "rated" && renderPlayerRows(rated, "avg_match_rating", "avg rating")}
        {activeTab === "clubs" && renderClubs()}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2 px-3 py-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 animate-pulse">
          <div className="w-5 h-3 bg-secondary rounded" />
          <div className="w-8 h-8 bg-secondary rounded-full" />
          <div className="flex-1 space-y-1">
            <div className="h-3 bg-secondary rounded w-3/4" />
            <div className="h-2 bg-secondary rounded w-1/2" />
          </div>
          <div className="w-8 h-3 bg-secondary rounded" />
        </div>
      ))}
    </div>
  );
}