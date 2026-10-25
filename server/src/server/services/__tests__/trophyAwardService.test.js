const assert=require('node:assert/strict');
const test=require('node:test');
function harness(player=false) {
  const awards=[],placements=[];let roster=['p1','p2'];
  const query=async(sql,v=[])=>{
    if(/FROM tournaments/.test(sql))return [{id:'t',name:'October Cup',type:'knockout',status:'completed',completed_at:'2026-10-25 10:00:00',participant_type:player?'player':'club',trophy_item_id:'design'}];
    if(/FROM matches/.test(sql))return [{id:'final',type:'final',status:'completed',result_state:'CONFIRMED',home_score:2,away_score:1,[player?'home_player_id':'home_club_id']:player?'winner-player':'winner-club',[player?'away_player_id':'away_club_id']:'opponent'}];
    if(/FROM (clubs|players) WHERE id IN/.test(sql))return v.map(id=>({id,name:id,gamertag:id}));
    if(/FROM trophy_items/.test(sql))return [{id:'design',image_url:'/uploads/cup.png',name:'Catalogue Design'}];
    if(/SELECT DISTINCT p.id/.test(sql))return roster.map(id=>({id}));
    if(/SELECT id,club_id FROM players/.test(sql))return [];
    if(/SELECT.*FROM trophy_awards/.test(sql)) {
      let rows=awards;
      let i=0;for(const m of sql.matchAll(/(owner_id|owner_type|source_id|source_type|edition_id|award_key)=\?/g)){const value=v[i++];rows=rows.filter(r=>r[m[1]]===value);}
      return rows;
    }
    if(/INSERT INTO trophy_awards/.test(sql)) {
      const row={id:v[0],owner_id:v[1],owner_type:v[2],trophy_item_id:v[3],source_type:v[4],source_id:v[5],edition_id:v[6],winning_club_id:v[7],status:'earned',award_key:v[8],award_role:v[9],metadata_json:v[10]};
      if(!awards.some(a=>a.award_key===row.award_key))awards.push(row);return {affectedRows:1};
    }
    if(/trophy_placements/.test(sql)){placements.push(sql);throw new Error('Earning a win must not arrange a cabinet');}
    throw new Error('Unexpected SQL: '+sql);
  };
  return {query,awards,placements,setRoster:ids=>{roster=ids;}};
}
test('club championship and associated player honours are durable, not visual placements',async()=>{
  const env=harness();const result=await require('../trophyAwardService').awardClubTrophyToClubAndPlayers({query:env.query,clubId:'winner-club',trophyItemId:'design',tournamentId:'t'});
  assert.equal(result.player_count,2);assert.equal(env.awards.length,3);assert.equal(env.placements.length,0);
  assert.deepEqual(env.awards.map(a=>a.award_role),['club_champion','associated_player','associated_player']);
  const details=JSON.parse(env.awards[0].metadata_json);assert.equal(details.display_name,'October Cup Trophy — 2026');assert.equal(details.participant_count,2);assert.equal(details.image_url,'/uploads/cup.png');
});
test('player tournaments award only their winning player',async()=>{
  const env=harness(true);await require('../trophyAwardService').awardPlayerOnlyTrophy({query:env.query,playerId:'winner-player',trophyItemId:'design',tournamentId:'t'});
  assert.equal(env.awards.length,1);assert.equal(env.awards[0].award_role,'player_champion');
});
test('retries cannot inflate awards or give a later transfer the old winning-club honour',async()=>{
  const env=harness(),service=require('../trophyAwardService'),input={query:env.query,clubId:'winner-club',trophyItemId:'design',tournamentId:'t'};
  await service.awardClubTrophyToClubAndPlayers(input);env.setRoster(['new-transfer']);await service.awardClubTrophyToClubAndPlayers(input);
  assert.equal(env.awards.length,3);assert.ok(!env.awards.some(a=>a.owner_id==='new-transfer'));
});
test('historical materialization cannot infer past player honours from the current squad',async()=>{
  const env=harness();await require('../trophyAwardService').awardClubTrophyToClubAndPlayers({query:env.query,clubId:'winner-club',trophyItemId:'design',tournamentId:'t',tournament:{_historical_backfill:true}});
  assert.equal(env.awards.length,1);assert.equal(env.awards[0].owner_type,'club');assert.equal(JSON.parse(env.awards[0].metadata_json).associated_history_unavailable,true);
});
