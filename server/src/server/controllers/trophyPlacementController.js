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
router.post('/confirm/:ownerType/:ownerId',wrap(async(req,res)=>{
  const result=await withTransaction(async query=>{
    const {ownerType,ownerId}=req.params;
    const actor=await entitlement.assertCabinetOwner(req.user.id,ownerId,ownerType,query);
    await query(`SELECT id FROM ${ownerType==='club'?'clubs':'players'} WHERE id=? FOR UPDATE`,[ownerId]);
    const report=await entitlement.review(ownerId,ownerType,query);
    const ids=req.body.placement_ids;
    if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length)throw Object.assign(new Error('Select exact draft placement IDs'),{status:400});
    for(const id of ids) {
      const p=report.placements.find(row=>row.id===id);
      if(!p||!p.award_id||!report.awards.some(a=>a.id===p.award_id&&a.persisted))throw deny('Every selected placement requires its exact earned award');
      const [locked]=await query('SELECT id, award_id, locked_at, owner_id, owner_type FROM trophy_placements WHERE id=? FOR UPDATE',[id]);
      if(!locked||String(locked.owner_id)!==String(ownerId)||locked.owner_type!==ownerType||String(locked.award_id)!==String(p.award_id))throw deny('Draft placement is no longer available for this cabinet');
      if(!locked.locked_at) {
        const result=await query('UPDATE trophy_placements SET locked_at=NOW() WHERE owner_id=? AND owner_type=? AND award_id=? AND locked_at IS NULL AND id=?',[ownerId,ownerType,p.award_id,id]);
        if(!result?.affectedRows) {
          const [again]=await query('SELECT locked_at FROM trophy_placements WHERE id=?',[id]);
          if(!again?.locked_at)throw deny('Could not permanently lock this draft placement');
        }
      }
    }
    if([0,2].includes(Number(actor.role_id)))await require('../services/rewardConfigurationService').audit(query,actor,'confirm_permanent_trophies','cabinet',ownerId,report.placements,{placement_ids:ids},'Admin confirmed draft placements');
    return entitlement.review(ownerId,ownerType,query);
  });res.json(result);
}));
router.post('/correct/:id',wrap(async(req,res)=>{
  const result=await withTransaction(async query=>{
    const [admin]=await query('SELECT id,email,role_id FROM users WHERE id=?',[req.user.id]);
    if(!admin||![0,2].includes(Number(admin.role_id))||!String(req.body.reason||'').trim())throw deny('Admin identity and correction reason required');
    const before=await Model.getById(req.params.id,query);if(!before)throw Object.assign(new Error('Not found'),{status:404});
    await query(`SELECT id FROM ${before.owner_type==='club'?'clubs':'players'} WHERE id=? FOR UPDATE`,[before.owner_id]);
    await query('UPDATE trophy_placements SET locked_at=NULL WHERE id=?',[before.id]);
    await require('../services/rewardConfigurationService').audit(query,admin,'unlock_trophy_correction','trophy_placement',before.id,before,{...before,locked_at:null},req.body.reason);
    return Model.getById(before.id,query);
  });res.json(result);
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
    const earned=report.awards.find(a=>a.id===body.award_id&&a.persisted&&a.trophy_item_id);
    if(!earned)throw deny('Select one exact earned award copy; a design ID alone is not entitlement');
    const existing=report.placements.find(p=>p.award_id===earned.id);
    if(existing)return existing;
    const created=await Model.create({owner_id:ownerId,owner_type:ownerType,award_id:earned.id,trophy_item_id:earned.trophy_item_id,trophy_image_url:earned.image_url,trophy_name:earned.display_name||earned.name,win_count:1,won_tournament_ids:[`${earned.source_type}:${earned.source_id}:${earned.edition_id}`],...visual(body)},query);
    if([0,2].includes(Number(actor.role_id)))await require('../services/rewardConfigurationService').audit(query,actor,'place_earned_trophy','trophy_placement',created.id,null,created,'Admin cabinet arrangement');
    return created;
  });
  res.status(201).json(row);
}));
router.patch('/:id',wrap(async(req,res)=>{
  const updated=await withTransaction(async query=>{
  const previous=await Model.getById(req.params.id,query);if(!previous)throw Object.assign(new Error('Not found'),{status:404});
  const actor=await entitlement.assertCabinetOwner(req.user.id,previous.owner_id,previous.owner_type,query);
  await query(`SELECT id FROM ${previous.owner_type==='club'?'clubs':'players'} WHERE id=? FOR UPDATE`,[previous.owner_id]);
  const locked=await Model.getById(req.params.id,query);if(locked.locked_at)throw deny('Permanent placement cannot be moved or resized');
  if(Object.keys(req.body).some(k=>!['x_percent','y_percent','scale','position','slot_index'].includes(k)))throw deny('Cabinet edits cannot change ownership, trophy identity or earned history');
  const report=await entitlement.review(previous.owner_id,previous.owner_type,query);
  if(!report.awards.some(a=>previous.award_id?a.id===previous.award_id:a.trophy_item_id===previous.trophy_item_id))throw deny('No verified entitlement for this placement');
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
  await query(`SELECT id FROM ${previous.owner_type==='club'?'clubs':'players'} WHERE id=? FOR UPDATE`,[previous.owner_id]);
  const locked=await Model.getById(req.params.id,query);if(locked.locked_at)throw deny('Permanent placement cannot be removed');
  await Model.delete(req.params.id,query);
  if([0,2].includes(Number(actor.role_id)))await require('../services/rewardConfigurationService').audit(query,actor,'remove_visual_trophy_placement','trophy_placement',previous.id,previous,null,'Admin removed a visual placement; earned history retained');
  });
  res.json({success:true});
}));
module.exports=router;
