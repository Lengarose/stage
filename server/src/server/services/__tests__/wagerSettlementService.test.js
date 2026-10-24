const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {cents,stc}=require('../../lib/competitionPrizes');
function setup(player=false) {
  const kind=player ? 'player' : 'club';
  let state={match:{id:'match',mode:player ? 'solo':'club',status:'completed',result_state:'CONFIRMED',wager_status:'active',wager_stc:'10.01',wager_home_locked:1,wager_away_locked:1,home_score:2,away_score:1,[`home_${kind}_id`]:'a',[`away_${kind}_id`]:'b'},accounts:[{id:'a',stc:'100.00'},{id:'b',stc:'100.00'}],ledger:[]};
  let fail=false;
  async function query(sql,v=[]) {
    if (/FROM matches/.test(sql)) return [{...state.match}];
    if (/FROM (clubs|players)/.test(sql)) return state.accounts.filter(a=>a.id===v[0]).map(a=>({...a}));
    if (/FROM (stc_transactions|player_stc_transactions)/.test(sql)) return state.ledger.filter(l=>l[`${kind}_id`]===v[0] && l.reference_id===v[1] && (sql.includes("'wager_stake'") ? l.category==='wager_stake' : ['wager_win','wager_loss','wager_refund'].includes(l.category)));
    if (/^UPDATE (clubs|players)/.test(sql)) {const a=state.accounts.find(a=>a.id===v[1]);const n=cents(a.stc)+(sql.includes('0)-?') ? -cents(v[0]):cents(v[0]));a.stc=stc(n);return {affectedRows:1};}
    if (/^INSERT INTO/.test(sql)) {
      if (fail) throw new Error('Injected wager ledger failure');
      const cols=sql.match(/\(([^)]+)\)/)[1].split(',');const row={};cols.forEach((c,i)=>{row[c]=v[i];});
      assert(!state.ledger.some(l=>l.settlement_key===row.settlement_key));state.ledger.push(row);return {affectedRows:1};
    }
    if (/^UPDATE matches/.test(sql)) {state.match.wager_status=v[0];if(sql.includes('wager_home_locked=1')) {state.match.wager_home_locked=1;state.match.wager_away_locked=1;}return {affectedRows:1};}
    throw new Error(`Unexpected wager SQL: ${sql}`);
  }
  let queue=Promise.resolve();const withTransaction=fn=>{const result=queue.then(async()=>{const snapshot=structuredClone(state);try{return await fn(query);}catch(e){state=snapshot;throw e;}});queue=result.catch(()=>{});return result;};
  const db=path.resolve(__dirname,'../../db/database.js');require.cache[db]={id:db,filename:db,loaded:true,exports:{withTransaction}};
  delete require.cache[path.resolve(__dirname,'../wagerSettlementService.js')];
  return {service:require('../wagerSettlementService'),get state(){return state;},set fail(v){fail=v;}};
}
for(const player of [false,true]) test(`${player ? 'player':'club'} wager credits the funded pot once, with consistent ledger and status`,async()=>{
  const env=setup(player);await Promise.all([env.service.settle('match'),env.service.settle('match')]);assert.equal(env.state.accounts[0].stc,'120.02');assert.equal(env.state.accounts[1].stc,'100.00');assert.equal(env.state.ledger.length,2);assert.equal(env.state.match.wager_status,'settled');
});
test('wager draw refunds each reserved stake and failed credit cannot mark it refunded',async()=>{
  const env=setup(true);env.state.match.home_score=1;env.fail=true;await assert.rejects(()=>env.service.settle('match'),/Injected/);assert.equal(env.state.match.wager_status,'active');assert.equal(env.state.accounts[0].stc,'100.00');
  env.fail=false;await env.service.settle('match');assert(env.state.accounts.every(a=>a.stc==='110.01'));assert.equal(env.state.match.wager_status,'refunded');
});
test('wager reservation rolls back the first debit when the second account has insufficient STC',async()=>{
  const env=setup();Object.assign(env.state.match,{status:'scheduled',wager_status:'pending_acceptance',wager_home_locked:0,wager_away_locked:0});env.state.accounts[1].stc='0.00';await assert.rejects(()=>env.service.settle('match','reserve'),/Insufficient/);assert.equal(env.state.accounts[0].stc,'100.00');assert.equal(env.state.ledger.length,0);assert.equal(env.state.match.wager_status,'pending_acceptance');
});
test('wager cancellation refunds atomically and disputed results do not pay',async()=>{
  const env=setup();env.state.match.result_state='DISPUTED';assert.equal((await env.service.settle('match')).skipped,true);assert.equal(env.state.ledger.length,0);env.state.match.status='scheduled';await env.service.settle('match','cancel');assert.equal(env.state.match.wager_status,'cancelled');assert(env.state.accounts.every(a=>a.stc==='110.01'));
});
