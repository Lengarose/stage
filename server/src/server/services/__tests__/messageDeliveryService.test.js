const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadMessageDeliveryServiceWithDbMock(executesql) {
  const servicePath = path.resolve(__dirname, '../messageDeliveryService.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  const socketPath = path.resolve(__dirname, '../../utils/socketBroadcast.js');
  const broadcasts = [];
  const inboxBroadcasts = [];

  delete require.cache[servicePath];
  delete require.cache[dbPath];
  delete require.cache[socketPath];

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql },
  };
  require.cache[socketPath] = {
    id: socketPath,
    filename: socketPath,
    loaded: true,
    exports: {
      broadcastNotification(payload) {
        broadcasts.push(payload);
      },
      broadcastInbox(payload) {
        inboxBroadcasts.push(payload);
      },
    },
  };

  return { service: require(servicePath), broadcasts, inboxBroadcasts };
}

test('messageTypeToNotificationType maps inbox messages to notification categories', () => {
  const { service } = loadMessageDeliveryServiceWithDbMock(async () => []);

  assert.equal(service.messageTypeToNotificationType('match_invite'), 'match_reminder');
  assert.equal(service.messageTypeToNotificationType('contract_offer'), 'contract_offer');
  assert.equal(service.messageTypeToNotificationType('club_invite'), 'club_update');
  assert.equal(service.messageTypeToNotificationType('announcement'), 'announcement');
  assert.equal(service.messageTypeToNotificationType('unknown'), 'message');
});

test('createNotificationIfEnabled reuses an existing related notification', async () => {
  const queries = [];
  const { service, broadcasts } = loadMessageDeliveryServiceWithDbMock(async (sql, params) => {
    queries.push({ sql, params });
    if (/FROM players WHERE LOWER\(email\)=LOWER\(\?\)/.test(sql)) return [{ notification_settings: '{}' }];
    if (/FROM notifications WHERE recipient_email = \? AND type = \? AND related_id = \?/.test(sql)) {
      return [{ id: 'notification-1' }];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  const result = await service.createNotificationIfEnabled({
    recipientEmail: 'player@example.test',
    type: 'contract_offer',
    title: 'Contract Offer',
    relatedId: 'contract-1',
  });

  assert.deepEqual(result, { success: true, id: 'notification-1', reused: true });
  assert.equal(broadcasts.length, 0);
  assert.equal(queries.length, 2);
});

test('deliverContractOfferMessage reuses existing inbox message and notification', async () => {
  const queries = [];
  const { service, broadcasts } = loadMessageDeliveryServiceWithDbMock(async (sql, params) => {
    queries.push({ sql, params });
    if (/FROM player_contracts pc/.test(sql)) {
      return [{
        id: 'contract-1',
        team_id: 'club-1',
        user_id: 'player-1',
        contract_type: 'star',
        max_games: 400,
        max_days: 180,
        weekly_salary_stc: 170000,
        signing_bonus_stc: 0,
        club_name: 'Longue Vie FC',
        club_logo_url: '/uploads/logo.png',
        club_owner_email: 'owner@example.test',
        player_email: 'player@example.test',
        user_email: 'player@example.test',
      }];
    }
    if (/FROM inbox_messages WHERE related_entity_id = \? AND message_type = 'contract_offer'/.test(sql)) {
      return [{ id: 'inbox-1', recipient_email: 'player@example.test' }];
    }
    if (/UPDATE inbox_messages/.test(sql)) return { affectedRows: 1 };
    if (/UPDATE notifications/.test(sql)) return { affectedRows: 1 };
    if (/FROM inbox_messages WHERE idempotency_key = \?/.test(sql)) return [{ id: 'inbox-1' }];
    if (/FROM players WHERE LOWER\(email\)=LOWER\(\?\)/.test(sql)) return [{ notification_settings: '{}' }];
    if (/FROM notifications WHERE idempotency_key = \?/.test(sql)) return [{ id: 'notification-1' }];
    if (/FROM notifications WHERE recipient_email = \? AND type = \? AND related_id = \?/.test(sql)) {
      return [{ id: 'notification-1' }];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  await service.deliverContractOfferMessage('contract-1');

  const inboxUpdates = queries.filter(({ sql }) => /UPDATE inbox_messages/.test(sql));
  const repairedInboxUpdate = inboxUpdates.find(({ sql }) => /action_type = \?/.test(sql));

  assert.ok(repairedInboxUpdate, 'existing inbox contract offer should be repaired with actionable fields');
  assert.equal(repairedInboxUpdate.params[5], 'Contract Offer from Longue Vie FC');
  assert.equal(repairedInboxUpdate.params[7], 'contract_offer');
  assert.equal(repairedInboxUpdate.params[8], 'contract_negotiation');
  assert.equal(repairedInboxUpdate.params[10], JSON.stringify({
    contract_id: 'contract-1',
    club_id: 'club-1',
    club_name: 'Longue Vie FC',
    contract_type: 'star',
  }));
  assert.equal(repairedInboxUpdate.params[11], 'contract-1');
  assert.equal(repairedInboxUpdate.params[12], 'player_contract');
  assert.equal(broadcasts.length, 0);
  assert.equal(queries.some(({ sql }) => /INSERT INTO inbox_messages/.test(sql)), false);
  assert.equal(queries.some(({ sql }) => /INSERT INTO notifications/.test(sql)), false);
});

test('deliverContractOfferMessage creates one inbox message and one related notification', async () => {
  const queries = [];
  const { service, broadcasts } = loadMessageDeliveryServiceWithDbMock(async (sql, params) => {
    queries.push({ sql, params });
    if (/FROM player_contracts pc/.test(sql)) {
      return [{
        id: 'contract-1',
        team_id: 'club-1',
        user_id: 'player-1',
        contract_type: 'star',
        max_games: 400,
        max_days: 180,
        weekly_salary_stc: 170000,
        signing_bonus_stc: 5000,
        offer_note: 'Welcome.',
        club_name: 'Longue Vie FC',
        club_logo_url: '/uploads/logo.png',
        club_owner_email: 'owner@example.test',
        player_email: 'player@example.test',
        user_email: 'player@example.test',
      }];
    }
    if (/FROM inbox_messages WHERE related_entity_id = \? AND message_type = 'contract_offer'/.test(sql)) {
      return [];
    }
    if (/FROM inbox_messages WHERE idempotency_key = \?/.test(sql)) return [];
    if (/FROM inbox_messages\s+WHERE recipient_email = \?/.test(sql)) return [];
    if (/FROM inbox_messages WHERE id = \? LIMIT 1/.test(sql)) {
      return [{
        id: params[0],
        recipient_email: 'player@example.test',
        subject: 'Contract Offer from Longue Vie FC',
        message_type: 'contract_offer',
        status: 'pending',
        is_read: 0,
      }];
    }
    if (/FROM players WHERE LOWER\(email\)=LOWER\(\?\)/.test(sql)) return [{ notification_settings: '{}' }];
    if (/FROM notifications WHERE idempotency_key = \?/.test(sql)) return [];
    if (/FROM notifications WHERE recipient_email = \? AND type = \? AND related_id = \?/.test(sql)) {
      return [];
    }
    if (/INSERT INTO inbox_messages/.test(sql)) return { affectedRows: 1 };
    if (/INSERT INTO notifications/.test(sql)) return { affectedRows: 1 };
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  await service.deliverContractOfferMessage('contract-1');

  const inboxInserts = queries.filter(({ sql }) => /INSERT INTO inbox_messages/.test(sql));
  const notificationInserts = queries.filter(({ sql }) => /INSERT INTO notifications/.test(sql));
  const notificationLookup = queries.find(({ sql }) => /FROM notifications WHERE recipient_email = \? AND type = \? AND related_id = \?/.test(sql));

  assert.equal(inboxInserts.length, 1);
  assert.equal(notificationInserts.length, 1);
  assert.equal(inboxInserts[0].params.at(-1), 'contract_offer:player_contract:contract-1:player@example.test');
  assert.deepEqual(notificationLookup.params, ['player@example.test', 'contract_offer', notificationInserts[0].params[7]]);
  assert.equal(notificationInserts[0].params[6], `/inbox?id=${notificationInserts[0].params[7]}`);
  assert.equal(notificationInserts[0].params.at(-1), 'notification:contract_offer:player_contract:contract-1:player@example.test');
  assert.equal(broadcasts.length, 1);
  assert.equal(broadcasts[0].link, `/inbox?id=${broadcasts[0].related_id}`);
});

test('sendActionMessage creates an actionable inbox and links notification to that inbox', async () => {
  const queries = [];
  const { service, broadcasts, inboxBroadcasts } = loadMessageDeliveryServiceWithDbMock(async (sql, params) => {
    queries.push({ sql, params });
    if (/FROM inbox_messages WHERE idempotency_key = \?/.test(sql)) return [];
    if (/FROM inbox_messages\s+WHERE recipient_email = \?/.test(sql)) return [];
    if (/INSERT INTO inbox_messages/.test(sql)) return { affectedRows: 1 };
    if (/FROM inbox_messages WHERE id = \? LIMIT 1/.test(sql)) {
      return [{
        id: params[0],
        recipient_email: 'player@example.test',
        subject: 'Trial Request',
        message_type: 'trial_request',
        status: 'pending',
        is_read: 0,
      }];
    }
    if (/FROM players WHERE LOWER\(email\)=LOWER\(\?\)/.test(sql)) return [{ notification_settings: '{}' }];
    if (/FROM notifications WHERE idempotency_key = \?/.test(sql)) return [];
    if (/FROM notifications WHERE recipient_email = \? AND type = \? AND related_id = \?/.test(sql)) return [];
    if (/INSERT INTO notifications/.test(sql)) return { affectedRows: 1 };
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  const result = await service.sendActionMessage({
    recipientEmail: 'player@example.test',
    senderEmail: 'owner@example.test',
    subject: 'Trial Request',
    body: 'Please respond.',
    messageType: 'trial_request',
    actionType: 'trial_response',
    relatedEntityId: 'trial-1',
    relatedEntityType: 'trial_request',
    idempotencyKey: 'trial_request:trial-1:player@example.test',
    notification: {
      type: 'club_update',
      title: 'New trial request',
      body: 'Open your inbox to respond.',
    },
  });

  const inboxInsert = queries.find(({ sql }) => /INSERT INTO inbox_messages/.test(sql));
  const notificationInsert = queries.find(({ sql }) => /INSERT INTO notifications/.test(sql));

  assert.equal(result.success, true);
  assert.equal(result.message.reused, false);
  assert.match(inboxInsert.sql, /idempotency_key/);
  assert.equal(inboxInsert.params.at(-1), 'trial_request:trial-1:player@example.test');
  assert.match(notificationInsert.sql, /idempotency_key/);
  assert.equal(notificationInsert.params[6], `/inbox?id=${result.message.id}`);
  assert.equal(notificationInsert.params[7], result.message.id);
  assert.equal(notificationInsert.params.at(-1), 'notification:trial_request:trial-1:player@example.test');
  assert.equal(inboxBroadcasts.length, 1);
  assert.equal(broadcasts.length, 1);
  assert.equal(broadcasts[0].link, `/inbox?id=${result.message.id}`);
});

test('sendActionMessage derives idempotency from related entity when key is omitted', async () => {
  const queries = [];
  const { service } = loadMessageDeliveryServiceWithDbMock(async (sql, params) => {
    queries.push({ sql, params });
    if (/FROM inbox_messages WHERE idempotency_key = \?/.test(sql)) return [];
    if (/FROM inbox_messages\s+WHERE recipient_email = \?/.test(sql)) return [];
    if (/INSERT INTO inbox_messages/.test(sql)) return { affectedRows: 1 };
    if (/FROM inbox_messages WHERE id = \? LIMIT 1/.test(sql)) return [];
    if (/FROM players WHERE LOWER\(email\)=LOWER\(\?\)/.test(sql)) return [{ notification_settings: '{}' }];
    if (/FROM notifications WHERE idempotency_key = \?/.test(sql)) return [];
    if (/FROM notifications WHERE recipient_email = \? AND type = \? AND related_id = \?/.test(sql)) return [];
    if (/INSERT INTO notifications/.test(sql)) return { affectedRows: 1 };
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  await service.sendActionMessage({
    recipientEmail: 'PLAYER@example.test',
    subject: 'Trial Request',
    body: 'Please respond.',
    messageType: 'trial_request',
    actionType: 'trial_response',
    relatedEntityId: 'trial-1',
    relatedEntityType: 'trial_request',
  });

  const inboxInsert = queries.find(({ sql }) => /INSERT INTO inbox_messages/.test(sql));

  assert.equal(inboxInsert.params.at(-1), 'trial_request:trial_request:trial-1:player@example.test');
});

test('sendActionMessage rejects messages without an idempotency source', async () => {
  const { service } = loadMessageDeliveryServiceWithDbMock(async () => []);

  await assert.rejects(
    service.sendActionMessage({
      recipientEmail: 'player@example.test',
      subject: 'Loose Action',
      body: 'Please respond.',
      messageType: 'general',
    }),
    /requires idempotencyKey or relatedEntityId/
  );
});

test('sendActionMessage can skip related-entity reuse for distinct action proposals', async () => {
  const queries = [];
  const { service } = loadMessageDeliveryServiceWithDbMock(async (sql, params) => {
    queries.push({ sql, params });
    if (/FROM inbox_messages WHERE idempotency_key = \?/.test(sql)) return [];
    if (/INSERT INTO inbox_messages/.test(sql)) return { affectedRows: 1 };
    if (/FROM inbox_messages WHERE id = \? LIMIT 1/.test(sql)) return [];
    if (/FROM players WHERE LOWER\(email\)=LOWER\(\?\)/.test(sql)) return [{ notification_settings: '{}' }];
    if (/FROM notifications WHERE idempotency_key = \?/.test(sql)) return [];
    if (/FROM notifications WHERE recipient_email = \? AND type = \? AND related_id = \?/.test(sql)) return [];
    if (/INSERT INTO notifications/.test(sql)) return { affectedRows: 1 };
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  await service.sendActionMessage({
    recipientEmail: 'player@example.test',
    subject: 'Reschedule Proposal',
    body: 'New proposed date.',
    messageType: 'match_invite',
    actionType: 'accept_decline_date',
    relatedEntityId: 'match-1',
    relatedEntityType: 'match',
    idempotencyKey: 'match_reschedule:message-1:2026-06-02:21:30',
    reuseByRelated: false,
  });

  assert.equal(queries.some(({ sql }) => /FROM inbox_messages\s+WHERE recipient_email = \?/.test(sql)), false);
  assert.equal(queries.some(({ sql }) => /INSERT INTO inbox_messages/.test(sql)), true);
});

test('sendActionMessage repairs a missing notification when reusing an existing inbox', async () => {
  const queries = [];
  const { service, broadcasts, inboxBroadcasts } = loadMessageDeliveryServiceWithDbMock(async (sql, params) => {
    queries.push({ sql, params });
    if (/FROM inbox_messages WHERE idempotency_key = \?/.test(sql)) return [{ id: 'inbox-1' }];
    if (/UPDATE inbox_messages/.test(sql)) return { affectedRows: 1 };
    if (/FROM inbox_messages WHERE id = \? LIMIT 1/.test(sql)) {
      return [{
        id: params[0],
        recipient_email: 'player@example.test',
        subject: 'Match Invite',
        message_type: 'match_invite',
        action_type: 'match_invite_response',
        status: 'pending',
        is_read: 0,
      }];
    }
    if (/FROM players WHERE LOWER\(email\)=LOWER\(\?\)/.test(sql)) return [{ notification_settings: '{}' }];
    if (/FROM notifications WHERE idempotency_key = \?/.test(sql)) return [];
    if (/FROM notifications WHERE recipient_email = \? AND type = \? AND related_id = \?/.test(sql)) return [];
    if (/INSERT INTO notifications/.test(sql)) return { affectedRows: 1 };
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  const result = await service.sendActionMessage({
    recipientEmail: 'PLAYER@example.test',
    subject: 'Match Invite',
    body: 'Please respond.',
    messageType: 'match_invite',
    actionType: 'match_invite_response',
    idempotencyKey: 'match_invite:fixture-1:player@example.test',
  });

  const notificationInsert = queries.find(({ sql }) => /INSERT INTO notifications/.test(sql));

  assert.equal(result.success, true);
  assert.equal(result.message.reused, true);
  assert.equal(queries.some(({ sql }) => /INSERT INTO inbox_messages/.test(sql)), false);
  assert.equal(notificationInsert.params[6], '/inbox?id=inbox-1');
  assert.equal(notificationInsert.params[7], 'inbox-1');
  assert.equal(notificationInsert.params.at(-1), 'notification:match_invite:fixture-1:player@example.test');
  assert.equal(inboxBroadcasts.length, 1);
  assert.equal(inboxBroadcasts[0].id, 'inbox-1');
  assert.equal(broadcasts.length, 1);
});
