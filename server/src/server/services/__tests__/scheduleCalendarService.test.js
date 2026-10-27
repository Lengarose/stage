const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeCalendarEvents, validateCalendarQuery, createCalendarService, dateKey } = require('../scheduleCalendarService');
const identity={player:{id:'me'},memberClub:{id:'club'},club:{id:'club'},ownedClub:{id:'owned'}};
const base={id:'m1',home_player_id:'me',away_player_id:'other',home_player_name:'Me',away_player_name:'Opponent',scheduling_status:'confirmed',status:'scheduled',scheduled_date:'2026-10-27 20:00:00',timezone:'Europe/Brussels'};
const options={identity,timezone:'Europe/Brussels',from:'2026-10-01',to:'2026-11-01'};
const normalize=(data={})=>normalizeCalendarEvents({...options,matches:[base],...data});
test('calendar query validates inclusive start, exclusive end, bounded range, scope and identifier',()=>{
  assert.equal(validateCalendarQuery({from:'2026-10-01',to:'2026-11-01'}).scope,'general');
  for(const input of [{from:'2026-02-30',to:'2026-03-01'},{from:'2026-01-01',to:'2027-01-01'},{from:'2026-10-01',to:'2026-11-01',scope:'all'},{from:'2026-10-01',to:'2026-11-01',tournament_id:"' OR 1=1"}])assert.throws(()=>validateCalendarQuery(input),{status:400});
});
test('confirmed home and away player, member and owned-club games are visible, not unrelated games',()=>{
  const matches=[base,{...base,id:'away',home_player_id:'other',away_player_id:'me'},{...base,id:'member',home_player_id:null,away_player_id:null,home_club_id:'opponent',away_club_id:'club'},{...base,id:'owned',home_club_id:'owned',away_club_id:'other'},{...base,id:'private',home_player_id:'someone',away_player_id:'else'}];
  assert.equal(normalize({matches}).length,4);
  assert.equal(normalize({identity:{player:{id:'me'}}}).length,1);
  assert.equal(normalize({identity:{}}).length,0);
});
test('dates alone, proposals, previews, unknown opponents, voids and scheduling windows never establish eligibility',()=>{
  for(const patch of [{scheduling_status:'open'},{scheduling_status:'home_proposed',home_proposed_date:base.scheduled_date},{status:'cancelled'},{status:'voided'},{result_state:'VOIDED'},{status:'preview'},{status:'bye'},{away_player_id:null},{scheduled_date:null,window_start:base.scheduled_date},{scheduled_date:null,created_date:base.scheduled_date}])assert.equal(normalize({matches:[{...base,...patch}]}).length,0,JSON.stringify(patch));
  assert.equal(normalize({matches:[{...base,tournament_id:'cup'}],parents:[{id:'cup',status:'cancelled'}]}).length,0);
});
test('confirmed historical results keep a reliable kickoff and score; empty legacy timestamps stay unavailable',()=>{
  const result={...base,status:'completed',stats_processed:1,scheduling_status:'open',home_score:2,away_score:0};
  assert.equal(normalize({matches:[result]})[0].score,'2 - 0');
  assert.equal(normalize({matches:[{...result,scheduled_date:null}]}).length,0);
  assert.equal(normalize({matches:[{...base,status:'awaiting_confirmation',home_score:4,away_score:3}]})[0].score,null);
});
test('six categories use source identity, not competition display-name matching',()=>{
  for(const category of ['supreme','elite','challenger','regional','tournament','friendly']){
    const fixture={...base,id:`f-${category}`,entity_type:category==='regional'?'regional_league_fixture':'competition_fixture',match_id:base.id,competition_slug:category,competition_name:'Misleading Supreme League',home_club_id:'club',away_club_id:'rival'};
    const match={...base,home_player_id:null,away_player_id:null,home_club_id:'club',away_club_id:'rival',...(category==='tournament'?{tournament_id:'cup'}:{}),...(category==='friendly'?{type:'friendly'}:{})};
    const events=normalize({matches:[match],fixtures:['tournament','friendly'].includes(category)?[]:[fixture]});
    assert.equal(events[0].category,category);
  }
  assert.equal(normalize({matches:[{...base,type:'ranked'}]})[0].category,'match');
  assert.equal(normalize({matches:[{...base,tournament_id:'cup',type:'league'}],parents:[{id:'cup',name:'Supreme League tournament'}]})[0].category,'tournament');
});
test('ordinary admin/user player and club tournaments use the same purple category and scope',()=>{
  for(const created_by of ['admin','user'])for(const club of [false,true]){
    const match={...base,tournament_id:'cup',...(club?{home_player_id:null,away_player_id:null,home_club_id:'club',away_club_id:'rival'}:{})};
    assert.equal(normalize({matches:[match],scope:'tournament',parents:[{id:'cup',created_by,name:'Cup'}]})[0].category,'tournament');
  }
});
test('linked legacy, engine and canonical match become one durable event; legs remain distinct',()=>{
  const fixture={...base,id:'f1',match_id:'m1',entity_type:'competition_fixture',competition_slug:'supreme'};
  const engine={id:'engine',match_id:'m1',legacy_fixture_id:'f1',legacy_fixture_type:'competition_fixture',product_type:'official_competition',competition_slug:'supreme'};
  const data={matches:[base],fixtures:[fixture],engineFixtures:[engine]};
  const events=normalize(data);
  assert.equal(events.length,1);assert.equal(events[0].id,'match:m1');assert.equal(events[0].href,'/game-day?match=m1');
  assert.equal(normalize({...data,matches:[{...base,scheduled_date:'2026-11-04 20:00:00'}]}).length,0);
  assert.equal(normalize({...data,matches:[{...base,status:'voided'}]}).length,0);
  assert.equal(normalize({matches:[base,{...base,id:'leg2',leg:2}]}).length,2);
  assert.equal(normalize({...data,matches:[{...base,scheduled_date:'2026-10-28 20:00:00'}]})[0].id,'match:m1');
});
test('engine backfill cannot turn an unconfirmed legacy date into official confirmation',()=>{
  assert.equal(normalize({matches:[{...base,scheduling_status:'open'}],engineFixtures:[{id:'e',match_id:'m1',legacy_fixture_type:'tournament_match',legacy_fixture_id:'m1',scheduling_status:'confirmed',confirmed_at:base.scheduled_date}]}).length,0);
});
test('repeated canonical records sharing a durable source collapse to the mapped match',()=>{
  const fixture={...base,id:'f',match_id:'m1',entity_type:'competition_fixture',competition_slug:'supreme'};
  const engine={id:'engine',match_id:'m1',legacy_fixture_type:'competition_fixture',legacy_fixture_id:'f',competition_slug:'supreme',product_type:'official_competition'};
  const first={...base,source_fixture_type:'competition_engine',source_fixture_id:'engine'};
  const duplicate={...base,id:'duplicate',source_fixture_type:'competition',source_fixture_id:'f'};
  const events=normalize({matches:[first,duplicate],fixtures:[fixture],engineFixtures:[engine]});
  assert.equal(events.length,1);assert.equal(events[0].id,'match:m1');
});
test('all five scopes stay exclusive; GOST and Regional use the playing club not another owned club',()=>{
  const match={...base,home_club_id:'club',away_club_id:'rival'};
  const fixture={...match,id:'f',match_id:'m1',entity_type:'competition_fixture',competition_slug:'elite'};
  assert.equal(normalize({matches:[match],fixtures:[fixture],scope:'gost'}).length,1);
  assert.equal(normalize({matches:[match],fixtures:[fixture],scope:'regional'}).length,0);
  assert.equal(normalize({matches:[match],fixtures:[fixture],scope:'friendly'}).length,0);
  assert.equal(normalize({matches:[{...match,home_club_id:'owned'}],fixtures:[{...fixture,home_club_id:'owned'}],scope:'gost'}).length,0);
  assert.equal(normalize({matches:[{...base,type:'friendly'}],scope:'friendly'}).length,1);
  assert.equal(normalize({scope:'tournament'}).length,0);
});
test('wall-clock storage uses row timezone, viewer midnight and DST day assignment are correct',()=>{
  const event=normalize({matches:[{...base,scheduled_date:'2026-10-01 00:30:00'}],timezone:'America/New_York',from:'2026-09-01',to:'2026-10-01'})[0];
  assert.equal(event.day,'2026-09-30');
  assert.equal(Date.parse(event.startsAt),Date.parse('2026-09-30T22:30:00Z'));
  const summer=normalize({matches:[{...base,scheduled_date:'2026-10-24 20:00:00'}]})[0];
  const winter=normalize({matches:[{...base,scheduled_date:'2026-10-26 20:00:00'}]})[0];
  assert.ok(summer.startsAt.endsWith('+02:00'));assert.ok(winter.startsAt.endsWith('+01:00'));
  assert.equal(dateKey('2026-10-31T23:30:00Z','Europe/Brussels'),'2026-11-01');
});
test('accepted invitation is independent schedule evidence, without making it a friendly',()=>{
  const events=normalize({matches:[{...base,scheduling_status:'open',accepted_invitation:true,type:'ranked'}]});
  assert.equal(events.length,1);assert.equal(events[0].category,'match');
});
test('service sends trusted scopes, padded date bounds and pagination to SQL, with no writes',async()=>{
  const calls=[];
  const service=createCalendarService({resolveIdentity:async()=>identity,query:async(sql,args)=>{calls.push({sql,args});return sql.startsWith('SELECT timezone')?[{timezone:'Europe/Brussels'}]:[];}});
  const result=await service('user',{from:'2026-10-01',to:'2026-11-01'});
  assert.deepEqual(result.events,[]);
  assert.ok(calls.every(c=>c.sql.startsWith('SELECT')));
  assert.ok(calls.filter(c=>/LIMIT \? OFFSET \?/.test(c.sql)).every(c=>c.args.includes('2026-09-29')&&c.args.includes('2026-11-03')));
  assert.ok(calls.find(c=>/FROM matches m WHERE/.test(c.sql)).args.includes('me'));
  assert.ok(calls.find(c=>/FROM league_entities le/.test(c.sql)).args.includes('club'));
});
