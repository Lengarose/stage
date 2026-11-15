const express = require('express');
const { v4: uuid } = require('uuid');
const { EXECUTESQL, withTransaction } = require('../db/database');
const NewsItem = require('../models/newsItemModel');
const times = require('../services/stageTimesService');
const router = express.Router();
const parse = v => { try {return typeof v==='string'?JSON.parse(v):v||{};} catch{return {};} };
async function admin(req,res,next) {
  try {const [u]=await EXECUTESQL('SELECT id,email,role_id FROM users WHERE id=?',[req.user?.id]);if(!u||u.role_id==null||![0,2].includes(Number(u.role_id)))return res.status(403).json({error:'Newsroom Admin access required.'});req.newsAdmin=u;next();}catch(e){next(e);}
}
const action = fn => async(req,res)=>{try{res.json(await fn(req));}catch(e){res.status(e.status||500).json({error:e.status?e.message:'Could not load STAGE Times. Please retry.'});console.error('[STAGE Times]',e.message);}};
router.get('/feed',action(req=>times.feed(req.user,req.query)));
router.get('/editorial',admin,action(req=>new NewsItem().selectAll(Math.max(1,Number(req.query.page)||1))));
router.get('/sources',admin,action(async()=>{
  const [tournaments,clubs,players,entities,matches]=await Promise.all([
    EXECUTESQL('SELECT id,name FROM tournaments ORDER BY name'),
    EXECUTESQL("SELECT id,name FROM clubs WHERE COALESCE(tier,'')<>'TEST' AND owner_email NOT LIKE '%@stage-test.local' ORDER BY name"),
    EXECUTESQL("SELECT id,gamertag AS name FROM players WHERE email NOT LIKE '%@stage-test.local' ORDER BY gamertag"),
    EXECUTESQL("SELECT id,entity_type,data_json FROM league_entities WHERE entity_type IN ('regional_league','regional_cup_edition','competition','competition_season')"),
    EXECUTESQL("SELECT id,home_club_name,away_club_name,home_player_name,away_player_name FROM matches WHERE status IN ('scheduled','confirmed','in_progress','completed') ORDER BY created_date DESC LIMIT 200")
  ]);
  const definitions=entities.filter(e=>e.entity_type==='competition').map(e=>({...parse(e.data_json),id:e.id}));
  return [...tournaments.map(r=>({...r,kind:'tournament',link:`/tournaments/${r.id}`})),...clubs.map(r=>({...r,kind:'club',link:`/clubs/${r.id}`})),...players.map(r=>({...r,kind:'player',link:`/players/${r.id}`})),...entities.filter(e=>e.entity_type!=='competition').map(e=>{const r={...parse(e.data_json),id:e.id};return {id:e.id,name:`${r.name||r.league_name||'Competition'} · Season ${r.season_number||r.season||''}`,kind:e.entity_type,link:times.competitionLink(r,e.entity_type,definitions)};}),...matches.map(m=>({id:m.id,name:`${m.home_club_name||m.home_player_name} vs ${m.away_club_name||m.away_player_name}`,kind:'match',link:`/the-stands?match=${m.id}`}))];
}));
// Legacy consumers keep the array response, but receive the same scoped stories.
router.get('/',action(async req=>(await times.feed(req.user,{...req.query,offset:((Number(req.query.page)||1)-1)*25,limit:25})).stories.map(s=>({...s,type:s.type||s.kind,category:s.category||s.kind,is_featured:s.featured}))));
router.get('/:id',action(async req=>{
  const [u]=await EXECUTESQL('SELECT role_id FROM users WHERE id=?',[req.user?.id]);
  if(u?.role_id!=null&&[0,2].includes(Number(u.role_id))){const [r]=await new NewsItem().selectOne(req.params.id);if(r)return r;}
  const story=await times.feed(req.user,{article:req.params.id,limit:1});
  const found=story.stories[0];
  if(!found)throw Object.assign(Error('Story not found.'),{status:404});return found;
}));
async function mutate(req,operation){
  return withTransaction(async q=>{
    const model=new NewsItem({},q),[before]=req.params.id?await model.selectOne(req.params.id):[];
    if(operation!=='create'&&!before)throw Object.assign(Error('Story not found.'),{status:404});
    let after=null;
    if(operation==='delete')await model.delete(req.params.id);
    else{
      const body={...before,...req.body};
      if(!String(body.title||'').trim())throw Object.assign(Error('Enter a headline.'),{status:400});
      if(body.link&&!times.safeLink(body.link))throw Object.assign(Error('Choose an internal STAGE destination.'),{status:400});
      if(!['draft','published'].includes(body.publication_status||'published'))throw Object.assign(Error('Choose Draft or Published.'),{status:400});
      if(body.type==='achievement'||body.category==='achievement')throw Object.assign(Error('Player milestones are not enabled.'),{status:400});
      body.editorial={...parse(body.editorial),curated:true};
      const reference=body.editorial;
      if(reference.source_id){
        const tables={club:'clubs',player:'players',tournament:'tournaments',match:'matches'};
        let target;
        if(tables[reference.source_kind]) [target]=await q(`SELECT id FROM ${tables[reference.source_kind]} WHERE id=?`,[reference.source_id]);
        else if(['regional_league','regional_cup_edition','competition_season'].includes(reference.source_kind)) [target]=await q('SELECT id FROM league_entities WHERE id=? AND entity_type=?',[reference.source_id,reference.source_kind]);
        if(!target)throw Object.assign(Error('The linked record no longer exists. Choose another destination.'),{status:400});
      }

      body.published_at=body.published_at||new Date().toISOString();
      const next=new NewsItem(body,q);
      if(operation==='create')await next.create();else await next.update(req.params.id);
      [after]=await next.selectOne(operation==='create'?next.id:req.params.id);
    }
    await q('INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (?,?,?,?,?,?,?,?,?)',[uuid(),req.newsAdmin.id,req.newsAdmin.email,`news_${operation}`,'news_item',after?.id||before.id,JSON.stringify(before||null),JSON.stringify(after),'Admin newsroom publication']);
    return after||{success:true};
  });
}
router.post('/',admin,action(req=>mutate(req,'create')));
router.patch('/:id',admin,action(req=>mutate(req,'update')));
router.delete('/:id',admin,action(req=>mutate(req,'delete')));
module.exports=router;
