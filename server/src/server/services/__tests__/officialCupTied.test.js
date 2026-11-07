'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createService,VERSION}=require('../officialCupTiedService');
const ctx={root:{id:'cup',participation_window_snapshot:{cup_tied_policy_version:VERSION}},match:{id:'current'},engine:{legacy_fixture_type:'regional_cup'}};
const selection={club_id:'new-club',ids:['player']};
test('actual declared Cup participation ties the player to that club; bench-only and same-club evidence do not',async()=>{
 const service=createService();
 const prior={id:'previous',home_club_id:'old-club',away_club_id:'other',home_submission:JSON.stringify({participating_player_ids:['player']})};
 await assert.rejects(service.assertSelection(ctx,selection,async()=>[prior]),e=>e.status===422);
 await service.assertSelection(ctx,selection,async()=>[{...prior,home_submission:JSON.stringify({participating_player_ids:['other-player'],bench_players:['player']})}]);
 await service.assertSelection(ctx,{...selection,club_id:'old-club'},async()=>[prior]);
});
test('the query binds the exact Cup and kickoff evidence, legacy editions do not gain new terms, and failures are not swallowed',async()=>{
 let queried=false;await createService().assertSelection({...ctx,root:{...ctx.root,participation_window_snapshot:{}}},selection,async()=>{queried=true;});assert.equal(queried,false);
 await createService().assertSelection(ctx,selection,async(sql,values)=>{assert.match(sql,/official_match_selection/);assert.deepEqual(values,['cup','cup','current']);return [];});
 await assert.rejects(createService().assertSelection(ctx,selection,async()=>{throw Error('database unavailable');}),/database unavailable/);
 await assert.rejects(createService().assertSelection(ctx,selection,async()=>[{home_submission:'invalid'}]),/evidence/);
});
