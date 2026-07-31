const { v4: uuidv4 } = require('uuid');
const { EXECUTESQL } = require('../db/database');
const { broadcastNotification } = require('../utils/socketBroadcast');

function parseMaybeJson(value, fallback = {}) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch { return fallback; }
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

async function createNotificationIfEnabled({
  recipientEmail, type, title, body = '', link = '', relatedId = null,
}) {
  if (!recipientEmail) return { skipped: true, reason: 'recipient missing' };
  const playerRows = await EXECUTESQL('SELECT notification_settings FROM players WHERE LOWER(email)=LOWER(?) LIMIT 1', [recipientEmail]);
  const settings = parseMaybeJson(playerRows[0]?.notification_settings, {});
  const settingKey = getNotificationSettingKey(type);
  const enabled = settingKey ? (settings[settingKey] === undefined ? true : settings[settingKey] === true) : true;
  if (!enabled) return { skipped: true, reason: 'disabled in settings' };
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
    'INSERT INTO notifications (id, recipient_email, type, title, body, `read`, link, related_id, created_date) VALUES (?,?,?,?,?,?,?,?, NOW())',
    [id, recipientEmail, type, title, body, 0, link || '', relatedId]
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
  });
  return { success: true, id };
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
  const typeLabel = String(contract.contract_type || 'squad').replace(/_/g, ' ');
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
  // Contract offers are uniquely represented by the contract id in inbox.
  // This keeps marketplace/profile flows from creating parallel messages.
  if (existingInbox.length) {
    const currentRecipient = String(existingInbox[0].recipient_email || '').trim().toLowerCase();
    if (currentRecipient !== recipientEmail) {
      await EXECUTESQL(
        `UPDATE inbox_messages
            SET recipient_email = ?,
                status = 'pending',
                is_read = 0
          WHERE id = ?`,
        [recipientEmail, existingInbox[0].id]
      ).catch(() => {});
    }
  } else {
    await EXECUTESQL(
      `INSERT INTO inbox_messages
         (id, recipient_email, sender_email, sender_gamertag, sender_avatar_url, sender_club_name,
          subject, body, message_type, action_type, status, is_read, is_system, metadata,
          related_entity_id, related_entity_type, created_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'contract_offer', 'contract_negotiation', 'pending', 0, 0, ?, ?, 'player_contract', NOW())`,
      [
        uuidv4(),
        recipientEmail,
        contract.club_owner_email || 'system@stage.com',
        contract.club_name || 'Club Management',
        contract.club_logo_url || '',
        contract.club_name || '',
        `Contract Offer from ${contract.club_name || 'Club'}`,
        body,
        JSON.stringify({
          contract_id: contractId,
          club_id: contract.team_id,
          club_name: contract.club_name,
          contract_type: contract.contract_type,
        }),
        contractId,
      ]
    );
  }
  await createNotificationIfEnabled({
    recipientEmail,
    type: 'contract_offer',
    title: `Contract Offer from ${contract.club_name || 'Club'}`,
    body: `${contract.club_name || 'A club'} has sent you a ${contract.contract_type || 'squad'} contract offer.`,
    link: '/inbox',
    relatedId: contractId,
  }).catch(() => {});
}

module.exports = {
  createNotificationIfEnabled,
  deliverContractOfferMessage,
  messageTypeToNotificationType,
};
