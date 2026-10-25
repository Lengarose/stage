const test=require('node:test'),assert=require('node:assert/strict'),express=require('express'),path=require('node:path');
const {setup}=require('../../services/__tests__/rewardFlowFixture.cjs');
test('earned copies survive automatic/manual archive; locking, admin correction and exact-copy permissions are enforced over HTTP',async()=>{
  const env=setup();env.state.items.push({id:'cup',name:'Shared Design',image_url:'/uploads/original.png'});
  const ago=days=>new Date(Date.now()-days*86400000).toISOString();
  for(const [id,days]of [['t1',8],['t2',2]]) {
    env.state.tournaments.push({id,name:'Cup '+id,type:'knockout',participant_type:'club',status:'completed',completed_at:ago(days),trophy_item_id:'cup',registered_clubs:['club-1','club-2'],winner_club_id:'club-1',winner_club_name:'club-1'});
    env.state.matches.push({id:'final-'+id,tournament_id:id,type:'final',status:'completed',result_state:'CONFIRMED',home_score:2,away_score:1,home_club_id:'club-1',away_club_id:'club-2'});
    await require('../../services/trophyAwardService').awardClubTrophyToClubAndPlayers({clubId:'club-1',trophyItemId:'cup',tournamentId:id,query:env.query});
  }
  assert.equal(env.state.awards.length,2);assert.equal(env.state.placements.length,0);
  await require('../../services/tournamentArchiveService').tick();
  assert.equal(env.state.tournaments[0].status,'archived');assert.equal(env.state.tournaments[1].status,'completed');
  const app=express();app.use(express.json());app.use((req,res,next)=>{req.user={id:req.headers.authorization?.replace('Bearer ','')||'intruder'};next();});
  for(const [url,file]of [['/cabinet','trophyPlacementController'],['/tournaments','tournamentController']]){delete require.cache[path.resolve(__dirname,`../${file}.js`)];app.use(url,require(`../${file}`));}
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  async function request(url,method='GET',body,actor='user-club-1') {
    const r=await fetch(`http://127.0.0.1:${server.address().port}`+url,{method,headers:{Authorization:`Bearer ${actor}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};
  }
  try {
    let r=await request('/tournaments/t2','DELETE',null,'admin');assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.archived,true);assert.equal(env.state.tournaments.length,2);assert.equal(env.state.matches.length,2);
    r=await request('/tournaments/archive');assert.equal(r.status,200);assert.equal(r.data.items.length,2);assert.equal(r.data.total,2);
    const report=(await request('/cabinet/entitlements?owner_id=club-1&owner_type=club')).data;assert.equal(report.titles.all_time,2);
    r=await request('/cabinet','POST',{owner_id:'club-1',owner_type:'club',trophy_item_id:'cup'});assert.equal(r.status,403);
    const input={owner_id:'club-1',owner_type:'club',award_id:report.awards[0].id};
    const concurrent=await Promise.all([request('/cabinet','POST',input),request('/cabinet','POST',input)]);assert.ok(concurrent.every(r=>r.status===201));assert.equal(env.state.placements.length,1);
    const first=concurrent[0].data;assert.ok(!first.locked_at);
    r=await request('/cabinet/'+first.id,'PATCH',{scale:1.2});assert.equal(r.status,200);
    r=await request('/cabinet/confirm/club/club-1','POST',{placement_ids:[first.id]},'intruder');assert.equal(r.status,403);
    r=await request('/cabinet/confirm/club/club-1','POST',{placement_ids:[first.id]});assert.equal(r.status,200);assert.ok(env.state.placements[0].locked_at);
    r=await request('/cabinet/'+first.id,'PATCH',{x_percent:70});assert.equal(r.status,403);
    r=await request('/cabinet/'+first.id,'DELETE');assert.equal(r.status,403);
    r=await request('/cabinet','POST',{...input,award_id:report.awards[1].id});assert.equal(r.status,201);assert.equal(env.state.placements.length,2);assert.ok(!r.data.locked_at);
    r=await request('/cabinet/correct/'+first.id,'POST',{reason:'Proven positioning mistake'},'admin');assert.equal(r.status,200);assert.equal(env.state.placements[0].locked_at,null);assert.ok(env.state.audits.some(a=>a.action==='unlock_trophy_correction'));
    r=await request('/cabinet/review/club/club-1','POST',{},'admin');assert.equal(r.status,200);
    r=await request('/cabinet/review/club/club-1','POST',{apply:true,action:'materialize',reason:'Idempotent reviewed history'},'admin');assert.equal(r.status,200);assert.equal(env.state.awards.length,2);
    env.state.players.push({id:'player-1',user_id:'user-player-1',email:'player@example.test',gamertag:'Solo Winner'});
    env.state.tournaments.push({id:'solo',name:'Solo Cup',type:'knockout',participant_type:'player',status:'completed',completed_at:ago(1),trophy_item_id:'cup',registered_players:['player-1','opponent'],winner_player_id:'player-1'});
    env.state.matches.push({id:'solo-final',tournament_id:'solo',type:'final',status:'completed',result_state:'CONFIRMED',home_score:2,away_score:1,home_player_id:'player-1',away_player_id:'opponent'});
    await require('../../services/trophyAwardService').awardPlayerOnlyTrophy({playerId:'player-1',trophyItemId:'cup',tournamentId:'solo',query:env.query});
    const solo=(await request('/cabinet/entitlements?owner_id=player-1&owner_type=player')).data;assert.equal(solo.titles.all_time,1);
    r=await request('/cabinet','POST',{owner_id:'player-1',owner_type:'player',award_id:solo.awards[0].id},'user-player-1');assert.equal(r.status,201);const soloPlacement=r.data;
    r=await request('/cabinet/confirm/player/player-1','POST',{placement_ids:[soloPlacement.id]},'user-player-1');assert.equal(r.status,200);
    r=await request('/cabinet/'+soloPlacement.id,'DELETE',null,'user-player-1');assert.equal(r.status,403);
    const ledgerBefore=structuredClone(env.state.ledgers);env.state.tournaments.splice(0);env.state.matches.splice(0);
    r=await request('/cabinet/entitlements?owner_id=club-1&owner_type=club');assert.equal(r.data.awards.length,2);assert.equal(r.data.titles.all_time,2);assert.deepEqual(env.state.ledgers,ledgerBefore);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
