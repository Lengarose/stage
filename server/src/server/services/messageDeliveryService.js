const { v4: uuidv4 } = require('uuid');
const { EXECUTESQL } = require('../db/database');
const { broadcastInbox, broadcastNotification } = require('../utils/socketBroadcast');
const { resolveClubPresidentContact } = require('./clubContactService');

function parseMaybeJson(value, fallback = {}) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch { return fallback; }
}

function formatContractTypeForSentence(type) {
  if (type === 'ownership') return 'president';
  return String(type || 'squad').replace(/_/g, ' ');
}

function getNotificationSettingKey(type) {
  const map = {
    contract_offer: 'contract_offers',
    contract_accepted: 'contract_updates',
    contract_rejected: 'contract_updates',
    contract_terminated: 'contract_updates',
    contract_expired: 'contract_updates',
    contract_completed: 'contract_updates',
    match_scheduled: 'match_reminders',
    match_result: 'match_results',
    match_reminder: 'match_reminders',
    result_submitted: 'match_results',
    result_confirmed: 'match_results',
    join_request: 'club_updates',
    join_approved: 'club_updates',
    join_rejected: 'club_updates',
    club_update: 'club_updates',
    invite: 'club_updates',
    message: 'messages',
    tournament_start: 'tournament_updates',
    tournament_complete: 'tournament_updates',
    announcement: 'announcements',
  };
  return map[type] || null;
}

function messageTypeToNotificationType(messageType) {
  const key = String(messageType || 'general');
  if (key === 'match_invite') return 'match_reminder';
  if (key === 'contract_offer') return 'contract_offer';
  if (key === 'club_invite') return 'club_update';
  if (key === 'announcement') return 'announcement';
  return 'message';
}

function buildActionMessageIdempotencyKey({ recipient, messageType, relatedEntityType, relatedEntityId }) {
  if (!relatedEntityId) return null;
  return [
    messageType || 'general',
    relatedEntityType || 'entity',
    relatedEntityId,
    recipient,
  ].map(value => String(value || '').trim().toLowerCase()).join(':');
}

async function notifyForActionMessage({
  recipient,
  messageId,
  subject,
  messageType,
  idempotencyKey,
  notification,
}) {
  return createNotificationIfEnabled({
    recipientEmail: recipient,
    type: notification.type || messageTypeToNotificationType(messageType),
    title: notification.title || `New message: ${subject}`,
    body: notification.body || 'Open your inbox to respond.',
    link: notification.link || `/inbox?id=${messageId}`,
    relatedId: messageId,
    idempotencyKey: notification.idempotencyKey || (idempotencyKey ? `notification:${idempotencyKey}` : null),
  });
}

async function createNotificationIfEnabled({
  recipientEmail, type, title, body = '', link = '', relatedId = null, idempotencyKey = null,
}) {
  if (!recipientEmail) return { skipped: true, reason: 'recipient missing' };
  const playerRows = await EXECUTESQL('SELECT notification_settings FROM players WHERE LOWER(email)=LOWER(?) LIMIT 1', [recipientEmail]);
  const settings = parseMaybeJson(playerRows[0]?.notification_settings, {});
  const settingKey = getNotificationSettingKey(type);
  const enabled = settingKey ? (settings[settingKey] === undefined ? true : settings[settingKey] === true) : true;
  if (!enabled) return { skipped: true, reason: 'disabled in settings' };
  if (idempotencyKey) {
    const existing = await EXECUTESQL(
      'SELECT id FROM notifications WHERE idempotency_key = ? LIMIT 1',
      [idempotencyKey]
    );
    if (existing.length) return { success: true, id: existing[0].id, reused: true };
  }
  // relatedId is the idempotency key for business events, so retries do not fan
  // out into duplicate notifications.
  if (relatedId) {
    const existing = await EXECUTESQL(
      'SELECT id FROM notifications WHERE recipient_email = ? AND type = ? AND related_id = ? LIMIT 1',
      [recipientEmail, type, relatedId]
    );
    if (existing.length) return { success: true, id: existing[0].id, reused: true };
  }
  const id = uuidv4();
  await EXECUTESQL(
    'INSERT INTO notifications (id, recipient_email, type, title, body, `read`, link, related_id, idempotency_key, created_date) VALUES (?,?,?,?,?,?,?,?,?, NOW())',
    [id, recipientEmail, type, title, body, 0, link || '', relatedId, idempotencyKey]
  );
  broadcastNotification({
    id,
    recipient_email: recipientEmail,
    type,
    title,
    body,
    read: 0,
    link: link || '',
    related_id: relatedId,
    idempotency_key: idempotencyKey,
  });
  return { success: true, id };
}

async function sendActionMessage({
  recipientEmail,
  senderEmail = null,
  senderGamertag = null,
  senderAvatarUrl = null,
  senderClubName = null,
  subject,
  body,
  messageType = 'general',
  actionType = 'none',
  relatedEntityId = null,
  relatedEntityType = null,
  metadata = null,
  idempotencyKey = null,
  isSystem = false,
  notify = true,
  notification = {},
  reuseByRelated = true,
}) {
  const recipient = String(recipientEmail || '').trim().toLowerCase();
  if (!recipient || !subject || !body) {
    throw new Error('Missing required fields: recipientEmail, subject, body');
  }
  const effectiveIdempotencyKey = idempotencyKey || buildActionMessageIdempotencyKey({
    recipient,
    messageType,
    relatedEntityType,
    relatedEntityId,
  });
  if (!effectiveIdempotencyKey) {
    throw new Error('sendActionMessage requires idempotencyKey or relatedEntityId');
  }

  const existingByKey = await EXECUTESQL(
    'SELECT id FROM inbox_messages WHERE idempotency_key = ? LIMIT 1',
    [effectiveIdempotencyKey]
  );
  const existingByRelated = existingByKey.length || !relatedEntityId || !reuseByRelated ? [] : await EXECUTESQL(
    `SELECT id FROM inbox_messages
      WHERE recipient_email = ?
        AND message_type = ?
        AND related_entity_id = ?
      LIMIT 1`,
    [recipient, messageType, relatedEntityId]
  );
  const existingMessage = existingByKey[0] || existingByRelated[0] || null;
  if (existingMessage) {
    // Keep retries and legacy rows actionable instead of preserving incomplete
    // messages that were created before the central inbox delivery path existed.
    await EXECUTESQL(
      `UPDATE inbox_messages
          SET recipient_email = ?,
              sender_email = ?,
              sender_gamertag = ?,
              sender_avatar_url = ?,
              sender_club_name = ?,
              subject = ?,
              body = ?,
              message_type = ?,
              action_type = ?,
              status = 'pending',
              is_read = 0,
              is_system = ?,
              metadata = ?,
              related_entity_id = ?,
              related_entity_type = ?,
              idempotency_key = COALESCE(idempotency_key, ?),
              updated_date = NOW()
        WHERE id = ?`,
      [
        recipient,
        senderEmail || null,
        senderGamertag || null,
        senderAvatarUrl || null,
        senderClubName || null,
        subject,
        body,
        messageType,
        actionType,
        isSystem ? 1 : 0,
        metadata ? JSON.stringify(metadata) : null,
        relatedEntityId,
        relatedEntityType,
        effectiveIdempotencyKey,
        existingMessage.id,
      ]
    ).catch(() => {});
    const repairedRows = await EXECUTESQL('SELECT * FROM inbox_messages WHERE id = ? LIMIT 1', [existingMessage.id]).catch(() => []);
    if (repairedRows[0]) broadcastInbox(repairedRows[0]);
    const notificationResult = notify ? await notifyForActionMessage({
      recipient,
      messageId: existingMessage.id,
      subject,
      messageType,
      idempotencyKey: effectiveIdempotencyKey,
      notification,
    }) : null;
    return {
      success: true,
      message: { id: existingMessage.id, reused: true },
      notification: notificationResult,
    };
  }

  const messageId = uuidv4();
  await EXECUTESQL(
    `INSERT INTO inbox_messages
       (id, recipient_email, sender_email, sender_gamertag, sender_avatar_url, sender_club_name,
        subject, body, message_type, action_type, status, is_read, is_system, metadata,
        related_entity_id, related_entity_type, idempotency_key, created_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?, ?, ?, NOW())`,
    [
      messageId,
      recipient,
      senderEmail || null,
      senderGamertag || null,
      senderAvatarUrl || null,
      senderClubName || null,
      subject,
      body,
      messageType,
      actionType,
      isSystem ? 1 : 0,
      metadata ? JSON.stringify(metadata) : null,
      relatedEntityId,
      relatedEntityType,
      effectiveIdempotencyKey,
    ]
  );

  const createdRows = await EXECUTESQL('SELECT * FROM inbox_messages WHERE id = ? LIMIT 1', [messageId]).catch(() => []);
  const createdMessage = createdRows[0] || {
    id: messageId,
    recipient_email: recipient,
    subject,
    message_type: messageType,
    status: 'pending',
    is_read: 0,
    idempotency_key: effectiveIdempotencyKey,
  };
  broadcastInbox(createdMessage);

  let notificationResult = null;
  if (notify) {
    notificationResult = await notifyForActionMessage({
      recipient,
      messageId,
      subject,
      messageType,
      idempotencyKey: effectiveIdempotencyKey,
      notification,
    });
  }

  return {
    success: true,
    message: { id: messageId, reused: false },
    notification: notificationResult,
  };
}

async function deliverContractOfferMessage(contractId) {
  const rows = await EXECUTESQL(
    `SELECT pc.*, pc.user_id AS target_player_id,
            c.name AS club_name, c.logo_url AS club_logo_url, c.owner_email AS club_owner_email,
            p.email AS player_email, p.gamertag AS player_gamertag,
            u.email AS user_email
       FROM player_contracts pc
       LEFT JOIN clubs c ON c.id = pc.team_id
       LEFT JOIN players p ON p.id = pc.user_id
       LEFT JOIN users u ON u.player_id = p.id OR u.id = p.user_id
      WHERE pc.id = ?
      LIMIT 1`,
    [contractId]
  );
  const contract = rows[0];
  if (!contract) return;
  const recipientEmail = String(contract.player_email || contract.user_email || '').trim().toLowerCase();
  if (!recipientEmail) return;
  const existingInbox = await EXECUTESQL(
    "SELECT id, recipient_email FROM inbox_messages WHERE related_entity_id = ? AND message_type = 'contract_offer' LIMIT 1",
    [contractId]
  );
  const typeLabel = formatContractTypeForSentence(contract.contract_type);
  const clubContact = await resolveClubPresidentContact({ clubId: contract.team_id });
  const body = [
    `${contract.club_name || 'A club'} has sent you a ${typeLabel} contract offer.`,
    '',
    `Duration: ${contract.max_games || 0} games / ${contract.max_days || 0} days`,
    `Weekly Salary: ${Number(contract.weekly_salary_stc || 0).toLocaleString()} STC / week`,
    Number(contract.signing_bonus_stc || 0) > 0 ? `Signing Bonus: ${Number(contract.signing_bonus_stc || 0).toLocaleString()} STC` : null,
    contract.offer_note ? `\nClub note:\n${contract.offer_note}` : null,
    '',
    'Please respond using the buttons below. You can accept the offer, send a counter-offer, or decline it.',
  ].filter(Boolean).join('\n');
  const idempotencyKey = `contract_offer:player_contract:${contractId}:${recipientEmail}`;
  const subject = `Contract Offer from ${contract.club_name || 'Club'}`;
  const notificationBody = `${contract.club_name || 'A club'} has sent you a ${typeLabel} contract offer.`;

  if (existingInbox.length) {
    const currentRecipient = String(existingInbox[0].recipient_email || '').trim().toLowerCase();
    await EXECUTESQL(
      `UPDATE inbox_messages
          SET recipient_email = ?,
              status = 'pending',
              is_read = 0,
              idempotency_key = COALESCE(idempotency_key, ?)
        WHERE id = ?`,
      [currentRecipient === recipientEmail ? currentRecipient : recipientEmail, idempotencyKey, existingInbox[0].id]
    ).catch(() => {});
    // Older delivery code keyed contract notifications to the contract id.
    // Move that reminder to the inbox id so the inbox remains the action source.
    await EXECUTESQL(
      `UPDATE notifications
          SET related_id = ?,
              link = ?,
              idempotency_key = COALESCE(idempotency_key, ?)
        WHERE type = 'contract_offer'
          AND related_id = ?`,
      [existingInbox[0].id, `/inbox?id=${existingInbox[0].id}`, `notification:${idempotencyKey}`, contractId]
    ).catch(() => {});
  }

  const delivery = await sendActionMessage({
    recipientEmail,
    senderEmail: clubContact.email || contract.club_owner_email || 'system@stage.com',
    senderGamertag: contract.club_name || 'Club Management',
    senderAvatarUrl: contract.club_logo_url || '',
    senderClubName: contract.club_name || '',
    subject,
    body,
    messageType: 'contract_offer',
    actionType: 'contract_negotiation',
    relatedEntityId: contractId,
    relatedEntityType: 'player_contract',
    idempotencyKey,
    notify: false,
    metadata: {
      contract_id: contractId,
      club_id: contract.team_id,
      club_name: contract.club_name,
      contract_type: contract.contract_type,
    },
  });
  const inboxId = delivery.message.id;
  await EXECUTESQL(
    `UPDATE notifications
        SET related_id = ?,
            link = ?,
            idempotency_key = COALESCE(idempotency_key, ?)
      WHERE type = 'contract_offer'
        AND related_id = ?`,
    [inboxId, `/inbox?id=${inboxId}`, `notification:${idempotencyKey}`, contractId]
  ).catch(() => {});
  await createNotificationIfEnabled({
    recipientEmail,
    type: 'contract_offer',
    title: subject,
    body: notificationBody,
    link: `/inbox?id=${inboxId}`,
    relatedId: inboxId,
    idempotencyKey: `notification:${idempotencyKey}`,
  });
}

module.exports = {
  createNotificationIfEnabled,
  deliverContractOfferMessage,
  messageTypeToNotificationType,
  sendActionMessage,
};
