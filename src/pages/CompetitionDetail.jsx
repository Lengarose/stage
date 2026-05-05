import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Trophy, Shield, ChevronLeft, ChevronDown, Star, CheckCircle2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { getCompetitionMeta, sortStandings, processFixtureResult } from "@/lib/competitionUtils";

const PHASE_LABEL = {
  league: "League Phase",
  playoff_round: "Playoff Round",
  knockout_r16: "Round of 16",
  knockout_qf: "Quarter-Finals",
  knockout_sf: "Semi-Finals",
  knockout_final: "Final",
};

const STATUS_LABEL = {
  draft: "Draft",
  registration: "Registration",
  league_phase: "League Phase",
  playoff_round: "Playoff Round",
  knockout_r16: "Round of 16",
  knockout_qf: "Quarter-Finals",
  knockout_sf: "Semi-Finals",
  knockout_final: "Final",
  completed: "Completed",
  archived: "Archived",
};

function FormBadge({ result }) {
  return (
    <span className={cn(
      "w-5 h-5 rounded-sm text-[9px] font-black flex items-center justify-center shrink-0",
      result === "W" ? "bg-success/20 text-success" :
      result === "D" ? "bg-muted-foreground/20 text-muted-foreground" :
      "bg-destructive/20 text-destructive"
    )}>{result}</span>
  );
}

function StandingsTable({ standings, directSpots = 8, playoffSpots = 16 }) {
  const rows = sortStandings(standings);
  if (!rows.length) return (
    <div className="border border-dashed border-border rounded p-12 text-center">
      <Trophy className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
      <p className="text-sm text-muted-foreground uppercase tracking-widest">No standings yet</p>
    </div>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[520px]">
        <thead>
          <tr className="border-b border-border">
            {["#", "Club", "P", "W", "D", "L", "GF", "GA", "GD", "Pts", "Form"].map((h, i) => (
              <th key={i} className={cn(
                "py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground",
                i === 0 ? "text-left pl-3 w-8" : i === 1 ? "text-left w-48" : "text-center w-10"
              )}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => {
            const pos = i + 1;
            const isDirect = pos <= directSpots;
            const isPlayoff = pos > directSpots && pos <= directSpots + playoffSpots;
            const isEliminated = pos > directSpots + playoffSpots;
            return (
              <tr key={s.id} className={cn(
                "border-b border-border/30 transition-colors hover:bg-secondary/30",
                isDirect && i === 0 && "bg-warning/5",
                isDirect && i > 0 && "bg-success/3",
                isEliminated && "opacity-60"
              )}>
                <td className="pl-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    {isEliminated
                      ? <span className="w-1 h-4 rounded-sm bg-destructive/50 shrink-0" />
                      : isPlayoff
                      ? <span className="w-1 h-4 rounded-sm bg-primary/50 shrink-0" />
                      : <span className={cn("w-1 h-4 rounded-sm shrink-0", i === 0 ? "bg-warning" : "bg-success/70")} />
                    }
                    <span className={cn("text-xs font-black tabular-nums w-4",
                      i === 0 ? "text-warning" : isDirect ? "text-success" : isEliminated ? "text-muted-foreground/50" : "text-muted-foreground"
                    )}>{pos}</span>
                  </div>
                </td>
                <td className="py-2.5">
                  <Link to={`/clubs/${s.club_id}`} className="flex items-center gap-2 hover:opacity-80">
                    {s.club_logo_url
                      ? <img src={s.club_logo_url} alt={s.club_name} className="w-5 h-5 object-contain shrink-0" />
                      : <Shield className="w-4 h-4 text-muted-foreground/30 shrink-0" />}
                    <span className="font-semibold text-foreground text-xs truncate">{s.club_name}</span>
                    {s.club_tag && <span className="text-muted-foreground text-[10px]">[{s.club_tag}]</span>}
                  </Link>
                </td>
                {[s.played, s.wins, s.draws, s.losses, s.goals_for, s.goals_against].map((v, j) => (
                  <td key={j} className="text-center py-2.5 text-xs text-muted-foreground tabular-nums">{v ?? 0}</td>
                ))}
                <td className={cn("text-center py-2.5 text-xs font-semibold tabular-nums",
                  (s.goal_difference ?? 0) > 0 ? "text-success" : (s.goal_difference ?? 0) < 0 ? "text-destructive" : "text-muted-foreground"
                )}>{(s.goal_difference ?? 0) > 0 ? "+" : ""}{s.goal_difference ?? 0}</td>
                <td className="text-center py-2.5 text-xs font-black text-foreground tabular-nums">{s.points ?? 0}</td>
                <td className="py-2.5 pr-2">
                  <div className="flex gap-0.5 justify-end">
                    {(s.form || []).slice(0, 5).map((r, j) => <FormBadge key={j} result={r} />)}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex items-center gap-4 px-3 pt-3 pb-1 flex-wrap">
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-warning" /><span className="text-[10px] text-muted-foreground">1st (Champion)</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-success/70" /><span className="text-[10px] text-muted-foreground">2–{directSpots}: Direct to R16</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-primary/50" /><span className="text-[10px] text-muted-foreground">{directSpots + 1}–{directSpots + playoffSpots}: Playoff Round</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-destructive/50" /><span className="text-[10px] text-muted-foreground">{directSpots + playoffSpots + 1}+: Eliminated</span></div>
      </div>
    </div>
  );
}

function FixtureRow({ fixture, isAdmin, onSubmitResult, legLabel, isFinalLeg }) {
  const [editing, setEditing] = useState(false);
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [tieWinner, setTieWinner] = useState(""); // for final leg: explicit tie winner override
  const [saving, setSaving] = useState(false);

  const isKnockout = fixture.phase !== "league";

  async function save() {
    setSaving(true);
    const hs = parseInt(home) || 0;
    const as_ = parseInt(away) || 0;
    // For league fixtures, auto-determine winner. For knockout leg 2, use explicit override if set.
    const winnerId = isFinalLeg && tieWinner
      ? tieWinner
      : (hs > as_ ? fixture.home_club_id : as_ > hs ? fixture.away_club_id : "");
    const winnerName = winnerId === fixture.home_club_id ? fixture.home_club_name
      : winnerId === fixture.away_club_id ? fixture.away_club_name : "";

    await base44.entities.CompetitionFixture.update(fixture.id, {
      home_score: hs, away_score: as_,
      winner_club_id: winnerId,
      winner_club_name: winnerName,
      status: "completed",
    });
    await processFixtureResult({ ...fixture, home_score: hs, away_score: as_, winner_club_id: winnerId, status: "completed" });
    setSaving(false);
    setEditing(false);
    onSubmitResult?.();
  }

  const isDone = fixture.status === "completed" || fixture.status === "forfeit";
  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-3 border-b border-border/40 last:border-0",
      isDone ? "opacity-90" : "hover:bg-secondary/20"
    )}>
      {legLabel && (
        <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold shrink-0 w-8">{legLabel}</span>
      )}
      <div className="flex-1 grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
        {/* Home */}
        <div className="flex items-center gap-2 justify-end">
          <span className="text-xs font-semibold text-foreground text-right">{fixture.home_club_name}</span>
          {fixture.home_club_logo_url
            ? <img src={fixture.home_club_logo_url} alt="" className="w-5 h-5 object-contain shrink-0" />
            : <Shield className="w-4 h-4 text-muted-foreground/30 shrink-0" />}
        </div>
        {/* Score */}
        <div className="text-center shrink-0">
          {isDone ? (
            <span className="font-black text-sm text-foreground tabular-nums px-2">
              {fixture.home_score} — {fixture.away_score}
            </span>
          ) : editing ? (
            <div className="flex items-center gap-1">
              <input value={home} onChange={e => setHome(e.target.value)} className="w-8 text-center bg-secondary border border-border rounded text-xs py-0.5 text-foreground" placeholder="0" />
              <span className="text-muted-foreground text-xs">—</span>
              <input value={away} onChange={e => setAway(e.target.value)} className="w-8 text-center bg-secondary border border-border rounded text-xs py-0.5 text-foreground" placeholder="0" />
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider px-2">vs</span>
          )}
        </div>
        {/* Away */}
        <div className="flex items-center gap-2 justify-start">
          {fixture.away_club_logo_url
            ? <img src={fixture.away_club_logo_url} alt="" className="w-5 h-5 object-contain shrink-0" />
            : <Shield className="w-4 h-4 text-muted-foreground/30 shrink-0" />}
          <span className="text-xs font-semibold text-foreground">{fixture.away_club_name}</span>
        </div>
      </div>

      {/* Admin controls */}
      {isAdmin && !isDone && (
        <div className="shrink-0 flex flex-col gap-1 items-end">
          {editing ? (
            <div className="flex gap-1 items-start">
              <div className="flex flex-col gap-1">
                {/* Leg 2 of knockout: show explicit winner override for ET/pens */}
                {isFinalLeg && isKnockout && (
                  <select
                    value={tieWinner}
                    onChange={e => setTieWinner(e.target.value)}
                    className="text-[9px] bg-secondary border border-border rounded px-1 py-0.5 text-foreground w-36"
                  >
                    <option value="">Tie winner (optional)</option>
                    <option value={fixture.home_club_id}>{fixture.home_club_name} wins</option>
                    <option value={fixture.away_club_id}>{fixture.away_club_name} wins</option>
                  </select>
                )}
              </div>
              <button onClick={save} disabled={saving} className="text-[10px] px-2 py-1 rounded bg-success/20 text-success border border-success/30 font-bold">{saving ? "..." : "Save"}</button>
              <button onClick={() => setEditing(false)} className="text-[10px] px-2 py-1 rounded border border-border text-muted-foreground">×</button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="text-[10px] px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground">Result</button>
          )}
        </div>
      )}
      {isDone && (
        <CheckCircle2 className="w-3.5 h-3.5 text-success/60 shrink-0" />
      )}
    </div>
  );
}

function TieCard({ leg1, leg2, isAdmin, onRefresh, label }) {
  const done1 = leg1?.status === "completed" || leg1?.status === "forfeit";
  const done2 = leg2?.status === "completed" || leg2?.status === "forfeit";

  let agg1 = 0, agg2 = 0;
  if (done1 && leg1) { agg1 += leg1.home_score ?? 0; agg2 += leg1.away_score ?? 0; }
  if (done2 && leg2) { agg1 += leg2.away_score ?? 0; agg2 += leg2.home_score ?? 0; }

  const hasAgg = done1 || done2;

  return (
    <div className="bg-card border border-border rounded overflow-hidden">
      {label && (
        <div className="px-4 py-2.5 bg-secondary/40 border-b border-border flex items-center justify-between gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</span>
          {hasAgg && (
            <span className={cn("text-[10px] font-black tabular-nums",
              agg1 > agg2 ? "text-foreground" : agg2 > agg1 ? "text-muted-foreground" : "text-warning"
            )}>
              Agg: {agg1} – {agg2}
              {agg1 === agg2 && done1 && done2 && <span className="text-warning ml-1">(tied)</span>}
            </span>
          )}
        </div>
      )}
      {leg1 && <FixtureRow fixture={leg1} isAdmin={isAdmin} onSubmitResult={onRefresh} legLabel="Leg 1" />}
      {leg2 && <FixtureRow fixture={leg2} isAdmin={isAdmin} onSubmitResult={onRefresh} legLabel="Leg 2" isFinalLeg />}
    </div>
  );
}

function FixturesPanel({ fixtures, isAdmin, onRefresh }) {
  if (!fixtures.length) return (
    <div className="border border-dashed border-border rounded p-12 text-center">
      <p className="text-sm text-muted-foreground uppercase tracking-widest">No fixtures generated yet</p>
    </div>
  );

  const leagueFixtures = fixtures.filter(f => f.phase === "league");
  const knockoutFixtures = fixtures.filter(f => f.phase !== "league");

  // League: group by matchday
  const byMatchday = {};
  leagueFixtures.forEach(f => {
    const k = f.matchday || 1;
    if (!byMatchday[k]) byMatchday[k] = [];
    byMatchday[k].push(f);
  });

  // Knockout: group by phase, then by tie_id
  const knockoutPhaseOrder = ["playoff_round", "knockout_r16", "knockout_qf", "knockout_sf", "knockout_final"];
  const byPhase = {};
  knockoutFixtures.forEach(f => {
    if (!byPhase[f.phase]) byPhase[f.phase] = {};
    const key = f.tie_id || `single-${f.id}`;
    if (!byPhase[f.phase][key]) byPhase[f.phase][key] = [];
    byPhase[f.phase][key].push(f);
  });

  return (
    <div className="space-y-6">
      {/* League phase by matchday */}
      {Object.keys(byMatchday).length > 0 && (
        <div className="space-y-3">
          {Object.entries(byMatchday).sort(([a], [b]) => Number(a) - Number(b)).map(([md, rows]) => (
            <div key={md} className="bg-card border border-border rounded overflow-hidden">
              <div className="px-4 py-2.5 bg-secondary/40 border-b border-border">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Matchday {md}</span>
              </div>
              {rows.map(f => <FixtureRow key={f.id} fixture={f} isAdmin={isAdmin} onSubmitResult={onRefresh} />)}
            </div>
          ))}
        </div>
      )}

      {/* Knockout phases as two-legged tie cards */}
      {knockoutPhaseOrder.filter(p => byPhase[p]).map(phase => {
        const ties = byPhase[phase];
        const tieKeys = Object.keys(ties).sort((a, b) => {
          const bpA = ties[a][0]?.bracket_position ?? 99;
          const bpB = ties[b][0]?.bracket_position ?? 99;
          return bpA - bpB;
        });
        return (
          <div key={phase} className="space-y-2">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1 mb-2">
              {PHASE_LABEL[phase] || phase}
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {tieKeys.map((tieKey, ti) => {
                const legs = ties[tieKey].sort((a, b) => (a.leg ?? 1) - (b.leg ?? 1));
                const [leg1, leg2] = legs;
                const isFinal = phase === "knockout_final";
                if (isFinal) {
                  return (
                    <div key={tieKey} className="lg:col-span-2 max-w-lg">
                      <div className="bg-card border border-border rounded overflow-hidden">
                        <div className="px-4 py-2.5 bg-secondary/40 border-b border-border">
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Final</span>
                        </div>
                        <FixtureRow fixture={leg1} isAdmin={isAdmin} onSubmitResult={onRefresh} />
                      </div>
                    </div>
                  );
                }
                const bp = leg1?.bracket_position ?? ti + 1;
                return (
                  <TieCard
                    key={tieKey}
                    leg1={leg1}
                    leg2={leg2}
                    isAdmin={isAdmin}
                    onRefresh={onRefresh}
                    label={`Tie ${bp}`}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function QualificationPanel({ entries }) {
  const pending = entries.filter(e => e.status === "pending");
  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <div className="border border-warning/20 bg-warning/5 rounded p-3 text-xs text-warning">
          {pending.length} pending qualification entr{pending.length === 1 ? "y" : "ies"} awaiting admin confirmation.
        </div>
      )}
      {!entries.length ? (
        <div className="border border-dashed border-border rounded p-12 text-center">
          <p className="text-sm text-muted-foreground uppercase tracking-widest">No qualification entries yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map(e => (
            <div key={e.id} className="bg-card border border-border rounded p-3 flex items-center gap-3">
              {e.club_logo_url
                ? <img src={e.club_logo_url} alt={e.club_name} className="w-8 h-8 object-contain shrink-0" />
                : <Shield className="w-6 h-6 text-muted-foreground/30 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{e.club_name}</p>
                <p className="text-[10px] text-muted-foreground">{e.regional_league_name || e.source_type} · Pos. {e.regional_finish_position || "—"}</p>
              </div>
              <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0",
                e.status === "confirmed" ? "text-success border-success/30 bg-success/5" :
                e.status === "pending" ? "text-warning border-warning/30 bg-warning/5" :
                e.status === "rejected" ? "text-destructive border-destructive/30 bg-destructive/5" :
                "text-muted-foreground border-border"
              )}>{e.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CompetitionDetail() {
  const { slug } = useParams();
  const meta = getCompetitionMeta(slug);

  const [competition, setCompetition] = useState(null);
  const [allSeasons, setAllSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [standings, setStandings] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [qualEntries, setQualEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [seasonPickerOpen, setSeasonPickerOpen] = useState(false);

  useEffect(() => { loadComp(); }, [slug]);
  useEffect(() => { if (selectedSeason) loadSeasonData(selectedSeason); }, [selectedSeason?.id]);

  async function loadComp() {
    setLoading(true);
    try {
      const [comps, user] = await Promise.all([
        base44.entities.Competition.filter({ slug }, null, 1).catch(() => []),
        base44.auth.me().catch(() => null),
      ]);
      setIsAdmin(user?.role === "admin");
      const comp = comps[0];
      if (!comp) { setLoading(false); return; }
      setCompetition(comp);
      const seasons = await base44.entities.CompetitionSeason.filter(
        { competition_id: comp.id }, "-season_number", 20
      ).catch(() => []);
      setAllSeasons(seasons);
      const active = seasons.find(s => s.status !== "completed" && s.status !== "archived" && s.status !== "draft") || seasons.find(s => s.status !== "archived" && s.status !== "draft") || seasons[0];
      if (active) setSelectedSeason(active);
      else setLoading(false);
    } catch (err) {
      console.error("[CompetitionDetail] loadComp:", err);
      setLoading(false);
    }
  }

  async function loadSeasonData(season) {
    setLoading(true);
    try {
      const [rows, fx, qual] = await Promise.all([
        base44.entities.CompetitionStanding.filter({ season_id: season.id }, null, 100).catch(() => []),
        base44.entities.CompetitionFixture.filter({ season_id: season.id }, "matchday", 300).catch(() => []),
        base44.entities.QualificationEntry.filter({ target_season_id: season.id }, null, 50).catch(() => []),
      ]);
      setStandings(rows);
      setFixtures(fx);
      setQualEntries(qual);
    } catch (err) {
      console.error("[CompetitionDetail] loadSeasonData:", err);
    } finally {
      setLoading(false);
    }
  }

  const completedFixtures = fixtures.filter(f => f.status === "completed" || f.status === "forfeit");
  const upcomingFixtures = fixtures.filter(f => f.status === "scheduled" || f.status === "awaiting_result" || f.status === "postponed");

  return (
    <div className="min-h-screen bg-background">

      {/* ── Hero header ─────────────────────────────────────── */}
      <div
        className="relative w-full border-b border-border"
        style={{ background: `linear-gradient(135deg, hsl(var(--background)) 0%, ${meta.color}18 100%)` }}
      >
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
          <Link to="/competitions" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-5 uppercase tracking-wider">
            <ChevronLeft className="w-3.5 h-3.5" /> Competitions
          </Link>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border", meta.badgeClass)}>
                  {["TIER I", "TIER II", "TIER III"][meta.tier - 1]}
                </span>
                {selectedSeason && (
                  <span className={cn("text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded border",
                    selectedSeason.status === "league_phase" ? "text-success border-success/30 bg-success/5" :
                    selectedSeason.status === "registration" ? "text-primary border-primary/30 bg-primary/5" :
                    selectedSeason.status === "completed" ? "text-muted-foreground border-border" :
                    "text-warning border-warning/30 bg-warning/5"
                  )}>
                    {STATUS_LABEL[selectedSeason.status] || selectedSeason.status.replace(/_/g, " ")}
                  </span>
                )}
              </div>
              <h1
                className="font-heading font-black text-5xl md:text-7xl uppercase"
                style={{ color: meta.color, transform: "skewX(-8deg)", letterSpacing: "-0.02em", transformOrigin: "left center" }}
              >
                {meta.name.replace("STAGE ", "")}
              </h1>
              <p className="text-sm text-muted-foreground mt-2">{meta.description}</p>
            </div>

            {/* Season picker */}
            {allSeasons.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setSeasonPickerOpen(v => !v)}
                  className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded text-sm font-bold text-foreground hover:border-primary/40"
                >
                  {selectedSeason ? (selectedSeason.season_label || `Season ${selectedSeason.season_number}`) : "Select Season"}
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                {seasonPickerOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded shadow-lg z-20 min-w-[160px]">
                    {allSeasons.map(s => (
                      <button
                        key={s.id}
                        onClick={() => { setSelectedSeason(s); setSeasonPickerOpen(false); }}
                        className={cn(
                          "w-full text-left px-4 py-2.5 text-sm hover:bg-secondary/60 transition-colors flex items-center justify-between gap-3",
                          selectedSeason?.id === s.id ? "text-primary font-bold" : "text-foreground"
                        )}
                      >
                        {s.season_label || `Season ${s.season_number}`}
                        <span className={cn("text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase",
                          s.status === "archived" ? "text-muted-foreground/50 border-border/50" :
                          s.status === "draft" ? "text-muted-foreground border-border" :
                          s.status === "completed" ? "text-muted-foreground border-border" :
                          s.status === "league_phase" ? "text-success border-success/30" :
                          "text-primary border-primary/30"
                        )}>{STATUS_LABEL[s.status] || s.status}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {selectedSeason && (
            <div className="flex items-center gap-4 mt-4 flex-wrap">
              <span className="text-xs text-muted-foreground">{selectedSeason.num_clubs || 0} clubs</span>
              {selectedSeason.status === "league_phase" && (
                <span className="text-xs text-muted-foreground">
                  MD {selectedSeason.current_matchday || 1}/{selectedSeason.league_matchday_total || 8}
                </span>
              )}
              {["playoff_round","knockout_r16","knockout_qf","knockout_sf","knockout_final"].includes(selectedSeason.status) && (
                <span className="text-xs font-bold" style={{ color: meta.color }}>
                  {STATUS_LABEL[selectedSeason.status]}
                </span>
              )}
              <span className="text-xs text-muted-foreground">{selectedSeason.platform}</span>
              {selectedSeason.prize_pool_stc > 0 && (
                <span className="text-xs font-bold text-warning">{(selectedSeason.prize_pool_stc / 1_000_000).toFixed(1)}M STC prize</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Main content ────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : !competition ? (
          <div className="border border-dashed border-border rounded p-16 text-center">
            <Trophy className="w-10 h-10 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground uppercase tracking-widest">Competition not found</p>
            <p className="text-xs text-muted-foreground mt-2">This competition may not be seeded yet.</p>
          </div>
        ) : !selectedSeason ? (
          <div className="border border-dashed border-border rounded p-16 text-center">
            <Star className="w-10 h-10 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground uppercase tracking-widest">No season started yet</p>
            {isAdmin && <p className="text-xs text-muted-foreground mt-2">Create the first season from Admin → Leagues.</p>}
          </div>
        ) : (
          <Tabs defaultValue="standings">
            <TabsList className="bg-transparent border-b border-border w-full rounded-none h-auto p-0 gap-0 justify-start mb-6">
              {[
                { value: "standings", label: "Standings" },
                { value: "fixtures", label: `Fixtures (${completedFixtures.length}/${fixtures.length})` },
                { value: "upcoming", label: `Upcoming (${upcomingFixtures.length})` },
                { value: "qualification", label: `Qualification (${qualEntries.length})` },
              ].map(tab => (
                <TabsTrigger key={tab.value} value={tab.value}
                  className="rounded-none border-b-2 border-transparent px-5 pb-3 pt-1 text-xs uppercase tracking-widest font-bold text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="standings">
              <StandingsTable
                standings={standings}
                directSpots={8}
                playoffSpots={16}
                totalClubs={selectedSeason?.num_clubs || standings.length}
              />
            </TabsContent>

            <TabsContent value="fixtures">
              <FixturesPanel
                fixtures={completedFixtures}
                isAdmin={isAdmin}
                onRefresh={() => loadSeasonData(selectedSeason)}
              />
            </TabsContent>

            <TabsContent value="upcoming">
              <FixturesPanel
                fixtures={upcomingFixtures}
                isAdmin={isAdmin}
                onRefresh={() => loadSeasonData(selectedSeason)}
              />
            </TabsContent>

            <TabsContent value="qualification">
              <QualificationPanel entries={qualEntries} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
