import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { stageClient } from "@/api/stageClient";
import TournamentStages from "@/components/TournamentStages";
import FixtureSchedulerPanel from "@/components/schedule/FixtureSchedulerPanel";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { createMatchFromFixture } from "@/lib/gameDayIntegration";
import { penaltyOutcome } from "@/lib/penaltyOutcome";

export default function LeagueCompetitionStages({ kind, editionId, myClub, myEmail, myGamertag, renderStandings, initialFixtureId = null, naturalScroll = false }) {
  const [data,setData] = useState(null);
  const [error,setError] = useState("");
  const [fixture,setFixture] = useState(null);
  const [revision,setRevision] = useState(0);
  const navigate = useNavigate();
  const fixtureType = kind === "regional_league" ? "regional_league" : "competition";
  const entity = fixtureType === "regional_league" ? stageClient.entities.RegionalLeagueFixture : stageClient.entities.CompetitionFixture;
  useEffect(()=>{
    let stopped = false;
    async function refresh() {
      try { const value = await stageClient.http.get(`/competition-views/${kind}/${encodeURIComponent(editionId)}`); if (!stopped) {setData(value);setError("");} }
      catch(e) { if (!stopped) setError(e.message); }
    }
    setData(null); void refresh();
    const timer = setInterval(refresh,15000);
    window.addEventListener("focus",refresh);
    return ()=>{stopped=true;clearInterval(timer);window.removeEventListener("focus",refresh);};
  },[kind,editionId,revision]);
  async function openDetails(match) { try { setFixture({...match,...await entity.get(match.fixture_id)}); } catch(e) {setError(e.message);} }
  async function openGameDay(match) {
    try { const source = await entity.get(match.fixture_id); const created = await createMatchFromFixture(source,fixtureType); if (!created?.id) throw new Error("This fixture does not have an active confirmed GameDay match."); navigate(`/game-day?match=${encodeURIComponent(created.id)}`); }
    catch(e) {setError(e.message);}
  }
  if (!data) return <p role={error ? "alert" : "status"} className="p-6 text-sm text-muted-foreground">{error || "Loading stages..."}</p>;
  if (initialFixtureId && !data.matches.some(m => String(m.fixture_id || m.id) === String(initialFixtureId))) return <div role="alert" className="py-6">The requested fixture is unavailable in this edition.<button type="button" className="ml-3 min-h-11 text-primary" onClick={()=>setRevision(v=>v+1)}>Retry</button></div>;
  const tournament = {...data.root,participant_type:"club",type:kind === "regional_league" || data.root.type === "league" || data.root.format === "league" || data.root.league_only === true ? "league" : "swiss_ucl",registered_clubs:data.participants.map(c=>c.id)};
  return <>
    {error && <p role="alert" className="p-3 text-destructive">{error}</p>}
    {fixture && penaltyOutcome(fixture) && <p role="status" className="px-3 text-sm text-primary">{penaltyOutcome(fixture)}</p>}
    <TournamentStages key={`${kind}:${editionId}:${initialFixtureId || ''}`} initialFixtureId={initialFixtureId} naturalScroll={naturalScroll} tournament={tournament} matches={data.matches} clubs={data.participants} onSchedule={openDetails} onGameDay={openGameDay} onStats={openDetails} canSchedule={m=>Boolean(m.can_schedule && m.home_club_id && m.away_club_id && !["completed","forfeit","bye","cancelled"].includes(m.status) && m.scheduling_status !== "home_proposed")} renderStandings={renderStandings} onDetails={openDetails} />
    <Dialog open={Boolean(fixture)} onOpenChange={open=>{if (!open) setFixture(null);}}><DialogContent className="max-h-[85dvh] overflow-y-auto !rounded-none"><DialogHeader><DialogTitle>{fixture?.home_club_name} vs {fixture?.away_club_name}</DialogTitle><DialogDescription>Match details and scheduling</DialogDescription></DialogHeader>{fixture && <FixtureSchedulerPanel fixture={fixture} fixtureType={fixtureType} myClub={myClub} myEmail={myEmail} myGamertag={myGamertag} onUpdate={()=>{setFixture(null);setRevision(v=>v+1);}} />}</DialogContent></Dialog>
  </>;
}
