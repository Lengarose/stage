const { v4: uuidv4 } = require('uuid');
const { EXECUTESQL } = require('../db/database');
const AdminMailMessage = require('../models/adminMailMessageModel');
const { sendMail, isConfigured: smtpConfigured } = require('./mailer');
const { fetchInboxMessages, isConfigured: imapConfigured } = require('./imapClient');

function mailboxAddress() {
  return process.env.SMTP_USER || '';
}

function parseJson(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try { return JSON.parse(value); } catch { return fallback; }
  }
  return fallback;
}

async function listMessages(query = {}, adminUserId = null) {
  const folder = String(query.folder || 'inbox');
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
  const offset = Math.max(0, Number(query.offset) || 0);
  const search = String(query.search || '').trim();
  const listOpts = { folder, search, limit, offset, adminUserId: folder === 'drafts' ? adminUserId : null };
  const [rows, countRows, unreadRows] = await Promise.all([
    AdminMailMessage.selectAll(listOpts),
    AdminMailMessage.count(listOpts),
    AdminMailMessage.unreadCount(folder),
  ]);
  return {
    messages: rows || [],
    total: Number(countRows?.[0]?.total || 0),
    unread: Number(unreadRows?.[0]?.total || 0),
    configured: {
      smtp: smtpConfigured(),
      imap: imapConfigured(),
      mailbox: mailboxAddress(),
    },
  };
}

async function getMessage(id) {
  const rows = await AdminMailMessage.selectOne(id);
  return rows?.[0] || null;
}

async function markRead(id, isRead = true) {
  await AdminMailMessage.update(id, { is_read: isRead });
  return getMessage(id);
}

async function moveToTrash(id) {
  await AdminMailMessage.update(id, { folder: 'trash' });
  return getMessage(id);
}

async function deletePermanently(admin, id) {
  const existing = await getMessage(id);
  if (!existing) {
    const err = new Error('Message not found');
    err.status = 404;
    throw err;
  }
  if (existing.folder !== 'trash') {
    const err = new Error('Move the message to trash before deleting permanently');
    err.status = 400;
    throw err;
  }
  await AdminMailMessage.delete(id);
  await writeAudit(admin, 'admin_mail_delete_permanent', id, {
    subject: existing.subject,
    from_email: existing.from_email,
    to_email: existing.to_email,
    direction: existing.direction,
  });
  return { ok: true, id };
}

async function emptyTrash(admin) {
  const countRows = await AdminMailMessage.count({ folder: 'trash' });
  const deleted = Number(countRows?.[0]?.total || 0);
  if (deleted > 0) {
    await AdminMailMessage.deleteByFolder('trash');
    await writeAudit(admin, 'admin_mail_empty_trash', 'trash', { deleted_count: deleted });
  }
  return { ok: true, deleted };
}

async function writeAudit(admin, action, entityId, newValue) {
  await EXECUTESQL(
    `INSERT INTO admin_audit_log
      (id, admin_user_id, admin_email, action, entity_type, entity_id, new_value, created_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      uuidv4(),
      admin.id,
      admin.email,
      action,
      'admin_mail',
      entityId,
      JSON.stringify(newValue),
    ],
  ).catch((err) => console.error('[adminMail] audit failed:', err.message));
}

function parseEmailList(value) {
  return String(value || '')
    .split(/[,;]/)
    .map((v) => v.trim())
    .filter((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && !v.endsWith('@stage.local') && !v.endsWith('@stage.invalid'));
}

function draftHasContent({ to, cc, bcc, subject, body }) {
  return Boolean(
    String(to || '').trim()
    || String(cc || '').trim()
    || String(bcc || '').trim()
    || String(subject || '').trim()
    || String(body || '').trim(),
  );
}

async function saveDraft(admin, payload = {}) {
  const {
    id, to, cc, bcc, subject, body, audience, replyToId,
  } = payload;
  if (!draftHasContent({ to, cc, bcc, subject, body })) {
    const err = new Error('Draft is empty');
    err.status = 400;
    throw err;
  }

  const toList = parseEmailList(to);
  const ccList = parseEmailList(cc);
  const bccList = parseEmailList(bcc);
  const draftMeta = audience ? JSON.stringify({ audience }) : null;
  const displayTo = toList.join(', ') || (bccList.length ? `${bccList.length} recipients` : '');

  if (id) {
    const existing = await getMessage(id);
    if (!existing || existing.folder !== 'drafts') {
      const err = new Error('Draft not found');
      err.status = 404;
      throw err;
    }
    if (existing.admin_user_id && existing.admin_user_id !== admin.id) {
      const err = new Error('Draft not found');
      err.status = 404;
      throw err;
    }
    await AdminMailMessage.update(id, {
      to_email: displayTo || null,
      to_addresses: toList.length ? JSON.stringify(toList) : null,
      cc_addresses: ccList.length ? JSON.stringify(ccList) : null,
      bcc_addresses: bccList.length ? JSON.stringify(bccList) : null,
      draft_meta: draftMeta,
      subject: String(subject || '').trim() || null,
      body_text: String(body || ''),
      in_reply_to: replyToId || existing.in_reply_to || null,
    });
    return getMessage(id);
  }

  const row = new AdminMailMessage({
    direction: 'out',
    folder: 'drafts',
    mailbox: mailboxAddress() || null,
    from_email: admin.email,
    from_name: 'STAGE Admin',
    to_email: displayTo || null,
    to_addresses: toList.length ? JSON.stringify(toList) : null,
    cc_addresses: ccList.length ? JSON.stringify(ccList) : null,
    bcc_addresses: bccList.length ? JSON.stringify(bccList) : null,
    draft_meta: draftMeta,
    subject: String(subject || '').trim() || null,
    body_text: String(body || ''),
    is_read: 1,
    in_reply_to: replyToId || null,
    admin_user_id: admin.id,
    admin_email: admin.email,
    received_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
  });
  await row.create();
  return getMessage(row.id);
}

async function deleteDraft(admin, id) {
  const existing = await getMessage(id);
  if (!existing || existing.folder !== 'drafts') {
    const err = new Error('Draft not found');
    err.status = 404;
    throw err;
  }
  if (existing.admin_user_id && existing.admin_user_id !== admin.id) {
    const err = new Error('Draft not found');
    err.status = 404;
    throw err;
  }
  await AdminMailMessage.delete(id);
  return { ok: true, id };
}

async function sendMessage({
  admin, to, cc, bcc, subject, body, replyToId, audience, draftId,
}) {
  if (!smtpConfigured()) {
    const err = new Error('SMTP is not configured');
    err.status = 503;
    throw err;
  }

  const mailbox = mailboxAddress();
  const toList = parseEmailList(to);
  const ccList = parseEmailList(cc);
  const bccList = parseEmailList(bcc);
  const primaryTo = toList.length
    ? toList.join(',')
    : (bccList.length ? mailbox : '');

  if (!primaryTo || (!toList.length && !bccList.length)) {
    const err = new Error('Add a recipient or select a competition audience');
    err.status = 400;
    throw err;
  }
  if (toList.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    const err = new Error('Invalid recipient email');
    err.status = 400;
    throw err;
  }
  if (bccList.length > 200) {
    const err = new Error('Too many Bcc recipients (max 200)');
    err.status = 400;
    throw err;
  }

  let inReplyTo = null;
  if (replyToId) {
    const parent = await getMessage(replyToId);
    inReplyTo = parent?.external_message_id || null;
  }

  const bodyText = String(body || '').trim();
  const html = bodyText.includes('<') ? bodyText : `<p>${bodyText.replace(/\n/g, '<br>')}</p>`;
  const result = await sendMail({
    to: primaryTo,
    cc: ccList.length ? ccList.join(',') : cc,
    bcc: bccList.length ? bccList.join(',') : bcc,
    subject: String(subject || '').trim() || '(no subject)',
    html,
    text: bodyText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  });

  if (!result?.sent) {
    const err = new Error(result?.reason === 'not_configured' ? 'SMTP is not configured' : 'Email could not be sent');
    err.status = result?.reason === 'not_configured' ? 503 : 502;
    throw err;
  }

  const displayTo = bccList.length && !toList.length
    ? `Bulk (${bccList.length} recipients)`
    : (toList.length > 1 ? `${toList.length} recipients` : primaryTo);

  const row = new AdminMailMessage({
    direction: 'out',
    folder: 'sent',
    mailbox,
    from_email: mailbox,
    from_name: 'STAGE Admin',
    to_email: displayTo,
    to_addresses: JSON.stringify(bccList.length && !toList.length ? bccList : (toList.length ? toList : [primaryTo])),
    cc_addresses: ccList.length ? JSON.stringify(ccList) : null,
    bcc_addresses: bccList.length ? JSON.stringify(bccList) : null,
    subject: String(subject || '').trim() || '(no subject)',
    body_text: bodyText,
    body_html: html,
    is_read: 1,
    in_reply_to: inReplyTo,
    admin_user_id: admin.id,
    admin_email: admin.email,
    received_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
  });
  await row.create();
  await writeAudit(admin, bccList.length ? 'admin_mail_bulk_send' : 'admin_mail_send', row.id, {
    to: displayTo,
    subject: row.subject,
    recipient_count: bccList.length || toList.length || 1,
    audience: audience || null,
  });
  if (draftId) {
    await deleteDraft(admin, draftId).catch(() => {});
  }
  return getMessage(row.id);
}

async function syncInbox() {
  if (!imapConfigured()) {
    return { synced: 0, skipped: 0, reason: 'not_configured' };
  }
  const mailbox = mailboxAddress();
  const maxRows = await AdminMailMessage.maxExternalUid(mailbox);
  const sinceUid = Number(maxRows?.[0]?.max_uid || 0);
  const { messages, reason, mailbox: fetchedMailbox } = await fetchInboxMessages({ sinceUid, limit: 50 });
  if (reason === 'not_configured') {
    return { synced: 0, skipped: 0, reason };
  }

  let synced = 0;
  let skipped = 0;
  for (const msg of messages || []) {
    const toList = msg.to_addresses || [];
    const row = new AdminMailMessage({
      direction: 'in',
      folder: 'inbox',
      mailbox: fetchedMailbox || mailbox,
      from_email: msg.from_email || null,
      from_name: msg.from_name || null,
      to_email: toList[0] || mailbox,
      to_addresses: JSON.stringify(toList.length ? toList : [mailbox]),
      cc_addresses: JSON.stringify(msg.cc_addresses || []),
      subject: msg.subject || '(no subject)',
      body_text: msg.body_text || '',
      body_html: msg.body_html || null,
      is_read: 0,
      external_uid: msg.external_uid,
      external_message_id: msg.external_message_id,
      in_reply_to: msg.in_reply_to,
      received_at: msg.received_at
        ? String(msg.received_at).slice(0, 19).replace('T', ' ')
        : new Date().toISOString().slice(0, 19).replace('T', ' '),
    });
    try {
      await row.create();
      synced += 1;
    } catch (err) {
      if (String(err.message || '').includes('Duplicate') || String(err.code) === 'ER_DUP_ENTRY') {
        skipped += 1;
      } else {
        console.warn('[adminMail] insert failed:', err.message);
        skipped += 1;
      }
    }
  }
  return { synced, skipped, sinceUid, mailbox: fetchedMailbox || mailbox };
}

module.exports = {
  listMessages,
  getMessage,
  markRead,
  moveToTrash,
  deletePermanently,
  emptyTrash,
  saveDraft,
  deleteDraft,
  draftHasContent,
  sendMessage,
  syncInbox,
  parseJson,
};
