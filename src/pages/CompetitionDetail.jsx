import { useState, useEffect } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { stageClient, resolveMyPlayerAndClub } from "@/api/stageClient";
import { useTranslation } from "@/hooks/useTranslation";
import { Trophy, Shield, ArrowLeft, ArrowRight, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCompetitionMeta, sortStandings } from "@/lib/competitionUtils";
import StandingsIntegrityNotice from "@/components/StandingsIntegrityNotice";
import { isAppAdminUser } from "@/lib/adminAuth";
import LeagueCompetitionStages from "@/components/LeagueCompetitionStages";
import TournamentLeaderboard from "@/components/TournamentLeaderboard";
import { penaltyOutcome } from "@/lib/penaltyOutcome";
import { GostTrophy, GostJourney } from "@/pages/Competitions";
import { clubPathway, qualificationRange } from "@/lib/gostOverview";
import { detailTabs, directoryRows, editionSelection, editionProgress, seasonLocation } from "@/lib/gostDetail";

function dedupeCompetitionStandingsByClub(rows = []) {
  const byClub = new Map();
  for (const row of rows) {
    if (!row?.club_id) continue;
    const key = String(row.club_id);
    if (!byClub.has(key)) {
      byClub.set(key, row);
    } else {
      byClub.set(key, null);
    }
  }
  return [...byClub.values()].filter(Boolean);
}

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
  const { t } = useTranslation();
  const rows = sortStandings(standings);
  if (!rows.length) return (
    <div className="border border-dashed border-border rounded p-12 text-center">
      <Trophy className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
      <p className="text-sm text-muted-foreground uppercase tracking-widest">{t("commonPages.ldNoStandings")}</p>
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


const linkClass = "inline-flex min-h-11 items-center gap-2 py-2 font-semibold text-primary focus-visible:ring-2 focus-visible:ring-primary";
const heading = "font-heading text-2xl font-bold uppercase italic sm:text-3xl";
const money = value => `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })} STC`;
const phaseName = value => ({ knockout_r16: 'Round of 16', knockout_qf: 'Quarterfinals', knockout_sf: 'Semifinals', knockout_final: 'Final', playoff_round: 'Knockout playoff' })[value] || String(value || 'Season preparation').replace(/_/g, ' ');
const displayDate = value => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

function LoadError({ message, retry }) {
  return <div role="alert" className="border-y border-border py-8"><p className="text-destructive">{message}</p><button type="button" onClick={retry} className={linkClass}>Retry <ArrowRight size={16} /></button></div>;
}

function ClubCrest({ club }) {
  const [failed, setFailed] = useState(false);
  return club.logo_url && !failed ? <img src={club.logo_url} onError={() => setFailed(true)} alt="" className="h-11 w-11 shrink-0 object-contain" /> : <Shield aria-hidden="true" className="h-11 w-11 shrink-0 text-muted-foreground/50" />;
}

export function GostClubDirectory({ participants, myClub }) {
  const [search, setSearch] = useState('');
  const [league, setLeague] = useState('');
  const [order, setOrder] = useState('asc');
  const rows = directoryRows(participants, search, league, order);
  const leagues = [...new Map(participants.filter(c => c.regional_league_id).map(c => [c.regional_league_id, c.regional_league_name || 'Regional league unavailable'])).entries()].sort((a,b) => a[1].localeCompare(b[1]));
  return <section>
    <div className="flex flex-wrap items-end justify-between gap-5 pb-6">
      <div><h2 className={heading}>Qualified clubs</h2><p className="mt-2 text-sm text-muted-foreground">Confirmed participants in this edition.</p></div>
      <div className="flex w-full flex-wrap gap-3 lg:w-auto">
        <label className="relative w-full min-w-0 flex-none sm:w-64 sm:flex-1"><span className="sr-only">Search clubs</span><Search size={17} className="absolute left-3 top-3.5 text-muted-foreground" /><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clubs..." className="h-11 w-full rounded-none border border-border bg-background pl-10 pr-3 text-sm" /></label>
        <select aria-label="Regional league" value={league} onChange={e => setLeague(e.target.value)} className="h-11 min-w-0 max-w-full flex-1 border border-border bg-background px-3 text-sm sm:flex-none"><option value="">All regional leagues</option>{leagues.map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select>
        <select aria-label="Club sort order" value={order} onChange={e => setOrder(e.target.value)} className="h-11 min-w-0 flex-1 border border-border bg-background px-3 text-sm sm:flex-none"><option value="asc">Club name A–Z</option><option value="desc">Club name Z–A</option></select>
      </div>
    </div>
    <p role="status" className="mb-4 text-sm text-muted-foreground">Showing {rows.length} of {participants.length} clubs</p>
    <div className="hidden grid-cols-[1.2fr_1fr_0.6fr_20px] gap-4 border-b border-border px-4 py-3 text-xs uppercase text-muted-foreground md:grid"><span>Club</span><span>Regional league</span><span>Qualified as</span><span /></div>
    {rows.map(club => <Link key={club.id} to={`/clubs/${encodeURIComponent(club.id)}`} className={cn("grid grid-cols-[1fr_20px] items-center gap-3 border-b border-l-4 border-border px-3 py-4 transition hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:grid-cols-[1.2fr_1fr_0.6fr_20px] md:gap-4", myClub?.id === club.id ? "border-l-primary bg-primary/5" : "border-l-transparent")}>
      <div className="flex min-w-0 items-center gap-4"><ClubCrest club={club} /><div className="min-w-0"><div className="flex flex-wrap items-center gap-x-3"><span className="break-words font-bold">{club.name}</span>{myClub?.id === club.id && <span className="text-xs font-semibold uppercase text-primary">Your club</span>}</div><p className="text-sm text-muted-foreground">{club.country_code || 'Country unavailable'}</p><div className="mt-2 text-sm text-muted-foreground md:hidden">{club.regional_league_name || 'Regional league unavailable'} · {club.qualification_position ? `Position ${club.qualification_position}` : club.qualification_conflict ? 'Qualification needs review' : 'Position unavailable'}</div></div></div>
      <span className="hidden text-sm text-muted-foreground md:block">{club.regional_league_name || 'Regional league unavailable'}</span><span className="hidden text-sm md:block">{club.qualification_position ? `Position ${club.qualification_position}` : club.qualification_conflict ? 'Needs review' : 'Unavailable'}</span><ChevronRight size={18} aria-hidden="true" />
    </Link>)}
    {!rows.length && <div className="border-y border-border py-10"><p>{participants.length ? 'No clubs match the selected filters.' : 'No confirmed clubs yet.'}</p>{participants.length > 0 && <button type="button" className={linkClass} onClick={() => { setSearch(''); setLeague(''); setOrder('asc'); }}>Clear filters</button>}</div>}
    <p className="mt-5 text-xs text-muted-foreground">Qualification positions refer to the regional season that qualified the club, not its current standings.</p>
  </section>;
}

function ClubPathway({ identity, participants, season, matches, slug }) {
  const club = identity?.club || identity?.presidentClub;
  const [path, setPath] = useState(null);
  const own = participants.find(c => c.id === club?.id);
  useEffect(() => {
    let active = true;
    if (!club || own) return;
    async function load() {
      try {
        const [standings, entries] = await Promise.all([
          stageClient.entities.RegionalLeagueStanding.filter({ club_id: club.id }, '-season_number', 100),
          stageClient.entities.QualificationEntry.filter({ club_id: club.id }, '-created_date', 100),
        ]);
        const leagues = await Promise.all([...new Set(standings.map(s => s.league_id).filter(Boolean))].map(id => stageClient.entities.RegionalLeague.get(id)));
        if (active) setPath(clubPathway(club, leagues.filter(Boolean), standings, entries));
      } catch { if (active) setPath({ text: 'Regional pathway could not be loaded.', href: '/leagues' }); }
    }
    void load();
    return () => { active = false; };
  }, [club?.id, own?.id]);
  const next = matches.find(m => m.home_club_id === club?.id || m.away_club_id === club?.id);
  return <section className="min-w-0 lg:border-l lg:border-border lg:pl-8"><h2 className={heading}>Your club’s pathway</h2>
    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Finish in positions {qualificationRange(slug)} of Regional Division 1 to qualify.</p>
    {identity === undefined ? <p className="mt-3 text-sm">Loading your club...</p> : identity === null ? <p className="mt-3 text-sm">Your club identity could not be loaded.</p> : own ? <><p className="mt-3 font-semibold">{own.name} · Confirmed participation</p><p className="mt-2 text-sm text-muted-foreground">{phaseName(season.status)}</p>{next && <p className="mt-2 text-sm">Next scheduled fixture: {next.home_club_name} vs {next.away_club_name} · {displayDate(next.scheduled_date)}</p>}</> : <p className="mt-3 text-sm text-muted-foreground">{club ? path?.text || 'Loading regional pathway...' : 'Your final regional position determines your GOST competition.'}</p>}
    <Link to={path?.href || '/leagues'} className={linkClass}>Explore regional leagues <ArrowRight size={17} /></Link>
  </section>;
}

function MatchPreview({ matches, onStages, empty }) {
  return <div className="mt-3">{matches.length ? matches.slice(0, 3).map(match => <div key={match.id} className="flex flex-wrap items-center justify-between gap-x-3 border-b border-border py-3 text-sm">
    <span>{match.home_club_name || 'Home club'} <strong>{match.home_score != null && match.away_score != null ? `${match.home_score} – ${match.away_score}` : 'vs'}</strong> {match.away_club_name || 'Away club'}</span>
    <span className="text-muted-foreground">{displayDate(match.scheduled_date)}</span>
    {match.match_id ? <Link to={`/game-day?match=${encodeURIComponent(match.match_id)}`} className={linkClass}>GAMEDAY <ArrowRight size={15} /></Link> : <button type="button" onClick={onStages} className={linkClass}>Match details <ArrowRight size={15} /></button>}
  </div>) : <p className="text-sm text-muted-foreground">{empty}</p>}</div>;
}

function Rewards({ edition, trophy }) {
  const prizes = edition.prizes;
  return <section><h2 className={heading}>Prizes and trophy</h2>{prizes ? <><dl className="mt-5 max-w-3xl divide-y divide-border">{[['participation', 'Participation payment per eligible club'], ['winner_bonus', 'Winner’s additional STC prize'], ['runner_up_bonus', 'Runner-up’s additional STC prize']].map(([key,label]) => <div key={key} className="flex flex-wrap justify-between gap-3 py-4"><dt>{label}</dt><dd className="font-bold">{money(prizes[key])}</dd></div>)}</dl><p className="mt-5 text-sm text-muted-foreground">Winner and runner-up receive their additional prize in addition to participation money.</p><p className="mt-3 text-sm">Winner’s total: <strong>{money(Number(prizes.participation) + Number(prizes.winner_bonus))}</strong> · Runner-up’s total: <strong>{money(Number(prizes.participation) + Number(prizes.runner_up_bonus))}</strong></p>{prizes.budget && <p className="mt-3 text-sm text-muted-foreground">Configured budget for {prizes.participant_basis} captured clubs: {money(prizes.budget)}. This is not an amount distributed.</p>}</> : <p className="mt-5 text-muted-foreground">Rewards not configured or no captured configuration is available for this edition.</p>}<p className="mt-6">Winner’s trophy: <strong>{trophy?.name || 'No captured or assigned trophy available'}</strong></p></section>;
}

function EditionContent({ competition, edition, identity, activeTab, setTab, selectSeason, reloadOverview }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    let request = 0;
    async function load() {
      const token = ++request;
      try {
        const [directory, view] = await Promise.all([
          stageClient.http.get(`/gost/${encodeURIComponent(competition.id)}/editions/${encodeURIComponent(edition.id)}/clubs`),
          stageClient.http.get(`/competition-views/competition_season/${encodeURIComponent(edition.id)}`),
        ]);
        if (!directory.season || !Array.isArray(directory.participants) || !Array.isArray(view.matches) || !Array.isArray(view.standings)) throw new Error('Incomplete edition response. Check that the matching backend is deployed.');
        if (active && token === request) { setData({ ...directory, ...view, participants: directory.participants }); setError(''); }
      } catch (e) { if (active && token === request) setError(`Club or season data could not be loaded: ${e.message}`); }
    }
    void load();
    window.addEventListener('focus', load);
    return () => { active = false; window.removeEventListener('focus', load); };
  }, [competition.id, edition.id, revision]);
  if (error) return <LoadError message={error} retry={() => { setRevision(n => n + 1); reloadOverview(); }} />;
  if (!data) return <p role="status" className="py-12">Loading edition...</p>;
  const { season, participants, matches, standings } = data;
  const progress = editionProgress(season, participants, matches);
  const trophy = progress.finished ? edition.trophy : edition.trophy || competition.assignment?.trophy;
  const myClub = identity?.club || identity?.presidentClub;
  const onStages = () => setTab('stages');
  const final = progress.final;
  const winner = edition.winner || (final?.winner_club_id === final?.home_club_id ? final?.home_club_name : final?.winner_club_id === final?.away_club_id ? final?.away_club_name : null);
  const runner = edition.runner_up || (final?.winner_club_id && final.winner_club_id === final.home_club_id ? final.away_club_name : final?.winner_club_id && final.winner_club_id === final.away_club_id ? final.home_club_name : null);
  return <>
    {activeTab === 'overview' && <>
      <div className="grid gap-8 border-b border-border pb-7 lg:grid-cols-[1.25fr_1fr]">
        <section className="min-w-0"><h2 className={heading}>{progress.title}</h2>
          <p className="mt-3 text-sm text-muted-foreground">{progress.finished ? `Champion: ${winner || 'Not recorded'} · Runner-up: ${runner || 'Not recorded'}` : participants.length ? 'Confirmed clubs are preparing for or competing in this edition.' : 'Confirmed clubs will appear after regional qualification is finalised.'}</p>
          {final && <><p className="mt-3 font-bold">{final.home_club_name} {final.home_score} – {final.away_score} {final.away_club_name}</p>{penaltyOutcome(final) && <p className="mt-2 text-sm">{penaltyOutcome(final)}</p>}</>}
          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-4"><div><dt className="text-xs uppercase text-muted-foreground">Confirmed clubs</dt><dd className="mt-1 text-2xl font-bold">{participants.length}{edition.maximum ? ` / ${edition.maximum}` : ''}</dd></div><div className="border-l border-border pl-8"><dt className="text-xs uppercase text-muted-foreground">Season status</dt><dd className="mt-1 font-bold capitalize">{phaseName(season.status)}</dd></div>{progress.required.length > 0 && <div><dt className="text-xs uppercase text-muted-foreground">Confirmed matches</dt><dd className="mt-1 font-bold">{progress.played.length} / {progress.required.length}</dd></div>}</dl>
          {progress.finished ? <div className="mt-3 flex flex-wrap gap-6"><button type="button" className={linkClass} onClick={() => setTab('table')}>Final standings <ArrowRight size={16} /></button><button type="button" className={linkClass} onClick={() => setTab('history')}>Season history <ArrowRight size={16} /></button></div> : <Link to="/leagues" className={`mt-3 ${linkClass}`}>Explore regional leagues <ArrowRight size={17} /></Link>}
        </section>
        <ClubPathway identity={identity} participants={participants} season={season} matches={progress.upcoming} slug={competition.slug} />
      </div>
      <section className="border-b border-border py-7"><h2 className={heading}>Competition journey</h2><div className="mt-5"><GostJourney journey={edition.journey || competition.journey} /></div></section>
      <div className="grid gap-8 py-7 lg:grid-cols-2"><section><h2 className={heading}>Fixtures and results</h2><h3 className="mt-5 text-sm font-bold">Upcoming fixtures</h3><MatchPreview matches={progress.upcoming} onStages={onStages} empty="No scheduled fixtures yet." /><h3 className="mt-5 text-sm font-bold">Recent confirmed results</h3><MatchPreview matches={[...progress.played].reverse()} onStages={onStages} empty="No confirmed results yet." /><button type="button" className={linkClass} onClick={onStages}>View stages <ArrowRight size={17} /></button></section><section className="lg:border-l lg:border-border lg:pl-8"><h2 className={heading}>Prizes and trophy</h2><p className="mt-4 text-sm text-muted-foreground">{edition.prizes ? 'Participation payment for every eligible club, with additional prizes for the winner and runner-up.' : 'Reward configuration is unavailable for this edition.'}</p><button type="button" className={linkClass} onClick={() => setTab('rewards')}>View reward details <ArrowRight size={17} /></button></section></div>
    </>}
    {activeTab === 'clubs' && <GostClubDirectory participants={participants} myClub={myClub} />}
    {activeTab === 'table' && <><StandingsIntegrityNotice kind="competition_season" editionId={edition.id} isAdmin={isAppAdminUser(identity?.user)} onRefresh={() => setRevision(n => n + 1)} /><StandingsTable standings={dedupeCompetitionStandingsByClub(standings)} /></>}
    {activeTab === 'stages' && <LeagueCompetitionStages key={edition.id} kind="competition_season" editionId={edition.id} myClub={myClub} myEmail={identity?.user?.email || identity?.player?.email || ''} myGamertag={identity?.player?.gamertag || ''} renderStandings={() => <StandingsTable standings={dedupeCompetitionStandingsByClub(standings)} />} />}
    {activeTab === 'stats' && <TournamentLeaderboard key={edition.id} tournamentId={edition.id} title="Season Statistics" statisticsUrl={`/competition-views/competition_season/${encodeURIComponent(edition.id)}/statistics`} />}
    {activeTab === 'rewards' && <Rewards edition={edition} trophy={trophy} />}
    {activeTab === 'history' && <section><h2 className={heading}>Season history</h2><div className="mt-5">{competition.archive.length ? competition.archive.map(s => <button type="button" key={s.id} onClick={() => selectSeason(s.id, true)} className="flex min-h-20 w-full flex-wrap items-center justify-between gap-3 border-b border-border py-4 text-left hover:bg-secondary/30 focus-visible:ring-2 focus-visible:ring-primary"><div><strong>{s.label}</strong>{s.trophy?.name && <p className="mt-1 text-sm text-muted-foreground">Trophy: {s.trophy.name}</p>}<p className="mt-1 text-sm text-muted-foreground">{s.state}{s.completed_at ? ` · ${displayDate(s.completed_at)}` : ''}</p></div><span className="text-sm">Champion: {s.winner || 'Not recorded'} · Runner-up: {s.runner_up || 'Not recorded'}</span><ArrowRight size={17} /></button>) : <p>No completed or archived editions yet.</p>}</div></section>}
  </>;
}

function CompetitionPage({ slug }) {
  const [params, setParams] = useSearchParams();
  const [competition, setCompetition] = useState(null);
  const [identity, setIdentity] = useState(undefined);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const meta = getCompetitionMeta(slug);
  const activeTab = detailTabs.includes(params.get('tab')) ? params.get('tab') : 'overview';
  useEffect(() => {
    let active = true;
    let request = 0;
    async function load() {
      const token = ++request;
      try {
        const response = await stageClient.http.get('/gost/overview');
        const found = response.competitions.find(c => c.slug === slug);
        if (!found) throw new Error('Competition not found.');
        if (!Array.isArray(found.editions)) throw new Error('The GOST detail page needs the matching backend update.');
        if (active && token === request) { setCompetition(found); setError(''); }
      } catch (e) { if (active && token === request) setError(e.message); }
    }
    void load();
    window.addEventListener('focus', load);
    return () => { active = false; window.removeEventListener('focus', load); };
  }, [slug, revision]);
  useEffect(() => {
    let active = true;
    resolveMyPlayerAndClub().then(value => { if (active) setIdentity(value); }).catch(() => { if (active) setIdentity(null); });
    return () => { active = false; };
  }, []);
  const edition = competition ? editionSelection(competition.editions, params.get('season')) : null;
  const historical = ['completed', 'archived'].includes(edition?.status);
  const trophy = historical ? edition?.trophy : competition?.assignment?.trophy || edition?.trophy;
  const setTab = tab => setParams(previous => { const next = new URLSearchParams(previous); next.set('tab', tab); return next; });
  const selectSeason = (id, overview = false) => setParams(previous => seasonLocation(previous, id, overview));
  return <main className="gost-detail min-h-screen bg-background px-5 py-7 text-foreground sm:px-8" style={{ '--primary': 'var(--gost-accent)', '--gost-accent-dark': ({ supreme: '199 95% 60%', elite: '48 96% 53%', challenger: '142 71% 45%' })[slug], '--gost-accent-light': ({ supreme: '200 98% 32%', elite: '40 93% 29%', challenger: '142 72% 29%' })[slug] }}>
    <div className="mx-auto max-w-7xl min-w-0">
      <Link to="/competitions" className={linkClass}><ArrowLeft size={17} /> All GOST competitions</Link>
      <header className="grid grid-cols-[80px_minmax(0,1fr)] items-center gap-5 py-5 sm:grid-cols-[180px_minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)_auto]">
        <div className="gost-detail-trophy"><GostTrophy compact trophy={trophy} guidance={historical ? 'Historical trophy unavailable.' : 'Trophy not assigned.'} /></div>
        <div className="min-w-0"><p className="mb-3 text-sm font-semibold uppercase text-primary">● Tier {['I', 'II', 'III'][meta.tier - 1]}</p><h1 className="break-words font-heading text-2xl font-black uppercase italic leading-tight sm:text-5xl lg:text-6xl">{(competition?.name || meta.name).replace(/^STAGE\s+/i, '')}</h1><p className="mt-3 text-lg">Global Official Stage Tournaments</p><p className="mt-3 text-sm text-muted-foreground">Regional Division 1 · Positions {qualificationRange(slug)} qualify</p></div>
        <div className="col-span-2 flex flex-wrap items-center gap-5 sm:col-span-1 sm:col-start-2 lg:col-start-auto"><label className="max-w-full"><span className="sr-only">Competition season</span><select aria-label="Competition season" value={edition?.id || ''} onChange={e => selectSeason(e.target.value)} disabled={!competition?.editions.length} className="h-11 max-w-full border border-border bg-background px-3 text-sm">{!edition && <option value="">Select season</option>}{competition?.editions.map(s => <option value={s.id} key={s.id}>{s.label} · {s.state}</option>)}</select></label><span className="border-l border-border pl-5 text-sm capitalize">{edition ? phaseName(edition.status) : 'No edition selected'}</span></div>
      </header>
      {error ? <LoadError message={error} retry={() => setRevision(n => n + 1)} /> : !competition ? <p role="status" className="py-12">Loading competition...</p> : <>
        <nav aria-label="Competition sections" className="mb-7 flex flex-wrap gap-x-4 border-y border-border sm:gap-x-7">{detailTabs.map(tab => <button type="button" key={tab} onClick={() => setTab(tab)} aria-current={activeTab === tab ? 'page' : undefined} className={cn("min-h-12 border-b-2 px-1 text-sm capitalize transition focus-visible:ring-2 focus-visible:ring-primary", activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{tab}</button>)}</nav>
        {edition ? <EditionContent key={`${competition.id}:${edition.id}`} competition={competition} edition={edition} identity={identity} activeTab={activeTab} setTab={setTab} selectSeason={selectSeason} reloadOverview={() => setRevision(n => n + 1)} /> : <p className="py-12">{params.get('season') ? 'This edition does not belong to this competition or is unavailable. Choose an available season.' : 'No edition announced.'}</p>}
      </>}
    </div>
  </main>;
}

export default function CompetitionDetail() {
  const { slug } = useParams();
  return <CompetitionPage key={slug} slug={slug} />;
}
