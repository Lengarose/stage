import {loadDisputeReviewSummary} from './adminDisputeFocus.js';

export const GAME_DAY_FEED_KEYS = ['reviews', 'forfeits', 'scheduling', 'stuck'];
const TERMINAL = new Set(['completed','confirmed','played','forfeit','cancelled','canceled','deleted','voided','archived','reset','superseded']);
const FINAL_RESULTS = new Set(['CONFIRMED','VOIDED','AUTO_CONFIRMED_TIMEOUT']);
const STALE_STATES = new Set(['AWAITING_AWAY_CONFIRMATION','AWAITING_HOME_REVIEW','RESULT_OVERDUE','DISPUTED','ADMIN_REVIEW']);
const CANDIDATE_STATUSES = ['scheduled','in_progress','awaiting_confirmation','disputed'];
const MAX_AGE = 48 * 60 * 60 * 1000;

export function initialGameDayFeeds() {
  return Object.fromEntries(GAME_DAY_FEED_KEYS.map(key=>[key,{status:'loading',items:[],total:null}]));
}
export function gameDayFeedCount(feed) {
  return feed?.status === 'ready' ? feed.total : null;
}
export function gameDayActionCount(feeds, keys=GAME_DAY_FEED_KEYS) {
  const counts=keys.map(key=>gameDayFeedCount(feeds?.[key]));
  return counts.every(count=>count!==null) ? counts.reduce((sum,count)=>sum+count,0) : null;
}
export function gameDayFeedLabel(feed) {
  return gameDayFeedCount(feed) ?? (feed?.status==='error'?'Unavailable':'Checking…');
}
function records(value) {
  if(!Array.isArray(value) || value.some(row=>!row || typeof row.id!=='string' || !row.id) || new Set(value.map(row=>row.id)).size!==value.length)throw Error('Invalid action feed');
  return value;
}
function active(match) {
  return !TERMINAL.has(String(match.status || '').toLowerCase()) && !FINAL_RESULTS.has(String(match.result_state || '').toUpperCase());
}
function timestamp(value) {
  const n=value?new Date(value).getTime():NaN;
  return Number.isFinite(n)?n:null;
}
export function isStaleGameDayMatch(match,now=Date.now()) {
  if(!match?.id || !active(match))return false;
  const status=String(match.status || '').toLowerCase();
  const state=String(match.result_state || '').toUpperCase();
  const due=timestamp(match.confirmation_due_at || match.review_due_at || match.result_due_at);
  const last=timestamp(match.updated_date || match.scheduled_date || match.match_date || match.created_date);
  const old=last!==null && now-last>MAX_AGE;
  return STALE_STATES.has(state)?(due!==null && now>due)||old:CANDIDATE_STATUSES.includes(status)&&old;
}
async function expiredPages(client,path,type) {
  const items=[],ids=new Set();
  for(let offset=0;offset<20000;offset+=200){
    const page=records(await client.http.get(path,{scheduling_status:'expired',limit:200,offset}));
    if(page.length>200 || page.some(row=>ids.has(row.id) || row.scheduling_status!=='expired'))throw Error('Invalid scheduling page');
    for(const row of page){ids.add(row.id);items.push({...row,_fixtureType:type});}
    if(page.length<200)return items;
  }
  throw Error('Scheduling review exceeds the supported read size');
}

// Raw HTTP is intentional: the generic entity factory converts some 404s into [].
// Match filtered reads currently return all matching rows; fixture reads need paging.
export async function loadAdminGameDayFeeds(client,publish,now=Date.now()) {
  const tasks={
    reviews:()=>loadDisputeReviewSummary(client),
    forfeits:async()=>{
      const rows=records(await client.http.get('/matches',{forfeit_status:'pending'}));
      if(rows.some(row=>row.forfeit_status!=='pending' || typeof row.status!=='string'))throw Error('Invalid forfeit response');
      return {items:rows.filter(row=>row.forfeit_claimed_by && active(row))};
    },
    scheduling:async()=>({items:(await Promise.all([
      expiredPages(client,'/regional-league-fixtures','regional_league'),
      expiredPages(client,'/competition-fixtures','competition'),
    ])).flat()}),
    stuck:async()=>{
      const groups=await Promise.all(CANDIDATE_STATUSES.map(async status=>{
        const rows=records(await client.http.get('/matches',{status}));
        if(rows.some(row=>row.status!==status))throw Error('Invalid candidate response');
        return rows;
      }));
      const unique=new Map(groups.flat().map(row=>[row.id,row]));
      return {items:[...unique.values()].filter(row=>isStaleGameDayMatch(row,now))};
    },
  };
  await Promise.allSettled(GAME_DAY_FEED_KEYS.map(async key=>{
    try {
      const data=await tasks[key]();
      publish(key,{...data,total:data.total ?? data.items.length,status:'ready',as_of:data.as_of || new Date(now).toISOString()});
    }catch{
      publish(key,{status:'error',items:[],total:null,error:'This action feed could not be loaded. Refresh to try again.'});
    }
  }));
}
