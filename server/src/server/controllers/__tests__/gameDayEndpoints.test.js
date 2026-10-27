const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');

test('GameDay read and screenshot business endpoints over local HTTP',async()=>{
  const dbPath=require.resolve('../../db/database');
  require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{EXECUTESQL:async()=>[],withTransaction:async fn=>fn(async()=>[]),pool:{}}};
  const express=require('express');
  const {createRouter:views}=require('../gameDayViewController');
  const {createRouter:highlights}=require('../matchHighlightController');
  const match={id:'m',home_player_id:'p',away_player_id:'q',home_player_name:'Home',away_player_name:'Away',status:'completed',result_state:'CONFIRMED',home_score:1,away_score:0,scheduled_date:'2026-10-27 20:00:00',timezone:'Europe/Brussels',proof_url:'/private-proof'};
  const previous={...match,id:'prior',scheduled_date:'2026-10-20 20:00:00'};
  const rows=[],audit=[];
  const query=async(sql,args=[])=>{
    if(sql.startsWith('SELECT * FROM matches'))return args[0]==='missing'?[]:[match];
    if(sql.includes('FROM matches m'))return sql.includes('WHERE m.id=')?[match]:sql.includes("m.status IN")?[previous]:[match];
    if(sql.startsWith('SELECT COUNT'))return [{total:rows.filter(r=>r.status==='published').length}];
    if(sql.startsWith('SELECT * FROM match_highlights WHERE id'))return rows.filter(r=>r.id===args[0]);
    if(sql.includes('image_sha256=?'))return rows.filter(r=>r.match_id===args[0]&&r.image_sha256===args[1]);
    if(sql.startsWith('SELECT * FROM match_highlights'))return rows.filter(r=>r.status==='published').slice(args[2],args[2]+args[1]);
    if(sql.startsWith('INSERT INTO match_highlights')){rows.push(Object.fromEntries(['id','match_id','uploader_user_id','image_url','image_sha256','caption','status'].map((k,i)=>[k,args[i]])));return {affectedRows:1};}
    if(sql.startsWith('UPDATE match_highlights')){rows.find(r=>r.id===args[1]).status=args[0];return {affectedRows:1};}
    if(sql.startsWith('INSERT INTO admin_audit_log')){audit.push(args);return {};}
    return [];
  };
  const resolveIdentity=async id=>({user:{id,role_id:id==='admin'?0:1,email:'local@example.test'},player:{id:id==='stranger'?'unrelated':id==='other'?'q':'p'}});
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'stage-highlight-test-'));
  const app=express();app.use(express.json());app.use((req,res,next)=>{const id=req.headers.authorization?.replace('Bearer ','');if(id)req.user={id};next();});
  app.use('/game-day',views({query,resolveIdentity}));
  app.use('/match-highlights',highlights({query,resolveIdentity,transaction:fn=>fn(query),storageDir:()=>dir}));
  const server=await new Promise((resolve,reject)=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));s.on('error',reject);});
  const base=`http://127.0.0.1:${server.address().port}`;
  const get=(url,id='home',options={})=>fetch(base+url,{...options,headers:{Authorization:`Bearer ${id}`,...options.headers}});
  const upload=async(bytes,type='image/png',id='home')=>{const body=new FormData();body.set('file',new Blob([bytes],{type}),'screenshot.png');return get('/match-highlights/publish/m',id,{method:'POST',body});};
  try {
    assert.equal((await fetch(base+'/game-day/matches')).status,401);
    assert.equal((await get('/game-day/matches?limit=101')).status,400);
    const list=await (await get('/game-day/matches')).json();assert.equal(list[0].id,'m');assert.equal(list[0].proof_url,undefined);
    assert.equal((await get('/game-day/m/history','stranger')).status,403);
    assert.equal((await get('/game-day/missing/history')).status,404);
    assert.equal((await get('/game-day/m/history?scope=bad')).status,400);
    const history=await (await get('/game-day/m/history?scope=all')).json();assert.equal(history.total,1);assert.equal(history.homeWins,1);assert.ok(!JSON.stringify(history).includes('private-proof'));
    assert.equal((await get('/game-day/m/penalties?home_score=bad&away_score=1')).status,400);
    assert.equal((await (await get('/game-day/m/penalties?home_score=1&away_score=1')).json()).applicable,false);
    assert.equal((await get('/match-highlights')).status,400);
    assert.deepEqual(await (await get('/match-highlights?match_id=m')).json(),[]);
    assert.equal((await get('/match-highlights?match_id=m','stranger')).status,403);
    assert.equal((await get('/match-highlights',{},{method:'POST'})).status,405);
    assert.equal((await upload(Buffer.from('<svg/>'),'image/svg+xml')).status,400);
    assert.equal((await upload(Buffer.from('video pretending to be PNG'))).status,400);
    assert.equal((await upload(Buffer.alloc(10*1024*1024+1))).status,413);
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1kAAAAASUVORK5CYII=','base64');
    assert.equal((await upload(png,'image/png','stranger')).status,403);
    const published=await upload(png);assert.equal(published.status,201);const image=await published.json();
    assert.equal((await upload(png)).status,200);assert.equal(rows.length,1);
    const gallery=await (await get('/match-highlights?match_id=m&view=gallery')).json();assert.equal(gallery.total,1);assert.equal(gallery.items[0].can_remove,true);
    assert.equal((await get(`/match-highlights/${image.id}`)).status,200);
    assert.equal((await get(`/match-highlights/${image.id}`,'home',{method:'PATCH',headers:{'Content-Type':'application/json'},body:'{}'})).status,405);
    assert.equal((await get(`/match-highlights/${image.id}`,'other',{method:'DELETE'})).status,403);
    assert.equal((await get(`/match-highlights/${image.id}`,'admin',{method:'DELETE'})).status,200);assert.equal(audit.length,1);
    assert.equal((await get(`/match-highlights/${image.id}`)).status,404);
    assert.equal((await upload(png)).status,409);
    assert.deepEqual(await fs.readdir(dir),[]);
  } finally {await new Promise(resolve=>server.close(resolve));await fs.rm(dir,{recursive:true,force:true});delete require.cache[dbPath];}
});
