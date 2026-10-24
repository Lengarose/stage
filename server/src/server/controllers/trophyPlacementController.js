const express=require('express');
const router=express.Router();
const Model=require('../models/trophyPlacementModel');
const {EXECUTESQL,withTransaction}=require('../db/database');
const entitlement=require('../services/trophyEntitlementService');
const wrap=fn=>async(req,res)=>{try{await fn(req,res);}catch(e){res.status(e.status||500).json({error:e.message});}};
const deny=message=>Object.assign(new Error(message),{status:403});
function visual(data) {
  const result={};
  for(const [key,min,max] of [['x_percent',0,100],['y_percent',0,100],['scale',0.1,3],['position',0,100],['slot_index',0,100]])if(data[key]!=null){const n=Number(data[key]);if(!Number.isFinite(n)||n<min||n>max)throw Object.assign(new Error(`Invalid ${key}`),{status:400});result[key]=n;}
  return result;
}
router.get('/entitlements',wrap(async(req,res)=>res.json(await entitlement.review(req.query.owner_id,req.query.owner_type))));
router.post('/review/:ownerType/:ownerId',wrap(async(req,res)=>{
  const [admin]=await EXECUTESQL('SELECT id,email,role_id FROM users WHERE id=?',[req.user.id]);
  if(!admin||![0,2].includes(Number(admin.role_id)))throw deny('Admin access required');
  res.json(req.body.apply===true?await entitlement.repair(req.params.ownerId,req.params.ownerType,req.body,admin):await entitlement.review(req.params.ownerId,req.params.ownerType));
}));
router.get('/',wrap(async(req,res)=>res.json(await Model.getAll(req.query))));
router.get('/:id',wrap(async(req,res)=>{const row=await Model.getById(req.params.id);res.status(row?200:404).json(row||{error:'Not found'});}));
router.post('/',wrap(async(req,res)=>{
  const body=req.body;
  if(body.win_count!==undefined||body.won_tournament_ids!==undefined)throw deny('Cabinet placement cannot create winning-event references or win counts');
  const ownerId=body.owner_id||body.player_id,ownerType=body.owner_type||(body.player_id?'player':null);
  const row=await withTransaction(async query=>{
    const actor=await entitlement.assertCabinetOwner(req.user.id,ownerId,ownerType,query);
    await query(`SELECT id FROM ${ownerType==='club'?'clubs':'players'} WHERE id=? FOR UPDATE`,[ownerId]);
    const report=await entitlement.review(ownerId,ownerType,query);
    const earned=report.awards.filter(a=>String(a.trophy_item_id)===String(body.trophy_item_id));
    if(!earned.length)throw deny('This owner has not earned the event trophy');
    const existing=report.placements.find(p=>String(p.trophy_item_id)===String(body.trophy_item_id));
    if(existing)return existing;
    const [item]=await query('SELECT * FROM trophy_items WHERE id = ? LIMIT 1',[body.trophy_item_id]);
    const created=await Model.create({owner_id:ownerId,owner_type:ownerType,trophy_item_id:item.id,trophy_image_url:item.image_url,trophy_name:item.name,win_count:earned.length,won_tournament_ids:earned.map(a=>`${a.source_type}:${a.source_id}:${a.edition_id}`),...visual(body)},query);
    if([0,2].includes(Number(actor.role_id)))await require('../services/rewardConfigurationService').audit(query,actor,'place_earned_trophy','trophy_placement',created.id,null,created,'Admin cabinet arrangement');
    return created;
  });
  res.status(201).json(row);
}));
router.patch('/:id',wrap(async(req,res)=>{
  const updated=await withTransaction(async query=>{
  const previous=await Model.getById(req.params.id,query);if(!previous)throw Object.assign(new Error('Not found'),{status:404});
  const actor=await entitlement.assertCabinetOwner(req.user.id,previous.owner_id,previous.owner_type,query);
  if(Object.keys(req.body).some(k=>!['x_percent','y_percent','scale','position','slot_index'].includes(k)))throw deny('Cabinet edits cannot change ownership, trophy identity or earned history');
  const report=await entitlement.review(previous.owner_id,previous.owner_type,query);
  if(!report.awards.some(a=>a.trophy_item_id===previous.trophy_item_id))throw deny('No verified entitlement for this placement');
  const record=await Model.update(req.params.id,visual(req.body),query);
  if([0,2].includes(Number(actor.role_id)))await require('../services/rewardConfigurationService').audit(query,actor,'move_earned_trophy','trophy_placement',previous.id,previous,record,'Admin cabinet arrangement');
  return record;
  });
  res.json(updated);
}));
router.delete('/:id',wrap(async(req,res)=>{
  await withTransaction(async query=>{
  const previous=await Model.getById(req.params.id,query);if(!previous)throw Object.assign(new Error('Not found'),{status:404});
  const actor=await entitlement.assertCabinetOwner(req.user.id,previous.owner_id,previous.owner_type,query);
  await Model.delete(req.params.id,query);
  if([0,2].includes(Number(actor.role_id)))await require('../services/rewardConfigurationService').audit(query,actor,'remove_visual_trophy_placement','trophy_placement',previous.id,previous,null,'Admin removed a visual placement; earned history retained');
  });
  res.json({success:true});
}));
module.exports=router;
