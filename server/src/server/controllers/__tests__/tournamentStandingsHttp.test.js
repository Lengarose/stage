const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');
for (const kind of ['player','club']) test(`${kind}: public tournament serves the complete registered roster without unrelated matches`, async () => {
  const ids = Array.from({length:20},(_,i)=>String(i+1));
  const root={id:'cup',participant_type:kind,status:'registration',[kind==='player'?'registered_players':'registered_clubs']:JSON.stringify(ids)};
  const db=path.resolve(__dirname,'../../db/database.js');
  const query=async(sql,v)=>{
    if(sql.includes('FROM tournaments')) return v[0]==='cup' ? [root] : [];
    if(sql.includes(`FROM ${kind==='player'?'players':'clubs'}`)) {assert.deepEqual(v,ids);return ids.slice(0,19).map(id=>({id,[kind==='player'?'gamertag':'name']:`Participant ${id}`}));}
    if(sql.includes('FROM matches')) {assert.match(sql,/WHERE tournament_id = \?/);assert.deepEqual(v,['cup']);return [{id:'preview',tournament_id:'cup',status:'scheduled',type:'league',home_score:0,away_score:0}];}
    throw Error(sql);
  };
  require.cache[db]={id:db,filename:db,loaded:true,exports:{EXECUTESQL:query}};
  const functions=path.resolve(__dirname,'../functionsController.js');require.cache[functions]={id:functions,filename:functions,loaded:true,exports:{HANDLERS:{}}};
  delete require.cache[path.resolve(__dirname,'../publicTournamentController.js')];
  const app=express();app.use('/public',require('../publicTournamentController'));
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const url=`http://127.0.0.1:${server.address().port}/public/tournaments/cup`;
  try {
    let r=await fetch(url);assert.equal(r.status,200);const data=await r.json();assert.equal(data.standing_participants.length,20);assert.equal(data.standing_participants[19].id,'20');
    r=await fetch(`${url}/matches`);assert.equal(r.status,200);assert.equal((await r.json()).length,1);
    r=await fetch(url.replace('cup','missing'));assert.equal(r.status,404);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
