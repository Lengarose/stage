export const CALENDAR_CATEGORIES = {
  supreme: { label:'Supreme', color:'#38bdf8', background:'rgba(56,189,248,0.12)' },
  elite: { label:'Elite', color:'#eab308', background:'rgba(234,179,8,0.12)' },
  challenger: { label:'Challenger', color:'#22c55e', background:'rgba(34,197,94,0.12)' },
  regional: { label:'Regional', color:'#f43f5e', background:'rgba(244,63,94,0.12)' },
  friendly: { label:'Friendly', color:'#94a3b8', background:'rgba(148,163,184,0.12)' },
  tournament: { label:'Tournament', color:'#c44df3', background:'rgba(196,77,243,0.12)' },
};
export const CALENDAR_SCOPES = [
  { id:'general', label:'General', description:'All your confirmed games' },
  { id:'gost', label:'GOST', description:"Your club's GOST games" },
  { id:'regional', label:'Regional', description:"Your club's regional games" },
  { id:'tournament', label:'Tournament', description:'Your player and club tournaments' },
  { id:'friendly', label:'Friendly', description:'Confirmed friendly games' },
];
export function calendarDay(value, timezone = 'Europe/Brussels') {
  const parts = new Intl.DateTimeFormat('en-CA',{ timeZone:timezone, year:'numeric',month:'2-digit',day:'2-digit' }).formatToParts(new Date(value));
  const get = type => parts.find(p=>p.type===type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export const calendarTime = (value,timezone) => new Intl.DateTimeFormat(undefined,{timeZone:timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value));
export const calendarDate = (day,options) => new Intl.DateTimeFormat(undefined,{...options,timeZone:'UTC'}).format(new Date(`${day}T12:00:00Z`));
export function shiftCalendarMonth(month, amount) {
  const [year,index] = month.split('-').map(Number);
  return new Date(Date.UTC(year,index-1+amount,1)).toISOString().slice(0,7);
}
export function calendarGrid(month) {
  const [year,index] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year,index-1,1));
  const last = new Date(Date.UTC(year,index,0));
  const offset = (first.getUTCDay()+6)%7;
  const count = Math.ceil((offset+last.getUTCDate())/7)*7;
  return Array.from({length:count},(_,i)=>new Date(Date.UTC(year,index-1,1-offset+i)).toISOString().slice(0,10));
}
export function calendarRange(month) {
  const days=calendarGrid(month);
  return {from:days[0],to:new Date(Date.parse(`${days.at(-1)}T00:00:00Z`)+86400000).toISOString().slice(0,10)};
}
export function groupCalendarEvents(events,timezone) {
  const dates = new Map();
  for (const event of events) {
    const day = calendarDay(event.startsAt,timezone);
    if (!dates.has(day)) dates.set(day,[]);
    dates.get(day).push(event);
  }
  for (const list of dates.values()) list.sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt)||a.id.localeCompare(b.id));
  return dates;
}
export function identicalKickoffs(events) {
  const counts=new Map();
  for(const event of events) { const key=Date.parse(event.startsAt);counts.set(key,(counts.get(key)||0)+1); }
  return new Set(events.filter(e=>counts.get(Date.parse(e.startsAt))>1).map(e=>e.id));
}
