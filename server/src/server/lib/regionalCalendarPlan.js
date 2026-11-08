'use strict';
const policy=require('./regionalCalendarPolicy.json');
const {fail}=require('./regionalEditionIdentity');
const {scheduleTime}=require('./officialScheduleTime');
const dateAt=(date,days)=>new Date(Date.parse(`${date}T00:00:00Z`)+days*86400000).toISOString().slice(0,10);
const dateFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:policy.timezone,year:'numeric',month:'2-digit',day:'2-digit'});
function localDate(instant) {return dateFormatter.format(new Date(instant));}
function weekOf(date) {const day=new Date(`${date}T00:00:00Z`).getUTCDay();return dateAt(date,-((day+6)%7));}
function loadViolations(events,timezone=policy.timezone) {
  const formatter=timezone===policy.timezone?dateFormatter:new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'});
  const clubs=new Map(),errors=new Set();
  for(const e of events)for(const club of [e.home_club_id,e.away_club_id].filter(Boolean)) {
    if(!Number.isFinite(e.instant) || !Number.isFinite(e.minutes) || e.minutes<=0)fail('Invalid existing match block requires Admin review');
    if(!clubs.has(club))clubs.set(club,[]);clubs.get(club).push(e);
  }
  for(const [club,rows] of clubs) {
    const sorted=rows.slice().sort((a,b)=>a.instant-b.instant),days=new Map(),weeks=new Map();
    for(let i=0;i<sorted.length;i++) {
      const e=sorted[i],day=formatter.format(new Date(e.instant)),week=weekOf(day);
      days.set(day,(days.get(day)||0)+1);
      if(!weeks.has(week))weeks.set(week,{count:0,days:new Set()});weeks.get(week).count++;weeks.get(week).days.add(day);
      for(let j=i-1;j>=0;j--)if(sorted[j].instant+sorted[j].minutes*60000>e.instant)errors.add(`Club ${club}: overlapping match blocks (${sorted[j].id}, ${e.id})`);
    }
    for(const [day,count] of days)if(count>policy.max_per_evening)errors.add(`Club ${club}: more than ${policy.max_per_evening} matches on ${day}`);
    for(const [week,row] of weeks) {
      if(row.count>policy.max_per_week)errors.add(`Club ${club}: more than ${policy.max_per_week} matches in week ${week}`);
      if(row.days.size>policy.max_evenings_per_week)errors.add(`Club ${club}: more than ${policy.max_evenings_per_week} playing evenings in week ${week}`);
    }
  }
  return [...errors];
}
function planCalendar({editions,fixtures,start_monday,busy=[],now=new Date()}) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start_monday || '') || !Number.isFinite(Date.parse(`${start_monday}T00:00:00Z`)) || dateAt(start_monday,0)!==start_monday || new Date(`${start_monday}T00:00:00Z`).getUTCDay()!==1)fail('Choose a valid Monday for the first playing week',400);
  if(!Array.isArray(editions) || !editions.length)fail('Select at least one league group',400);
  const entries=[],allClubs=new Set(),fixtureIds=new Set();
  for(const edition of editions) {
    if(!policy.regions.includes(edition.region_slug))fail('This region has no confirmed automatic calendar profile');
    const clubs=typeof edition.registered_club_ids==='string'?JSON.parse(edition.registered_club_ids):edition.registered_club_ids;
    if(!Array.isArray(clubs) || clubs.length!==20 || new Set(clubs).size!==20 || clubs.some(id=>typeof id!=='string' || !id.trim()))fail('Every calendar group requires exactly twenty confirmed clubs');
    for(const club of clubs){if(allClubs.has(club))fail('A club appears in more than one selected group');allClubs.add(club);}
    const group=fixtures.filter(f=>f.league_id===edition.id),pairs=new Set();
    if(group.length!==380)fail('Draw the complete 380-fixture home-and-away league before planning');
    for(let md=1;md<=38;md++) {
      const round=group.filter(f=>Number(f.matchday)===md),seen=new Set(),index=md-1,slot=policy.week_slots[index%4],day=dateAt(start_monday,Math.floor(index/4)*7+slot.day);
      if(round.length!==10)fail(`Matchday ${md} must contain ten fixtures`);
      const time=scheduleTime(`${day}T${slot.time}`,policy.timezone);
      if(time.instant<=new Date(now).getTime()+5*60000)fail('The first playing week is too early for selection publication');
      for(const f of round) {
        if(typeof f.id!=='string' || !f.id.trim() || fixtureIds.has(f.id) || !clubs.includes(f.home_club_id) || !clubs.includes(f.away_club_id) || f.home_club_id===f.away_club_id || seen.has(f.home_club_id) || seen.has(f.away_club_id))fail('Invalid fixture identity or duplicate club within a matchday');
        if((f.phase || 'league')!=='league')fail('Only ordinary league fixtures belong in this calendar');
        const pair=`${f.home_club_id}:${f.away_club_id}`;if(pairs.has(pair))fail('The home-and-away fixture draw contains a repeated pairing');pairs.add(pair);
        fixtureIds.add(f.id);seen.add(f.home_club_id);seen.add(f.away_club_id);
        entries.push({id:f.id,edition_id:edition.id,matchday:md,home_club_id:f.home_club_id,away_club_id:f.away_club_id,scheduled_date:time.wall,timezone:policy.timezone,instant:time.instant,minutes:policy.league_minutes});
      }
    }
  }
  const from=scheduleTime(`${start_monday}T00:00`,policy.timezone).instant,to=scheduleTime(`${dateAt(start_monday,70)}T00:00`,policy.timezone).instant;
  const relevant=busy.filter(e=>!fixtureIds.has(e.fixture_id || e.id) && (allClubs.has(e.home_club_id)||allClubs.has(e.away_club_id)) && e.instant>=from && e.instant<to);
  return {policy_version:policy.version,timezone:policy.timezone,start_monday,entries,blockers:loadViolations([...entries,...relevant]),reserved_weeks:[{week:11,purpose:'Promotion pathways; not drawn by this league calendar'},{week:12,purpose:'Cup finals and necessary decisions; not drawn by this league calendar'}]};
}
module.exports={planCalendar,loadViolations,localDate,weekOf,dateAt,policy};
