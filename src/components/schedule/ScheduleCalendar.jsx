import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronDown, Check, ArrowRight, AlertTriangle, RefreshCw } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { stageClient } from '@/api/stageClient';
import { useAuth } from '@/lib/AuthContext';
import { CHANNELS, setSocketListeners, offSocketListeners } from '@/lib/SocketContext';
import { cn } from '@/lib/utils';
import { CALENDAR_CATEGORIES, CALENDAR_SCOPES, calendarDay, calendarTime, calendarDate, calendarGrid, calendarRange, shiftCalendarMonth, groupCalendarEvents, identicalKickoffs } from '@/lib/scheduleCalendar';

const control = 'inline-flex min-h-11 items-center justify-center gap-2 border border-border px-3 text-sm text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400';
function categoryStyle(event) {
  const category=CALENDAR_CATEGORIES[event.category] || {label:event.category==='gost'?'GOST':'Match',color:'#94a3b8',background:'rgba(148,163,184,0.12)'};
  return {...category,style:{background:category.background,borderInlineStart:`4px solid ${category.color}`}};
}

export default function ScheduleCalendar({ tournamentId }) {
  const auth = useAuth();
  const user=auth?.user;
  const timezone=user?.timezone || 'Europe/Brussels';
  const [month,setMonth]=useState(()=>calendarDay(new Date(),timezone).slice(0,7));
  const [selected,setSelected]=useState(()=>calendarDay(new Date(),timezone));
  const [scope,setScope]=useState('general');
  const [scopeOpen,setScopeOpen]=useState(false);
  const [monthOpen,setMonthOpen]=useState(false);
  const [pickerYear,setPickerYear]=useState(()=>Number(month.slice(0,4)));
  const [response,setResponse]=useState(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [revision,setRevision]=useState(0);
  const sequence=useRef(0);
  const days=calendarGrid(month);
  const {from,to}=calendarRange(month);
  const accountKey=[user?.id,user?.player_id,user?.club_id,user?.owner_id,user?.president_club_id,user?.active_role,timezone].join(':');
  const requestKey=[accountKey,from,to,scope,tournamentId || ''].join('|');
  const current=response?.requestKey===requestKey ? response : null;
  const displayTimezone=current?.timezone || timezone;
  const events=current?.events || [];
  const dates=groupCalendarEvents(events,displayTimezone);
  const selectedEvents=dates.get(selected)||[];
  const conflicts=identicalKickoffs(selectedEvents);
  const today=calendarDay(new Date(),displayTimezone);
  const scopeLabel=CALENDAR_SCOPES.find(s=>s.id===scope)?.label;

  useEffect(()=>{
    let alive=true;
    const version=++sequence.current;
    setLoading(true);
    setError('');
    stageClient.http.get('/schedule/calendar',{from,to,scope,...(tournamentId?{tournament_id:tournamentId}:{})})
      .then(data=>{if(alive && version===sequence.current) setResponse({...data,requestKey});})
      .catch(()=>{if(alive && version===sequence.current)setError('Scheduled games could not be loaded. Please try again.');})
      .finally(()=>{if(alive && version===sequence.current)setLoading(false);});
    return ()=>{alive=false;};
  },[requestKey,revision,from,to,scope,tournamentId]);

  useEffect(()=>{
    let timer;
    const refresh=()=>{clearTimeout(timer);timer=setTimeout(()=>setRevision(r=>r+1),120);};
    const onVisible=()=>{if(document.visibilityState==='visible')refresh();};
    setSocketListeners(CHANNELS.MATCH,refresh);
    window.addEventListener('focus',refresh);
    document.addEventListener('visibilitychange',onVisible);
    const poll=setInterval(onVisible,60000);
    return ()=>{clearTimeout(timer);clearInterval(poll);offSocketListeners(CHANNELS.MATCH,refresh);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',onVisible);};
  },[]);

  const navigateMonth=amount=>{const next=shiftCalendarMonth(month,amount);setMonth(next);setSelected(`${next}-01`);};
  const showToday=()=>{setMonth(today.slice(0,7));setSelected(today);};
  function onDateKey(event,day) {
    const offsets={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
    if (!(event.key in offsets)) return;
    event.preventDefault();
    const next=new Date(Date.parse(`${day}T12:00:00Z`)+offsets[event.key]*86400000).toISOString().slice(0,10);
    setSelected(next);
    if(!days.includes(next))setMonth(next.slice(0,7));
    requestAnimationFrame(()=>document.getElementById(`schedule-day-${next}`)?.focus());
  }

  return (
    <section className="min-w-0 text-foreground" aria-label="Schedule calendar" aria-busy={loading}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3">
        <Popover open={scopeOpen} onOpenChange={setScopeOpen}>
          <PopoverTrigger asChild><button type="button" className={cn(control,'min-w-36 justify-between')} aria-label={`Calendar scope: ${scopeLabel}`}>{scopeLabel}<ChevronDown size={16}/></button></PopoverTrigger>
          <PopoverContent align="start" className="w-72 rounded-none border-border bg-card p-0">
            <div role="group" aria-label="Calendar scope">{CALENDAR_SCOPES.map(option=><button key={option.id} type="button" aria-pressed={scope===option.id} className="flex min-h-14 w-full items-center justify-between gap-3 border-b border-border px-4 py-2 text-left hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400" onClick={()=>{setScope(option.id);setScopeOpen(false);}}><span><span className="block text-sm font-bold">{option.label}</span><span className="block text-xs text-muted-foreground">{option.description}</span></span>{scope===option.id?<Check size={18} className="text-cyan-500"/>:null}</button>)}</div>
          </PopoverContent>
        </Popover>
        <div className="flex items-center gap-1 sm:gap-3">
          <button type="button" aria-label="Previous month" className={cn(control,'w-11 px-0')} onClick={()=>navigateMonth(-1)}><ChevronLeft size={20}/></button>
          <Popover open={monthOpen} onOpenChange={open=>{setMonthOpen(open);if(open)setPickerYear(Number(month.slice(0,4)));}}>
            <PopoverTrigger asChild><button type="button" aria-label="Choose month and year" className="min-h-11 w-28 min-w-0 shrink-0 px-1 font-heading text-lg font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 sm:w-44 sm:text-2xl">{calendarDate(`${month}-01`,{month:'long',year:'numeric'})}</button></PopoverTrigger>
            <PopoverContent className="w-64 rounded-none border-border bg-card p-3"><div className="mb-2 flex items-center justify-between"><button type="button" className={control} aria-label="Previous year" onClick={()=>setPickerYear(y=>y-1)}><ChevronLeft size={16}/></button><span>{pickerYear}</span><button type="button" className={control} aria-label="Next year" onClick={()=>setPickerYear(y=>y+1)}><ChevronRight size={16}/></button></div><div className="grid grid-cols-3 gap-1">{Array.from({length:12},(_,i)=>{const value=`${pickerYear}-${String(i+1).padStart(2,'0')}`;return <button type="button" key={value} className={cn(control,'px-1',value===month&&'text-cyan-500')} onClick={()=>{setMonth(value);setSelected(`${value}-01`);setMonthOpen(false);}}>{calendarDate(`${value}-01`,{month:'short'})}</button>;})}</div></PopoverContent>
          </Popover>
          <button type="button" aria-label="Next month" className={cn(control,'w-11 px-0')} onClick={()=>navigateMonth(1)}><ChevronRight size={20}/></button>
          <button type="button" className={control} onClick={showToday}>Today</button>
        </div>
        <div aria-label="Competition legend" className="flex flex-wrap gap-x-4 gap-y-2 text-xs">{Object.entries(CALENDAR_CATEGORIES).map(([id,category])=><span key={id} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{background:category.color}}/>{category.label}</span>)}</div>
      </div>
      {error?<div role="alert" className="my-3 flex flex-wrap items-center gap-3 border border-destructive/40 p-3 text-sm"><span>{error}{current?' Showing the last loaded games.':''}</span><button type="button" className={control} onClick={()=>setRevision(r=>r+1)}><RefreshCw size={16}/>Retry</button></div>:null}
      <div className="my-3 min-h-5 text-xs text-muted-foreground" role="status">{loading ? (current?'Refreshing games...':'Loading scheduled games...') : error ? '' : !current?.hasClub && ['gost','regional'].includes(scope) ? 'No active club resolved for this calendar scope.' : !events.length ? (scope==='general'?'No confirmed games scheduled in this month.':`No confirmed ${scopeLabel} games in this month.`) : `${events.length} games in the displayed calendar`}</div>
      <div className="grid min-w-0 items-stretch gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
        <div className="min-w-0 border-l border-t border-border" role="grid" aria-label={calendarDate(`${month}-01`,{month:'long',year:'numeric'})}>
          <div className="grid grid-cols-7" role="row">{['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day=><div key={day} role="columnheader" aria-label={day} className="border-b border-r border-border py-2 text-center text-[10px] font-semibold uppercase text-muted-foreground sm:text-xs"><span className="sm:hidden">{day.slice(0,1)}</span><span className="hidden sm:inline">{day.slice(0,3)}</span></div>)}</div>
          {Array.from({length:days.length/7},(_,week)=><div role="row" key={week} className="grid grid-cols-7">{days.slice(week*7,week*7+7).map(day=>{
            const items=dates.get(day)||[];const active=day===selected;const isToday=day===today;
            return <div key={day} role="gridcell" aria-selected={active} className={cn('relative min-w-0 border-b border-r border-border',day.slice(0,7)!==month&&'text-muted-foreground',new Date(`${day}T12:00:00Z`).getUTCDay()%6===0&&'bg-secondary/25',active&&'ring-1 ring-inset ring-cyan-400')}>
              <button type="button" id={`schedule-day-${day}`} tabIndex={active?0:-1} aria-current={isToday?'date':undefined} aria-label={`${calendarDate(day,{dateStyle:'full'})}, ${items.length} games${isToday?', today':''}`} onKeyDown={e=>onDateKey(e,day)} onClick={()=>setSelected(day)} className="flex h-[76px] w-full min-w-0 flex-col p-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400 sm:h-[112px] sm:p-1.5 lg:h-[124px]">
                <span className="flex w-full min-w-0 items-center justify-between gap-1 text-xs sm:text-sm"><span className={cn(isToday&&'font-bold text-cyan-500')}>{Number(day.slice(8))}{day.slice(0,7)!==month?<span className="hidden sm:inline"> {calendarDate(day,{month:'short'})}</span>:null}</span>{isToday?<span className="hidden text-[9px] font-bold text-cyan-500 sm:inline">TODAY</span>:null}</span>
                <span className="mt-1 flex flex-wrap gap-1 sm:hidden">{items.slice(0,3).map(event=><span key={event.id} className="h-1.5 w-1.5 rounded-full" style={{background:categoryStyle(event).color}}/>)}{items.length>3?<span className="text-[9px]">+{items.length-3}</span>:null}</span>
                <span className="mt-1 hidden w-full min-w-0 space-y-1 sm:block">{items.slice(0,2).map(event=>{const category=categoryStyle(event);return <span key={event.id} className="block min-w-0 px-1 py-0.5 text-[10px] leading-tight" style={category.style}><span className="block truncate">{category.label} · {calendarTime(event.startsAt,displayTimezone)}</span><span className="block truncate font-semibold">{event.score?`${event.score} · `:''}{event.homeName} v {event.awayName}</span></span>;})}{items.length>2?<span className="block text-[9px] text-muted-foreground">+{items.length-2} more</span>:null}</span>
              </button>
            </div>;
          })}</div>)}
        </div>
        <section className="min-w-0 border border-border p-4 text-foreground sm:p-5" aria-label="Selected day fixtures">
          <div className="border-b border-border pb-4"><p className="text-sm font-semibold uppercase">{calendarDate(selected,{weekday:'long'})}</p><p className="font-heading text-6xl font-black leading-none text-cyan-500">{Number(selected.slice(8))}</p><h2 className="mt-1 font-heading text-xl uppercase">{calendarDate(selected,{month:'long',year:'numeric'})}</h2></div>
          <p className="my-4 text-sm" aria-live="polite">{loading&&!current?'Loading games...':error&&!current?'Games unavailable':`${selectedEvents.length} scheduled ${selectedEvents.length===1?'game':'games'}`}</p>
          {conflicts.size?<p role="note" className="mb-3 flex items-start gap-2 border border-amber-500/40 p-2 text-xs"><AlertTriangle size={16} className="shrink-0 text-amber-500"/>Games share the same kickoff time. Check the fixtures below.</p>:null}
          {!selectedEvents.length?<p className="text-sm text-muted-foreground">{loading&&!current?'Loading games...':error&&!current?'Games unavailable. Retry above.':scope==='general'?'No fixtures scheduled for this day.':`No ${scopeLabel} fixtures scheduled for this day.`}</p>:null}
          <div className="space-y-3 xl:max-h-[560px] xl:overflow-y-auto xl:pr-1">{selectedEvents.map(event=>{const category=categoryStyle(event);return <article key={event.id} className="min-w-0 border border-border p-3" style={category.style}>
            <div className="flex items-start justify-between gap-2"><p className="min-w-0 break-words text-xs font-bold uppercase">{event.competition}</p><time className="shrink-0 text-sm tabular-nums" dateTime={event.startsAt}>{calendarTime(event.startsAt,displayTimezone)}</time></div>
            <p className="mt-1 text-[10px] text-muted-foreground">{category.label}{event.stage?` · ${event.stage}`:''}{event.matchday?` · Matchday ${event.matchday}`:event.round?` · Round ${event.round}`:''}{event.leg?` · Leg ${event.leg}`:''}</p>
            <div className="mt-2 flex items-start gap-2">{event.homeAvatarUrl?<img src={event.homeAvatarUrl} alt="" className="h-6 w-6 shrink-0 object-contain"/>:null}<h3 className="min-w-0 break-words font-heading text-lg font-bold">{event.homeName} vs {event.awayName}</h3>{event.awayAvatarUrl?<img src={event.awayAvatarUrl} alt="" className="h-6 w-6 shrink-0 object-contain"/>:null}</div>
            {event.score?<p className="mt-1 font-bold">{event.score} · Completed</p>:<p className="mt-1 text-xs text-muted-foreground">{event.status==='in_progress'?'In progress':event.status==='disputed'?'Result disputed':event.status==='awaiting_confirmation'?'Result awaiting confirmation':'Confirmed schedule'}</p>}
            {conflicts.has(event.id)?<p className="mt-1 text-xs text-amber-600 dark:text-amber-300">Same-time kickoff</p>:null}
            {event.href?<Link to={event.href} className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:text-cyan-300" aria-label={`View match: ${event.homeName} vs ${event.awayName}`}>View match<ArrowRight size={16}/></Link>:<p className="mt-2 text-xs text-muted-foreground">Match details are not linked yet.</p>}
          </article>;})}</div>
        </section>
      </div>
      <p className="py-4 text-xs text-muted-foreground">Times shown in {displayTimezone}</p>
    </section>
  );
}
