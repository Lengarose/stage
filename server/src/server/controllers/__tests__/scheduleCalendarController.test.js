const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Exercise the actual Express endpoint over HTTP with controlled identity/DB seams.
test('authenticated calendar endpoint: confirmed events, validation, no unauthenticated access',async()=>{
  const dbPath=require.resolve('../../db/database');
  require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{EXECUTESQL:async()=>[],pool:{}}};
  const express=require('express');
  const {createRouter}=require('../scheduleCalendarController');
  const match={id:'match-test',home_player_id:'player-test',away_player_id:'other',home_player_name:'Test home',away_player_name:'Test away',scheduling_status:'confirmed',scheduled_date:'2026-10-27 19:00:00',timezone:'Europe/Brussels',status:'scheduled'};
  const queries=[];
  const query=async(sql,args)=>{queries.push({sql,args});if(sql.startsWith('SELECT timezone'))return [{timezone:'Europe/Brussels'}];if(sql.startsWith('SELECT m.* FROM matches'))return [match];return [];};
  const app=express();
  app.use((req,res,next)=>{if(req.headers.authorization==='Bearer local-fixture')req.user={id:'test-user'};next();});
  app.use('/api/stage/schedule',createRouter({query,resolveIdentity:async()=>({player:{id:'player-test'}})}));
  const server=await new Promise((resolve,reject)=>{const server=app.listen(0,'127.0.0.1',()=>resolve(server));server.on('error',reject);});
  try {
    const url=`http://127.0.0.1:${server.address().port}/api/stage/schedule/calendar`;
    assert.equal((await fetch(`${url}?from=2026-10-01&to=2026-11-01`)).status,401);
    const headers={Authorization:'Bearer local-fixture'};
    assert.equal((await fetch(`${url}?from=bad&to=bad`,{headers})).status,400);
    const res=await fetch(`${url}?from=2026-10-01&to=2026-11-01&scope=general`,{headers});
    assert.equal(res.status,200);
    const body=await res.json();assert.equal(body.events.length,1);assert.equal(body.events[0].id,'match:match-test');
    assert.equal(body.events[0].href,'/game-day?match=match-test');
    assert.ok(!JSON.stringify(body).includes('email'));
    assert.ok(queries.every(q=>q.sql.startsWith('SELECT')));
    const hidden=await fetch(`${url}?from=2026-10-01&to=2026-11-01&scope=regional`,{headers});
    assert.equal((await hidden.json()).events.length,0);
  } finally {await new Promise(resolve=>server.close(resolve));delete require.cache[path.resolve(__dirname,'../../db/database.js')];}
});
