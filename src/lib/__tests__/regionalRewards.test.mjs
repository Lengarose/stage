import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { getDefaultRewardRowsForSource, calculatePrizePool } from '../prizeDefaults.js';
const require=createRequire(import.meta.url);
const {placements}=require('../../../server/src/server/lib/competitionPrizes.js');
test('regional divisions share exact finishing-position prizes and 757 million budget',()=>{
  for(const division of [1,2,3]) {
    const rows=getDefaultRewardRowsForSource('regional_league',{division},20);
    assert.equal(rows.length,20);
    assert.deepEqual(rows.map(r=>Number(r.stc_amount)),Array.from({length:20},(_,i)=>54000000-i*1700000));
    assert.equal(calculatePrizePool('regional_league',{division},20),757000000);
    assert.equal(rows[2].position_label,'3rd Place');
    assert.ok(rows.every(r=>!/semi|quarter/i.test(r.position_label)));
  }
});
test('a safely completed archived regional edition remains eligible for its established obligations',()=>{
  const scope={source_type:'regional_league',edition_id:'l:1',root:{id:'l',status:'archived',registered_club_ids:['a','b']},participants:[{id:'a',name:'A'},{id:'b',name:'B'}],
    matches:[{id:'m1',tournament_id:'l',type:'league',status:'completed',result_state:'CONFIRMED',home_club_id:'a',away_club_id:'b',home_score:2,away_score:0},{id:'m2',tournament_id:'l',type:'league',status:'completed',result_state:'CONFIRMED',home_club_id:'b',away_club_id:'a',home_score:0,away_score:1}],
    standings:[{club_id:'a',played:2,wins:2,draws:0,losses:0,points:6,goals_for:3,goals_against:0,goal_difference:3},{club_id:'b',played:2,wins:0,draws:0,losses:2,points:0,goals_for:0,goals_against:3,goal_difference:-3}]};
  const result=placements(scope,[{position:1,amount:'10.00'}]);
  assert.equal(result.blocked,undefined);assert.equal(result.map.get(1),'a');
});
test('a trophy explicitly linked to another event is not unlocked by a shared name',()=>{
  const source=readFileSync(new URL('../../components/trophy/TrophyCabinetSystem.jsx',import.meta.url),'utf8');
  const start=source.indexOf('function buildUnlockedMap(');
  const build=new Function(`${source.slice(start)}; return buildUnlockedMap;`)();
  assert.deepEqual(build([{id:'won',name:'Premier Cup',trophy_item_id:'correct'}],[{id:'wrong',tournament_id:'other',competition_name:'Premier Cup'}]),{});
});
