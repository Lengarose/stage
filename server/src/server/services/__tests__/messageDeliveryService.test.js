const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadMessageDeliveryServiceWithDbMock(executesql) {
  const servicePath = path.resolve(__dirname, '../messageDeliveryService.js');
  const clubContactPath = path.resolve(__dirname, '../clubContactService.js');
  const oneSignalPath = path.resolve(__dirname, '../oneSignalService.js');
  const notificationsPath = path.resolve(__dirname, '../notifications.js');
  const preferencePath = path.resolve(__dirname, '../notificationPreferenceService.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  const socketPath = path.resolve(__dirname, '../../utils/socketBroadcast.js');
  const broadcasts = [];
  const inboxBroadcasts = [];
  const pushes = [];
  const emails = [];

  delete require.cache[servicePath];
  delete require.cache[clubContactPath];
  delete require.cache[oneSignalPath];
  delete require.cache[notificationsPath];
  delete require.cache[preferencePath];
  delete require.cache[dbPath];
  delete require.cache[socketPath];

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql },
  };
  require.cache[oneSignalPath] = {
    id: oneSignalPath,
    filename: oneSignalPath,
    loaded: true,
    exports: {
      queueOneSignalPush(payload) {
        pushes.push(payload);
      },
    },
  };
  require.cache[notificationsPath] = {
    id: notificationsPath,
    filename: notificationsPath,
    loaded: true,
    exports: {
      sendEventEmail(payload) {
        emails.push(payload);
      },
      notifySignup() {},
      notifyAnnouncement() {},
    },
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

  return { service: require(servicePath), broadcasts, inboxBroadcasts, pushes, emails };
}

test('messageTypeToNotificationType maps inbox messages to notification categories', () => {
  const { service } = loadMessageDeliveryServiceWithDbMock(async () => []);

  assert.equal(service.messageTypeToNotificationType('match_invite'), 'match_reminder');
  assert.equal(service.messageTypeToNotificationType('contract_offer'), 'contract_offer');
  assert.equal(service.messageTypeToNotificationType('loan_proposal'), 'loan_offer');
  assert.equal(service.messageTypeToNotificationType('loan_recalled'), 'loan_offer');
  assert.equal(service.messageTypeToNotificationType('loan_early_end'), 'loan_offer');
  assert.equal(service.messageTypeToNotificationType('loan_terminated_early'), 'loan_offer');
  assert.equal(service.messageTypeToNotificationType('club_invite'), 'club_update');
  assert.equal(service.messageTypeToNotificationType('announcement'), 'announcement');
  assert.equal(service.messageTypeToNotificationType('unknown'), 'message');
});

test('deliverPlayerLoanOffer names both clubs, dates, fee, and wage split for the player', async () => {
  const queries = [];
  const { service } = loadMessageDeliveryServiceWithDbMock(async (sql, params) => {
    queries.push({ sql, params });
    if (/FROM players WHERE id = \?/.test(sql)) {
      return [{ gamertag: 'Player X', email: 'player@example.test' }];
    }
    if (/FROM clubs WHERE id = \?/.test(sql)) {
      if (params[0] === 'club-a') return [{ name: 'Club A', logo_url: '', owner_email: 'a@example.test' }];
      if (params[0] === 'club-b') return [{ name: 'Club B', logo_url: '', owner_email: 'b@example.test' }];
      return [];
    }
    if (/FROM inbox_messages WHERE idempotency_key = \?/.test(sql)) return [];
    if (/FROM inbox_messages\s+WHERE recipient_email = \?/.test(sql)) return [];
    if (/FROM inbox_messages WHERE id = \? LIMIT 1/.test(sql)) {
      return [{
        id: params[0],
        recipient_email: 'player@example.test',
        subject: 'Loan offer from Club B',
        message_type: 'loan_proposal',
        action_type: 'loan_player_response',
        status: 'pending',
        is_read: 0,
      }];
    }
    if (/FROM players WHERE LOWER\(email\)=LOWER\(\?\)/.test(sql)) return [{ notification_settings: '{}' }];
    if (/FROM notifications WHERE idempotency_key = \?/.test(sql)) return [];
    if (/FROM notifications WHERE recipient_email = \? AND type = \? AND related_id = \?/.test(sql)) return [];
    if (/INSERT INTO inbox_messages/.test(sql)) return { affectedRows: 1 };
    if (/INSERT INTO notifications/.test(sql)) return { affectedRows: 1 };
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  await service.deliverPlayerLoanOffer({
    id: 'loan-1',
    player_id: 'player-1',
    parent_club_id: 'club-a',
    loan_club_id: 'club-b',
    start_date: '2027-01-01',
    end_date: '2027-06-30',
    loan_fee_stc: 25000,
    parent_wage_percentage: 30,
    loan_wage_percentage: 70,
  });

  const inboxInsert = queries.find(({ sql }) => /INSERT INTO inbox_messages/.test(sql));
  assert.equal(inboxInsert.params[1], 'player@example.test');
  assert.match(String(inboxInsert.params[7]), /Club B and Club A have agreed a loan/);
  assert.match(String(inboxInsert.params[7]), /2027-01-01/);
  assert.match(String(inboxInsert.params[7]), /2027-06-30/);
  assert.match(String(inboxInsert.params[7]), /25,000 STC/);
  assert.match(String(inboxInsert.params[7]), /Club A 30%/);
  assert.match(String(inboxInsert.params[7]), /Club B 70%/);
  assert.equal(inboxInsert.params[8], 'loan_proposal');
  assert.equal(inboxInsert.params[9], 'loan_player_response');
  assert.equal(inboxInsert.params.at(-1), 'loan_player_offer:player_loan:loan-1:player@example.test');
});

test('deliverPlayerLoanOffer includes option-to-buy type and price when purchase terms are not none', async () => {
  const queries = [];
  const { service } = loadMessageDeliveryServiceWithDbMock(async (sql, params) => {
    queries.push({ sql, params });
    if (/FROM players WHERE id = \?/.test(sql)) {
      return [{ gamertag: 'Player X', email: 'player@example.test' }];
    }
    if (/FROM clubs WHERE id = \?/.test(sql)) {
      if (params[0] === 'club-a') return [{ name: 'Club A', logo_url: '', owner_email: 'a@example.test' }];
      if (params[0] === 'club-b') return [{ name: 'Club B', logo_url: '', owner_email: 'b@example.test' }];
      return [];
    }
    if (/FROM inbox_messages WHERE idempotency_key = \?/.test(sql)) return [];
    if (/FROM inbox_messages\s+WHERE recipient_email = \?/.test(sql)) return [];
    if (/FROM inbox_messages WHERE id = \? LIMIT 1/.test(sql)) {
      return [{
        id: params[0],
        recipient_email: 'player@example.test',
        subject: 'Loan offer from Club B',
        message_type: 'loan_proposal',
        action_type: 'loan_player_response',
        status: 'pending',
        is_read: 0,
      }];
    }
    if (/FROM players WHERE LOWER\(email\)=LOWER\(\?\)/.test(sql)) return [{ notification_settings: '{}' }];
    if (/FROM notifications WHERE idempotency_key = \?/.test(sql)) return [];
    if (/FROM notifications WHERE recipient_email = \? AND type = \? AND related_id = \?/.test(sql)) return [];
    if (/INSERT INTO inbox_messages/.test(sql)) return { affectedRows: 1 };
    if (/INSERT INTO notifications/.test(sql)) return { affectedRows: 1 };
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  await service.deliverPlayerLoanOffer({
    id: 'loan-1',
    player_id: 'player-1',
    parent_club_id: 'club-a',
    loan_club_id: 'club-b',
    start_date: '2027-01-01',
    end_date: '2027-06-30',
    loan_fee_stc: 25000,
    parent_wage_percentage: 30,
    loan_wage_percentage: 70,
    purchase_type: 'OPTIONAL',
    purchase_option_stc: 100000,
    purchase_option_deadline: '2027-05-01',
  });

  const inboxInsert = queries.find(({ sql }) => /INSERT INTO inbox_messages/.test(sql));
  assert.match(String(inboxInsert.params[7]), /Option to buy: 100,000 STC/);
  const metadata = JSON.parse(inboxInsert.params[11]);
  assert.equal(metadata.purchase_type, 'OPTIONAL');
  assert.equal(Number(metadata.purchase_option_stc), 100000);
});

test('deliverLoanRecalled notifies the borrower president and the player without an accept step', async () => {
  const queries = [];
  const { service } = loadMessageDeliveryServiceWithDbMock(async (sql, params) => {
    queries.push({ sql, params });
    if (/FROM clubs c/.test(sql)) {
      if (params[0] === 'club-b') {
        return [{
          id: 'club-b',
          name: 'Club B',
          logo_url: '',
          owner_email: 'b@example.test',
          president_user_email: 'b-president@example.test',
        }];
      }
      return [];
    }
    if (/FROM players WHERE id = \?/.test(sql)) {
      return [{ gamertag: 'Player X', email: 'player@example.test' }];
    }
    if (/FROM clubs WHERE id = \?/.test(sql)) {
      if (params[0] === 'club-a') return [{ name: 'Club A', logo_url: '', owner_email: 'a@example.test' }];
      if (params[0] === 'club-b') return [{ name: 'Club B', logo_url: '', owner_email: 'b@example.test' }];
      return [];
    }
    if (/FROM inbox_messages WHERE idempotency_key = \?/.test(sql)) return [];
    if (/FROM inbox_messages\s+WHERE recipient_email = \?/.test(sql)) return [];
    if (/FROM inbox_messages WHERE id = \? LIMIT 1/.test(sql)) {
      return [{
        id: params[0],
        recipient_email: 'player@example.test',
        subject: 'Loan recalled',
        message_type: 'loan_recalled',
        action_type: 'none',
        status: 'pending',
        is_read: 0,
      }];
    }
    if (/FROM players WHERE LOWER\(email\)=LOWER\(\?\)/.test(sql)) return [{ notification_settings: '{}' }];
    if (/FROM notifications WHERE idempotency_key = \?/.test(sql)) return [];
    if (/FROM notifications WHERE recipient_email = \? AND type = \? AND related_id = \?/.test(sql)) return [];
    if (/INSERT INTO inbox_messages/.test(sql)) return { affectedRows: 1 };
    if (/INSERT INTO notifications/.test(sql)) return { affectedRows: 1 };
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  await service.deliverLoanRecalled({
    id: 'loan-1',
    player_id: 'player-1',
    parent_club_id: 'club-a',
    loan_club_id: 'club-b',
    status: 'RECALLED',
  });

  const inboxInserts = queries.filter(({ sql }) => /INSERT INTO inbox_messages/.test(sql));
  assert.equal(inboxInserts.length, 2);
  const recipients = inboxInserts.map(({ params }) => params[1]).sort();
  assert.deepEqual(recipients, ['b-president@example.test', 'player@example.test']);
  for (const insert of inboxInserts) {
    assert.equal(insert.params[8], 'loan_recalled');
    assert.equal(insert.params[9], 'none');
    assert.match(String(insert.params[7]), /recalled/i);
  }
});

test('deliverEarlyEndRequest notifies the other club president with accept and reject', async () => {
  const queries = [];
  const { service } = loadMessageDeliveryServiceWithDbMock(async (sql, params) => {
    queries.push({ sql, params });
    if (/FROM clubs c/.test(sql)) {
      if (params[0] === 'club-b') {
        return [{
          id: 'club-b',
          name: 'Club B',
          logo_url: '',
          owner_email: 'b@example.test',
          president_user_email: 'b-president@example.test',
        }];
      }
      return [];
    }
    if (/FROM players WHERE id = \?/.test(sql)) {
      return [{ gamertag: 'Player X', email: 'player@example.test' }];
    }
    if (/FROM clubs WHERE id = \?/.test(sql)) {
      if (params[0] === 'club-a') return [{ name: 'Club A', logo_url: '', owner_email: 'a@example.test' }];
      if (params[0] === 'club-b') return [{ name: 'Club B', logo_url: '', owner_email: 'b@example.test' }];
      return [];
    }
    if (/FROM inbox_messages WHERE idempotency_key = \?/.test(sql)) return [];
    if (/FROM inbox_messages\s+WHERE recipient_email = \?/.test(sql)) return [];
    if (/FROM inbox_messages WHERE id = \? LIMIT 1/.test(sql)) {
      return [{
        id: params[0],
        recipient_email: 'b-president@example.test',
        subject: 'Early loan return requested',
        message_type: 'loan_early_end',
        action_type: 'loan_early_end_response',
        status: 'pending',
        is_read: 0,
      }];
    }
    if (/FROM players WHERE LOWER\(email\)=LOWER\(\?\)/.test(sql)) return [{ notification_settings: '{}' }];
    if (/FROM notifications WHERE idempotency_key = \?/.test(sql)) return [];
    if (/FROM notifications WHERE recipient_email = \? AND type = \? AND related_id = \?/.test(sql)) return [];
    if (/INSERT INTO inbox_messages/.test(sql)) return { affectedRows: 1 };
    if (/INSERT INTO notifications/.test(sql)) return { affectedRows: 1 };
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  await service.deliverEarlyEndRequest({
    id: 'loan-1',
    player_id: 'player-1',
    parent_club_id: 'club-a',
    loan_club_id: 'club-b',
    status: 'ACTIVE',
    early_end_proposed_by_club_id: 'club-a',
  });

  const inboxInserts = queries.filter(({ sql }) => /INSERT INTO inbox_messages/.test(sql));
  assert.equal(inboxInserts.length, 1);
  assert.equal(inboxInserts[0].params[1], 'b-president@example.test');
  assert.equal(inboxInserts[0].params[8], 'loan_early_end');
  assert.equal(inboxInserts[0].params[9], 'loan_early_end_response');
  assert.match(String(inboxInserts[0].params[7]), /return|early/i);
});

test('deliverLoanTerminatedEarly notifies both clubs and the player without an accept step', async () => {
  const queries = [];
  const { service } = loadMessageDeliveryServiceWithDbMock(async (sql, params) => {
    queries.push({ sql, params });
    if (/FROM clubs c/.test(sql)) {
      if (params[0] === 'club-a') {
        return [{
          id: 'club-a',
          name: 'Club A',
          logo_url: '',
          owner_email: 'a@example.test',
          president_user_email: 'a-president@example.test',
        }];
      }
      if (params[0] === 'club-b') {
        return [{
          id: 'club-b',
          name: 'Club B',
          logo_url: '',
          owner_email: 'b@example.test',
          president_user_email: 'b-president@example.test',
        }];
      }
      return [];
    }
    if (/FROM players WHERE id = \?/.test(sql)) {
      return [{ gamertag: 'Player X', email: 'player@example.test' }];
    }
    if (/FROM clubs WHERE id = \?/.test(sql)) {
      if (params[0] === 'club-a') return [{ name: 'Club A', logo_url: '', owner_email: 'a@example.test' }];
      if (params[0] === 'club-b') return [{ name: 'Club B', logo_url: '', owner_email: 'b@example.test' }];
      return [];
    }
    if (/FROM inbox_messages WHERE idempotency_key = \?/.test(sql)) return [];
    if (/FROM inbox_messages\s+WHERE recipient_email = \?/.test(sql)) return [];
    if (/FROM inbox_messages WHERE id = \? LIMIT 1/.test(sql)) {
      return [{
        id: params[0],
        recipient_email: 'player@example.test',
        subject: 'Loan ended early',
        message_type: 'loan_terminated_early',
        action_type: 'none',
        status: 'pending',
        is_read: 0,
      }];
    }
    if (/FROM players WHERE LOWER\(email\)=LOWER\(\?\)/.test(sql)) return [{ notification_settings: '{}' }];
    if (/FROM notifications WHERE idempotency_key = \?/.test(sql)) return [];
    if (/FROM notifications WHERE recipient_email = \? AND type = \? AND related_id = \?/.test(sql)) return [];
    if (/INSERT INTO inbox_messages/.test(sql)) return { affectedRows: 1 };
    if (/INSERT INTO notifications/.test(sql)) return { affectedRows: 1 };
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  await service.deliverLoanTerminatedEarly({
    id: 'loan-1',
    player_id: 'player-1',
    parent_club_id: 'club-a',
    loan_club_id: 'club-b',
    status: 'TERMINATED_EARLY',
  });

  const inboxInserts = queries.filter(({ sql }) => /INSERT INTO inbox_messages/.test(sql));
  assert.equal(inboxInserts.length, 3);
  const recipients = inboxInserts.map(({ params }) => params[1]).sort();
  assert.deepEqual(recipients, [
    'a-president@example.test',
    'b-president@example.test',
    'player@example.test',
  ]);
  for (const insert of inboxInserts) {
    assert.equal(insert.params[8], 'loan_terminated_early');
    assert.equal(insert.params[9], 'none');
  }
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

test('createNotificationIfEnabled emails when the Email switch is on', async () => {
  const { service, emails, broadcasts, pushes } = loadMessageDeliveryServiceWithDbMock(async (sql) => {
    if (/FROM players WHERE LOWER\(email\)=LOWER\(\?\)/.test(sql)) {
      return [{ notification_settings: JSON.stringify({ email: { contract_offers: true } }) }];
    }
    if (/FROM notifications WHERE recipient_email = \? AND type = \? AND related_id = \?/.test(sql)) return [];
    if (/INSERT INTO notifications/.test(sql)) return { affectedRows: 1 };
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  const result = await service.createNotificationIfEnabled({
    recipientEmail: 'player@example.test',
    type: 'contract_offer',
    title: 'New contract offer',
    body: 'Longue Vie FC sent you an offer.',
    link: '/inbox',
    relatedId: 'contract-1',
  });

  assert.equal(result.email, true);
  assert.equal(broadcasts.length, 1);
  assert.equal(pushes.length, 1);
  assert.equal(emails.length, 1);
  assert.equal(emails[0].to, 'player@example.test');
  assert.equal(emails[0].title, 'New contract offer');
  assert.equal(emails[0].url, '/inbox');
});

test('createNotificationIfEnabled skips email when the Email switch is off', async () => {
  const { service, emails, broadcasts } = loadMessageDeliveryServiceWithDbMock(async (sql) => {
    if (/FROM players WHERE LOWER\(email\)=LOWER\(\?\)/.test(sql)) {
      return [{ notification_settings: JSON.stringify({ email: { contract_offers: false } }) }];
    }
    if (/FROM notifications WHERE recipient_email = \? AND type = \? AND related_id = \?/.test(sql)) return [];
    if (/INSERT INTO notifications/.test(sql)) return { affectedRows: 1 };
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  const result = await service.createNotificationIfEnabled({
    recipientEmail: 'player@example.test',
    type: 'contract_offer',
    title: 'New contract offer',
    relatedId: 'contract-1',
  });

  assert.equal(result.email, false);
  assert.equal(broadcasts.length, 1);
  assert.equal(emails.length, 0);
});

test('createNotificationIfEnabled can email without in-app or push', async () => {
  const { service, emails, broadcasts, pushes } = loadMessageDeliveryServiceWithDbMock(async (sql) => {
    if (/FROM players WHERE LOWER\(email\)=LOWER\(\?\)/.test(sql)) {
      return [{
        notification_settings: JSON.stringify({
          web: { club_updates: false },
          mobile: { club_updates: false },
          push: { club_updates: false },
          email: { club_updates: true },
        }),
      }];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  const result = await service.createNotificationIfEnabled({
    recipientEmail: 'player@example.test',
    type: 'club_update',
    title: 'Club news',
    body: 'Training at 8.',
    link: '/clubs/club-1',
  });

  assert.equal(result.email, true);
  assert.equal(result.inApp, false);
  assert.equal(result.push, false);
  assert.equal(broadcasts.length, 0);
  assert.equal(pushes.length, 0);
  assert.equal(emails.length, 1);
  assert.equal(emails[0].to, 'player@example.test');
});

test('createNotificationIfEnabled does not email unmapped types', async () => {
  const { service, emails, broadcasts } = loadMessageDeliveryServiceWithDbMock(async (sql) => {
    if (/FROM players WHERE LOWER\(email\)=LOWER\(\?\)/.test(sql)) return [{ notification_settings: '{}' }];
    if (/INSERT INTO notifications/.test(sql)) return { affectedRows: 1 };
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  const result = await service.createNotificationIfEnabled({
    recipientEmail: 'player@example.test',
    type: 'post_like',
    title: 'Someone liked your post',
  });

  assert.equal(result.email, false);
  assert.equal(broadcasts.length, 1);
  assert.equal(emails.length, 0);
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
    if (/FROM clubs c/.test(sql)) {
      return [{
        id: 'club-1',
        name: 'Longue Vie FC',
        owner_email: 'owner@example.test',
        president_user_email: null,
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
    if (/FROM clubs c/.test(sql)) {
      return [{
        id: 'club-1',
        name: 'Longue Vie FC',
        owner_email: 'owner@example.test',
        president_user_email: null,
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

test('deliverContractOfferMessage uses president contact and president wording for ownership contracts', async () => {
  const queries = [];
  const { service } = loadMessageDeliveryServiceWithDbMock(async (sql, params) => {
    queries.push({ sql, params });
    if (/FROM player_contracts pc/.test(sql)) {
      return [{
        id: 'contract-president',
        team_id: 'club-1',
        user_id: 'player-1',
        contract_type: 'ownership',
        max_games: 999,
        max_days: 3650,
        weekly_salary_stc: 0,
        signing_bonus_stc: 0,
        club_name: 'President FC',
        club_logo_url: '/uploads/logo.png',
        club_owner_email: 'legacy-owner@example.test',
        player_email: 'player@example.test',
        user_email: 'player@example.test',
      }];
    }
    if (/FROM clubs c/.test(sql)) {
      return [{
        id: 'club-1',
        name: 'President FC',
        president_user_id: 'president-user',
        owner_email: 'legacy-owner@example.test',
        president_user_email: 'president@example.test',
      }];
    }
    if (/FROM inbox_messages WHERE related_entity_id = \? AND message_type = 'contract_offer'/.test(sql)) return [];
    if (/FROM inbox_messages WHERE idempotency_key = \?/.test(sql)) return [];
    if (/FROM inbox_messages\s+WHERE recipient_email = \?/.test(sql)) return [];
    if (/FROM inbox_messages WHERE id = \? LIMIT 1/.test(sql)) return [{ id: params[0], recipient_email: 'player@example.test' }];
    if (/FROM players WHERE LOWER\(email\)=LOWER\(\?\)/.test(sql)) return [{ notification_settings: '{}' }];
    if (/FROM notifications WHERE idempotency_key = \?/.test(sql)) return [];
    if (/FROM notifications WHERE recipient_email = \? AND type = \? AND related_id = \?/.test(sql)) return [];
    if (/INSERT INTO inbox_messages/.test(sql)) return { affectedRows: 1 };
    if (/INSERT INTO notifications/.test(sql)) return { affectedRows: 1 };
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  await service.deliverContractOfferMessage('contract-president');

  const inboxInsert = queries.find(({ sql }) => /INSERT INTO inbox_messages/.test(sql));
  const notificationInsert = queries.find(({ sql }) => /INSERT INTO notifications/.test(sql));

  assert.equal(inboxInsert.params[2], 'president@example.test');
  assert.match(inboxInsert.params[7], /president contract offer/);
  assert.match(notificationInsert.params[4], /president contract offer/);
});

test('deliverContractOfferMessage sends player counters to the president with a new round notification', async () => {
  const queries = [];
  const { service } = loadMessageDeliveryServiceWithDbMock(async (sql, params) => {
    queries.push({ sql, params });
    if (/FROM player_contracts pc/.test(sql)) {
      return [{
        id: 'contract-1',
        team_id: 'club-1',
        user_id: 'player-1',
        target_player_id: 'player-1',
        last_negotiated_by: 'player-1',
        negotiation_round: 1,
        contract_type: 'important',
        max_games: 250,
        max_days: 120,
        weekly_salary_stc: 22500,
        signing_bonus_stc: 50000,
        performance_targets: [{ stat: 'goals', type: 'min', value: 10 }],
        club_name: 'Longue Vie FC',
        club_logo_url: '/uploads/logo.png',
        club_owner_email: 'owner@example.test',
        player_email: 'player@example.test',
        player_gamertag: 'Callmeddz',
        user_email: 'player@example.test',
      }];
    }
    if (/FROM clubs c/.test(sql)) {
      return [{
        id: 'club-1',
        name: 'Longue Vie FC',
        owner_email: 'owner@example.test',
        president_user_email: 'president@example.test',
      }];
    }
    if (/FROM inbox_messages WHERE idempotency_key = \?/.test(sql)) return [];
    if (/FROM inbox_messages\s+WHERE recipient_email = \?/.test(sql)) return [];
    if (/FROM inbox_messages WHERE id = \? LIMIT 1/.test(sql)) {
      return [{
        id: params[0],
        recipient_email: 'president@example.test',
        subject: 'Counter-Offer from Callmeddz',
        message_type: 'contract_offer',
        status: 'pending',
        is_read: 0,
      }];
    }
    if (/FROM players WHERE LOWER\(email\)=LOWER\(\?\)/.test(sql)) return [{ notification_settings: '{}' }];
    if (/FROM notifications WHERE idempotency_key = \?/.test(sql)) return [];
    if (/FROM notifications WHERE recipient_email = \? AND type = \? AND related_id = \?/.test(sql)) return [];
    if (/INSERT INTO inbox_messages/.test(sql)) return { affectedRows: 1 };
    if (/INSERT INTO notifications/.test(sql)) return { affectedRows: 1 };
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  await service.deliverContractOfferMessage('contract-1');

  const inboxInsert = queries.find(({ sql }) => /INSERT INTO inbox_messages/.test(sql));
  const notificationInsert = queries.find(({ sql }) => /INSERT INTO notifications/.test(sql));

  assert.equal(inboxInsert.params[1], 'president@example.test');
  assert.equal(inboxInsert.params[6], 'Counter-Offer from Callmeddz');
  assert.match(inboxInsert.params[7], /Callmeddz sent a counter-offer \(Round 1\)/);
  assert.match(inboxInsert.params[7], /22,500/);
  assert.match(inboxInsert.params[7], /50,000/);
  assert.equal(inboxInsert.params.at(-1), 'contract_offer:player_contract:contract-1:president@example.test:r1');
  assert.equal(notificationInsert.params[1], 'president@example.test');
  assert.equal(notificationInsert.params.at(-1), 'notification:contract_offer:player_contract:contract-1:president@example.test:r1');
  assert.ok(!queries.some(({ sql }) => /FROM inbox_messages WHERE related_entity_id = \? AND message_type = 'contract_offer'/.test(sql)));
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

function liveChatSqlMock({
  settingsByEmail = {},
  unreadByEmail = {},
  match = null,
  squadByClub = {},
  ownerByClub = {},
  playersById = {},
} = {}) {
  return async (sql, params = []) => {
    if (/SELECT email FROM players WHERE club_id = \?/.test(sql)) {
      return squadByClub[params[0]] || [];
    }
    if (/SELECT owner_email FROM clubs WHERE id = \?/.test(sql)) {
      return ownerByClub[params[0]] || [];
    }
    if (/FROM matches WHERE id = \?/.test(sql)) {
      return match ? [match] : [];
    }
    if (/SELECT email FROM players WHERE id IN/.test(sql)) {
      return params.flatMap((id) => playersById[id] || []);
    }
    if (/SELECT email FROM players WHERE club_id IN/.test(sql)) {
      return params.flatMap((id) => squadByClub[id] || []);
    }
    if (/SELECT notification_settings FROM players WHERE LOWER\(email\)=LOWER\(\?\)/.test(sql)) {
      const email = String(params[0] || '').toLowerCase();
      const settings = settingsByEmail[email];
      if (settings === undefined) return [{ notification_settings: '{}' }];
      return [{ notification_settings: typeof settings === 'string' ? settings : JSON.stringify(settings) }];
    }
    if (/FROM notifications WHERE recipient_email = \? AND type = \? AND related_id = \? AND `read` = 0/.test(sql)) {
      const id = unreadByEmail[params[0]];
      return id ? [{ id }] : [];
    }
    if (/UPDATE notifications SET title = \?/.test(sql)) return { affectedRows: 1 };
    if (/INSERT INTO notifications/.test(sql)) return { affectedRows: 1 };
    throw new Error(`Unexpected SQL: ${sql}`);
  };
}

test('liveChatChannelMeta distinguishes club chat from match chat', () => {
  const { service } = loadMessageDeliveryServiceWithDbMock(async () => []);

  assert.deepEqual(service.liveChatChannelMeta({ match_id: 'club:club-1' }), {
    channelId: 'club:club-1',
    kind: 'club',
    clubId: 'club-1',
    link: '/clubs/club-1',
    titleSuffix: 'club chat',
  });
  assert.deepEqual(service.liveChatChannelMeta({ match_id: 'match-1' }), {
    channelId: 'match-1',
    kind: 'match',
    matchId: 'match-1',
    link: '/game-day?match=match-1',
    titleSuffix: 'match chat',
  });
});

test('resolveLiveChatRecipientEmails skips the sender for club and match channels', async () => {
  const clubMock = liveChatSqlMock({
    squadByClub: {
      'club-1': [{ email: 'alice@example.test' }, { email: 'bob@example.test' }],
    },
    ownerByClub: {
      'club-1': [{ owner_email: 'owner@example.test' }],
    },
  });
  const { service: clubService } = loadMessageDeliveryServiceWithDbMock(clubMock);
  const clubRecipients = await clubService.resolveLiveChatRecipientEmails({
    match_id: 'club:club-1',
    sender_email: 'ALICE@example.test',
  });
  assert.deepEqual(clubRecipients.sort(), ['bob@example.test', 'owner@example.test']);

  const matchMock = liveChatSqlMock({
    match: {
      home_player_email: 'home@example.test',
      away_player_email: 'away@example.test',
      home_owner_email: 'home-owner@example.test',
      away_owner_email: null,
      home_player_id: 'p-home',
      away_player_id: null,
      home_club_id: 'club-home',
      away_club_id: null,
    },
    playersById: {
      'p-home': [{ email: 'home@example.test' }],
    },
    squadByClub: {
      'club-home': [{ email: 'squad@example.test' }, { email: 'home@example.test' }],
    },
  });
  const { service: matchService } = loadMessageDeliveryServiceWithDbMock(matchMock);
  const matchRecipients = await matchService.resolveLiveChatRecipientEmails({
    match_id: 'match-1',
    sender_email: 'home@example.test',
  });
  assert.deepEqual(matchRecipients.sort(), [
    'away@example.test',
    'home-owner@example.test',
    'squad@example.test',
  ]);
});

test('notifyLiveChatIfEnabled skips recipients who turned Messages off', async () => {
  const queries = [];
  const { service, broadcasts, pushes } = loadMessageDeliveryServiceWithDbMock(async (sql, params) => {
    queries.push({ sql, params });
    return liveChatSqlMock({
      squadByClub: {
        'club-1': [{ email: 'bob@example.test' }],
      },
      settingsByEmail: {
        'bob@example.test': { messages: false },
      },
    })(sql, params);
  });

  const result = await service.notifyLiveChatIfEnabled({
    match_id: 'club:club-1',
    sender_email: 'alice@example.test',
    sender_name: 'Alice',
    content: 'Hello club',
  });

  assert.equal(result.notified, 0);
  assert.equal(result.results[0].skipped, true);
  assert.equal(result.results[0].reason, 'disabled in settings');
  assert.equal(queries.some(({ sql }) => /INSERT INTO notifications/.test(sql)), false);
  assert.equal(broadcasts.length, 0);
  assert.equal(pushes.length, 0);
});

test('notifyLiveChatIfEnabled notifies when Messages is unset and collapses unread rows', async () => {
  const queries = [];
  const { service, broadcasts, pushes, emails } = loadMessageDeliveryServiceWithDbMock(async (sql, params) => {
    queries.push({ sql, params });
    return liveChatSqlMock({
      squadByClub: {
        'club-1': [{ email: 'bob@example.test' }],
      },
      settingsByEmail: {
        'bob@example.test': {},
      },
    })(sql, params);
  });

  const created = await service.notifyLiveChatIfEnabled({
    match_id: 'club:club-1',
    sender_email: 'alice@example.test',
    sender_name: 'Alice',
    content: 'First club line',
  });

  const insert = queries.find(({ sql }) => /INSERT INTO notifications/.test(sql));
  assert.equal(created.notified, 1);
  assert.equal(insert.params[1], 'bob@example.test');
  assert.equal(insert.params[2], 'message');
  assert.match(String(insert.params[3]), /club chat/);
  assert.equal(insert.params[7], 'live_chat:club:club-1');
  assert.equal(broadcasts.length, 1);
  assert.equal(pushes.length, 1);
  assert.equal(pushes[0].recipientEmail, 'bob@example.test');
  assert.equal(pushes[0].type, 'message');
  assert.equal(emails.length, 1);
  assert.equal(emails[0].to, 'bob@example.test');

  const unreadQueries = [];
  const unread = loadMessageDeliveryServiceWithDbMock(async (sql, params) => {
    unreadQueries.push({ sql, params });
    return liveChatSqlMock({
      squadByClub: {
        'club-1': [{ email: 'bob@example.test' }],
      },
      unreadByEmail: {
        'bob@example.test': 'notif-1',
      },
    })(sql, params);
  });

  const reused = await unread.service.notifyLiveChatIfEnabled({
    match_id: 'club:club-1',
    sender_email: 'alice@example.test',
    sender_name: 'Alice',
    content: 'Second club line',
  });

  assert.equal(reused.notified, 1);
  assert.equal(reused.results[0].reused, true);
  assert.equal(unreadQueries.some(({ sql }) => /INSERT INTO notifications/.test(sql)), false);
  assert.equal(unreadQueries.some(({ sql }) => /UPDATE notifications SET title = \?/.test(sql)), true);
  assert.equal(unread.broadcasts.length, 1);
  assert.equal(unread.pushes.length, 1);
  assert.equal(unread.broadcasts[0].id, 'notif-1');
  assert.match(String(unread.broadcasts[0].body), /Second club line/);
  assert.equal(unread.emails.length, 0);
});

test('notifyLiveChatIfEnabled can keep in-app on while skipping push', async () => {
  const { service, broadcasts, pushes } = loadMessageDeliveryServiceWithDbMock(async (sql, params) => liveChatSqlMock({
    squadByClub: {
      'club-1': [{ email: 'bob@example.test' }],
    },
    settingsByEmail: {
      'bob@example.test': {
        web: { messages: true },
        mobile: { messages: false },
        push: { messages: false },
        email: { messages: false },
      },
    },
  })(sql, params));

  const result = await service.notifyLiveChatIfEnabled({
    match_id: 'club:club-1',
    sender_email: 'alice@example.test',
    sender_name: 'Alice',
    content: 'In-app only',
  });

  assert.equal(result.notified, 1);
  assert.equal(result.results[0].push, false);
  assert.equal(broadcasts.length, 1);
  assert.equal(pushes.length, 0);
});
