import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarDays, ChevronLeft, Layers, Plus, Settings2, Shield, Trophy, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import RegionalLeagueManagementPanel from './RegionalLeagueManagementPanel';
import RegionalRegistrationPanel from './RegionalRegistrationPanel';
import RegionalCupPanel from './RegionalCupPanel';
import RegionalCyclePanel from './RegionalCyclePanel';
import RegionalCalendarPanel from './RegionalCalendarPanel';
import RegionalOperationsPanel from './RegionalOperationsPanel';
import OfficialSchedulePanel from './OfficialSchedulePanel';
import OfficialCompetitionDecisions from './OfficialCompetitionDecisions';
import { stageClient } from '@/api/stageClient';
import { getRegionalLeagueMaxClubs } from '@/lib/regionalLeagueRules';

const tasks = {
  create: { title: 'Create a league', description: 'Create a permanent league and its initial draft edition. Registration and activation follow separately.', icon: Plus },
  registration: { title: 'Open registration', description: 'Choose a regional system, prepare the participation conditions and review the dates before publishing.', icon: Users },
  cycles: { title: 'Placement & next season', description: 'Review the confirmed field, record the draw and allocate sporting places into draft groups.', icon: Layers },
  calendar: { title: 'Publish season calendar', description: 'After allocation, draw fixtures and review the complete season calendar before publishing kickoff times.', icon: CalendarDays },
  cups: { title: 'Regional Cups', description: 'Prepare the permanent Cup, review its edition, then activate matches. Rewards have a separate review.', icon: Trophy },
  schedule: { title: 'Schedule one match', description: 'Schedule or reschedule a specific official fixture, with a reason and explicit confirmation.', icon: CalendarDays },
  review: { title: 'Review league dependencies', description: 'Inspect a permanent league and its linked records before deciding what to change.', icon: Shield },
  retire: { title: 'Retire a league', description: 'Review dependencies and retire a permanent league while preserving its history.', icon: Shield },
  delete: { title: 'Delete an unused league', description: 'Only unused draft leagues can be deleted. The server checks dependencies before confirmation.', icon: Shield },
  decisions: { title: 'Official decisions', description: 'Keep withdrawals, transfer reviews, absence evidence and player sanctions separate from league setup.', icon: Settings2 },
  reset: { title: 'Fresh-start reset', description: 'Review the scope and consequences before resetting generated regional history. This is separate from season rollover.', icon: Shield },
  seed: { title: 'Seed default leagues', description: 'Add the standard league definitions. Use Create a league for an individual custom league.', icon: Layers },
};
const hashTasks = { '#regional-management': 'review', '#regional-registration': 'registration', '#regional-cycles': 'cycles', '#regional-calendar': 'calendar', '#regional-cups': 'cups' };
const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40';

function TaskCard({ id, onOpen }) {
  const task = tasks[id];
  const Icon = task.icon;
  return <button type="button" onClick={() => onOpen(id)} className="group flex h-full flex-col items-start rounded-xl border border-border bg-card p-5 text-left transition hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
    <Icon className="mb-4 h-5 w-5 text-primary" />
    <span className="font-heading text-lg uppercase">{task.title}</span>
    <span className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{task.description}</span>
    <span className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-primary">Open guided task <ArrowRight className="h-3.5 w-3.5" /></span>
  </button>;
}

export default function RegionalAdminWorkspace({ leagues, definitions, trophyItems, registrations, onRefresh, sourceError, applicationsContent, resetContent, leagueContent, fixturesContent, standingsContent, onSelectLeague, onLeagueView, seedRegionalLeagues, seedingRegionalLeagues }) {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const requestedTask = hashTasks[location.hash] || params.get('regional_task') || (params.has('regional_calendar_cycle') ? 'calendar' : params.has('regional_field') ? 'cycles' : null);
  const task = tasks[requestedTask] ? requestedTask : requestedTask === 'choose' ? 'choose' : null;
  const [cupData, setCupData] = useState(null);
  const [cupError, setCupError] = useState('');
  const [cupRefresh, setCupRefresh] = useState(0);
  const [selectedCup, setSelectedCup] = useState(null);
  const [tab, setTab] = useState('overview');
  const [filter, setFilter] = useState('all');
  const [region, setRegion] = useState('all');
  const [season, setSeason] = useState('all');
  const [search, setSearch] = useState('');
  const [detailId, setDetailId] = useState(null);
  const [detailView, setDetailView] = useState('setup');
  const [seedConfirmed, setSeedConfirmed] = useState(false);
  const [seedDone, setSeedDone] = useState(false);
  const detail = leagues.find(league => league.id === detailId);
  useEffect(() => {
    if (tab !== 'competitions') return;
    let active = true;
    setCupError('');
    stageClient.http.get('/regional-leagues/cups').then(result => { if (active) setCupData(result); }).catch(error => { if (active) { setCupData(null); setCupError(error.message); } });
    return () => { active = false; };
  }, [tab, cupRefresh]);
  function openTask(id, cup = null) {
    setSelectedCup(cup);
    setDetailId(null); setSeedConfirmed(false); setSeedDone(false);
    const next = new URLSearchParams(location.search); next.delete('regional_field'); next.delete('regional_calendar_cycle'); next.set('regional_task', id);
    navigate({ search: `?${next}`, hash: '' }, { replace: true });
  }
  function closeTask() {
    setCupRefresh(value => value + 1);
    const next = new URLSearchParams(location.search);
    ['regional_task', 'regional_field', 'regional_calendar_cycle'].forEach(key => next.delete(key));
    navigate({ search: next.toString() ? `?${next}` : '', hash: '' }, { replace: true });
  }
  function openLeague(league) { onSelectLeague(league); setDetailView('setup'); setDetailId(league.id); }
  const visible = leagues.filter(league => (region === 'all' || league.region_slug === region) && (season === 'all' || String(league.season_number) === season) && `${league.name} ${league.platform}`.toLowerCase().includes(search.toLowerCase()));
  const regions = [...new Set(leagues.map(league => league.region_slug).filter(Boolean))].sort();
  const seasons = [...new Set(leagues.map(league => String(league.season_number)).filter(value => value !== 'undefined'))].sort((a, b) => Number(b) - Number(a));
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Regional workspace</p><h2 className="mt-1 font-heading text-2xl uppercase">What would you like to do?</h2><p className="mt-1 text-sm text-muted-foreground">Choose a task. We will guide you through preparation, review and confirmation.</p></div>
      <button type="button" className={`${button} border-primary bg-primary text-primary-foreground hover:bg-primary/90`} onClick={() => openTask('choose')}><Plus className="h-4 w-4" />Start guided task</button>
    </div>
    <nav aria-label="Regional workspace" className="flex gap-1 overflow-x-auto border-b border-border">
      {[['overview', 'Overview'], ['competitions', 'Leagues & Cups'], ['management', 'Management']].map(([id, label]) => <button key={id} type="button" aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)} className={`min-h-12 whitespace-nowrap border-b-2 px-4 text-sm font-semibold ${tab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{label}</button>)}
    </nav>
    {sourceError && <p role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">{sourceError}</p>}
    {tab === 'overview' && <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[['League groups', leagues.length], ['Active groups', leagues.filter(league => ['active', 'in_progress'].includes(league.status)).length], ['Draft groups', leagues.filter(league => league.status === 'draft').length], ['Applications', registrations.length]].map(([label, count]) => <div key={label} className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 font-heading text-3xl">{sourceError && label !== 'Applications' ? '—' : count}</p></div>)}
      </div>
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5"><h3 className="font-heading text-lg uppercase">Start here: prepare a regional season</h3><p className="mt-1 text-sm text-muted-foreground">Each stage has its own checks. Complete the required preparation before moving to the next task.</p><ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{[['create', 'League setup'], ['registration', 'Registration & confirmation'], ['cycles', 'Placement & allocation'], ['calendar', 'Fixtures & calendar']].map(([id, title], i) => <li key={id}><button type="button" onClick={() => openTask(id)} className="flex min-h-14 w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left text-sm hover:border-primary"><span className="font-heading text-xl text-primary">0{i + 1}</span>{title}</button></li>)}</ol><p className="mt-4 text-xs text-muted-foreground">Regional Cups have their own preparation and activation. Existing leagues can be managed directly from Leagues & Cups.</p></div>
      <RegionalOperationsPanel key={location.search} />
    </>}
    {tab === 'competitions' && <>
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2" aria-label="Competition type">{[['all', 'All'], ['leagues', 'Leagues'], ['cups', 'Regional Cups']].map(([id, label]) => <button type="button" key={id} aria-pressed={filter === id} className={`${button} ${filter === id ? 'border-primary bg-primary/10 text-primary' : ''}`} onClick={() => setFilter(id)}>{label}</button>)}</div><button type="button" className={button} onClick={() => openTask(filter === 'cups' ? 'cups' : 'create')}><Plus className="h-4 w-4" />New competition</button></div>
      {filter !== 'cups' && <>
        <div className="grid gap-3 sm:grid-cols-3"><label className="text-xs text-muted-foreground">Region<select className="mt-1 min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground" value={region} onChange={e => setRegion(e.target.value)}><option value="all">All regions</option>{regions.map(value => <option key={value} value={value}>{value}</option>)}</select></label><label className="text-xs text-muted-foreground">Season<select className="mt-1 min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground" value={season} onChange={e => setSeason(e.target.value)}><option value="all">All current seasons</option>{seasons.map(value => <option key={value} value={value}>Season {value}</option>)}</select></label><label className="text-xs text-muted-foreground">Search<input className="mt-1 min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground" placeholder="League or platform" value={search} onChange={e => setSearch(e.target.value)} /></label></div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map(league => <article key={league.id} className="flex flex-col rounded-xl border border-border bg-card p-5"><div className="flex items-start justify-between gap-3"><Shield className="h-6 w-6 text-primary" /><span className="rounded-full border border-border px-2 py-1 text-[10px] uppercase tracking-wider">{league.status || 'Unknown'}</span></div><h3 className="mt-4 font-heading text-xl">{league.name}</h3><p className="mt-1 text-xs text-muted-foreground">{league.region_slug} · {league.platform} · D{league.division || 1}{league.group_code || 'A'} · Season {league.season_number}</p><p className="mt-4 text-sm">{league.num_clubs || 0}/{getRegionalLeagueMaxClubs(league)} clubs</p><p className="mb-5 mt-2 flex-1 text-xs text-muted-foreground">{league.status === 'draft' ? 'Next: review setup, participants and fixture readiness.' : league.status === 'registration' ? 'Next: review registrations and confirmed participants.' : ['completed', 'archived'].includes(league.status) ? 'Review results and the next-season pathway.' : 'Review fixtures, results and the current sporting status.'}</p><button type="button" className={button} onClick={() => openLeague(league)}>Manage league <ArrowRight className="h-4 w-4" /></button></article>)}</div>
        {!visible.length && <div className="rounded-xl border border-dashed border-border p-8 text-center"><p className="text-sm text-muted-foreground">{leagues.length ? 'No leagues match these filters.' : sourceError ? 'League data is unavailable. Refresh Admin before creating a league.' : 'No regional leagues yet. Start by creating a league.'}</p>{!leagues.length && !sourceError && <button type="button" className={`${button} mt-4`} onClick={() => openTask('create')}>Create first league</button>}</div>}
      </>}
      {filter !== 'leagues' && <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-heading text-xl uppercase">Regional Cups</h3><button type="button" className={button} onClick={() => setCupRefresh(value => value + 1)}>Refresh Cups</button></div>
        {cupError ? <p role="alert" className="text-sm text-destructive">Cup data unavailable: {cupError}</p> : !cupData ? <p role="status" className="text-sm text-muted-foreground">Loading Cups…</p> : <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{cupData.definitions.map(cup => {
            const editions = cupData.editions.filter(edition => edition.permanent_cup_id === cup.id).sort((a, b) => Number(b.reset_series || 0) - Number(a.reset_series || 0) || Number(b.season_number) - Number(a.season_number));
            const edition = editions[0];
            return <article key={cup.id} className="flex flex-col rounded-xl border border-border bg-card p-5"><div className="flex items-center justify-between gap-3"><Trophy className="h-6 w-6 text-primary" /><span className="rounded-full border border-border px-2 py-1 text-[10px] uppercase tracking-wider">{edition?.status || 'Setup'}</span></div><h4 className="mt-4 font-heading text-xl">{cup.name}</h4><p className="mt-1 text-xs text-muted-foreground">{cup.region_slug} · {cup.platform}{edition ? ` · Season ${edition.season_number}` : ''}</p><p className="mt-4 text-sm">{edition ? `${edition.participant_ids?.length || 0} participants` : 'No edition prepared yet'}</p><p className="mb-5 mt-2 flex-1 text-xs text-muted-foreground">{!edition ? 'Next: prepare the edition using a published league calendar.' : edition.status === 'draft' ? 'Next: review participants, draw and calendar before activation.' : edition.status === 'completed' ? 'Next: review the final results, rewards and trophy.' : 'Review official results and progress.'}</p><button type="button" className={button} onClick={() => openTask('cups', { cupId: cup.id, editionId: edition?.id || '', step: edition ? edition.status === 'completed' ? 3 : 2 : 1 })}>Manage Cup <ArrowRight className="h-4 w-4" /></button><button type="button" className={`${button} mt-2`} onClick={() => openTask('cups', { cupId: cup.id, editionId: edition?.id || '', step: 0 })}>View / change trophy</button></article>;
          })}</div>
          {!cupData.definitions.length && <div className="rounded-xl border border-dashed border-border p-6 text-center"><p className="text-sm text-muted-foreground">No Regional Cups yet. Prepare a Cup for an existing regional system.</p><button type="button" className={`${button} mt-4`} onClick={() => openTask('cups')}>Prepare first Cup</button></div>}
        </>}
      </section>}
    </>}
    {tab === 'management' && <><div><h3 className="font-heading text-xl uppercase">Choose a separate management task</h3><p className="mt-1 text-sm text-muted-foreground">League setup, sporting decisions and maintenance each have their own workflow.</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{['create', 'registration', 'cycles', 'calendar', 'schedule', 'decisions', 'review', 'retire', 'delete', 'seed', 'reset'].map(id => <TaskCard key={id} id={id} onOpen={openTask} />)}</div></>}
    <Dialog open={!!task} onOpenChange={open => { if (!open) closeTask(); }}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-5xl flex-col overflow-hidden rounded-xl border-border bg-card p-0 text-foreground">
        <DialogHeader className="shrink-0 border-b border-border p-5 pr-14"><DialogTitle className="font-heading text-xl uppercase">{task === 'choose' ? 'Choose your task' : tasks[task]?.title}</DialogTitle><DialogDescription>{task === 'choose' ? 'Each task opens a separate guided workflow. Start with league setup for a new regional system.' : tasks[task]?.description}</DialogDescription></DialogHeader>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-5">
          {task === 'choose' ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{['create', 'registration', 'cycles', 'calendar', 'cups', 'review', 'retire', 'delete', 'decisions'].map(id => <TaskCard key={id} id={id} onOpen={openTask} />)}</div> : <div key={task}>
            {['create', 'review', 'retire', 'delete'].includes(task) && <RegionalLeagueManagementPanel initialAction={task} standalone definitions={definitions} trophyItems={trophyItems} onRefresh={onRefresh} />}
            {task === 'registration' && <><RegionalRegistrationPanel definitions={definitions} leagues={leagues} /><details className="mt-5 rounded-lg border border-border p-4"><summary className="cursor-pointer font-semibold">Review registration applications</summary><div className="mt-4">{applicationsContent}</div></details></>}
            {task === 'cups' && <RegionalCupPanel definitions={definitions} initialCupId={selectedCup?.cupId} initialEditionId={selectedCup?.editionId} initialStep={selectedCup?.step} />}
            {task === 'cycles' && <RegionalCyclePanel leagues={leagues} registrations={registrations} onRefresh={onRefresh} />}
            {task === 'calendar' && <RegionalCalendarPanel leagues={leagues} onRefresh={onRefresh} />}
            {task === 'schedule' && <OfficialSchedulePanel />}
            {task === 'decisions' && <OfficialCompetitionDecisions definitions={definitions} onRefresh={onRefresh} />}
            {task === 'reset' && resetContent}
            {task === 'seed' && <div className="space-y-4"><p className="text-sm">This creates the standard regional league catalogue using the existing seed action. Review the current leagues first to avoid unintended setup.</p><label className="flex gap-2 text-sm"><input type="checkbox" checked={seedConfirmed} disabled={seedingRegionalLeagues} onChange={e => setSeedConfirmed(e.target.checked)} />I want to seed the default regional leagues.</label><button type="button" className={button} disabled={!seedConfirmed || seedingRegionalLeagues} onClick={async () => { await seedRegionalLeagues(); setSeedDone(true); setSeedConfirmed(false); }}>{seedingRegionalLeagues ? 'Seeding…' : 'Seed default leagues'}</button>{seedDone && <p role="status" className="text-sm">Seed request finished. Check the action message and refreshed league catalogue.</p>}</div>}
          </div>}
        </div>
        <div className="shrink-0 border-t border-border px-5 py-3"><button type="button" className={button} onClick={() => task === 'choose' ? closeTask() : openTask('choose')}><ChevronLeft className="h-4 w-4" />{task === 'choose' ? 'Close' : 'Choose another task'}</button></div>
      </DialogContent>
    </Dialog>
    <Dialog open={!!detail} onOpenChange={open => { if (!open) setDetailId(null); }}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-5xl flex-col overflow-hidden rounded-xl border-border bg-card p-0 text-foreground">
        <DialogHeader className="shrink-0 border-b border-border p-5 pr-14"><DialogTitle className="font-heading text-xl">{detail?.name}</DialogTitle><DialogDescription>Manage this league, its fixtures and standings.</DialogDescription></DialogHeader>
        <nav aria-label="League views" className="flex shrink-0 gap-2 overflow-x-auto px-5 pt-3">{[['setup', 'Setup & actions'], ['fixtures', 'Fixtures & results'], ['standings', 'Standings']].map(([id, label]) => <button type="button" key={id} aria-pressed={detailView === id} className={`${button} whitespace-nowrap ${detailView === id ? 'border-primary text-primary' : ''}`} onClick={() => { setDetailView(id); onLeagueView(detail, id); }}>{label}</button>)}</nav>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-5">{detailView === 'setup' ? leagueContent : detailView === 'fixtures' ? fixturesContent : standingsContent}</div>
      </DialogContent>
    </Dialog>
  </div>;
}
