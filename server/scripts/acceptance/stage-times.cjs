'use strict';
const {configure,bootstrap}=require('./bootstrap.cjs');
const assert=require('node:assert/strict'),{randomUUID:id}=require('node:crypto');
const config=configure();let db,server;
const preview=process.argv.includes('--preview');
(async()=>{
  db=await bootstrap(config);const q=db.EXECUTESQL;
  const express=require('express'),jwt=require('jsonwebtoken'),app=express();app.use(express.json());require('../../src/server/routes/registerStageRoutes').registerStageRoutes(app,require('../../src/server/authMiddleware'));
  const password=id()+id(),admin={uid:id(),pid:id(),cid:id(),email:`${id()}@news.acceptance.test`},reader={uid:id(),pid:id(),cid:id(),email:`${id()}@news.acceptance.test`},other={uid:id(),pid:id(),cid:id(),email:`${id()}@news.acceptance.test`};
  for(const [i,u] of [admin,reader,other].entries()){
    await q('INSERT INTO users (id,email,password_hash,role_id,player_id,timezone) VALUES (?,?,?,?,?,?)',[u.uid,u.email,await require('bcryptjs').hash(password,10),i===0?2:1,u.pid,'Europe/Brussels']);
    await q('INSERT INTO clubs (id,name,president_user_id,user_id,owner_email,logo_url) VALUES (?,?,?,?,?,?)',[u.cid,['STAGE Editorial','Northside United','Eastbrook FC'][i],u.uid,u.uid,u.email,`/src/assets/landing/${i===1?'player':'triumph'}.webp`]);
    await q('INSERT INTO players (id,user_id,email,gamertag,club_id,avatar_url) VALUES (?,?,?,?,?,?)',[u.pid,u.uid,u.email,['Editor','Arena Manager','Visitor'][i],u.cid,'/src/assets/landing/player.webp']);
  }
  server=app.listen(preview?18110:0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  async function call(user,path,body,method='GET',expected=200){const r=await fetch(`http://127.0.0.1:${server.address().port}/api/stage/${path}`,{method,headers:{authorization:'Bearer '+jwt.sign({id:user.uid},process.env.ACCESS_TOKEN_SECRET,{expiresIn:'2h'}),'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const value=await r.json();assert.equal(r.status,expected,JSON.stringify(value));return value;}
  const news=(title,extra={})=>call(admin,'news-items',{title,body:'The next chapter of the season is here. Follow your club and explore the competition for the full story.',type:'app_update',category:'app_update',publication_status:'published',published_at:new Date(Date.now()-3600000).toISOString(),...extra},'POST');
  await call(reader,'news-items',{title:'Unauthorized'},'POST',403);
  const launch=await news('A new season. A new stage.',{is_featured:true,editorial:{placement:'lead',section:'updates'},link:'/leagues'});
  await news('Your club is ready for the next chapter',{club_id:reader.cid,editorial:{section:'club'},link:`/clubs/${reader.cid}`});
  const privateStory=await news('Private other-club briefing',{club_id:reader.cid,visible_to_player_ids:[other.pid]});
  await news('Unpublished draft',{publication_status:'draft'});
  await news('Expired announcement',{expires_at:'2020-01-01 00:00:00'});
  await news('Future announcement',{published_at:'2099-01-01 00:00:00'});
  await news('Player milestone excluded',{type:'app_update',category:'ranking',editorial:{kind:'ranking'}});
  await news('Community cup opens',{type:'tournament',editorial:{section:'community'},link:'/tournaments'});
  await q("INSERT INTO news_items (id,type,category,title,body,published_at) VALUES (?,'app_update','general','Legacy platform update','An existing Admin announcement',NOW())",[id()]);
  const hidden=id();await q("INSERT INTO news_items (id,type,category,title,body,published_at,is_global) VALUES (?,'tournament','tournament','Uncurated public tournament','Not globally syndicated',NOW(),1)",[hidden]);
  const tid=id();await q('INSERT INTO tournaments (id,name,registered_clubs) VALUES (?,?,?)',[tid,'The Night Cup',JSON.stringify([reader.cid,other.cid])]);
  await q("INSERT INTO news_items (id,type,category,title,body,tournament_id,published_at,is_global) VALUES (?,'tournament','tournament','The Night Cup draw is ready','Explore the draw',?,NOW(),1)",[id(),tid]);
  const mid=id();await q("INSERT INTO matches (id,home_club_id,away_club_id,home_club_name,away_club_name,tournament_id,scheduled_date,status,scheduling_status) VALUES (?,?,?,?,?,?,DATE_ADD(NOW(),INTERVAL 2 DAY),'scheduled','confirmed')",[mid,reader.cid,other.cid,'Northside United','Eastbrook FC',tid]);
  const pending=id();await q("INSERT INTO matches (id,home_club_id,away_club_id,home_score,away_score,status,result_state) VALUES (?,?,?,8,0,'completed','awaiting_confirmation')",[pending,reader.cid,other.cid]);
  const final=id();await q("INSERT INTO matches (id,home_club_id,away_club_id,home_club_name,away_club_name,home_score,away_score,status,result_state,scheduled_date) VALUES (?,?,?,?,?,2,1,'completed','confirmed',NOW())",[final,reader.cid,other.cid,'Northside United','Eastbrook FC']);
  const edition=id(),cup=id(),competition=id(),season=id();
  for(const [key,type,value] of [[edition,'regional_league',{name:'Premier Division',status:'in_progress',registered_club_ids:[reader.cid],slug:'uk-ireland-div-1',season_number:1}],[cup,'regional_cup_edition',{name:'STAGE UK & Ireland Cup',status:'in_progress',participant_ids:[reader.cid],season_number:1}],[competition,'competition',{name:'Supreme League',slug:'supreme-league'}],[season,'competition_season',{name:'Supreme League',status:'in_progress',competition_id:competition,registered_club_ids:[reader.cid],season_number:1}],[id(),'club_agreement',{kind:'player',purpose:'initial',status:'active',club_id:reader.cid,player_id:other.pid,accepted_at:new Date().toISOString(),starts_at:new Date().toISOString(),weekly_salary_stc:999999}]])await q('INSERT INTO league_entities (id,entity_type,club_id,status,data_json) VALUES (?,?,?,?,?)',[key,type,value.club_id||null,value.status||'active',JSON.stringify(value)]);
  await news('GOST remains closed',{type:'announcement',editorial:{kind:'gost',section:'updates'},link:`/competitions/supreme-league?season=${season}`});
  const testClub=id();await q("INSERT INTO clubs (id,name,president_user_id,owner_email,tier,description) VALUES (?,'Fixture Club',?,?,'TEST','[STAGE TEST PACK]')",[testClub,other.uid,'fixture@stage-test.local']);
  await news('Test-pack story excluded',{club_id:testClub});
  await q('UPDATE matches SET competition_context=? WHERE id=?',[edition,final]);
  const data=await call(reader,'news-items/feed');
  assert(data.stories.some(s=>s.id===launch.id));assert(data.stories.some(s=>s.title==='Legacy platform update'));assert(!data.stories.some(s=>s.id===privateStory.id));
  for(const title of ['Unpublished draft','Expired announcement','Future announcement','Player milestone excluded','Uncurated public tournament','Test-pack story excluded'])assert(!data.stories.some(s=>s.title===title),title);
  const all=(await call(reader,'news-items/feed?limit=30')).stories;
  assert(all.some(s=>s.id===`match:${mid}`&&s.match.homeAvatarUrl&&s.link===`/game-day?match=${mid}`));
  assert(all.some(s=>s.id===`match:${final}`&&s.related_links.some(l=>l.link.endsWith(`?season=${edition}`))));assert(!all.some(s=>s.id===`match:${pending}`));
  assert(all.some(s=>s.link===`/regional-cups?edition=${cup}`));assert(!all.some(s=>s.id===`edition:${season}`),'Closed GOST does not announce competition play');assert(all.some(s=>s.link.endsWith(`?season=${edition}`)));
  assert(all.some(s=>s.kind==='signing'));assert(!JSON.stringify(all).includes('999999'));
  const featuredMatch=await news('Friday night spotlight',{type:'announcement',editorial:{kind:'match_preview',section:'competitions',match_id:mid,source_id:mid,source_kind:'match'},link:`/the-stands?match=${mid}`});
  const spotlight=(await call(other,`news-items/feed?article=${featuredMatch.id}&limit=1`)).stories[0];assert(spotlight.match.homeAvatarUrl);assert.equal(spotlight.link,`/the-stands?match=${mid}`);
  await call(admin,'news-items',{title:'Invalid source',editorial:{source_kind:'match',source_id:id()}},'POST',400);
  await call(reader,`news-items/${privateStory.id}`,null,'GET',404);
  const before=await call(reader,'news-items/feed?section=updates&limit=2');assert.equal(before.stories.length,2);
  // Many irrelevant new rows must not push an older relevant story off page 1.
  for(let n=0;n<105;n++)await q("INSERT INTO news_items (id,title,type,category,visible_to_player_ids,published_at) VALUES (?,?,'announcement','announcement',?,NOW())",[id(),`Other audience ${n}`,JSON.stringify([other.pid])]);
  assert.equal((await call(reader,'news-items/feed?section=updates&limit=2')).total,before.total);
  const settings=await call(admin,'news-page-configs',{key:'main',artwork:{app_update:{url:'',position:'50% 50%',zoom:100}},hero_slides:Array.from({length:6},()=>({url:'',position:'50% 50%',zoom:100})),hero_interval_seconds:7},'POST',201);assert(settings.id);
  assert.equal(settings.hero_slides.length,6);assert(settings.hero_slides.every(s=>s.url===''));
  const adjusted=await call(admin,`news-page-configs/${settings.id}`,{hero_interval_seconds:9,hero_slides:[{url:'/uploads/fixture-only.png',position:'30% 20%',zoom:120}]},'PATCH');assert.equal(adjusted.hero_slides[0].position,'30% 20%');
  await call(admin,`news-page-configs/${settings.id}`,{hero_slides:settings.hero_slides,hero_interval_seconds:7},'PATCH');
  await call(reader,'news-page-configs',{key:'main'},'POST',403);
  assert.equal((await call(reader,'news-page-configs?key=main'))[0].artwork.app_update.url,'');
  await call(admin,`news-items/${launch.id}`,{body:'Updated article body'},'PATCH');assert.equal((await call(admin,`news-items/${launch.id}`)).body,'Updated article body');
  const sources=await call(admin,'news-items/sources');assert(sources.some(s=>s.id===cup));assert(sources.some(s=>s.id===mid));
  await call(admin,`news-items/${launch.id}`,{body:'A new season begins. Explore regional competitions, follow every confirmed result and prepare for the next matchday.'},'PATCH');
  assert((await q("SELECT id FROM admin_audit_log WHERE action='news_create'")).length>=8);
  console.log('PASS: authenticated feed, role restrictions, drafts/expiry, targeted audience before pagination (105 unrelated rows), personal tournament coverage, confirmed match results, diagonal-art data, GameDay/Stands links, Regional/GOST/Cup edition links, public signing projection, empty Admin artwork persistence and audit logging.');
  if(preview){require('node:fs').writeFileSync('/private/tmp/stage-news-preview.json',JSON.stringify({database:config.database,password,admin,reader}),{mode:0o600});console.log('Disposable STAGE Times preview on port 18110');await new Promise(resolve=>process.once('SIGTERM',resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(server)await new Promise(r=>server.close(r));if(db)await db.pool.promise().end();});
