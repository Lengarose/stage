import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Trophy, Globe, ChevronRight, Star, TrendingUp, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { COMPETITIONS, getCompetitionMeta, sortStandings } from "@/lib/competitionUtils";

const TIER_LABEL = { 1: "TIER I", 2: "TIER II", 3: "TIER III" };

function FormBadge({ result }) {
  return (
    <span className={cn(
      "w-5 h-5 rounded-sm text-[9px] font-black flex items-center justify-center",
      result === "W" ? "bg-success/20 text-success" :
      result === "D" ? "bg-muted-foreground/20 text-muted-foreground" :
      "bg-destructive/20 text-destructive"
    )}>{result}</span>
  );
}

function MiniStandingsTable({ standings }) {
  const rows = sortStandings(standings).slice(0, 5);
  if (!rows.length) return (
    <div className="py-8 text-center text-xs text-muted-foreground uppercase tracking-widest">
      Season not started
    </div>
  );
  return (
    <div className="w-full">
      <div className="grid grid-cols-[1.5rem_1fr_repeat(4,2.5rem)] gap-x-1 px-3 mb-1">
        {["#", "Club", "P", "GD", "Pts", ""].map((h, i) => (
          <span key={i} className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold text-center first:text-left">{h}</span>
        ))}
      </div>
      {rows.map((s, i) => (
        <div key={s.id} className={cn(
          "grid grid-cols-[1.5rem_1fr_repeat(4,2.5rem)] gap-x-1 px-3 py-1.5 items-center border-t border-border/40",
          i === 0 && "bg-warning/5"
        )}>
          <span className={cn("text-xs font-black tabular-nums", i === 0 ? "text-warning" : "text-muted-foreground")}>{i + 1}</span>
          <div className="flex items-center gap-1.5 min-w-0">
            {s.club_logo_url
              ? <img src={s.club_logo_url} alt={s.club_name} className="w-4 h-4 object-contain shrink-0" />
              : <Shield className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />}
            <span className="text-xs font-semibold text-foreground truncate">{s.club_tag || s.club_name}</span>
          </div>
          <span className="text-xs text-muted-foreground text-center tabular-nums">{s.played}</span>
          <span className={cn("text-xs text-center tabular-nums font-semibold",
            s.goal_difference > 0 ? "text-success" : s.goal_difference < 0 ? "text-destructive" : "text-muted-foreground"
          )}>{s.goal_difference > 0 ? "+" : ""}{s.goal_difference}</span>
          <span className="text-xs font-black text-foreground text-center tabular-nums">{s.points}</span>
          <div className="flex gap-0.5 justify-end">
            {(s.form || []).slice(0, 3).map((r, j) => <FormBadge key={j} result={r} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function CompetitionCard({ meta, season, standings }) {
  const activeSeason = season;
  return (
    <Link to={`/competitions/${meta.slug}`} className="block group">
      <div className={cn(
        "bg-card border rounded overflow-hidden transition-all duration-200 hover:border-opacity-60",
        meta.borderColor
      )} style={{ borderLeftWidth: 3, borderLeftColor: meta.color }}>

        {/* Header */}
        <div className="relative px-5 pt-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={cn("text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border", meta.badgeClass)}>
                  {TIER_LABEL[meta.tier]}
                </span>
                {activeSeason && (
                  <span className={cn("text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border font-bold",
                    activeSeason.status === "league_phase" ? "text-success border-success/30 bg-success/5" :
                    activeSeason.status === "registration" ? "text-primary border-primary/30 bg-primary/5" :
                    activeSeason.status === "playoffs" || activeSeason.status === "knockout" ? "text-warning border-warning/30 bg-warning/5" :
                    "text-muted-foreground border-border bg-muted"
                  )}>
                    {activeSeason.status === "league_phase" ? "Live" :
                     activeSeason.status === "registration" ? "Open" :
                     activeSeason.status === "playoffs" ? "Playoffs" :
                     activeSeason.status === "knockout" ? "Knockout" :
                     activeSeason.status}
                  </span>
                )}
              </div>
              <h2
                className="font-heading font-black text-2xl text-foreground uppercase leading-none"
                style={{ transform: "skewX(-6deg)", transformOrigin: "left center", letterSpacing: "-0.02em" }}
              >
                {meta.name.replace("STAGE ", "")}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">{meta.description}</p>
            </div>
            <ChevronRight className={cn("w-4 h-4 mt-1 shrink-0 transition-transform group-hover:translate-x-0.5", meta.textColor)} />
          </div>

          {activeSeason && (
            <div className="flex items-center gap-3 mt-3">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {activeSeason.season_label || `Season ${activeSeason.season_number}`}
              </span>
              <span className="text-[10px] text-muted-foreground">·</span>
              <span className="text-[10px] text-muted-foreground">{activeSeason.num_clubs || 0} clubs</span>
              <span className="text-[10px] text-muted-foreground">·</span>
              <span className="text-[10px] text-muted-foreground">MD {activeSeason.current_matchday || 1}/{activeSeason.league_matchday_total || "—"}</span>
            </div>
          )}
        </div>

        {/* Mini standings */}
        <div className="pb-3">
          <MiniStandingsTable standings={standings} />
        </div>

        <div className={cn("mx-5 mb-4 pt-3 border-t border-border/40 flex items-center justify-between")}>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">View full standings →</span>
          {activeSeason?.prize_pool_stc > 0 && (
            <span className="text-[10px] font-bold text-warning">{(activeSeason.prize_pool_stc / 1_000_000).toFixed(1)}M STC prize</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function Competitions() {
  const [competitions, setCompetitions] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [standingsMap, setStandingsMap] = useState({});
  const [regionalLeagues, setRegionalLeagues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [comps, allSeasons, leagues] = await Promise.all([
        base44.entities.Competition.list("tier", 10).catch(() => []),
        base44.entities.CompetitionSeason.list("-season_number", 30).catch(() => []),
        base44.entities.RegionalLeague.list("-season_number", 20).catch(() => []),
      ]);
      setCompetitions(comps);
      setSeasons(allSeasons);
      setRegionalLeagues(leagues);

      // For each competition, find the latest non-completed season and load its standings
      const latestSeasons = {};
      for (const meta of COMPETITIONS) {
        const comp = comps.find(c => c.slug === meta.slug);
        if (!comp) continue;
        const compSeasons = allSeasons
          .filter(s => s.competition_id === comp.id)
          .sort((a, b) => b.season_number - a.season_number);
        const active = compSeasons.find(s => s.status !== "completed") || compSeasons[0];
        if (active) latestSeasons[meta.slug] = active;
      }

      const standingResults = await Promise.all(
        Object.entries(latestSeasons).map(async ([slug, season]) => {
          const rows = await base44.entities.CompetitionStanding.filter(
            { season_id: season.id }, null, 50
          ).catch(() => []);
          return [slug, rows];
        })
      );
      setStandingsMap(Object.fromEntries(standingResults));
      setSeasons({ raw: allSeasons, bySlug: latestSeasons });
    } catch (err) {
      console.error("[Competitions] load error:", err);
    } finally {
      setLoading(false);
    }
  }

  const seasonsBySlug = seasons.bySlug || {};
  const activeLeagues = regionalLeagues.filter(l => l.status === "in_progress");
  const openLeagues = regionalLeagues.filter(l => l.status === "registration");

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-10">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-warning shrink-0" />
            <div>
              <h1
                className="font-heading font-black text-5xl md:text-6xl text-foreground uppercase"
                style={{ transform: "skewX(-8deg)", letterSpacing: "-0.02em", transformOrigin: "left center" }}
              >
                COMPETITIONS
              </h1>
              <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest">
                The STAGE competition pyramid
              </p>
            </div>
          </div>
        </div>

        {/* ── Competition pyramid ─────────────────────────────── */}
        {competitions.length === 0 ? (
          <div className="border border-dashed border-border rounded p-16 text-center">
            <Trophy className="w-10 h-10 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground uppercase tracking-widest mb-2">No competitions found</p>
            <p className="text-xs text-muted-foreground">An admin needs to seed the 3 permanent competitions first.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {COMPETITIONS.map(meta => {
              const comp = competitions.find(c => c.slug === meta.slug);
              const season = comp ? seasonsBySlug[meta.slug] : null;
              const standings = standingsMap[meta.slug] || [];
              return (
                <CompetitionCard key={meta.slug} meta={meta} season={season} standings={standings} />
              );
            })}
          </div>
        )}

        {/* ── Qualification flow explainer ────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="text-xs font-black uppercase tracking-widest text-foreground">How Qualification Works</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: Globe, label: "Regional Leagues", desc: "Compete in your country's league. Top finishers earn a qualification spot.", color: "text-violet-400" },
              { icon: Trophy, label: "STAGE Challenger", desc: "Challengers prove themselves. Top clubs promote to Elite League.", color: "text-violet-400" },
              { icon: Star, label: "Supreme League", desc: "The best Elite League clubs earn the right to compete at the highest level.", color: "text-yellow-400" },
            ].map(step => (
              <div key={step.label} className="bg-card border border-border rounded p-4 flex gap-3">
                <step.icon className={cn("w-4 h-4 mt-0.5 shrink-0", step.color)} />
                <div>
                  <p className="text-xs font-bold text-foreground uppercase tracking-wider mb-1">{step.label}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Regional Leagues ────────────────────────────────── */}
        {(activeLeagues.length > 0 || openLeagues.length > 0) && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <Globe className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-black uppercase tracking-widest text-foreground">Regional Leagues</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...activeLeagues, ...openLeagues].slice(0, 9).map(league => {
                const targetMeta = getCompetitionMeta(
                  COMPETITIONS.find(c => c.name === league.target_competition_name)?.slug || "challenger"
                );
                return (
                  <div key={league.id} className="bg-card border border-border rounded p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="text-sm font-bold text-foreground leading-tight">{league.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{league.region} · Season {league.season_number}</p>
                      </div>
                      <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0",
                        league.status === "in_progress" ? "text-success border-success/30 bg-success/5" :
                        "text-primary border-primary/30 bg-primary/5"
                      )}>
                        {league.status === "in_progress" ? "Live" : "Open"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{league.num_clubs || 0}/{league.max_clubs} clubs</span>
                      <span>·</span>
                      <span className={targetMeta.textColor}>→ {league.target_competition_name || "STAGE"}</span>
                      {league.promoted_slots > 0 && <span className="text-muted-foreground">({league.promoted_slots} spots)</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
