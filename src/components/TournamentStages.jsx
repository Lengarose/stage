import { useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Shield, Trophy } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildTournamentStages, canScheduleTournamentMatch, isStageResult, stageMatchSections, stageAggregate } from "@/lib/tournamentStages";
import { canOpenTournamentGameDay } from "@/lib/tournamentGameDay";

export default function TournamentStages({ tournament, matches, clubs, user, player, onSchedule, onGameDay, onStats, onSimulate, onResolve, isAdmin, renderStandings }) {
  const stages = buildTournamentStages(tournament, matches);
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(null);
  const trigger = useRef(null);
  const stage = stages.find(s => s.id === selected) || stages.find(s => s.matches.some(m => !isStageResult(m))) || stages.find(s => !s.matches.length) || stages[stages.length - 1];
  const modalStage = modal ? stages[modal.index] : null;
  const fixtures = (s) => s.matches.filter(m => !isStageResult(m) && !["cancelled", "canceled"].includes(m.status));
  const results = (s) => s.matches.filter(isStageResult);
  const isPlayer = tournament.participant_type === "player";
  const identity = (match, side) => {
    const club = clubs.find(c => String(c.id) === String(match[`${side}_club_id`]));
    const name = (isPlayer ? match[`${side}_player_name`] : match[`${side}_club_name`]) || match[`${side}_club_name`] || "TBD";
    const image = match[`${side}_avatar_url`] || match[`${side}_player_avatar_url`] || match[`${side}_club_logo_url`] || club?.logo_url;
    return <span className="flex min-w-0 items-center gap-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center">{image ? <img src={image} alt="" className="h-full w-full object-contain" /> : <Shield className="h-4 w-4 text-muted-foreground" />}</span><span className="min-w-0 break-words">{name}</span></span>;
  };
  function score(match) {
    return isStageResult(match) && match.home_score != null && match.away_score != null ? `${match.home_score} – ${match.away_score}` : match.status === "bye" ? "Bye" : "vs";
  }
  function matchList(s, rows, actions = false) {
    return stageMatchSections(s, rows).map(section => <section key={section.label}>
      <h3 className="border-b border-border bg-secondary/40 px-4 py-2 text-xs font-bold uppercase text-muted-foreground">{section.label}</h3>
      {section.matches.map(match => <div key={match.id} className="border-b border-border/60 px-3 py-3 odd:bg-secondary/15">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-sm">
          <div className="flex min-w-0 flex-wrap items-center gap-2">{identity(match, "home")}{actions && canScheduleTournamentMatch(match, tournament, user, player, clubs) && <button type="button" onClick={() => onSchedule(match)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><CalendarDays className="h-3.5 w-3.5" />Schedule</button>}</div>
          <span className="min-w-12 text-center font-bold tabular-nums text-foreground">{score(match)}</span>
          <div className="min-w-0">{identity(match, "away")}</div>
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-end gap-3 text-xs text-muted-foreground">
          {match.status === "forfeit" && <span>Decided by forfeit</span>}
          {match.scheduling_status === "home_proposed" && <span>Proposal sent</span>}
          {match.aggregate_home_score != null && match.aggregate_away_score != null && <span>Aggregate {match.aggregate_home_score} – {match.aggregate_away_score}</span>}
          {match.aggregate_home_score == null && stageAggregate(s, match) && <span>Aggregate {stageAggregate(s, match).join(" – ")}</span>}
          {(match.home_penalties != null && match.away_penalties != null) && <span>Penalties {match.home_penalties} – {match.away_penalties}</span>}
          {match.penalty_winner_side && <span>{match.penalty_winner_side === "home" ? (match.home_player_name || match.home_club_name) : (match.away_player_name || match.away_club_name)} won on penalties</span>}
          {actions && canOpenTournamentGameDay(match) && <button type="button" onClick={() => onGameDay(match)} className="text-primary hover:underline">GameDay</button>}
          {actions && isStageResult(match) && <button type="button" onClick={() => onStats(match)} className="hover:text-foreground">Stats</button>}
          {actions && match.video_url && <a href={match.video_url} target="_blank" rel="noreferrer" className="text-primary">Match video</a>}
          {actions && match.stream_url && <a href={match.stream_url} target="_blank" rel="noreferrer" className="text-primary">Watch stream</a>}
          {actions && isAdmin && match.status === "disputed" && <button type="button" onClick={() => onResolve(match)} className="text-destructive">Resolve dispute</button>}
          {actions && isAdmin && !isStageResult(match) && <button type="button" onClick={() => onSimulate(match)} className="text-warning">Simulate Score</button>}
        </div>
      </div>)}
    </section>);
  }
  const empty = (s) => stages[0]?.id === s.id ? "Draw not made yet." : tournament.participant_type === "player" ? "Awaiting qualification from the previous stage." : "Awaiting completion of the previous round before the draw.";
  function tile(category) {
    const rows = category === "Fixtures" ? fixtures(stage) : results(stage);
    return <button type="button" aria-label={`Open ${category.toLowerCase()} for ${stage.label}`} onClick={event => { trigger.current = event.currentTarget; setModal({ category, index: stages.indexOf(stage) }); }} className="w-full border border-border bg-card text-left transition hover:border-primary/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
      <span className="flex items-center justify-between border-b border-border px-4 py-3 font-heading text-lg font-bold"><span>{category}</span><span className="text-xs text-muted-foreground">{rows.length}</span></span>
      <span className="block px-4 pt-3 text-xs text-primary">{stage.label}</span>
      <span className="block min-h-28 p-3">{rows.length ? rows.slice(0, 4).map(m => <span key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-border/40 py-2 text-xs">{identity(m, "home")}<strong>{score(m)}</strong>{identity(m, "away")}</span>) : <span className="text-xs text-muted-foreground">{category === "Fixtures" ? "No upcoming fixtures in this stage." : "No results yet."}</span>}</span>
    </button>;
  }
  if (!stage) return null;
  return <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
    <section className="min-w-0 border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-border p-4"><Trophy className="h-4 w-4 text-primary" /><label htmlFor="tournament-stage" className="text-sm font-bold">Stage</label><select id="tournament-stage" value={stage.id} onChange={e => setSelected(e.target.value)} className="min-w-0 max-w-full border border-border bg-background px-3 py-2 text-sm text-foreground">{stages.map(s => <option value={s.id} key={s.id}>{s.label}</option>)}</select></div>
      <div key={stage.id} tabIndex={0} role="region" aria-label={`${stage.label} matches and standings`} className="max-h-[65vh] min-h-64 overflow-y-auto overscroll-contain">
        {stage.id === "final" && stages.some(s => s.id === "third") && <p className="border-b border-border p-4 text-sm text-warning">The Final must be scheduled after the Third-Place Playoff. Complete the playoff before reporting the Final.</p>}
        {tournament.status === "registration" && stage.matches.length > 0 && <p className="border-b border-border px-4 py-3 text-xs text-primary">Draw preview — tournament has not started yet.</p>}
        {stage.matches.length ? matchList(stage, stage.matches, true) : <p className="p-8 text-center text-sm text-muted-foreground">{empty(stage)}</p>}
        {["group", "league"].includes(stage.id) && renderStandings(stage.id)}
      </div>
    </section>
    <aside className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-1">{tile("Fixtures")}{tile("Results")}</aside>
    <Dialog open={Boolean(modal)} onOpenChange={open => { if (!open) setModal(null); }}>
      <DialogContent onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }} aria-describedby="stage-modal-description" className="flex max-h-[85dvh] !w-[calc(100%-2rem)] !max-w-3xl flex-col gap-0 !rounded-none !p-0 [&>button]:!rounded-none">
        <DialogHeader className="shrink-0 border-b border-border p-4 pr-14"><DialogTitle>{modal?.category}</DialogTitle><DialogDescription id="stage-modal-description">{modalStage?.label}</DialogDescription></DialogHeader>
        {modal && <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border p-3"><button type="button" aria-label="Previous stage" disabled={modal.index === 0} onClick={() => setModal({ ...modal, index: modal.index - 1 })} className="p-2 disabled:opacity-30"><ChevronLeft className="h-5 w-5" /></button><span className="text-center text-sm font-bold">{modalStage?.label}</span><button type="button" aria-label="Next stage" disabled={modal.index === stages.length - 1} onClick={() => setModal({ ...modal, index: modal.index + 1 })} className="p-2 disabled:opacity-30"><ChevronRight className="h-5 w-5" /></button></div>}
        <div key={modalStage?.id} className="min-h-0 overflow-y-auto overscroll-contain" role="region" aria-label={`${modal?.category || "Stage"} match list`} tabIndex={0}>{modalStage && ((modal.category === "Fixtures" ? fixtures(modalStage) : results(modalStage)).length ? matchList(modalStage, modal.category === "Fixtures" ? fixtures(modalStage) : results(modalStage)) : <p className="p-8 text-center text-sm text-muted-foreground">{modal.category === "Fixtures" ? "No upcoming fixtures in this stage." : "No results yet."}</p>)}</div>
      </DialogContent>
    </Dialog>
  </div>;
}
