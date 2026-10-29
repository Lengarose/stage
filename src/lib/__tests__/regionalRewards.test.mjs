import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { getDefaultRewardRowsForSource, calculatePrizePool } from '../prizeDefaults.js';
const require=createRequire(import.meta.url);
const {placements}=require('../../../server/src/server/lib/competitionPrizes.js');
test('regional divisions select exact finishing-position prizes from authoritative division metadata',()=>{
  for(const division of [1,2,3]) {
    const rows=getDefaultRewardRowsForSource('regional_league',{division},20);
    assert.equal(rows.length,20);
    const first=division===2?33000000:54000000;
    assert.deepEqual(rows.map(r=>Number(r.stc_amount)),Array.from({length:20},(_,i)=>first-i*1700000));
    assert.equal(calculatePrizePool('regional_league',{division},20),division===2?337000000:757000000);
    assert.equal(rows[2].position_label,'3rd Place');
    assert.ok(rows.every(r=>!/semi|quarter/i.test(r.position_label)));
  }
});
test('division two metadata, not names, selects the same schedule across regions and platforms',()=>{
  for(const region of ['England','Belgium','Japan'])for(const platform of ['PlayStation','Xbox','PC']) {
    assert.equal(calculatePrizePool('regional_league',{division:'2',name:'First Division',region,platform},20),337000000);
    assert.equal(calculatePrizePool('regional_league',{division:1,name:'Division 2',region,platform},20),757000000);
  }
  assert.equal(calculatePrizePool('regional_league',{division:2},2),64300000);
});
test('next-season creation returns server-inherited rewards without seeding a child source',async()=>{
  const source=readFileSync(new URL('../seasonLifecycle.js',import.meta.url),'utf8');
  const fn=source.slice(source.indexOf('export async function createNextLeagueSeason(')).replace('export ','').replace('await import("./rewardsEngine")','rewardHelpers');
  for(const division of [1,2]) {
    const expected=division===2?337000000:757000000;
    let seeded = false;
    let requested;
    const stageClient={http:{post:async(path,body)=>{requested={path,body};return {outcome:'existing',record:{id:'next',permanent_league_id:'original',name:'League',division,max_clubs:20,prize_pool_stc:expected}};}}};
    const rewardHelpers={ensureDefaultRewardConfigs:async()=>{seeded=true;}};
    const create=new Function('stageClient','calculatePrizePool','REGIONAL_LEAGUE_MAX_CLUBS','rewardHelpers',`${fn};return createNextLeagueSeason;`)(stageClient,calculatePrizePool,20,rewardHelpers);
    const result=await create({id:'old',slug:'league-s1',name:'League',division,season_number:1,max_clubs:20});
    assert.equal(result.division,division);assert.equal(result.prize_pool_stc,expected);assert.equal(result.permanent_league_id,'original');assert.equal(seeded,false);
    assert.equal(requested.path,'/regional-leagues/old/next-season');
  }
  const admin=readFileSync(new URL('../../pages/Admin.jsx',import.meta.url),'utf8');
  assert.match(admin,/calculatePrizePool\("regional_league", d, REGIONAL_LEAGUE_MAX_CLUBS\)/);
});
test('future regional divisions do not acquire an inferred Division 1 schedule through automatic default seeding',async()=>{
 const source=readFileSync(new URL('../rewardsEngine.js',import.meta.url),'utf8');
 const fn=source.slice(source.indexOf('export async function ensureDefaultRewardConfigs(')).replace('export ','');
 let saved=false;
 const seed=new Function('getRewardConfiguration','getDefaultRewardRowsForSource','saveRewardConfigs',`${fn};return ensureDefaultRewardConfigs;`)(
  async()=>({version:0,rows:[],source:{division:3}}),()=>{throw new Error('No inferred schedule');},async()=>{saved=true;},
 );
 assert.deepEqual(await seed('permanent','regional_league','Division 3',{division:3},20),[]);assert.equal(saved,false);
});
test('a safely completed archived regional edition remains eligible for its established obligations',()=>{
  const scope={source_type:'regional_league',edition_id:'l:1',root:{id:'l',status:'archived',registered_club_ids:['a','b']},participants:[{id:'a',name:'A'},{id:'b',name:'B'}],
    matches:[{id:'m1',tournament_id:'l',type:'league',status:'completed',result_state:'CONFIRMED',home_club_id:'a',away_club_id:'b',home_score:2,away_score:0},{id:'m2',tournament_id:'l',type:'league',status:'completed',result_state:'CONFIRMED',home_club_id:'b',away_club_id:'a',home_score:0,away_score:1}],
    standings:[{club_id:'a',played:2,wins:2,draws:0,losses:0,points:6,goals_for:3,goals_against:0,goal_difference:3},{club_id:'b',played:2,wins:0,draws:0,losses:2,points:0,goals_for:0,goals_against:3,goal_difference:-3}]};
  const result=placements(scope,[{position:1,amount:'10.00'}]);
  assert.equal(result.blocked,undefined);assert.equal(result.map.get(1),'a');
});
test('a trophy explicitly linked to another event is not unlocked by a shared name',async()=>{
  const {buildUnlockedMap}=await import('../trophyCollection.js');
  assert.deepEqual(buildUnlockedMap([{id:'won',name:'Premier Cup',trophy_item_id:'correct'}],[{id:'wrong',tournament_id:'other',competition_name:'Premier Cup'}]),{});
});
