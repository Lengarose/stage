import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { stageClient, resolveMyPlayerAndClub } from '@/api/stageClient';
import { sortStandings } from '@/lib/competitionUtils';
import { STAGE_QUALIFICATION_RULES, REGIONS } from '@/lib/qualificationConfig';
import { selectRegionalEdition, historicalRegional, regionalTabs } from '@/lib/regionalPresentation';
import { editionProgress } from '@/lib/gostDetail';
import { penaltyOutcome } from '@/lib/penaltyOutcome';
import { GostTrophy } from '@/pages/Competitions';
import CompetitionTextTabs from '@/components/competition/CompetitionTextTabs';
import ParticipantDirectory from '@/components/competition/ParticipantDirectory';
import LeagueCompetitionStages from '@/components/LeagueCompetitionStages';
import TournamentLeaderboard from '@/components/TournamentLeaderboard';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import smoke from '@/assets/regional-smoke.png';

const action = 'inline-flex min-h-11 items-center gap-2 py-2 font-semibold focus-visible:ring-2 focus-visible:ring-primary';
const heading = 'font-heading text-2xl uppercase sm:text-3xl';
const money = value => `${Number(value).toLocaleString(undefined,{maximumFractionDigits:2})} STC`;
const label = value => String(value || 'Draft').replaceAll('_', ' ');
const date = value => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleString() : '';

function RegionalTable({ edition, standings }) {
  const rows = sortStandings(standings);
  const rules = Array.isArray(edition.qualification_rules) ? edition.qualification_rules : STAGE_QUALIFICATION_RULES;
  return !rows.length ? <p className="py-10 text-muted-foreground">No standings recorded yet.</p> : <div className="max-w-full overflow-x-auto border-y border-border"><table className="w-full min-w-[700px] text-sm"><thead><tr className="border-b border-border text-xs text-muted-foreground">{['#','Club','P','W','D','L','GF','GA','GD','PTS','Route'].map(c => <th key={c} className={`px-3 py-3 ${c === 'Club' ? 'text-left' : 'text-center'}`}>{c}</th>)}</tr></thead><tbody>{rows.map((row,i) => {
    const position = i+1;
    const zone = Number(edition.division) === 1 ? rules.find(r => r.positions?.includes(position)) : null;
    const promoted = Number(edition.division) > 1 && (edition.promoted_slots != null ? position <= edition.promoted_slots : row.is_promoted);
    const relegated = row.is_relegated || edition.relegated_slots != null && position > rows.length - edition.relegated_slots;
    return <tr key={row.id || row.club_id} className="border-b border-border"><td className="px-3 py-3 text-center">{position}</td><td className="px-3 py-3"><Link to={`/clubs/${encodeURIComponent(row.club_id)}`} className="flex min-h-10 items-center gap-3 font-semibold">{row.club_logo_url && <img src={row.club_logo_url} alt="" className="h-7 w-7 object-contain" />}{row.club_name || 'Club unavailable'}</Link></td>{[row.played,row.wins,row.draws,row.losses,row.goals_for,row.goals_against,row.goal_difference,row.points].map((v,j)=><td key={j} className={`px-3 py-3 text-center tabular-nums ${j===7?'font-bold text-foreground':'text-muted-foreground'}`}>{v ?? 0}</td>)}<td className="px-3 py-3 text-xs text-muted-foreground">{zone?.competitionName || (promoted ? 'Promotion' : relegated ? 'Relegation' : '—')}</td></tr>;
  })}</tbody></table></div>;
}

function Movement({ edition, editions }) {
  if (Number(edition.division) === 1) {
    const rules = Array.isArray(edition.qualification_rules) ? edition.qualification_rules : STAGE_QUALIFICATION_RULES;
    return <section className="border-y border-border py-7"><h2 className={heading}>The road to GOST</h2><p className="mt-3 text-sm text-muted-foreground">Qualification is confirmed from final Division 1 standings.</p><div className="mt-4 flex flex-wrap gap-x-8 gap-y-4">{rules.map((rule,i) => <div key={rule.competitionSlug || i}><p className="font-semibold">{rule.competitionName || rule.competitionSlug}</p><p className="mt-1 text-sm text-muted-foreground">Positions {rule.positions?.[0]}–{rule.positions?.at(-1)}</p></div>)}</div></section>;
  }
  const hasUpper = editions.some(e => e.system_key === edition.system_key && Number(e.division) === Number(edition.division)-1);
  const hasLower = editions.some(e => e.system_key === edition.system_key && Number(e.division) === Number(edition.division)+1);
  return <section className="border-y border-border py-7"><h2 className={heading}>Promotion and relegation</h2><p className="mt-3 text-sm text-muted-foreground">{hasUpper ? `Promotion to Division ${Number(edition.division)-1}${edition.promoted_slots != null ? ": top " + edition.promoted_slots + " positions." : "; places awaiting edition configuration."}` : 'No linked upper division is configured.'} {hasLower ? `Relegation to the linked lower division${edition.relegated_slots != null ? ": bottom " + edition.relegated_slots + " positions." : "; places awaiting edition configuration."}` : ''} Final confirmed standings determine placement. This division does not qualify directly for GOST.</p></section>;
}

function LeagueEdition({ edition, editions, identity, tab, setTab, selectSeason, initialFixture }) {
  const [data,setData] = useState(null);
  const [error,setError] = useState('');
  const [revision,setRevision] = useState(0);
  useEffect(() => {
    let active = true, sequence = 0;
    async function load() {
      const request = ++sequence;
      try {
        const [directory, view] = await Promise.all([stageClient.http.get(`/regional-public/${encodeURIComponent(edition.id)}/clubs`),stageClient.http.get(`/competition-views/regional_league/${encodeURIComponent(edition.id)}`)]);
        if (!Array.isArray(directory.participants) || !Array.isArray(view.matches) || !Array.isArray(view.standings)) throw new Error('Incomplete edition response');
        if (active && request === sequence) { setData({...view,participants:directory.participants});setError(''); }
      } catch(e) { if(active && request === sequence)setError(e.message); }
    }
    void load();window.addEventListener('focus',load);
    return () => { active=false;window.removeEventListener('focus',load); };
  },[edition.id,revision]);
  if(error)return <div role="alert" className="py-10 text-destructive">Season data could not be loaded: {error}<button type="button" className={action} onClick={()=>setRevision(n=>n+1)}>Retry</button></div>;
  if(!data)return <p role="status" className="py-12">Loading edition...</p>;
  const {participants,matches,standings}=data;
  const progress=editionProgress(edition,participants,matches);
  const rows=sortStandings(standings);
  const myClub=[identity?.club,identity?.presidentClub].find(c=>c&&participants.some(p=>p.id===c.id)) || identity?.club || identity?.presidentClub;
  const own=participants.some(c=>c.id === myClub?.id);
  const ownRow=own?rows.find(r=>r.club_id === myClub.id):null;
  const next=own?progress.upcoming.find(m=>[m.home_club_id,m.away_club_id].includes(myClub.id)):null;
  const leader=progress.played.length && rows.some(r=>Number(r.played)>0) ? rows[0] : null;
  const openFixture = match => setTab('stages',match.fixture_id || match.id);
  const previews = (list, empty) => list.length ? list.slice(0,3).map(m => <div key={m.id} className="border-b border-border py-3 text-sm"><p>{m.home_club_name} <strong>{progress.played.some(p=>p.id===m.id) ? `${m.home_score} – ${m.away_score}` : 'vs'}</strong> {m.away_club_name}</p>{m.scheduled_date && <p className="mt-1 text-muted-foreground">{date(m.scheduled_date)}</p>}{penaltyOutcome(m) && <p>{penaltyOutcome(m)}</p>}{m.match_id ? <Link className={action} to={`/game-day?match=${encodeURIComponent(m.match_id)}`}>Open GAMEDAY <ArrowRight size={16}/></Link> : <button type="button" className={action} onClick={()=>openFixture(m)}>View matchday {m.round} <ArrowRight size={16}/></button>}</div>) : <p className="mt-3 text-sm text-muted-foreground">{empty}</p>;
  return <>
    {tab === 'overview' && <>
      <div className="grid gap-7 border-b border-border py-7 lg:grid-cols-[1.2fr_1fr]"><section><h2 className={heading}>{progress.finished ? edition.status==='archived'?'Archived season':'Season completed' : edition.status==='in_progress' || progress.played.length ? 'The season is underway' : participants.length ? matches.length?'Fixtures ready':'Preparing the season' : 'The season starts here'}</h2><p className="mt-3 text-sm text-muted-foreground">{progress.finished ? `Champion: ${edition.winner_club_name || 'Not recorded'}` : leader ? `League leader: ${leader.club_name}` : participants.length ? 'Confirmed clubs are preparing for their scheduled matchdays.' : 'Clubs are being confirmed. Fixtures and standings will follow the supported season workflow.'}</p><dl className="mt-5 flex flex-wrap gap-8"><div><dt className="text-sm text-muted-foreground">Confirmed clubs</dt><dd className="mt-1 text-2xl font-bold">{participants.length} / {edition.max_clubs}</dd></div><div><dt className="text-sm text-muted-foreground">Season status</dt><dd className="mt-1 font-bold capitalize">{label(edition.status)}</dd></div>{progress.required.length>0&&<div><dt className="text-sm text-muted-foreground">Confirmed matches</dt><dd className="mt-1 font-bold">{progress.played.length} / {progress.required.length}</dd></div>}</dl>{progress.finished&&<button type="button" className={action} onClick={()=>setTab('table')}>Final standings <ArrowRight size={16}/></button>}</section><section className="lg:border-l lg:border-border lg:pl-8"><h2 className={heading}>Your club</h2><p className="mt-3 text-sm text-muted-foreground">{identity === undefined ? 'Loading your club...' : own ? `${myClub.name} participates in this edition.${Number(ownRow?.played)>0 ? ` Position ${rows.indexOf(ownRow)+1}.` : ''}` : myClub ? `${myClub.name} is not a confirmed participant in this edition.` : 'You do not have a participating club in this edition.'}</p>{next&&<div className="mt-3">{previews([next],'')}</div>}<button type="button" className={action} onClick={()=>setTab('clubs')}>View participating clubs <ArrowRight size={16}/></button></section></div>
      <div className="grid gap-8 py-7 lg:grid-cols-2"><section><h2 className={heading}>Next fixtures</h2>{previews(progress.upcoming,matches.length?'No accepted schedules yet.':'Fixtures have not been generated yet.')}<button type="button" className={action} onClick={()=>setTab('stages')}>Explore stages <ArrowRight size={16}/></button></section><section className="lg:border-l lg:border-border lg:pl-8"><h2 className={heading}>Recent results</h2>{previews([...progress.played].reverse(),'No confirmed results yet.')}<button type="button" className={action} onClick={()=>setTab('stages')}>View results <ArrowRight size={16}/></button></section></div>
      <Movement edition={edition} editions={editions}/><div className="grid gap-8 py-7 sm:grid-cols-2"><section><h2 className={heading}>Season rewards</h2><p className="mt-3 text-sm text-muted-foreground">Position-based STC prizes for eligible clubs.</p><button type="button" className={action} onClick={()=>setTab('rewards')}>View all rewards <ArrowRight size={16}/></button></section><section><h2 className={heading}>Past champions</h2><button type="button" className={action} onClick={()=>setTab('history')}>View history <ArrowRight size={16}/></button></section></div>
    </>}
    {tab==='clubs'&&<ParticipantDirectory participants={participants} myId={myClub?.id}/>}
    {tab==='table'&&<RegionalTable edition={edition} standings={standings}/>}
    {tab==='stages'&&<LeagueCompetitionStages key={`${edition.id}:${initialFixture || ''}`} initialFixtureId={initialFixture} naturalScroll kind="regional_league" editionId={edition.id} myClub={myClub} myEmail={identity?.user?.email} myGamertag={identity?.player?.gamertag} renderStandings={()=> <RegionalTable edition={edition} standings={standings}/>}/>}
    {tab==='stats'&&<TournamentLeaderboard naturalScroll tournamentId={edition.id} title="Season Statistics" statisticsUrl={`/competition-views/regional_league/${encodeURIComponent(edition.id)}/statistics`}/>}
    {tab==='rewards'&&<section><h2 className={heading}>Season rewards</h2>{edition.rewards?.rows?.length ? <><p className="my-4 text-sm text-muted-foreground">{edition.rewards.origin}. Eligibility and payment are determined by the established settlement workflow. Viewing this schedule does not establish that a payment was made.</p><div className="max-w-xl"><div className="flex justify-between border-b border-border py-3 text-xs uppercase text-muted-foreground"><span>Finishing position</span><span>STC prize</span></div>{edition.rewards.rows.map(row=><div key={row.position} className="flex justify-between border-b border-border py-3 text-sm"><span>{row.position_label || `Position ${row.position}`}</span><strong>{money(row.stc_amount)}</strong></div>)}</div></> : <p className="my-5 text-muted-foreground">No reliable reward configuration is available for this edition.</p>}<p className="mt-5">Champion’s trophy: {edition.trophy?.name || 'Unavailable'}</p><p className="mt-3 text-sm text-muted-foreground">Recorded settlement state: {edition.rewards?.payment_state || 'Not verified'}</p></section>}
    {tab==='history'&&<section><h2 className={heading}>Season history</h2>{editions.filter(e=>e.division_key===edition.division_key&&historicalRegional(e)).sort((a,b)=>b.season_number-a.season_number).map(e=><button type="button" key={e.id} onClick={()=>selectSeason(e.id,true)} className="flex min-h-20 w-full flex-wrap items-center justify-between gap-4 border-b border-border py-4 text-left"><span><strong>{e.season_label || `Season ${e.season_number}`}</strong><p className="mt-1 text-sm text-muted-foreground capitalize">{e.status}{e.completed_at ? ` · ${date(e.completed_at)}` : ''}</p></span><span className="text-sm">Champion: {e.winner_club_name || 'Not recorded'}{e.trophy?.name ? ` · ${e.trophy.name}` : ''}</span><ArrowRight size={17}/></button>)}{!editions.some(e=>e.division_key===edition.division_key&&historicalRegional(e))&&<p className="py-8 text-muted-foreground">No completed or archived editions yet.</p>}</section>}
  </>;
}

function RegionalLeaguePage({slug}) {
  const [params,setParams]=useSearchParams();
  const [data,setData]=useState(null),[error,setError]=useState(''),[revision,setRevision]=useState(0),[identity,setIdentity]=useState(undefined);
  useEffect(()=>{let active=true;stageClient.http.get('/regional-public/overview').then(value=>{if(active){setData(value);setError('');}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[revision]);
  useEffect(()=>{let active=true;resolveMyPlayerAndClub().then(value=>{if(active)setIdentity(value);}).catch(()=>{if(active)setIdentity(null);});return()=>{active=false;};},[]);
  const edition=data?selectRegionalEdition(data.editions,slug,params.get('season')):null;
  const tab=regionalTabs.some(t=>t.value===params.get('tab'))?params.get('tab'):'overview';
  const setTab=(value,fixture)=>setParams(previous=>{const next=new URLSearchParams(previous);next.set('tab',value);if(fixture)next.set('fixture',fixture);else next.delete('fixture');return next;});
  const selectSeason=(id,overview=false)=>setParams(previous=>{const next=new URLSearchParams(previous);next.set('season',id);next.delete('fixture');if(overview)next.set('tab','overview');return next;});
  const rulesOpen=params.get('rules')==='1';
  const region=REGIONS.find(r=>r.slug===edition?.region_slug)?.name || edition?.region_slug || edition?.region;
  return <main className="competition-surface min-h-screen bg-background px-5 py-7 text-foreground sm:px-8"><div className="mx-auto max-w-7xl"><Link to="/leagues" className={action}><ArrowLeft size={17}/>Back to regional leagues</Link>
    {error?<div role="alert" className="py-12 text-destructive">{error}<button type="button" onClick={()=>setRevision(n=>n+1)} className={action}>Retry</button></div>:!data?<p role="status" className="py-16">Loading regional league...</p>:!edition?<p className="py-12">This edition is unavailable or its identity is ambiguous. Open a specific edition from Regional Leagues; unresolved duplicates need Admin identity review.</p>:<>
      <header className="relative grid grid-cols-[90px_minmax(0,1fr)] items-center gap-6 border-b border-border py-6 sm:grid-cols-[200px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)_240px]"><img src={smoke} alt="" aria-hidden="true" className="regional-smoke pointer-events-none absolute left-0 top-4 h-60 w-full max-w-sm object-contain opacity-20"/><div className="gost-detail-trophy relative"><GostTrophy compact trophy={edition.trophy} guidance="Trophy not assigned."/></div><div className="relative min-w-0"><p className="text-sm uppercase text-muted-foreground">{region} · Division {edition.division}</p><h1 className="mt-3 break-words font-heading text-3xl uppercase sm:text-4xl">{edition.name}</h1><p className="mt-3 text-sm text-muted-foreground">{edition.season_label || `Season ${edition.season_number}`} · {edition.max_clubs} club capacity</p></div><div className="relative col-span-2 max-w-full space-y-3 sm:col-span-1 sm:col-start-2 lg:col-start-auto"><select aria-label="League season" value={edition.id} onChange={e=>selectSeason(e.target.value)} className="min-h-11 w-full max-w-full border border-border bg-background px-3 text-sm">{data.editions.filter(e=>e.division_key===edition.division_key).sort((a,b)=>b.season_number-a.season_number).map(e=><option key={e.id} value={e.id}>{e.season_label || `Season ${e.season_number}`} · {label(e.status)}{e.identity_conflict ? ` · ${e.id}` : ''}</option>)}</select><p className="text-sm capitalize">{label(edition.status)}</p><button type="button" className={action} onClick={()=>setParams(previous=>{const next=new URLSearchParams(previous);next.set('rules','1');return next;})}>View league rules <ArrowRight size={16}/></button></div></header>
      <CompetitionTextTabs items={regionalTabs} value={tab} onChange={setTab}/>
      {(edition.identity_conflict||edition.identity_unverified)&&<p role="status" className="my-4 break-all text-sm text-warning">Edition identity needs Admin review. Viewing record {edition.id}; no records have been merged.</p>}
      <LeagueEdition key={edition.id} edition={edition} editions={data.editions} identity={identity} tab={tab} setTab={setTab} selectSeason={selectSeason} initialFixture={params.get('fixture')}/>
      <Dialog open={rulesOpen} onOpenChange={open=>{if(!open)setParams(previous=>{const next=new URLSearchParams(previous);next.delete('rules');return next;});}}><DialogContent className="max-h-[85dvh] overflow-y-auto rounded-none"><DialogTitle>{edition.name} rules</DialogTitle><DialogDescription>Division {edition.division} · {edition.season_label || `Season ${edition.season_number}`}</DialogDescription><p className="whitespace-pre-wrap text-sm">{edition.rules || 'No additional league rules have been published for this edition.'}</p><Movement edition={edition} editions={data.editions}/>{edition.rules_file_url&&<a href={edition.rules_file_url} target="_blank" rel="noreferrer" className={action}>Open league rules file</a>}</DialogContent></Dialog>
    </>}
  </div></main>;
}
export default function LeagueDetail(){const {slug}=useParams();return <RegionalLeaguePage key={slug} slug={slug}/>;}
