const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadService(executesql, createNotificationIfEnabled) {
  const servicePath = path.resolve(__dirname, '../matchNotificationService.js');
  const deliveryPath = path.resolve(__dirname, '../messageDeliveryService.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  delete require.cache[servicePath];
  delete require.cache[deliveryPath];
  delete require.cache[dbPath];

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql },
  };
  require.cache[deliveryPath] = {
    id: deliveryPath,
    filename: deliveryPath,
    loaded: true,
    exports: {
      createNotificationIfEnabled: createNotificationIfEnabled || (async () => ({ success: true })),
    },
  };
  return require(servicePath);
}

const clubMatch = {
  id: 'match-1',
  mode: 'club',
  home_club_id: 'club-home',
  away_club_id: 'club-away',
  home_club_name: 'Home FC',
  away_club_name: 'Away FC',
  home_owner_email: 'owner-home@example.test',
  away_owner_email: null,
};

test('relatedIdForMatchEvent keeps kickoff distinct from schedule', () => {
  const service = loadService(async () => []);
  assert.equal(service.relatedIdForMatchEvent('match-1', 'kickoff'), 'match-1:kickoff');
  assert.equal(service.relatedIdForMatchEvent('match-1', 'scheduled'), 'match-1:scheduled');
  assert.equal(service.relatedIdForMatchEvent('match-1', 'result_requested'), 'match-1:result_requested');
});

test('resolveMatchSideEmails includes owner, player, and seated players', async () => {
  const service = loadService(async (sql, params = []) => {
    if (/SELECT email FROM players/.test(sql) && params.includes('player-away')) {
      return [{ email: 'away-player@example.test' }];
    }
    if (/SELECT email FROM players/.test(sql) && params.includes('seat-away')) {
      return [{ email: 'seated-away@example.test' }];
    }
    if (/SELECT owner_email FROM clubs/.test(sql) && params[0] === 'club-away') {
      return [{ owner_email: 'owner-away@example.test' }];
    }
    if (/FROM dressing_rooms/.test(sql)) {
      return [{ seated_players: JSON.stringify(['seat-away']) }];
    }
    return [];
  });

  const emails = await service.resolveMatchSideEmails({
    ...clubMatch,
    away_player_id: 'player-away',
  }, 'away');

  assert.deepEqual(emails.sort(), [
    'away-player@example.test',
    'owner-away@example.test',
    'seated-away@example.test',
  ]);
});

test('notifyMatchSide skips when no recipient can be resolved', async () => {
  const created = [];
  const service = loadService(async () => [], async (payload) => {
    created.push(payload);
    return { success: true };
  });

  const result = await service.notifyMatchSide({
    id: 'match-empty',
    mode: 'solo',
  }, 'home', 'match_result_requested', 'Your turn', 'Submit the score');

  assert.equal(result.skipped, true);
  assert.equal(created.length, 0);
});

test('notifyMatchKickoff notifies both sides with a kickoff related id', async () => {
  const created = [];
  const service = loadService(async () => [], async (payload) => {
    created.push(payload);
    return { success: true };
  });

  await service.notifyMatchKickoff({
    ...clubMatch,
    home_owner_email: 'owner-home@example.test',
    away_owner_email: 'owner-away@example.test',
  });

  assert.equal(created.length, 2);
  assert.deepEqual(created.map((row) => row.recipientEmail).sort(), [
    'owner-away@example.test',
    'owner-home@example.test',
  ]);
  assert.equal(created[0].type, 'match_reminder');
  assert.equal(created[0].title, 'Kickoff');
  assert.equal(created[0].relatedId, 'match-1:kickoff');
  assert.match(created[0].body, /Home FC vs Away FC is underway/);
});

test('notifyMatchSide uses a per-event related id for submit score', async () => {
  const created = [];
  const service = loadService(async () => [], async (payload) => {
    created.push(payload);
    return { success: true };
  });

  await service.notifyMatchSide(
    { ...clubMatch, away_owner_email: 'owner-away@example.test' },
    'away',
    'match_result_requested',
    'Result submitted - your turn',
    'Upload your screenshot.',
    'result_requested'
  );

  assert.equal(created.length, 1);
  assert.equal(created[0].recipientEmail, 'owner-away@example.test');
  assert.equal(created[0].type, 'match_result_requested');
  assert.equal(created[0].relatedId, 'match-1:result_requested');
});
