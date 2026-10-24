const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {cents,stc}=require('../../lib/competitionPrizes');
const {setup}=require('./prizeFixture.cjs');
for(const player of [false,true]) test(`atomic ${player ? 'player' : 'club'} prizes credit the existing accounts and ledger once under concurrent retries`,async()=>{
  const env=setup(player);
  const dry=await env.service.review('tournament','cup');assert.equal(dry.state,'unpaid');assert.equal(env.state.ledgers.length,0);assert.equal(env.state.metadata.length,0);
  await Promise.all(Array.from({length:4},()=>env.service.review('tournament','cup',{apply:true})));
  assert.deepEqual(env.state.accounts.map(a=>a.stc),['110.01','102.50']);assert.equal(env.state.ledgers.length,2);assert.equal(env.state.payouts.length,2);
  assert(env.state.ledgers.every(l=>l[player ? 'player_id' : 'club_id'] && l.edition_id==='cup'));
});
test('ledger failure rolls back balance and payout, retains retry state, then retries safely',async()=>{
  const env=setup();env.fail=true;await assert.rejects(()=>env.service.review('tournament','cup',{apply:true}),/Injected/);
  assert.equal(env.state.accounts[0].stc,'100.00');assert.equal(env.state.payouts.length,0);assert.equal(env.state.ledgers.length,0);assert.equal(JSON.parse(env.state.metadata[0].data_json).state,'failed');
  env.fail=false;await env.service.review('tournament','cup',{apply:true});assert.equal(env.state.accounts[0].stc,'110.01');
});
test('paid legacy amount is not deducted or credited twice; only the missing amount moves',async()=>{
  const env=setup();env.state.ledgers.push({id:'old',club_id:'a',reference_id:'cup',amount:'4.00'});
  await env.service.review('tournament','cup',{apply:true});assert.equal(env.state.accounts[0].stc,'106.01');assert.equal(env.state.accounts[1].stc,'102.50');
  await env.service.review('tournament','cup',{apply:true});assert.equal(env.state.accounts[0].stc,'106.01');
});
for(const kind of ['regional_league','competition_season']) test(`${kind} final standings settle the correct season prizes into club accounts`,async()=>{
  const env=setup(false,kind);const preview=await env.service.review(kind,'cup');assert.equal(preview.state,'unpaid');assert.equal(preview.obligations[0].recipient_id,'a');
  await env.service.review(kind,'cup',{apply:true});assert.deepEqual(env.state.accounts.map(a=>a.stc),['110.01','102.50']);assert(env.state.payouts.every(p=>p.source_type===kind));
  await env.service.review(kind,'cup',{apply:true});assert.equal(env.state.ledgers.length,2);
});
module.exports={setup};
