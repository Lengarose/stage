const test=require('node:test');
const assert=require('node:assert/strict');
const {playingState,signingContext,read}=require('../transferMarketService');
const now=new Date('2026-11-14T12:00:00Z');
const player={id:'p',club_id:'old'};
const agreement={id:'a',player_id:'p',kind:'player',club_id:'old',player_contract_id:'mirror',status:'active',ends_at:'2026-11-28T12:00:00Z'};
test('final 14 days includes the exact boundary, prefers agreement timestamp and excludes renewals',()=>{
 assert.equal(playingState(player,[],[agreement],now).expiring,true);
 assert.equal(playingState(player,[],[{...agreement,ends_at:'2026-11-28T12:00:01Z'}],now).expiring,false);
 assert.equal(playingState(player,[],[{...agreement,ends_at:now.toISOString()}],now).expiring,false);
 assert.equal(playingState(player,[{id:'mirror',user_id:'p',status:'active',end_date:'2026-11-28'}],[agreement],now).active.length,1);
 assert.equal(playingState(player,[],[agreement,{...agreement,id:'renewal',status:'scheduled'}],now).expiring,false);
 assert.equal(playingState(player,[{id:'owner',user_id:'p',contract_type:'ownership',status:'active'}],[],now).active.length,0);
});
const query=async sql=>sql.includes('player_contracts')?[]:[{id:'a',data_json:JSON.stringify(agreement)}];
test('a future signing captures the current expiry and cannot target the current club',async()=>{
 assert.deepEqual(await signingContext(player,'new',query,now),{not_before:agreement.ends_at,source_club_id:'old',source_contract_id:'mirror'});
 await assert.rejects(()=>signingContext(player,'old',query,now),/final 14 days/);
 await assert.rejects(()=>signingContext(player,'new',query,new Date('2026-11-01')),/final 14 days/);
});
test('market keeps pending unsigned offers visible, excludes committed renewals and includes current club',async()=>{
 const players=[player,{id:'free',club_id:null},{id:'renewing',club_id:'old'}];
 const rows=[agreement,{...agreement,id:'b',player_id:'renewing'},{...agreement,id:'future',player_id:'renewing',status:'scheduled'}];
 const q=async sql=>sql==='SELECT * FROM players'?players:sql.includes('FROM clubs')?[{id:'old',name:'Old FC'}]:sql.includes('player_contracts')?[]:rows.map(a=>({id:a.id,data_json:JSON.stringify(a)}));
 const market=await read(q,now);
 assert.deepEqual(market.free_agents.map(p=>p.id),['free']);
 assert.deepEqual(market.expiring_players.map(e=>e.player.id),['p']);
 assert.equal(market.expiring_players[0].contract.current_club_name,'Old FC');
});
test('club-linked test-pack and ordinary players never become free agents merely because they lack contracts',async()=>{
 const players=[...Array.from({length:139},(_,i)=>({id:`seed-${i}`,club_id:'test-club',bio:'[STAGE TEST PACK]'})),{id:'ordinary-member',club_id:'real-club'},{id:'free-one',club_id:null},{id:'free-two',club_id:null}];
 const q=async sql=>sql==='SELECT * FROM players'?players:sql.includes('FROM clubs')?[{id:'test-club',name:'Test club'},{id:'real-club',name:'Real club'}]:[];
 const market=await read(q,now);
 assert.equal(players.length,142);
 assert.deepEqual(market.free_agents.map(p=>p.id),['free-one','free-two']);
 assert.deepEqual(market.expiring_players,[]);
});
