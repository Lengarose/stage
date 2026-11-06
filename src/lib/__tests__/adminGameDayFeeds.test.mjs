import test from 'node:test';
import assert from 'node:assert/strict';
import {initialGameDayFeeds,loadAdminGameDayFeeds,gameDayFeedCount,gameDayFeedLabel,gameDayActionCount,isStaleGameDayMatch} from '../adminGameDayFeeds.js';
const now=Date.parse('2026-11-06T20:00:00Z');
const summary={items:[],total:0,as_of:new Date(now).toISOString()};
const ready=(items=[],total=items.length)=>({status:'ready',items,total});
function clientFor(read){return {http:{get:async(path,query)=>path==='/matches/reviews/summary'?summary:read(path,query)}};}
async function load(client){const state=initialGameDayFeeds();await loadAdminGameDayFeeds(client,(key,result)=>{state[key]=result;},now);return state;}

test('counts remain unknown until every requested category is verified, even when arrays are empty',()=>{
 const feeds=initialGameDayFeeds();assert.equal(gameDayActionCount(feeds),null);assert.equal(gameDayFeedLabel(feeds.forfeits),'Checking…');
 Object.keys(feeds).forEach(key=>{feeds[key]=ready();});assert.equal(gameDayActionCount(feeds),0);
 feeds.reviews=ready([{id:'preview'}],53);feeds.stuck=ready([{id:'same-match'}]);assert.equal(gameDayActionCount(feeds),54);
 feeds.scheduling={status:'error',items:[],total:null};assert.equal(gameDayFeedLabel(feeds.scheduling),'Unavailable');assert.equal(gameDayFeedCount(feeds.scheduling),null);assert.equal(gameDayActionCount(feeds),null);
});
test('scheduling reads every page and keeps equal IDs in different fixture types distinct',async()=>{
 const calls=[];
 const state=await load(clientFor(async(path,query)=>{
  calls.push([path,query]);
  if(path==='/regional-league-fixtures')return Array.from({length:query.offset===0?200:1},(_,i)=>({id:`f-${query.offset+i}`,scheduling_status:'expired'}));
  if(path==='/competition-fixtures')return [{id:'f-0',scheduling_status:'expired'}];
  return [];
 }));
 assert.equal(state.scheduling.status,'ready');assert.equal(state.scheduling.total,202);assert.equal(state.scheduling.items[0]._fixtureType,'regional_league');assert.equal(state.scheduling.items.at(-1)._fixtureType,'competition');
 assert.deepEqual(calls.filter(([p])=>p==='/regional-league-fixtures').map(([,q])=>q.offset),[0,200]);assert.equal(gameDayActionCount(state),202);
});
test('a late failed or duplicate scheduling page invalidates the category instead of showing a partial count',async()=>{
 for(const fail of [true,false]){
  const state=await load(clientFor(async(path,query)=>{
   if(path!=='/regional-league-fixtures')return [];
   if(query.offset===0)return Array.from({length:200},(_,i)=>({id:`f-${i}`,scheduling_status:'expired'}));
   if(fail)throw Error('private failure');
   return [{id:'f-0',scheduling_status:'expired'}];
  }));
  assert.equal(state.scheduling.status,'error');assert.equal(state.scheduling.total,null);assert.deepEqual(state.scheduling.items,[]);assert.equal(state.forfeits.status,'ready');assert.equal(gameDayActionCount(state),null);
 }
});
test('404, denied, unavailable and malformed reads never become successful empty feeds; unrelated categories remain available',async()=>{
 for(const failure of [Object.assign(Error('missing'),{status:404}),Object.assign(Error('denied'),{status:403}),Error('offline'),null,{items:[]},[null],[{id:'duplicate'},{id:'duplicate'}]]){
  const state=await load(clientFor(async(path,query)=>{
   if(path==='/matches' && query.forfeit_status){if(failure instanceof Error)throw failure;return failure;}
   return [];
  }));
  assert.equal(state.forfeits.status,'error');assert.equal(state.reviews.total,0);assert.equal(state.stuck.status,'ready');assert.equal(state.scheduling.status,'ready');assert.doesNotMatch(state.forfeits.error,/offline|denied|missing/);
 }
});
test('stuck category requires all candidate reads and filters final results while retaining the existing deadline/48h heuristic',async()=>{
 const old={id:'old',status:'scheduled',updated_date:'2026-11-03T20:00:00Z'};
 const recent={id:'recent',status:'scheduled',updated_date:new Date(now).toISOString()};
 const due={id:'due',status:'awaiting_confirmation',result_state:'ADMIN_REVIEW',confirmation_due_at:'2026-11-06T19:00:00Z',updated_date:new Date(now).toISOString()};
 const rows=[old,recent,due,{...old,id:'final',result_state:'CONFIRMED'}];
 assert.equal(isStaleGameDayMatch({...old,status:'voided'},now),false);
 const state=await load(clientFor(async(path,query)=>path==='/matches' && query.status?rows.filter(row=>row.status===query.status):[]));
 assert.deepEqual(state.stuck.items.map(row=>row.id),['old','due']);assert.equal(isStaleGameDayMatch({...old,updated_date:new Date(now-48*3600000).toISOString()},now),false);
 const failed=await load(clientFor(async(path,query)=>{if(query.status==='disputed')throw Error('one failed');return path==='/matches' && query.status==='scheduled'?[old]:[];}));
 assert.equal(failed.stuck.status,'error');assert.equal(failed.stuck.total,null);assert.deepEqual(failed.stuck.items,[]);
});
test('pending forfeits exclude unclaimed and terminal rows; the same match may count in another category',async()=>{
 const valid={id:'pending',status:'scheduled',forfeit_status:'pending',forfeit_claimed_by:'home',updated_date:'2026-11-01T00:00:00Z'};
 const state=await load(clientFor(async(path,query)=>{
  if(path!=='/matches')return [];
  if(query.forfeit_status)return [valid,{...valid,id:'done',status:'completed'},{...valid,id:'no-claim',forfeit_claimed_by:null},{...valid,id:'confirmed',result_state:'CONFIRMED'}];
  return query.status==='scheduled'?[valid]:[];
 }));
 assert.equal(state.forfeits.total,1);assert.equal(state.stuck.total,1);assert.equal(gameDayActionCount(state),2);
});
test('review failure stays independent of successful scheduling and forfeit loads',async()=>{
 const state=await load({http:{get:async path=>{if(path==='/matches/reviews/summary')throw Error('failed');return [];}}});
 assert.equal(state.reviews.status,'error');assert.equal(state.scheduling.status,'ready');assert.equal(state.forfeits.total,0);
});
