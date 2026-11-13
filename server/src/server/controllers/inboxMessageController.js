const express       = require('express');
const router        = express.Router();
const InboxMessage  = require('../models/inboxMessageModel');
const { EXECUTESQL } = require('../db/database');
const { broadcastInbox, broadcastInboxDeleted } = require('../utils/socketBroadcast');

async function getCurrentUser(req) {
  const userId = req.user?.id;
  if (!userId) return null;
  const rows = await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [userId]);
  return rows[0] || null;
}

async function auditInbox(user,action,id,before,after) {
  if(![0,2].includes(Number(user?.role_id)))return;
  await require('../services/rewardConfigurationService').audit(EXECUTESQL,user,action,'inbox_message',id,before,after,'Authenticated account correspondence action');
}

// Bulk read is scoped to the authenticated account, not a visible page.
router.post('/mark-all-read',async(req,res)=>{
 try {
  const user=await getCurrentUser(req);if(!user?.email)return res.status(403).json({error:'Forbidden'});
  const model=new InboxMessage(),before=await model.selectByRecipient(user.email);
  const result=await model.markAllRead(user.email);
  await auditInbox(user,'mark_all_inbox_read',user.id,{unread:before.filter(r=>!Number(r.is_read)).length},{updated:result.affectedRows});
  for(const record of before.filter(r=>!Number(r.is_read)))broadcastInbox({...record,is_read:1});
  res.json({success:true,updated:result.affectedRows});
 }catch(e){res.status(500).json({error:e.message});}
});
router.post('/:id/delete-conversation',async(req,res)=>{
 try {
  const user=await getCurrentUser(req),model=new InboxMessage();
  const [record]=await model.selectOne(req.params.id);
  if(!user?.email||!record||String(record.recipient_email).toLowerCase()!==user.email.toLowerCase())return res.status(404).json({error:'Message not found'});
  const records=await model.conversation(record);
  if(records.length)await EXECUTESQL(`UPDATE inbox_messages SET deleted_at=NOW(),is_read=1 WHERE LOWER(recipient_email)=LOWER(?) AND id IN (${records.map(()=>'?').join(',')})`,[user.email,...records.map(r=>r.id)]);
  await auditInbox(user,'delete_inbox_conversation',record.id,{ids:records.map(r=>r.id)},{hidden:true});
  for(const row of records)broadcastInboxDeleted(row.id,user.email);
  res.json({success:true,deleted_ids:records.map(row=>row.id)});
 }catch(e){res.status(500).json({error:e.message});}
});

// GET /
router.get('/', async (req, res) => {
  try {
    const { page } = req.query;
    const inbox = new InboxMessage();
    const currentUser = await getCurrentUser(req);
    if (!currentUser?.email) return res.status(403).json({ error: 'Forbidden' });

    let result;
    if (Number(currentUser.role_id) === 0 && req.query?.email) {
      result = await inbox.selectByRecipient(String(req.query.email));
    } else {
      // Always scope inbox reads to the authenticated user's email.
      result = await inbox.selectByRecipient(currentUser.email);
    }

    if (!req.query?.email && Number(currentUser.role_id) === 0 && page) {
      result = await inbox.selectAll(Number(page) || 1);
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}); 

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const inbox  = new InboxMessage();
    const currentUser = await getCurrentUser(req);
    if (!currentUser?.email) return res.status(403).json({ error: 'Forbidden' });
    const result = await inbox.selectOne(req.params.id);
    if (!result.length) return res.status(404).json({ error: 'Not found' });
    const record = result[0];
    const isAdmin = Number(currentUser.role_id) === 0;
    if (!isAdmin && record.recipient_email !== currentUser.email) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /
router.post('/', async (req, res) => {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser?.email) return res.status(403).json({ error: 'Forbidden' });
    const isAdmin = Number(currentUser.role_id) === 0;
    const payload = { ...req.body };
    if (!isAdmin) {
      // Prevent sender spoofing from the client.
      payload.sender_email = currentUser.email;
    }
    const subject = String(payload.subject || '').trim();
    const body = String(payload.body || '').trim();
    if (!payload.recipient_email || !subject || !body) {
      return res.status(400).json({ error: 'Missing required fields: recipient_email, subject, body' });
    }
    payload.subject = subject;
    payload.body = body;
    const inbox = new InboxMessage(payload);
    await inbox.create();
    const created = await inbox.selectOne(inbox.id);
    const record  = created[0];
    await auditInbox(currentUser,'create_inbox_message',record.id,null,{id:record.id,recipient_email:record.recipient_email});
    broadcastInbox(record);
    res.status(201).json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = await getCurrentUser(req);
    if (!currentUser?.email) return res.status(403).json({ error: 'Forbidden' });
    const isAdmin = Number(currentUser.role_id) === 0;
    const existing = await new InboxMessage().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    if (String(existing[0].recipient_email).toLowerCase() !== currentUser.email.toLowerCase()) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const merged = { ...existing[0], ...(Object.hasOwn(req.body||{},'is_read')?{is_read:[true,1,'1'].includes(req.body.is_read)?1:0}:{}), ...(req.body?.status?{status:req.body.status}:{}) };
    if (!isAdmin) {
      merged.sender_email = existing[0].sender_email;
      merged.recipient_email = existing[0].recipient_email;
    }
    const inbox = new InboxMessage(merged);
    await inbox.update(id);
    const updated = await inbox.selectOne(id);
    const record  = updated[0];
    await auditInbox(currentUser,'update_inbox_message',id,{is_read:existing[0].is_read,status:existing[0].status},{is_read:record.is_read,status:record.status});
    broadcastInbox(record);
    res.json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = await getCurrentUser(req);
    if (!currentUser?.email) return res.status(403).json({ error: 'Forbidden' });
    const isAdmin = Number(currentUser.role_id) === 0;
    const existing = await new InboxMessage().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    if (String(existing[0].recipient_email).toLowerCase() !== currentUser.email.toLowerCase()) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { recipient_email } = existing[0];
    await new InboxMessage().delete(id);
    await auditInbox(currentUser,'delete_inbox_message',id,{id},{hidden:true});
    broadcastInboxDeleted(id, recipient_email);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
