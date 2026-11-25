import CompetitionHubHero from '@/components/competition/CompetitionHubHero';
import '@/components/competition/competitionPages.css';
import '@/components/competition/regionalDarkRed.css';
import { useEffect, useState } from 'react';
import { competitionPagePresentation } from '@/lib/competitionPagePresentation';
import RegionalCups from './RegionalCups';
import RegionalCompetitionNav from '@/components/competition/RegionalCompetitionNav';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Search } from 'lucide-react';
import { stageClient } from '@/api/stageClient';
import { gostAccess } from '@/lib/gostOverview';
import { REGIONS, STAGE_QUALIFICATION_RULES } from '@/lib/qualificationConfig';
import { regionalSystems, regionalHref } from '@/lib/regionalPresentation';
import { formatProfilePlatform } from '@/lib/profilePlatform';
import CompetitionTextTabs from '@/components/competition/CompetitionTextTabs';
import { GostTrophy } from '@/pages/Competitions';


export default function RegionalLeagues() {
  const [params, setParams] = useSearchParams();
  const [presentation, setPresentation] = useState(() => competitionPagePresentation('regional'));
  const [presentationError, setPresentationError] = useState(false);
  useEffect(() => {
    let active = true;
    stageClient.entities.CompetitionPageConfig.filter({key:'regional'}, '-updated_date', 1).then(rows => { if (active) setPresentation(competitionPagePresentation('regional', rows[0] || {})); }).catch(() => { if (active) setPresentationError(true); });
    return () => { active = false; };
  }, []);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState(params.get('region') || '');
  const [division, setDivision] = useState('');
  const archive = params.get('view') === 'archive';
  useEffect(() => {
    if (params.get('region')) setRegion(params.get('region'));
    if (params.get('view') === 'cups') return;
    let active = true;
    stageClient.http.get('/regional-public/overview').then(result => { if (!Array.isArray(result.editions)) throw new Error('Invalid regional response'); if (active) { setData(result); setError(''); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [revision, params]);
  const systems = regionalSystems(data?.editions || [], { archive, search, region, division });
  const allRegions = [...new Set(data?.editions.map(e => e.region_slug).filter(Boolean) || [])];
  const divisions = [...new Set(data?.editions.map(e => e.division).filter(Boolean) || [])].sort((a,b) => a-b);
  const regionName = slug => REGIONS.find(r => r.slug === slug)?.name || slug || 'Regional identity unavailable';
  if (params.get('view') === 'cups') return <RegionalCups embedded />;
  return <main className="official-competition-ui ch-hub ch-regional-layout"><CompetitionHubHero kind="regional" /><div id="competition-directory" className="ch-directory">
    <RegionalCompetitionNav />
    <header className="flex flex-wrap items-end justify-between gap-5"><div><h2 className="font-heading">League directory</h2><p className="mt-3 text-muted-foreground">Browse divisions, compare availability and find your next competition.</p></div><CompetitionTextTabs label="Regional editions" value={archive ? 'archive' : 'current'} items={[{ value: 'current', label: 'Current Season' }, { value: 'archive', label: 'Archive' }]} onChange={value => setParams(previous => { const next = new URLSearchParams(previous); next.set('view', value); return next; })} /></header>
    <div className="my-7 flex flex-wrap items-center gap-3"><label className="relative w-full sm:w-72"><span className="sr-only">Search leagues</span><Search size={17} className="absolute left-3 top-3.5 text-muted-foreground" /><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leagues..." className="h-11 w-full border border-border bg-background pl-10 pr-3 text-sm" /></label><select aria-label="Region" value={region} onChange={e => setRegion(e.target.value)} className="h-11 max-w-full border border-border bg-background px-3 text-sm"><option value="">All regions</option>{allRegions.map(r => <option key={r} value={r}>{regionName(r)}</option>)}</select><select aria-label="Division" value={division} onChange={e => setDivision(e.target.value)} className="h-11 border border-border bg-background px-3 text-sm"><option value="">All divisions</option>{divisions.map(d => <option value={d} key={d}>Division {d}</option>)}</select><Link to="/competitions" className="inline-flex min-h-11 items-center gap-2 text-primary sm:ml-auto">Explore GOST <ArrowRight size={17} /></Link></div>
    {presentationError && <p role="status" className="text-sm text-muted-foreground">Region header images could not be loaded.</p>}
    {error ? <div role="alert" className="py-10 text-destructive">Regional leagues could not be loaded: {error}<button type="button" className="ml-3 min-h-11 text-primary" onClick={() => setRevision(n => n+1)}>Retry</button></div> : !data ? <p role="status" className="py-16">Loading regional leagues...</p> : !systems.length ? <div className="border-y border-border py-12"><p>{data.editions.length ? 'No leagues match the selected edition view and filters.' : 'No regional leagues available.'}</p><button type="button" className="mt-3 min-h-11 text-primary" onClick={() => { setSearch(''); setRegion(''); setDivision(''); }}>Clear filters</button></div> : <div className="regional-system-grid">{systems.map(system => <section key={system.key} className="regional-system-list">
      <header className="regional-system-heading regional-system-photo-heading">
        {presentation.region_headers[system.region_slug]?.url && <div className="regional-system-photo" aria-hidden="true"><img src={presentation.region_headers[system.region_slug].url} alt="" style={{objectPosition:presentation.region_headers[system.region_slug].position, transform:`scale(${presentation.region_headers[system.region_slug].zoom / 100})`}}/><div className="regional-system-photo-fade"/></div>}
        <div><p className="text-xs uppercase tracking-widest text-muted-foreground">{system.region || 'Regional league system'}</p><h2>{regionName(system.region_slug)}</h2><p className="text-sm text-muted-foreground">{system.divisions} division{system.divisions === 1 ? '' : 's'} · {formatProfilePlatform(system.platform, 'Platform unavailable', { preserveUnspecified: true })}</p></div>
        <div className="regional-system-links"><Link to={`/register-league?region=${encodeURIComponent(system.region_slug)}`}>Your club’s participation <ArrowRight size={16}/></Link><Link to={`${regionalHref(system.editions[0])}&rules=1`}>Regional rules <ArrowRight size={16}/></Link></div>
      </header>
      <div className="regional-league-list">{system.editions.map(edition => <article key={edition.id} className="regional-league-row">
        <div className="regional-row-trophy"><GostTrophy compact trophy={edition.trophy} guidance="Trophy not assigned." /></div>
        <div className="regional-row-identity"><p className="regional-row-kicker">Division {edition.division} <span> / </span> Group {edition.group_code || 'A'}</p><h3><Link to={regionalHref(edition)}>{edition.name}</Link></h3><p className="regional-row-season">{edition.season_label || `Season ${edition.season_number}`} · {formatProfilePlatform(system.platform, 'Platform unavailable', { preserveUnspecified: true })}</p>{(edition.identity_conflict || edition.identity_unverified) && <p role="status" className="mt-2 text-xs text-warning">Season information is being reviewed.</p>}</div>
        <div className="regional-row-places"><strong>{edition.participant_count ?? '—'}<span> / {edition.max_clubs}</span></strong><span>CLUBS</span></div>
        <div className="regional-row-status"><span className={`regional-status-mark ${edition.status === 'registration' ? 'is-open' : ''}`} aria-hidden="true" />{String(edition.status).replaceAll('_', ' ')}</div>
        <Link to={regionalHref(edition)} className="regional-row-open" aria-label={`Explore ${edition.name}`}><span>Explore league</span><ArrowRight size={21}/></Link>
      </article>)}</div>
    </section>)}</div>}
    <section className="border-b border-border py-7"><h2 className="font-heading text-2xl uppercase">The road to GOST</h2><p className="mt-3 text-sm text-muted-foreground">{gostAccess.qualifications_open ? 'Final confirmed Division 1 standings determine qualification. Division 2 follows its linked promotion route, not direct GOST qualification.' : gostAccess.closed_message}</p><div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">{STAGE_QUALIFICATION_RULES.map(rule => <Link key={rule.competitionSlug} to={`/competitions/${rule.competitionSlug}`} className="min-h-11 py-2 text-sm">{rule.competitionName}{gostAccess.qualifications_open && ` · Positions ${rule.positions[0]}–${rule.positions.at(-1)}`}</Link>)}</div></section>
  </div></main>;
}
