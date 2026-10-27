import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Trophy } from 'lucide-react';
import { stageClient, resolveMyPlayerAndClub } from '@/api/stageClient';
import { COMPETITIONS } from '@/lib/competitionUtils';
import { clubPathway, qualificationRange } from '@/lib/gostOverview';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const action = 'inline-flex min-h-11 items-center gap-2 py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';
const money = value => `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })} STC`;

export function GostTrophy({ trophy, guidance }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [trophy?.id, trophy?.image_url]);
  return <div className="flex h-64 items-center justify-center sm:h-72 lg:h-80">
    {trophy?.image_url && !failed ? <img src={trophy.image_url} alt={trophy.name || 'Competition trophy'} onError={() => setFailed(true)} className="h-full w-full max-w-64 object-contain" /> : <div className="max-w-56 space-y-3 text-center text-sm text-muted-foreground"><Trophy className="mx-auto h-12 w-12 opacity-40" aria-hidden="true" /><p>{failed ? 'Trophy artwork unavailable. Review the image in Admin → Trophies.' : guidance || 'No captured trophy design available.'}</p></div>}
  </div>;
}

export function GostJourney({ journey }) {
  if (journey?.kind !== 'ucl') return <p className="text-sm text-muted-foreground">{journey?.text || 'Competition journey is awaiting confirmed format rules.'}</p>;
  return <div>
    <p className="sr-only">{journey.text}</p>
    <div aria-hidden="true" className="flex flex-col items-start gap-5 text-sm lg:flex-row lg:items-center lg:justify-between lg:gap-3">
      <div className="font-semibold">League phase</div><ArrowRight className="h-4 w-4 shrink-0 rotate-90 text-primary lg:rotate-0" />
      <div className="space-y-4 border-l border-primary/60 pl-4"><div><strong>Top 8</strong><p className="text-xs text-muted-foreground">Direct qualification</p></div><div><strong>Positions 9–24</strong><div className="mt-1 flex flex-wrap items-center gap-2"><ArrowRight className="h-4 w-4 text-primary" /><div><strong className="text-xs">Two-legged playoff</strong><p className="text-xs text-muted-foreground">8 winners advance</p></div></div></div></div>
      {['Round of 16', 'Quarterfinals', 'Semifinals', 'Final'].map(label => <div key={label} className="flex items-center gap-3"><ArrowRight className="h-4 w-4 shrink-0 text-primary" /><span className="font-semibold">{label}</span></div>)}
    </div><p className="mt-5 text-xs text-muted-foreground">Positions 25 and below are eliminated after the league phase.</p>
  </div>;
}

function CompetitionColumn({ meta, competition, archive, onPrizes }) {
  const [editionId, setEditionId] = useState('');
  const season = archive ? competition?.archive.find(s => s.id === editionId) || competition?.archive[0] : competition?.current;
  const assignment = competition?.assignment;
  const trophy = archive ? season?.trophy : assignment?.trophy;
  const href = `/competitions/${meta.slug}${season ? `?season=${encodeURIComponent(season.id)}` : ''}`;
  return <article className="min-w-0 px-2 py-8 text-center sm:px-6 lg:py-0">
    <GostTrophy trophy={trophy} guidance={archive ? 'No captured trophy artwork for this edition.' : assignment?.guidance || 'Assign a competition trophy in Admin → GOST.'} />
    <p className="mt-6 text-xs font-bold uppercase" style={{ color: meta.color }}><span aria-hidden="true">● </span>Tier {['I', 'II', 'III'][meta.tier - 1]}</p>
    <h2 className="mt-3 break-words font-heading text-3xl font-black uppercase italic leading-tight text-foreground lg:flex lg:min-h-20 lg:items-center lg:justify-center">{(competition?.name || meta.name).replace(/^STAGE\s+/i, '')}</h2>
    <div className="mt-5 border-t border-border pt-4">
      <p className="text-xs font-semibold uppercase text-muted-foreground">Regional Division 1</p>
      <p className="mt-2 text-2xl font-bold text-foreground">Positions {qualificationRange(meta.slug)}</p>
      {archive && competition?.archive.length > 0 && <select aria-label={`${meta.name} archived edition`} value={season?.id || ''} onChange={e => setEditionId(e.target.value)} className="mt-4 min-h-11 w-full border-b border-border bg-background px-2 text-sm">{competition.archive.map(s => <option key={s.id} value={s.id}>{s.label} · {s.state}</option>)}</select>}
      <p className="mt-3 text-sm text-muted-foreground">{season ? `${season.label} · ${season.state}` : archive ? 'No archived editions.' : 'No edition announced.'}</p>
      {season?.registered != null && <p className="mt-1 text-xs text-muted-foreground">{season.registered} registered clubs{season.maximum ? ` · ${season.maximum} maximum` : ''}</p>}
      {season?.qualified != null && <p className="mt-1 text-xs text-muted-foreground">{season.qualified} confirmed qualifiers</p>}
      {archive && season?.winner && <p className="mt-2 text-sm">Winner: {season.winner}</p>}
    </div>
    <div className="mt-5 flex flex-col items-center">
      <Link to={href} className={action} style={{ color: meta.color }}>{archive && season ? 'Explore edition' : 'Explore competition'}<ArrowRight size={18} /></Link>
      <button type="button" onClick={() => onPrizes({ name: meta.name, season })} className="min-h-11 text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-primary">Prize details</button>
    </div>
  </article>;
}

export default function Competitions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const archive = searchParams.get('view') === 'archive';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [path, setPath] = useState(null);
  const [prize, setPrize] = useState(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const result = await stageClient.http.get('/gost/overview');
        if (active) { setData(result); setError(''); }
      } catch (e) { if (active) setError(e.status === 404 ? 'The GOST overview needs the matching backend update. Please contact an administrator.' : e.message); }
    }
    load();
    window.addEventListener('focus', load);
    return () => { active = false; window.removeEventListener('focus', load); };
  }, [revision]);
  useEffect(() => {
    let active = true;
    async function loadPath() {
      try {
        const identity = await resolveMyPlayerAndClub();
        const club = identity.club || identity.presidentClub;
        if (!club) { if (active) setPath(clubPathway(null, [], [], [])); return; }
        const [standings, entries] = await Promise.all([
          stageClient.entities.RegionalLeagueStanding.filter({ club_id: club.id }, '-season_number', 100),
          stageClient.entities.QualificationEntry.filter({ club_id: club.id }, '-created_date', 100),
        ]);
        const ids = [...new Set(standings.map(s => s.league_id).filter(Boolean))];
        const leagues = await Promise.all(ids.map(id => stageClient.entities.RegionalLeague.get(id)));
        if (active) setPath(clubPathway(club, leagues.filter(Boolean), standings, entries));
      } catch { if (active) setPath({ text: 'Your club’s regional pathway is currently unavailable.', href: '/leagues' }); }
    }
    loadPath(); return () => { active = false; };
  }, []);
  const competitions = data?.competitions || [];
  const journeys = competitions.map(c => ({ name: c.name, journey: c.current?.journey || c.journey }));
  const sameJourney = new Set(journeys.map(c => JSON.stringify(c.journey))).size === 1;
  return <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-8 lg:py-12">
    <div className="mx-auto max-w-7xl">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div><p className="text-xs uppercase text-muted-foreground">Global Official Stage Tournaments</p><div className="mt-2 flex flex-wrap items-center gap-5"><h1 className="font-heading text-6xl font-black italic leading-none">GOST</h1><p className="border-l border-border pl-5 text-sm text-muted-foreground">Three competitions.<br />One regional pathway.</p></div></div>
        <nav aria-label="GOST editions" className="flex gap-6">{[['Current season', false], ['Archive', true]].map(([label, value]) => <button type="button" key={label} aria-current={archive === value ? 'page' : undefined} onClick={() => setSearchParams(previous => { const next = new URLSearchParams(previous); if (value) next.set('view', 'archive'); else next.delete('view'); return next; })} className={`min-h-11 border-b-2 px-1 text-sm focus-visible:ring-2 focus-visible:ring-primary ${archive === value ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>{label}</button>)}</nav>
      </header>
      {error ? <p role="alert" className="my-8 text-sm text-destructive">{error}<button type="button" onClick={() => setRevision(n => n + 1)} className="ml-3 min-h-11 text-primary">Retry</button></p> : !data ? <p role="status" className="py-20 text-sm text-muted-foreground">Loading competitions...</p> : <div className="my-10 grid divide-y divide-border lg:my-12 lg:grid-cols-3 lg:divide-x lg:divide-y-0">{COMPETITIONS.map(meta => <CompetitionColumn key={`${meta.slug}:${archive}`} meta={meta} competition={competitions.find(c => c.slug === meta.slug)} archive={archive} onPrizes={setPrize} />)}</div>}
      <section className="flex flex-wrap items-center justify-between gap-6 border-y border-border py-7">
        <div className="min-w-0"><h2 className="font-heading text-3xl font-black uppercase italic">Your club’s pathway</h2>{path?.league && <p className="mt-2 text-sm">{path.club} · {path.league} · Division {path.division}</p>}<p className="mt-2 max-w-3xl text-sm text-muted-foreground">{path?.text || 'Loading your regional pathway...'}</p></div>
        <Link to={path?.href || '/leagues'} className={`${action} text-primary`}>Explore regional leagues<ArrowRight size={18} /></Link>
      </section>
      {!archive && <section className="space-y-7 border-b border-border py-8"><h2 className="font-heading text-2xl font-bold uppercase italic">Competition journey</h2>{sameJourney ? <GostJourney journey={journeys[0]?.journey} /> : journeys.map(({ name, journey }) => <div key={name} className="space-y-4"><h3 className="text-sm font-bold">{name}</h3><GostJourney journey={journey} /></div>)}</section>}
    </div>
    <Dialog open={Boolean(prize)} onOpenChange={open => { if (!open) setPrize(null); }}><DialogContent style={{ width: 'min(32rem, calc(100vw - 2rem))' }} className="max-h-[85dvh] max-w-lg overflow-y-auto rounded-none"><DialogTitle className="pr-8">{prize?.name} · Prize details</DialogTitle><DialogDescription>{prize?.season?.label || 'No edition announced'}</DialogDescription>
      {prize?.season?.prizes ? <><dl className="divide-y divide-border">{[['participation', 'Participation payment'], ['winner_bonus', 'Winner’s additional prize'], ['runner_up_bonus', 'Runner-up’s additional prize']].map(([key, label]) => <div key={key} className="flex flex-wrap justify-between gap-3 py-3 text-sm"><dt>{label}</dt><dd className="font-bold">{money(prize.season.prizes[key])}</dd></div>)}</dl><p className="text-sm text-muted-foreground">Finalists receive their participation payment plus their finishing bonus.</p>{prize.season.prizes.budget && <p className="text-sm">Total budget for {prize.season.prizes.participant_basis} captured clubs: <strong>{money(prize.season.prizes.budget)}</strong></p>}</> : <p className="py-4 text-sm text-muted-foreground">Confirmed prize configuration is unavailable for this edition.</p>}
    </DialogContent></Dialog>
  </main>;
}
