const express=require('express'),multer=require('multer'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {EXECUTESQL,withTransaction}=require('../db/database');
const {resolveUserIdentity}=require('../services/identityService');
const {matchAccess,fail}=require('../services/gameDayViewService');
const {imageExtension}=require('../services/highlightImagePolicy');
const {ensureUploadsDir}=require('../../constants/paths');
const Model=require('../models/matchHighlightModel');
function createRouter({query=EXECUTESQL,transaction=withTransaction,resolveIdentity=resolveUserIdentity,storageDir=ensureUploadsDir}={}) {
  const router=express.Router(),model=new Model();
  const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024,files:1}}).single('file');
  const wrap=fn=>async(req,res)=>{try{if(!req.user?.id)throw fail('Authentication required.',401);await fn(req,res);}catch(e){res.status(e.status||500).json({error:e.message});}};
  const access=(req,id)=>matchAccess(req.user.id,id,query,resolveIdentity);
  const publicRow=(row,user)=>({id:row.id,match_id:row.match_id,image_url:row.image_url,caption:row.caption,created_date:row.created_date,can_remove:row.uploader_user_id===user.id||[0,2].includes(Number(user.role_id))});
  const audit=async(q,user,action,row)=>{if([0,2].includes(Number(user.role_id)))await q("INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (UUID(),?,?,?,'match_highlight',?,?,?,?)",[user.id,user.email,action,row.id,action==='remove_match_highlight'?JSON.stringify(row):null,action==='publish_match_highlight'?JSON.stringify(row):null,'Explicit match screenshot action']);};
  router.get('/',wrap(async(req,res)=>{
    if(!req.query.match_id)throw fail('match_id is required.',400);
    const {identity}=await access(req,req.query.match_id);
    const limit=Number(req.query.limit||50),offset=Number(req.query.offset||0);
    if(!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(offset)||offset<0)throw fail('Invalid pagination.',400);
    const rows=await model.selectAll({match_id:req.query.match_id,limit,offset},query);
    const [count]=await query("SELECT COUNT(*) AS total FROM match_highlights WHERE match_id=? AND status='published'",[req.query.match_id]);
    const items=rows.map(r=>publicRow(r,identity.user));
    res.json(req.query.view==='gallery'?{items,total:Number(count?.total||0),can_upload:true}:items);
  }));
  router.get('/:id',wrap(async(req,res)=>{const [row]=await model.selectOne(req.params.id,query);if(!row||row.status!=='published')throw fail('Screenshot not found.',404);const {identity}=await access(req,row.match_id);res.json(publicRow(row,identity.user));}));
  // A fresh binary upload is the explicit publication action. URLs/private proof cannot be submitted.
  router.post('/publish/:matchId',wrap(async(req,res)=>{
    const {identity,match}=await access(req,req.params.matchId);
    if(['deleted','voided','cancelled'].includes(match.status))throw fail('This match cannot receive screenshots.',409);
    await new Promise((resolve,reject)=>upload(req,res,e=>e?reject(Object.assign(e,{status:e.code==='LIMIT_FILE_SIZE'?413:400})):resolve()));
    const extension=req.file&&imageExtension(req.file.buffer);
    if(!extension||!String(req.file.mimetype).startsWith('image/'))throw fail('Upload a JPG, PNG or WebP screenshot (maximum 10 MB).',400);
    const hash=crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    const [existing]=await query('SELECT * FROM match_highlights WHERE match_id=? AND image_sha256=?',[match.id,hash]);
    if(existing){if(existing.status!=='published')throw fail('This image has been removed and cannot be republished.',409);return res.json(publicRow(existing,identity.user));}
    const filename=`highlight-${crypto.randomUUID()}${extension}`,filePath=path.join(storageDir(),filename);
    const row={id:crypto.randomUUID(),match_id:match.id,uploader_user_id:req.user.id,image_url:`/uploads/${filename}`,image_sha256:hash,caption:String(req.body.caption||'').slice(0,160)};
    await fs.writeFile(filePath,req.file.buffer,{flag:'wx'});
    try {await transaction(async q=>{await model.create(row,q);await audit(q,identity.user,'publish_match_highlight',row);});}
    catch(e){await fs.unlink(filePath).catch(()=>{});if(e.code==='ER_DUP_ENTRY'){const [saved]=await query('SELECT * FROM match_highlights WHERE match_id=? AND image_sha256=?',[match.id,hash]);if(saved?.status==='published')return res.json(publicRow(saved,identity.user));}throw e;}
    res.status(201).json(publicRow(row,identity.user));
  }));
  router.patch('/:id',wrap(async()=>{throw fail('Screenshots cannot be edited through generic CRUD.',405);}));
  router.post('/',wrap(async()=>{throw fail('Use the explicit screenshot publication action.',405);}));
  router.delete('/:id',wrap(async(req,res)=>{
    const [row]=await model.selectOne(req.params.id,query);if(!row)throw fail('Screenshot not found.',404);
    const {identity}=await access(req,row.match_id);
    if(!publicRow(row,identity.user).can_remove)throw fail('Only the uploader or an authorised moderator can remove this screenshot.',403);
    if(row.status!=='removed')await transaction(async q=>{const [locked]=await q('SELECT * FROM match_highlights WHERE id=? FOR UPDATE',[row.id]);if(locked&&locked.status!=='removed'){await model.delete(row.id,q);await audit(q,identity.user,'remove_match_highlight',locked);}});
    const filename=path.basename(row.image_url||'');
    if(/^highlight-[a-f0-9-]+\.(png|jpg|webp)$/.test(filename))await fs.unlink(path.join(storageDir(),filename)).catch(()=>{});
    res.json({success:true});
  }));
  return router;
}
module.exports=createRouter();module.exports.createRouter=createRouter;
