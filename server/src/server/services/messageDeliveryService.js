const { v4: uuidv4 } = require('uuid');
const { EXECUTESQL } = require('../db/database');
const { broadcastInbox, broadcastNotification } = require('../utils/socketBroadcast');
const { resolveClubPresidentContact } = require('./clubContactService');
const { queueOneSignalPush } = require('./oneSignalService');
const { parseMaybeJson, resolveDelivery } = require('./notificationPreferenceService');
const { sendEventEmail } = require('./notifications');

function formatContractTypeForSentence(type) {
  if (type === 'ownership') return 'president';
  return String(type || 'squad').replace(/_/g, ' ');
}

function pickPlayerEmail(contract) {
  return String(contract?.player_email || contract?.user_email || '').trim().toLowerCase();
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString();
}

function purchaseTermsLine(loan) {
  const type = String(loan?.purchase_type || 'NONE').toUpperCase();
  if (type === 'NONE' || !type) return null;
  const label = type === 'MANDATORY' ? 'Obligation to buy' : type === 'OPTIONAL' ? 'Option to buy' : null;
  if (!label) return null;
  return `${label}: ${formatMoney(loan.purchase_option_stc)} STC`;
}

function purchaseTermsMetadata(loan) {
  const type = String(loan?.purchase_type || 'NONE').toUpperCase();
  if (type === 'NONE' || (type !== 'OPTIONAL' && type !== 'MANDATORY')) return {};
  return {
    purchase_type: type,
    purchase_option_stc: Number(loan.purchase_option_stc || 0),
  };
}

function formatTargetsForBody(targets) {
  const list = Array.isArray(targets) ? targets : [];
  if (!list.length) return null;
  const lines = list.slice(0, 8).map((target) => {
    const stat = String(target?.stat || 'target').replace(/_/g, ' ');
    if (target?.type === 'range') return `- ${stat}: ${target.value}–${target.value_max ?? ''}`;
    if (target?.type === 'exact') return `- ${stat}: = ${target.value}`;
    return `- ${stat}: ≥ ${target.value ?? 0}`;
  });
  return [`Performance targets (${list.length}):`, ...lines].join('\n');
}

function resolveContractOfferRecipient(contract, clubContact = {}) {
  const playerEmail = pickPlayerEmail(contract);
  const presidentEmail = String(clubContact?.email || contract?.club_owner_email || '').trim().toLowerCase();
  const lastBy = contract?.last_negotiated_by != null ? String(contract.last_negotiated_by).trim() : '';
  const targetPlayerId = String(contract?.user_id || contract?.target_player_id || '');
  const round = Number(contract?.negotiation_round || 0);
  const playerLastMoved = Boolean(lastBy && targetPlayerId && lastBy === targetPlayerId);
  if (playerLastMoved && presidentEmail && presidentEmail !== playerEmail) {
    return { role: 'president', email: presidentEmail, playerEmail, round };
  }
  return { role: 'player', email: playerEmail, playerEmail, round };
}

function buildContractOfferIdempotencyKey(contractId, email, round) {
  const base = `contract_offer:player_contract:${contractId}:${email}`;
  return Number(round) > 0 ? `${base}:r${round}` : base;
}

function getNotificationSettingKey(type) {
  const map = {
    contract_offer: 'contract_offers',
    contract_accepted: 'contract_updates',
    contract_rejected: 'contract_updates',
    contract_terminated: 'contract_updates',
    contract_expired: 'contract_updates',
    contract_completed: 'contract_updates',
    loan_offer: 'club_updates',
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
  if (key === 'loan_proposal') return 'loan_offer';
  if (key === 'loan_recalled') return 'loan_offer';
  if (key === 'loan_early_end') return 'loan_offer';
  if (key === 'loan_terminated_early') return 'loan_offer';
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
  const delivery = resolveDelivery(settings, settingKey);
  const email = Boolean(delivery.email && settingKey);
  if (!delivery.inApp && !delivery.push && !email) return { skipped: true, reason: 'disabled in settings' };
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
  let id = null;
  if (delivery.inApp) {
    id = uuidv4();
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
  }
  if (delivery.push) {
    queueOneSignalPush({
      recipientEmail,
      title,
      body,
      link,
      type,
      notificationId: id,
    });
  }
  if (email) {
    sendEventEmail({ to: recipientEmail, title, body, url: link });
  }
  return { success: true, id, inApp: delivery.inApp, push: delivery.push, email };
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function liveChatSnippet(text, max = 140) {
  const snippet = String(text || '').trim().replace(/\s+/g, ' ');
  if (!snippet) return 'Sent a message';
  return snippet.length > max ? `${snippet.slice(0, max - 1)}…` : snippet;
}

function liveChatChannelMeta(record) {
  const channelId = String(record?.match_id || '').trim();
  const clubMatch = channelId.match(/^club:(.+)$/i);
  if (clubMatch) {
    const clubId = clubMatch[1];
    return {
      channelId,
      kind: 'club',
      clubId,
      link: `/clubs/${clubId}`,
      titleSuffix: 'club chat',
    };
  }
  return {
    channelId,
    kind: 'match',
    matchId: channelId,
    link: channelId ? `/game-day?match=${encodeURIComponent(channelId)}` : '/game-day',
    titleSuffix: 'match chat',
  };
}

async function resolveLiveChatRecipientEmails(record) {
  const meta = liveChatChannelMeta(record);
  const sender = normalizeEmail(record?.sender_email);
  const emails = new Set();

  if (meta.kind === 'club' && meta.clubId) {
    const squad = await EXECUTESQL(
      'SELECT email FROM players WHERE club_id = ? AND email IS NOT NULL AND TRIM(email) != ""',
      [meta.clubId]
    ).catch(() => []);
    const owner = await EXECUTESQL(
      'SELECT owner_email FROM clubs WHERE id = ? LIMIT 1',
      [meta.clubId]
    ).catch(() => []);
    for (const row of squad || []) emails.add(normalizeEmail(row.email));
    if (owner?.[0]?.owner_email) emails.add(normalizeEmail(owner[0].owner_email));
  } else if (meta.matchId) {
    const matches = await EXECUTESQL(
      `SELECT home_player_email, away_player_email, home_owner_email, away_owner_email,
              home_player_id, away_player_id, home_club_id, away_club_id
         FROM matches WHERE id = ? LIMIT 1`,
      [meta.matchId]
    ).catch(() => []);
    const match = matches?.[0];
    if (match) {
      for (const key of ['home_player_email', 'away_player_email', 'home_owner_email', 'away_owner_email']) {
        if (match[key]) emails.add(normalizeEmail(match[key]));
      }
      const playerIds = [match.home_player_id, match.away_player_id].filter(Boolean);
      if (playerIds.length) {
        const placeholders = playerIds.map(() => '?').join(',');
        const players = await EXECUTESQL(
          `SELECT email FROM players WHERE id IN (${placeholders}) AND email IS NOT NULL AND TRIM(email) != ""`,
          playerIds
        ).catch(() => []);
        for (const row of players || []) emails.add(normalizeEmail(row.email));
      }
      const clubIds = [match.home_club_id, match.away_club_id].filter(Boolean);
      if (clubIds.length) {
        const placeholders = clubIds.map(() => '?').join(',');
        const squad = await EXECUTESQL(
          `SELECT email FROM players WHERE club_id IN (${placeholders}) AND email IS NOT NULL AND TRIM(email) != ""`,
          clubIds
        ).catch(() => []);
        for (const row of squad || []) emails.add(normalizeEmail(row.email));
      }
    }
  }

  emails.delete(sender);
  emails.delete('');
  return [...emails];
}

async function notifyLiveChatIfEnabled(record) {
  if (!record?.match_id) return { skipped: true, reason: 'channel missing' };
  const meta = liveChatChannelMeta(record);
  const recipients = await resolveLiveChatRecipientEmails(record);
  const senderName = String(record.sender_name || record.sender_email || 'Someone').trim() || 'Someone';
  const title = `${senderName} · ${meta.titleSuffix}`;
  const body = liveChatSnippet(record.content);
  const relatedId = `live_chat:${meta.channelId}`;
  const results = [];

  for (const recipientEmail of recipients) {
    const playerRows = await EXECUTESQL(
      'SELECT notification_settings FROM players WHERE LOWER(email)=LOWER(?) LIMIT 1',
      [recipientEmail]
    ).catch(() => []);
    const settings = parseMaybeJson(playerRows[0]?.notification_settings, {});
    const delivery = resolveDelivery(settings, 'messages');
    if (!delivery.inApp && !delivery.push && !delivery.email) {
      results.push({ recipientEmail, skipped: true, reason: 'disabled in settings' });
      continue;
    }

    const unread = delivery.inApp ? await EXECUTESQL(
      'SELECT id FROM notifications WHERE recipient_email = ? AND type = ? AND related_id = ? AND `read` = 0 LIMIT 1',
      [recipientEmail, 'message', relatedId]
    ).catch(() => []) : [];

    if (unread[0]?.id) {
      await EXECUTESQL(
        'UPDATE notifications SET title = ?, body = ?, link = ?, updated_date = NOW() WHERE id = ?',
        [title, body, meta.link, unread[0].id]
      ).catch(() => {});
      const payload = {
        id: unread[0].id,
        recipient_email: recipientEmail,
        type: 'message',
        title,
        body,
        read: 0,
        link: meta.link,
        related_id: relatedId,
      };
      broadcastNotification(payload);
      if (delivery.push) {
        queueOneSignalPush({
          recipientEmail,
          title,
          body,
          link: meta.link,
          type: 'message',
          notificationId: unread[0].id,
        });
      }
      results.push({ recipientEmail, success: true, reused: true, id: unread[0].id, push: delivery.push, email: false });
      continue;
    }

    let id = null;
    if (delivery.inApp) {
      id = uuidv4();
      await EXECUTESQL(
        'INSERT INTO notifications (id, recipient_email, type, title, body, `read`, link, related_id, created_date) VALUES (?,?,?,?,?,?,?,?, NOW())',
        [id, recipientEmail, 'message', title, body, 0, meta.link, relatedId]
      );
      const payload = {
        id,
        recipient_email: recipientEmail,
        type: 'message',
        title,
        body,
        read: 0,
        link: meta.link,
        related_id: relatedId,
      };
      broadcastNotification(payload);
    }
    if (delivery.push) {
      queueOneSignalPush({
        recipientEmail,
        title,
        body,
        link: meta.link,
        type: 'message',
        notificationId: id,
      });
    }
    if (delivery.email) {
      sendEventEmail({ to: recipientEmail, title, body, url: meta.link });
    }
    results.push({ recipientEmail, success: true, id, inApp: delivery.inApp, push: delivery.push, email: delivery.email });
  }

  return { success: true, notified: results.filter((row) => row.success).length, results };
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
  const clubContact = await resolveClubPresidentContact({ clubId: contract.team_id });
  const recipient = resolveContractOfferRecipient(contract, clubContact);
  const recipientEmail = recipient.email;
  if (!recipientEmail) return;

  const typeLabel = formatContractTypeForSentence(contract.contract_type);
  const playerName = contract.player_gamertag || 'A player';
  const clubName = contract.club_name || 'A club';
  const isCounter = recipient.round > 0;
  const terms = [
    `Duration: ${contract.max_games || 0} games / ${contract.max_days || 0} days`,
    `Weekly Salary: ${formatMoney(contract.weekly_salary_stc)} STC / week`,
    Number(contract.signing_bonus_stc || 0) > 0 ? `Signing Bonus: ${formatMoney(contract.signing_bonus_stc)} STC` : null,
    formatTargetsForBody(parseMaybeJson(contract.performance_targets, [])),
    contract.offer_note ? `\nNote:\n${contract.offer_note}` : null,
  ];
  const body = recipient.role === 'president'
    ? [
        `${playerName} sent a counter-offer (Round ${recipient.round}).`,
        '',
        ...terms,
        '',
        'Please respond using the buttons below. You can accept the offer, send a counter-offer, or decline it.',
      ].filter(Boolean).join('\n')
    : [
        isCounter
          ? `${clubName} sent a counter-offer (Round ${recipient.round}).`
          : `${clubName} has sent you a ${typeLabel} contract offer.`,
        '',
        ...terms,
        '',
        'Please respond using the buttons below. You can accept the offer, send a counter-offer, or decline it.',
      ].filter(Boolean).join('\n');
  const idempotencyKey = buildContractOfferIdempotencyKey(contractId, recipientEmail, recipient.round);
  const subject = recipient.role === 'president'
    ? `Counter-Offer from ${playerName}`
    : isCounter
      ? `Counter-Offer from ${contract.club_name || 'Club'}`
      : `Contract Offer from ${contract.club_name || 'Club'}`;
  const notificationBody = recipient.role === 'president'
    ? `${playerName} proposed new contract terms (Round ${recipient.round}).`
    : isCounter
      ? `${clubName} proposed new contract terms (Round ${recipient.round}).`
      : `${clubName} has sent you a ${typeLabel} contract offer.`;

  const isInitialPlayerOffer = recipient.role === 'player' && !isCounter;
  if (isInitialPlayerOffer) {
    const existingInbox = await EXECUTESQL(
      "SELECT id, recipient_email FROM inbox_messages WHERE related_entity_id = ? AND message_type = 'contract_offer' LIMIT 1",
      [contractId]
    );
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
  }

  const delivery = await sendActionMessage({
    recipientEmail,
    senderEmail: recipient.role === 'president'
      ? (recipient.playerEmail || 'system@stage.com')
      : (clubContact.email || contract.club_owner_email || 'system@stage.com'),
    senderGamertag: recipient.role === 'president' ? playerName : (contract.club_name || 'Club Management'),
    senderAvatarUrl: recipient.role === 'president' ? '' : (contract.club_logo_url || ''),
    senderClubName: contract.club_name || '',
    subject,
    body,
    messageType: 'contract_offer',
    actionType: 'contract_negotiation',
    relatedEntityId: contractId,
    relatedEntityType: 'player_contract',
    idempotencyKey,
    notify: false,
    reuseByRelated: !isCounter,
    metadata: {
      contract_id: contractId,
      club_id: contract.team_id,
      club_name: contract.club_name,
      contract_type: contract.contract_type,
      ...(isCounter ? { negotiation_round: recipient.round } : {}),
    },
  });
  const inboxId = delivery.message.id;
  const notificationRelatedId = isCounter ? `${inboxId}:r${recipient.round}` : inboxId;
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
    relatedId: notificationRelatedId,
    idempotencyKey: `notification:${idempotencyKey}`,
  });
}

async function deliverLoanProposal(loan) {
  if (!loan?.id || !loan.parent_club_id) return;
  const parentContact = await resolveClubPresidentContact({ clubId: loan.parent_club_id });
  const recipientEmail = String(parentContact?.email || '').trim().toLowerCase();
  if (!recipientEmail) return;

  const players = await EXECUTESQL('SELECT gamertag, email FROM players WHERE id = ? LIMIT 1', [loan.player_id]).catch(() => []);
  const loanClubs = await EXECUTESQL('SELECT name, logo_url, owner_email FROM clubs WHERE id = ? LIMIT 1', [loan.loan_club_id]).catch(() => []);
  const playerName = players[0]?.gamertag || 'A player';
  const loanClub = loanClubs[0] || {};
  const clubName = loanClub.name || 'A club';
  const fee = Number(loan.loan_fee_stc || 0).toLocaleString();
  const purchaseLine = purchaseTermsLine(loan);
  const subject = `Loan offer for ${playerName}`;
  const body = [
    `${clubName} has requested a loan for ${playerName}.`,
    '',
    `Duration: ${loan.start_date || '—'} → ${loan.end_date || '—'}`,
    `Loan fee: ${fee} STC`,
    `Wage split: parent ${Number(loan.parent_wage_percentage || 0)}% / ${clubName} ${Number(loan.loan_wage_percentage || 0)}%`,
    ...(purchaseLine ? [purchaseLine] : []),
    '',
    'Accept or reject this proposal from your inbox. The player is asked only after you accept.',
  ].join('\n');

  const delivery = await sendActionMessage({
    recipientEmail,
    senderEmail: loanClub.owner_email || parentContact.email || 'system@stage.com',
    senderGamertag: clubName,
    senderAvatarUrl: loanClub.logo_url || '',
    senderClubName: clubName,
    subject,
    body,
    messageType: 'loan_proposal',
    actionType: 'loan_parent_response',
    relatedEntityId: loan.id,
    relatedEntityType: 'player_loan',
    idempotencyKey: `loan_proposal:player_loan:${loan.id}:${recipientEmail}`,
    notification: {
      type: 'loan_offer',
      title: subject,
      body: `${clubName} has requested a loan for ${playerName}.`,
    },
    metadata: {
      loan_id: loan.id,
      player_id: loan.player_id,
      parent_club_id: loan.parent_club_id,
      loan_club_id: loan.loan_club_id,
      player_name: playerName,
      loan_club_name: clubName,
      ...purchaseTermsMetadata(loan),
    },
  });
  return delivery;
}

async function deliverPlayerLoanOffer(loan) {
  if (!loan?.id || !loan.player_id) return;
  const players = await EXECUTESQL(
    'SELECT gamertag, email FROM players WHERE id = ? LIMIT 1',
    [loan.player_id]
  ).catch(() => []);
  const recipientEmail = String(players[0]?.email || '').trim().toLowerCase();
  if (!recipientEmail) return;

  const parentClubs = await EXECUTESQL('SELECT name, logo_url, owner_email FROM clubs WHERE id = ? LIMIT 1', [loan.parent_club_id]).catch(() => []);
  const loanClubs = await EXECUTESQL('SELECT name, logo_url, owner_email FROM clubs WHERE id = ? LIMIT 1', [loan.loan_club_id]).catch(() => []);
  const playerName = players[0]?.gamertag || 'Player';
  const parentClub = parentClubs[0] || {};
  const loanClub = loanClubs[0] || {};
  const parentName = parentClub.name || 'Parent club';
  const loanClubName = loanClub.name || 'Loan club';
  const fee = Number(loan.loan_fee_stc || 0).toLocaleString();
  const purchaseLine = purchaseTermsLine(loan);
  const subject = `Loan offer from ${loanClubName}`;
  const body = [
    `${loanClubName} and ${parentName} have agreed a loan for you.`,
    '',
    `From: ${parentName}`,
    `To: ${loanClubName}`,
    `Duration: ${loan.start_date || '—'} → ${loan.end_date || '—'}`,
    `Loan fee: ${fee} STC`,
    `Wage split: ${parentName} ${Number(loan.parent_wage_percentage || 0)}% / ${loanClubName} ${Number(loan.loan_wage_percentage || 0)}%`,
    ...(purchaseLine ? [purchaseLine] : []),
    '',
    'Accept or reject this loan from your inbox.',
  ].join('\n');

  return sendActionMessage({
    recipientEmail,
    senderEmail: loanClub.owner_email || parentClub.owner_email || 'system@stage.com',
    senderGamertag: loanClubName,
    senderAvatarUrl: loanClub.logo_url || '',
    senderClubName: loanClubName,
    subject,
    body,
    messageType: 'loan_proposal',
    actionType: 'loan_player_response',
    relatedEntityId: loan.id,
    relatedEntityType: 'player_loan',
    idempotencyKey: `loan_player_offer:player_loan:${loan.id}:${recipientEmail}`,
    notification: {
      type: 'loan_offer',
      title: subject,
      body: `${loanClubName} and ${parentName} have agreed a loan for you.`,
    },
    metadata: {
      loan_id: loan.id,
      player_id: loan.player_id,
      parent_club_id: loan.parent_club_id,
      loan_club_id: loan.loan_club_id,
      player_name: playerName,
      parent_club_name: parentName,
      loan_club_name: loanClubName,
      ...purchaseTermsMetadata(loan),
    },
  });
}

// Club B exercised its option to buy. The player is asked to accept the
// permanent deal; the loan stays ACTIVE until they do.
async function deliverLoanPurchaseOffer(loan) {
  if (!loan?.id || !loan.player_id) return;
  const players = await EXECUTESQL(
    'SELECT gamertag, email FROM players WHERE id = ? LIMIT 1',
    [loan.player_id]
  ).catch(() => []);
  const recipientEmail = String(players[0]?.email || '').trim().toLowerCase();
  if (!recipientEmail) return;

  const parentClubs = await EXECUTESQL('SELECT name, logo_url, owner_email FROM clubs WHERE id = ? LIMIT 1', [loan.parent_club_id]).catch(() => []);
  const loanClubs = await EXECUTESQL('SELECT name, logo_url, owner_email FROM clubs WHERE id = ? LIMIT 1', [loan.loan_club_id]).catch(() => []);
  const playerName = players[0]?.gamertag || 'Player';
  const parentClub = parentClubs[0] || {};
  const loanClub = loanClubs[0] || {};
  const parentName = parentClub.name || 'Parent club';
  const loanClubName = loanClub.name || 'Loan club';
  const price = formatMoney(loan.purchase_option_stc);
  const salary = formatMoney(loan.purchase_salary_stc);
  const days = Number(loan.purchase_contract_days || 0);
  const subject = `${loanClubName} wants to sign you permanently`;
  const body = [
    `${loanClubName} has exercised its option to buy you from ${parentName}.`,
    '',
    `Purchase fee: ${price} STC (paid to ${parentName})`,
    `Weekly salary: ${salary} STC`,
    days > 0 ? `Contract length: ${days} days` : `Contract length: the remainder of your current deal`,
    '',
    'Accept and you become a permanent player at ' + loanClubName + '. Reject and your loan continues as agreed.',
  ].join('\n');

  return sendActionMessage({
    recipientEmail,
    senderEmail: loanClub.owner_email || parentClub.owner_email || 'system@stage.com',
    senderGamertag: loanClubName,
    senderAvatarUrl: loanClub.logo_url || '',
    senderClubName: loanClubName,
    subject,
    body,
    messageType: 'loan_purchase',
    actionType: 'loan_purchase_response',
    relatedEntityId: loan.id,
    relatedEntityType: 'player_loan',
    idempotencyKey: `loan_purchase_offer:player_loan:${loan.id}:${recipientEmail}`,
    notification: {
      type: 'loan_offer',
      title: subject,
      body: `${loanClubName} has exercised its option to buy you from ${parentName}.`,
    },
    metadata: {
      loan_id: loan.id,
      player_id: loan.player_id,
      parent_club_id: loan.parent_club_id,
      loan_club_id: loan.loan_club_id,
      player_name: playerName,
      parent_club_name: parentName,
      loan_club_name: loanClubName,
      purchase_option_stc: Number(loan.purchase_option_stc || 0),
      purchase_salary_stc: Number(loan.purchase_salary_stc || 0),
      purchase_contract_days: days || null,
    },
  });
}

async function deliverLoanRecalled(loan) {
  if (!loan?.id) return;
  const players = await EXECUTESQL(
    'SELECT gamertag, email FROM players WHERE id = ? LIMIT 1',
    [loan.player_id]
  ).catch(() => []);
  const parentClubs = await EXECUTESQL('SELECT name, logo_url, owner_email FROM clubs WHERE id = ? LIMIT 1', [loan.parent_club_id]).catch(() => []);
  const loanClubs = await EXECUTESQL('SELECT name, logo_url, owner_email FROM clubs WHERE id = ? LIMIT 1', [loan.loan_club_id]).catch(() => []);
  const playerName = players[0]?.gamertag || 'A player';
  const parentClub = parentClubs[0] || {};
  const loanClub = loanClubs[0] || {};
  const parentName = parentClub.name || 'Parent club';
  const loanClubName = loanClub.name || 'Loan club';
  const subject = `${playerName} has been recalled`;
  const body = [
    `${parentName} has recalled ${playerName} from the loan at ${loanClubName}.`,
    '',
    'Playing rights have returned to the parent club. No response is required.',
  ].join('\n');
  const metadata = {
    loan_id: loan.id,
    player_id: loan.player_id,
    parent_club_id: loan.parent_club_id,
    loan_club_id: loan.loan_club_id,
    player_name: playerName,
    parent_club_name: parentName,
    loan_club_name: loanClubName,
  };

  const borrowerContact = await resolveClubPresidentContact({ clubId: loan.loan_club_id });
  const borrowerEmail = String(borrowerContact?.email || '').trim().toLowerCase();
  if (borrowerEmail) {
    await sendActionMessage({
      recipientEmail: borrowerEmail,
      senderEmail: parentClub.owner_email || 'system@stage.com',
      senderGamertag: parentName,
      senderAvatarUrl: parentClub.logo_url || '',
      senderClubName: parentName,
      subject,
      body,
      messageType: 'loan_recalled',
      actionType: 'none',
      relatedEntityId: loan.id,
      relatedEntityType: 'player_loan',
      idempotencyKey: `loan_recalled:player_loan:${loan.id}:${borrowerEmail}`,
      notification: {
        type: 'loan_offer',
        title: subject,
        body: `${parentName} has recalled ${playerName}.`,
      },
      metadata,
    });
  }

  const playerEmail = String(players[0]?.email || '').trim().toLowerCase();
  if (playerEmail) {
    await sendActionMessage({
      recipientEmail: playerEmail,
      senderEmail: parentClub.owner_email || 'system@stage.com',
      senderGamertag: parentName,
      senderAvatarUrl: parentClub.logo_url || '',
      senderClubName: parentName,
      subject,
      body,
      messageType: 'loan_recalled',
      actionType: 'none',
      relatedEntityId: loan.id,
      relatedEntityType: 'player_loan',
      idempotencyKey: `loan_recalled:player_loan:${loan.id}:${playerEmail}`,
      notification: {
        type: 'loan_offer',
        title: subject,
        body: `${parentName} has recalled you from ${loanClubName}.`,
      },
      metadata,
    });
  }
}

async function loanClubNames(loan) {
  const players = await EXECUTESQL(
    'SELECT gamertag, email FROM players WHERE id = ? LIMIT 1',
    [loan.player_id]
  ).catch(() => []);
  const parentClubs = await EXECUTESQL('SELECT name, logo_url, owner_email FROM clubs WHERE id = ? LIMIT 1', [loan.parent_club_id]).catch(() => []);
  const loanClubs = await EXECUTESQL('SELECT name, logo_url, owner_email FROM clubs WHERE id = ? LIMIT 1', [loan.loan_club_id]).catch(() => []);
  const parentClub = parentClubs[0] || {};
  const loanClub = loanClubs[0] || {};
  return {
    playerName: players[0]?.gamertag || 'A player',
    playerEmail: String(players[0]?.email || '').trim().toLowerCase(),
    parentClub,
    loanClub,
    parentName: parentClub.name || 'Parent club',
    loanClubName: loanClub.name || 'Loan club',
    metadata: {
      loan_id: loan.id,
      player_id: loan.player_id,
      parent_club_id: loan.parent_club_id,
      loan_club_id: loan.loan_club_id,
      player_name: players[0]?.gamertag || 'A player',
      parent_club_name: parentClub.name || 'Parent club',
      loan_club_name: loanClub.name || 'Loan club',
      early_end_proposed_by_club_id: loan.early_end_proposed_by_club_id || null,
    },
  };
}

async function deliverEarlyEndRequest(loan) {
  if (!loan?.id) return;
  const proposedBy = String(loan.early_end_proposed_by_club_id || '').trim();
  const otherClubId = proposedBy && proposedBy === String(loan.parent_club_id)
    ? loan.loan_club_id
    : loan.parent_club_id;
  const otherContact = await resolveClubPresidentContact({ clubId: otherClubId });
  const recipientEmail = String(otherContact?.email || '').trim().toLowerCase();
  if (!recipientEmail) return;

  const names = await loanClubNames(loan);
  const proposerIsParent = proposedBy === String(loan.parent_club_id);
  const proposerName = proposerIsParent ? names.parentName : names.loanClubName;
  const proposerClub = proposerIsParent ? names.parentClub : names.loanClub;
  const subject = `${proposerName} requested an early return`;
  const body = [
    `${proposerName} has asked to end the loan of ${names.playerName} early.`,
    '',
    `From: ${names.parentName}`,
    `To: ${names.loanClubName}`,
    '',
    'Accept to return playing rights to the parent club, or reject to keep the loan active.',
  ].join('\n');

  return sendActionMessage({
    recipientEmail,
    senderEmail: proposerClub.owner_email || 'system@stage.com',
    senderGamertag: proposerName,
    senderAvatarUrl: proposerClub.logo_url || '',
    senderClubName: proposerName,
    subject,
    body,
    messageType: 'loan_early_end',
    actionType: 'loan_early_end_response',
    relatedEntityId: loan.id,
    relatedEntityType: 'player_loan',
    idempotencyKey: `loan_early_end:player_loan:${loan.id}:${recipientEmail}`,
    notification: {
      type: 'loan_offer',
      title: subject,
      body: `${proposerName} requested an early return of ${names.playerName}.`,
    },
    metadata: names.metadata,
  });
}

async function deliverLoanTerminatedEarly(loan) {
  if (!loan?.id) return;
  const names = await loanClubNames(loan);
  const subject = `${names.playerName}'s loan ended early`;
  const body = [
    `${names.parentName} and ${names.loanClubName} have agreed to end the loan of ${names.playerName} early.`,
    '',
    'Playing rights have returned to the parent club. No response is required.',
  ].join('\n');
  const metadata = names.metadata;

  const recipients = [];
  const parentContact = await resolveClubPresidentContact({ clubId: loan.parent_club_id });
  const parentEmail = String(parentContact?.email || '').trim().toLowerCase();
  if (parentEmail) recipients.push({ email: parentEmail, club: names.parentClub, clubName: names.parentName });
  const borrowerContact = await resolveClubPresidentContact({ clubId: loan.loan_club_id });
  const borrowerEmail = String(borrowerContact?.email || '').trim().toLowerCase();
  if (borrowerEmail && borrowerEmail !== parentEmail) {
    recipients.push({ email: borrowerEmail, club: names.loanClub, clubName: names.loanClubName });
  }

  for (const recipient of recipients) {
    await sendActionMessage({
      recipientEmail: recipient.email,
      senderEmail: names.parentClub.owner_email || names.loanClub.owner_email || 'system@stage.com',
      senderGamertag: names.parentName,
      senderAvatarUrl: names.parentClub.logo_url || '',
      senderClubName: names.parentName,
      subject,
      body,
      messageType: 'loan_terminated_early',
      actionType: 'none',
      relatedEntityId: loan.id,
      relatedEntityType: 'player_loan',
      idempotencyKey: `loan_terminated_early:player_loan:${loan.id}:${recipient.email}`,
      notification: {
        type: 'loan_offer',
        title: subject,
        body: `${names.playerName}'s loan has ended early.`,
      },
      metadata,
    });
  }

  if (names.playerEmail) {
    await sendActionMessage({
      recipientEmail: names.playerEmail,
      senderEmail: names.parentClub.owner_email || 'system@stage.com',
      senderGamertag: names.parentName,
      senderAvatarUrl: names.parentClub.logo_url || '',
      senderClubName: names.parentName,
      subject,
      body,
      messageType: 'loan_terminated_early',
      actionType: 'none',
      relatedEntityId: loan.id,
      relatedEntityType: 'player_loan',
      idempotencyKey: `loan_terminated_early:player_loan:${loan.id}:${names.playerEmail}`,
      notification: {
        type: 'loan_offer',
        title: subject,
        body: `Your loan at ${names.loanClubName} has ended early.`,
      },
      metadata,
    });
  }
}

module.exports = {
  buildContractOfferIdempotencyKey,
  createNotificationIfEnabled,
  deliverContractOfferMessage,
  deliverLoanProposal,
  deliverPlayerLoanOffer,
  deliverLoanPurchaseOffer,
  deliverLoanRecalled,
  deliverEarlyEndRequest,
  deliverLoanTerminatedEarly,
  messageTypeToNotificationType,
  resolveContractOfferRecipient,
  sendActionMessage,
  liveChatChannelMeta,
  resolveLiveChatRecipientEmails,
  notifyLiveChatIfEnabled,
};
