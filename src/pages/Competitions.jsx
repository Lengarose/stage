import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { stageClient } from "@/api/stageClient";
import { Trophy, Globe, ChevronRight, Star, TrendingUp, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { COMPETITIONS, sortStandings } from "@/lib/competitionUtils";
import { useTranslation } from "@/hooks/useTranslation";

const TIER_LABEL = { 1: "TIER I", 2: "TIER II", 3: "TIER III" };
const SHARP_PANEL_CLIP = "polygon(3% 0, 100% 0, 97% 100%, 0 100%)";

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
  const { t } = useTranslation();
  const rows = sortStandings(standings).slice(0, 5);
  if (!rows.length) return (
    <div className="py-8 text-center text-xs text-muted-foreground uppercase tracking-widest">
      {t("competitionFlow.seasonNotStarted")}
    </div>
  );
  return (
    <div className="w-full">
      <div className="grid grid-cols-[1.5rem_1fr_repeat(4,2.5rem)] gap-x-1 px-3 mb-1">
        {["#", t("competitionFlow.club"), t("competitionFlow.playedShort"), t("competitionFlow.goalDifferenceShort"), t("competitionFlow.pointsShort"), ""].map((h, i) => (
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
  const { t } = useTranslation();
  const activeSeason = season;
  return (
    <Link to={`/competitions/${meta.slug}`} className="block group">
      <div className={cn(
        "relative min-h-[19rem] overflow-hidden border bg-black/55 shadow-[0_18px_50px_rgba(0,0,0,0.28)] transition-all duration-200 hover:-translate-y-1 hover:border-primary/50",
        meta.borderColor
      )} style={{ clipPath: SHARP_PANEL_CLIP, borderLeftWidth: 3, borderLeftColor: meta.color }}>
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background: `radial-gradient(circle at 18% 8%, ${meta.color}22, transparent 32%), linear-gradient(115deg, rgba(8,18,36,0.92), rgba(2,8,20,0.74) 54%, rgba(8,18,36,0.92))`,
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-primary/50" />

        {/* Header */}
        <div className="relative px-6 pt-6 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-1 border", meta.badgeClass)}>
                  {TIER_LABEL[meta.tier]}
                </span>
                {activeSeason && (
                  <span className={cn("text-[9px] uppercase tracking-widest px-2 py-1 border font-bold",
                    activeSeason.status === "league_phase" ? "text-success border-success/30 bg-success/5" :
                    activeSeason.status === "registration" ? "text-primary border-primary/30 bg-primary/5" :
                    activeSeason.status === "playoffs" || activeSeason.status === "knockout" ? "text-warning border-warning/30 bg-warning/5" :
                    "text-muted-foreground border-border bg-muted"
                  )}>
                    {activeSeason.status === "league_phase" ? t("competitionFlow.live") :
                     activeSeason.status === "registration" ? t("competitionFlow.open") :
                     activeSeason.status === "playoffs" ? "Playoffs" :
                     activeSeason.status === "knockout" ? "Knockout" :
                     activeSeason.status}
                  </span>
                )}
              </div>
              <h2
                className="font-heading font-black text-3xl text-foreground uppercase leading-none"
                style={{ transform: "skewX(-6deg)", transformOrigin: "left center", letterSpacing: "-0.02em" }}
              >
                {meta.name.replace("STAGE ", "")}
              </h2>
              <p className="max-w-sm text-sm text-muted-foreground mt-2 leading-snug">{meta.description}</p>
            </div>
            <ChevronRight className={cn("w-4 h-4 mt-1 shrink-0 transition-transform group-hover:translate-x-0.5", meta.textColor)} />
          </div>

          {activeSeason && (
            <div className="flex items-center gap-3 mt-3">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {activeSeason.season_label || t("competitionFlow.seasonNumber", { number: activeSeason.season_number })}
              </span>
              <span className="text-[10px] text-muted-foreground">·</span>
              <span className="text-[10px] text-muted-foreground">{t("competitionFlow.clubsCount", { count: activeSeason.num_clubs || 0 })}</span>
              <span className="text-[10px] text-muted-foreground">·</span>
              <span className="text-[10px] text-muted-foreground">{t("competitionFlow.matchdayShort", { current: activeSeason.current_matchday || 1, total: activeSeason.league_matchday_total || "—" })}</span>
            </div>
          )}
        </div>

        {/* Mini standings */}
        <div className="relative pb-3">
          <MiniStandingsTable standings={standings} />
        </div>

        <div className={cn("relative mx-6 mb-5 pt-3 border-t border-border/40 flex items-center justify-between")}>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{t("competitionFlow.viewFullStandings")} →</span>
          {activeSeason?.prize_pool_stc > 0 && (
            <span className="text-[10px] font-bold text-warning">{t("competitionFlow.stcPrize", { amount: (activeSeason.prize_pool_stc / 1_000_000).toFixed(1) })}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function Competitions() {
  const { t } = useTranslation();
  const [competitions, setCompetitions] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [standingsMap, setStandingsMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [comps, allSeasons] = await Promise.all([
        stageClient.entities.Competition.list("tier", 10).catch(() => []),
        stageClient.entities.CompetitionSeason.list("-season_number", 30).catch(() => []),
      ]);
      setCompetitions(comps);
      setSeasons(allSeasons);

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
          const rows = await stageClient.entities.CompetitionStanding.filter(
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
                className="font-heading font-black text-4xl md:text-6xl text-foreground uppercase max-w-5xl leading-none"
                style={{ transform: "skewX(-8deg)", letterSpacing: "-0.02em", transformOrigin: "left center" }}
              >
                {t("competitionFlow.competitionsTitle")}
              </h1>
              <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest">
                {t("competitionFlow.competitionsSubtitle")}
              </p>
            </div>
          </div>
        </div>

        {/* ── Official STAGE tournament pyramid ───────────────── */}
        {competitions.length === 0 ? (
          <div className="border border-dashed border-border bg-black/30 p-16 text-center" style={{ clipPath: SHARP_PANEL_CLIP }}>
            <Trophy className="w-10 h-10 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground uppercase tracking-widest mb-2">{t("competitionFlow.noCompetitions")}</p>
            <p className="text-xs text-muted-foreground">{t("competitionFlow.seedCompetitions")}</p>
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
            <h2 className="text-xs font-black uppercase tracking-widest text-foreground">{t("competitionFlow.howQualificationWorks")}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              { icon: Globe, label: t("competitionFlow.regionalLeagues"), desc: t("competitionFlow.regionalLeaguesDesc"), color: "text-violet-400" },
              { icon: Star, label: t("competitionFlow.supremeLeague"), desc: t("competitionFlow.supremeLeagueDesc"), color: "text-yellow-400" },
              { icon: Trophy, label: t("competitionFlow.eliteLeague"), desc: t("competitionFlow.eliteLeagueDesc"), color: "text-primary" },
              { icon: Trophy, label: t("competitionFlow.stageChallenger"), desc: t("competitionFlow.stageChallengerDesc"), color: "text-violet-400" },
            ].map(step => (
              <div
                key={step.label}
                className="border border-border/70 bg-black/45 p-5 flex gap-3"
                style={{ clipPath: "polygon(6% 0, 100% 0, 94% 100%, 0 100%)" }}
              >
                <step.icon className={cn("w-4 h-4 mt-0.5 shrink-0", step.color)} />
                <div>
                  <p className="text-xs font-bold text-foreground uppercase tracking-wider mb-1">{step.label}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="border border-primary/25 bg-primary/5 p-5" style={{ clipPath: "polygon(2% 0, 100% 0, 98% 100%, 0 100%)" }}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Globe className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h2 className="font-heading text-lg text-foreground uppercase tracking-tight">Regional Leagues</h2>
                <p className="text-sm text-muted-foreground">
                  Regional divisions now live on their own league page. Division 1 standings decide qualification for these official STAGE tournaments.
                </p>
              </div>
            </div>
            <Link
              to="/leagues"
              className="inline-flex h-11 items-center justify-center px-5 text-xs font-black uppercase tracking-[0.16em] text-primary transition hover:text-primary/80"
              style={{
                clipPath: "polygon(9% 0, 100% 0, 91% 100%, 0 100%)",
                background: "linear-gradient(135deg, rgba(34,211,238,0.14), rgba(15,23,42,0.72))",
                border: "1px solid rgba(34,211,238,0.34)",
              }}
            >
              Open Regional Leagues
            </Link>
          </div>
        </section>

      </div>
    </div>
  );
}
