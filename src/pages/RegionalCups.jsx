import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Search, Trophy } from 'lucide-react';
import { stageClient } from '@/api/stageClient';
import { REGIONS } from '@/lib/qualificationConfig';
import { formatProfilePlatform } from '@/lib/profilePlatform';
import EditionParticipationConditions from '@/components/competition/EditionParticipationConditions';
import CompetitionTextTabs from '@/components/competition/CompetitionTextTabs';
import ParticipantDirectory from '@/components/competition/ParticipantDirectory';
import RegionalCompetitionNav from '@/components/competition/RegionalCompetitionNav';
import { GostTrophy } from '@/pages/Competitions';
import smoke from '@/assets/regional-smoke.png';

const action = 'inline-flex min-h-11 items-center gap-2 py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';
const heading = 'font-heading text-2xl uppercase';
const regionName = slug => REGIONS.find(region => region.slug === slug)?.name || slug;
const time = value => Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Kickoff awaiting publication';
const cupKey = cup => cup.id || cup.region_slug;
const editionOrder = (a, b) => Number(b.reset_series || 0) - Number(a.reset_series || 0) || Number(b.season_number) - Number(a.season_number) || a.id.localeCompare(b.id);
const roundName = (round, count) => count - round.number === 0 ? 'Final' : count - round.number === 1 ? 'Semifinals' : count - round.number === 2 ? 'Quarterfinals' : `Round ${round.number}`;
const sameCup = (definition, edition) => definition.id && edition.permanent_cup_id ? definition.id === edition.permanent_cup_id : definition.region_slug === edition.region_slug && (!definition.platform || definition.platform === edition.platform);
const tabs = [['overview', 'Overview'], ['clubs', 'Clubs'], ['stages', 'Stages & results'], ['rules', 'Rules'], ['rewards', 'Rewards'], ['history', 'History']].map(([value, label]) => ({ value, label }));

function CupStages({ edition }) {
  return <div className="space-y-8">{edition.rounds.map(round => <section key={round.number} className="min-w-0 border-b border-border pb-7">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className={heading}>{roundName(round, edition.rounds.length)}</h2><p className="text-sm text-muted-foreground">Week {round.week} · {time(round.kickoff_at)}</p></div>
    {!round.drawn && <p className="mt-4 text-sm text-muted-foreground">The open draw follows confirmation of every result in the previous round.</p>}
    {!!round.byes.length && <p className="mt-4 text-sm text-muted-foreground">Byes: {round.byes.map(id => edition.participants.find(club => club.id === id)?.name || 'Club unavailable').join(' · ')}</p>}
    <ul className="mt-3 divide-y divide-border">{round.matches.map(match => <li key={match.id}><Link to={`/game-day?match=${encodeURIComponent(match.id)}`} className="flex min-h-20 flex-wrap items-center justify-between gap-4 py-4 hover:bg-muted/20"><div className="min-w-0"><p className="break-words font-semibold">{match.home_club_name} <span className="px-2 text-muted-foreground">vs</span> {match.away_club_name}</p><p className="mt-1 text-sm text-muted-foreground">{time(match.kickoff_at)} · {match.status}{match.decided_on_penalties && ' · Penalties'}</p></div><span className="font-semibold">{match.home_score != null && match.away_score != null ? `${match.home_score} – ${match.away_score}` : 'GameDay →'}</span></Link></li>)}</ul>
  </section>)}</div>;
}

function CupRewards({ edition }) {
  return <section aria-label="Cup rewards"><h2 className={heading}>Cup rewards</h2>{edition.rewards?.winner_stc ? <><div className="mt-5 grid gap-5 border-y border-border py-6 sm:grid-cols-2"><div><p className="text-sm text-muted-foreground">Winner</p><p className="mt-2 font-heading text-3xl">{Number(edition.rewards.winner_stc).toLocaleString()} STC</p></div><div><p className="text-sm text-muted-foreground">Finalist</p><p className="mt-2 font-heading text-3xl">{Number(edition.rewards.runner_up_stc).toLocaleString()} STC</p></div></div><p className="mt-4 text-sm text-muted-foreground">Funded by STAGE · No third-place prize · No additional Cup entry fee</p><p className="mt-3 text-sm">Payment status: {edition.rewards.state} · Trophy: {edition.honours_state || 'pending'}</p></> : <p className="mt-4 text-muted-foreground">Prize terms for this edition are awaiting review.</p>}</section>;
}

export default function RegionalCups({ embedded = false }) {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [region, setRegion] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    let active = true;
    setError(''); setData(null);
    stageClient.http.get('/regional-leagues/cups/public').then(result => {
      if (!Array.isArray(result.cups)) throw new Error('Cup catalogue unavailable.');
      if (active) setData(result);
    }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [revision]);
  function update(values) {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      if (embedded) next.set('view', 'cups');
      for (const [key, value] of Object.entries(values)) { if (value == null) next.delete(key); else next.set(key, value); }
      return next;
    });
  }
  // Older deployed backends still provide playable editions, without the directory.
  const definitions = data?.definitions || [...new Map((data?.cups || []).map(cup => [cup.permanent_cup_id || `${cup.region_slug}:${cup.platform}`, { id: cup.permanent_cup_id || `${cup.region_slug}:${cup.platform}`, name: cup.name, region_slug: cup.region_slug, platform: cup.platform, trophy: cup.trophy }])).values()];
  const requestedEdition = params.get('edition');
  const exactEdition = data?.cups.find(cup => cup.id === requestedEdition);
  const requestedCup = params.get('cup');
  const selectedCup = requestedCup ? definitions.find(cup => cupKey(cup) === requestedCup) : exactEdition ? definitions.find(cup => sameCup(cup, exactEdition)) : null;
  const editions = selectedCup ? (data?.cups || []).filter(edition => sameCup(selectedCup, edition)).sort(editionOrder) : [];
  const selected = requestedEdition ? editions.find(edition => edition.id === requestedEdition) : editions.find(edition => edition.status === 'running') || editions[0];
  const unavailable = data && ((requestedCup && !selectedCup) || (requestedEdition && !selected));
  const activeTab = tabs.some(tab => tab.value === params.get('cup_tab')) ? params.get('cup_tab') : 'overview';
  const visible = definitions.filter(cup => (!region || cup.region_slug === region) && `${cup.name} ${regionName(cup.region_slug)} ${cup.platform || ''}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const matches = selected?.rounds.flatMap(round => round.matches) || [];
  const complete = matches.filter(match => match.home_score != null && match.away_score != null);
  const next = matches.filter(match => match.home_score == null && !['cancelled', 'abandoned', 'completed'].includes(match.status)).sort((a, b) => Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at))[0];
  const content = <>
    <RegionalCompetitionNav cups />
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.18em] text-primary">Regional competitions</p><h1 className="mt-2 font-heading text-4xl uppercase sm:text-5xl">Regional Cups</h1><p className="mt-3 text-muted-foreground">Every region. Its own Cup. One knockout journey.</p></div>{selectedCup && <button type="button" className={action} onClick={() => update({ cup: null, edition: null, cup_tab: null })}>← All Regional Cups</button>}</header>
    {error && <div role="alert" className="py-8 text-destructive"><p>Cups could not be loaded: {error}</p><button type="button" className={action} onClick={() => setRevision(value => value + 1)}>Retry</button></div>}
    {!data && !error && <p role="status" className="py-12">Loading Regional Cups…</p>}
    {unavailable && <div role="status" className="py-10"><p>This Cup or edition is unavailable. Unpublished editions remain private.</p><button type="button" className={action} onClick={() => update({ cup: null, edition: null, cup_tab: null })}>View available Cups <ArrowRight size={17} /></button></div>}
    {data && !selectedCup && !unavailable && <>
      <div className="my-7 flex flex-wrap items-center gap-3"><label className="relative w-full sm:w-80"><span className="sr-only">Search Cups</span><Search size={17} className="absolute left-3 top-3.5 text-muted-foreground" /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search Cups..." className="h-11 w-full border border-border bg-background pl-10 pr-3 text-sm" /></label><select aria-label="Cup region" value={region} onChange={event => setRegion(event.target.value)} className="h-11 max-w-full border border-border bg-background px-3 text-sm"><option value="">All regions</option>{[...new Set(definitions.map(cup => cup.region_slug))].map(slug => <option key={slug} value={slug}>{regionName(slug)}</option>)}</select></div>
      <div className="grid gap-x-8 gap-y-10 md:grid-cols-2 xl:grid-cols-3">{visible.map(cup => {
        const published = data.cups.filter(edition => sameCup(cup, edition)).sort(editionOrder);
        const current = published.find(edition => edition.status === 'running') || published[0];
        return <article key={cupKey(cup)} className="relative min-w-0 border-b border-border px-4 pb-7 text-center"><img src={smoke} alt="" aria-hidden="true" className="regional-smoke pointer-events-none absolute inset-x-0 top-4 h-52 w-full object-contain opacity-20" /><div className="relative"><GostTrophy compact trophy={current ? current.trophy : cup.trophy} guidance="Trophy artwork will appear once assigned." /><p className="mt-4 text-xs uppercase tracking-wider text-primary">{regionName(cup.region_slug)}</p><h2 className="mt-3 break-words font-heading text-2xl uppercase">{cup.name}</h2><p className="mt-2 text-sm text-muted-foreground">{cup.platform ? formatProfilePlatform(cup.platform) : 'Regional Cup'} · Single-match knockout</p><p className="mt-3 text-sm">{current ? `Season ${current.season_number} · ${current.status === 'running' ? 'In progress' : 'Completed'}` : 'Awaiting published edition'}</p><p className="mt-2 text-sm text-muted-foreground">{current ? `${current.participant_count} clubs · ${current.rounds.length} rounds` : 'Participants and fixtures appear after activation.'}</p>{cup.schedule && <p className="mt-3 text-xs text-muted-foreground">Sundays · {cup.schedule.time} {cup.schedule.timezone}</p>}<button type="button" className={`${action} mt-3`} onClick={() => update({ cup: cupKey(cup), edition: null, cup_tab: null })}>Explore Cup <ArrowRight size={17} /></button></div></article>;
      })}</div>
      {!visible.length && <p role="status" className="py-12 text-muted-foreground">{definitions.length ? 'No Cups match these filters.' : 'No Cup catalogue is available yet.'}</p>}
    </>}
    {selectedCup && !unavailable && <>
      <header className="relative my-7 grid items-center gap-7 border-y border-border py-8 sm:grid-cols-[220px_minmax(0,1fr)]"><img src={smoke} alt="" aria-hidden="true" className="regional-smoke pointer-events-none absolute left-0 top-6 h-64 max-w-full object-contain opacity-20" /><div className="relative"><GostTrophy trophy={selected ? selected.trophy : selectedCup.trophy} guidance="Trophy artwork will appear once assigned." /></div><div className="relative min-w-0"><p className="text-xs uppercase text-primary">{regionName(selectedCup.region_slug)} · Regional Cup</p><h2 className="mt-3 break-words font-heading text-3xl uppercase sm:text-4xl">{selectedCup.name}</h2><p className="mt-3 text-sm text-muted-foreground">{selectedCup.platform ? formatProfilePlatform(selectedCup.platform) : 'Regional competition'} · Single-match knockout</p><p className="mt-3">{selected ? `${selected.participant_count} clubs · Season ${selected.season_number} · ${selected.status === 'running' ? 'In progress' : 'Completed'}` : 'Awaiting published edition'}</p>{selectedCup.schedule && !selected && <p className="mt-3 text-sm text-muted-foreground">Planned rounds: Sunday {selectedCup.schedule.time} {selectedCup.schedule.timezone}. Exact dates follow the published season calendar.</p>}{selected?.winner_club_name && <p className="mt-4 flex items-center gap-2 font-semibold text-primary"><Trophy size={18} />Champion: {selected.winner_club_name}</p>}{editions.length > 0 && <label className="mt-5 block text-xs text-muted-foreground">Cup edition<select value={selected?.id || ''} onChange={event => update({ edition: event.target.value, cup_tab: null })} className="mt-2 min-h-11 w-full max-w-md border border-border bg-background px-3 text-sm text-foreground">{editions.map(edition => <option key={edition.id} value={edition.id}>Season {edition.season_number} · {edition.status} · Series {edition.reset_series || 0}</option>)}</select></label>}</div></header>
      {!selected ? <section className="py-6"><h3 className={heading}>The Cup starts here</h3><p className="mt-4 max-w-3xl text-muted-foreground">This regional Cup is awaiting a published edition. Confirmed participants, the recorded draw, fixtures and results appear here after activation. All participating divisions compete in the same regional Cup.</p><Link className={`${action} mt-4`} to={`/leagues?region=${encodeURIComponent(selectedCup.region_slug)}`}>Explore this region’s leagues <ArrowRight size={17} /></Link></section> : <>
        <CompetitionTextTabs label="Cup sections" items={tabs} value={activeTab} onChange={value => update({ cup_tab: value })} />
        <div className="py-6">
          {activeTab === 'overview' && <><section className="border-b border-border pb-7"><h3 className={heading}>{selected.status === 'completed' ? 'Cup completed' : 'The road to the final'}</h3><p className="mt-3 text-sm text-muted-foreground">{selected.status === 'completed' ? `Champion: ${selected.winner_club_name || 'Awaiting confirmation'}` : 'Each round advances after all official results are confirmed. Byes advance clubs without a match.'}</p><ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{selected.rounds.map(round => <li key={round.number} className="border-l-2 border-primary/40 py-2 pl-4"><p className="font-semibold">{roundName(round, selected.rounds.length)}</p><p className="mt-1 text-xs text-muted-foreground">{round.drawn ? `${round.matches.filter(match => match.home_score != null && match.away_score != null).length}/${round.matches.length} results confirmed${round.byes.length ? ` · ${round.byes.length} byes` : ''}` : 'Draw pending'}</p></li>)}</ol><button type="button" className={`${action} mt-4`} onClick={() => update({ cup_tab: 'stages' })}>Follow all rounds <ArrowRight size={17} /></button></section><div className="grid gap-8 py-7 sm:grid-cols-2"><section><h3 className={heading}>Next fixture</h3>{next ? <><p className="mt-4">{next.home_club_name} vs {next.away_club_name}</p><p className="mt-2 text-sm text-muted-foreground">{time(next.kickoff_at)}</p><Link className={action} to={`/game-day?match=${encodeURIComponent(next.id)}`}>Open GameDay <ArrowRight size={17} /></Link></> : <p className="mt-4 text-sm text-muted-foreground">{selected.status === 'completed' ? 'This edition has finished.' : 'The next fixture awaits the draw or confirmed results.'}</p>}</section><section><h3 className={heading}>Latest confirmed results</h3>{complete.length ? [...complete].sort((a,b) => Date.parse(b.kickoff_at)-Date.parse(a.kickoff_at)).slice(0,3).map(match => <Link key={match.id} className="block border-b border-border py-3 text-sm" to={`/game-day?match=${encodeURIComponent(match.id)}`}>{match.home_club_name} <strong>{match.home_score} – {match.away_score}</strong> {match.away_club_name}{match.decided_on_penalties && ' · Penalties'}</Link>) : <p className="mt-4 text-sm text-muted-foreground">No confirmed results yet.</p>}</section></div><p className="text-xs text-muted-foreground">Times are shown in your local timezone. Regional Cups do not grant automatic GOST qualification.</p></>}
          {activeTab === 'clubs' && <ParticipantDirectory participants={selected.participants} title="Cup participants" />}
          {activeTab === 'stages' && <CupStages edition={selected} />}
          {activeTab === 'rules' && <section><h3 className={heading}>Cup rules</h3><p className="mt-4 max-w-3xl whitespace-pre-line text-sm text-muted-foreground">{selected.rules}</p><p className="mt-4 text-sm">At least three eligible human players per club. Each participating player needs active STAGE Plus. Keeper optional; ANY allowed. Publish your selection and confirm readiness in GameDay.</p><EditionParticipationConditions conditions={selected.participation_conditions} /></section>}
          {activeTab === 'rewards' && <CupRewards edition={selected} />}
          {activeTab === 'history' && <section><h3 className={heading}>Past Cup editions</h3>{editions.filter(edition => edition.status === 'completed').map(edition => <button type="button" key={edition.id} className="flex min-h-20 w-full flex-wrap items-center justify-between gap-3 border-b border-border py-4 text-left" onClick={() => update({ edition: edition.id, cup_tab: 'overview' })}><span><strong>Season {edition.season_number} · Series {edition.reset_series || 0}</strong><span className="mt-1 block text-sm text-muted-foreground">Champion: {edition.winner_club_name || 'Not recorded'}</span></span><ArrowRight size={17} /></button>)}{!editions.some(edition => edition.status === 'completed') && <p className="mt-5 text-muted-foreground">No completed Cup editions yet.</p>}</section>}
        </div>
      </>}
    </>}
  </>;
  return embedded ? content : <main className="competition-surface min-h-screen bg-background px-5 py-8 text-foreground sm:px-8"><div className="mx-auto max-w-7xl">{content}</div></main>;
}
