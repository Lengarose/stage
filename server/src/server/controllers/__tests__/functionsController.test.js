const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadFunctionsRouterWithDbMock(executesql, options = {}) {
  const controllerPath = path.resolve(__dirname, '../functionsController.js');
  const legacyFunctionsPath = path.resolve(__dirname, '../../functions/legacyFunctions.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  const identityServicePath = path.resolve(__dirname, '../../services/identityService.js');
  const messageDeliveryServicePath = path.resolve(__dirname, '../../services/messageDeliveryService.js');
  const servicePath = path.resolve(__dirname, '../../services/competitionEngineService.js');
  const matchModelPath = path.resolve(__dirname, '../../models/matchModel.js');
  const socketPath = path.resolve(__dirname, '../../utils/socketBroadcast.js');

  delete require.cache[controllerPath];
  delete require.cache[legacyFunctionsPath];
  delete require.cache[identityServicePath];
  delete require.cache[messageDeliveryServicePath];
  delete require.cache[servicePath];
  delete require.cache[matchModelPath];
  delete require.cache[socketPath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql, pool: options.pool || {} },
  };
  require.cache[servicePath] = {
    id: servicePath,
    filename: servicePath,
    loaded: true,
    exports: {
      notifyIfPhaseReady: async () => ({ notified: false }),
      syncMatchResultToSource: async () => ({ synced: false }),
      ...options.serviceMock,
    },
  };
  require.cache[socketPath] = {
    id: socketPath,
    filename: socketPath,
    loaded: true,
    exports: {
      broadcastMatch() {},
      broadcastMatchById() {},
      broadcastNotification() {},
      broadcastInbox() {},
      broadcastMatchPlayerStat() {},
    },
  };

  return require(controllerPath);
}

function postFunctionHandler(router) {
  const layer = router.stack.find((entry) => entry.route?.path === '/:name');
  return layer.route.stack[0].handle;
}

test('playerWallet get_balance resolves player linked by users.player_id', async () => {
  const player = { id: 'player-1', email: 'player@example.test', stc: 1234 };
  const contractLookups = [];
  const executesql = async (sql, params) => {
    if (/FROM users WHERE id = \?/.test(sql)) {
      return [{ id: params[0], email: player.email, player_id: player.id, owner_id: null }];
    }
    if (/FROM players WHERE id = \?/.test(sql)) return [player];
    if (/FROM players WHERE user_id = \?/.test(sql)) return [];
    if (/FROM clubs WHERE/.test(sql)) return [];
    if (/FROM player_contracts/.test(sql)) {
      contractLookups.push({ sql, params });
      return [];
    }
    if (/FROM player_stc_transactions/.test(sql)) return [];
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadFunctionsRouterWithDbMock(executesql);
  const handle = postFunctionHandler(router);
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };

  await handle(
    { params: { name: 'playerWallet' }, body: { action: 'get_balance' }, user: { id: 'user-1' } },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.balance, 1234);
  assert.equal(contractLookups[0].params[0], 'player-1');
  assert.match(contractLookups[0].sql, /target_player_id/);
});

test('regionalLeagueFixtureResult processes fixture and standings on the server', async () => {
  const updates = [];
  const auditRows = [];
  const queries = [];
  const fixture = {
    id: 'fixture-1',
    entity_type: 'regional_league_fixture',
    status: 'scheduled',
    data_json: JSON.stringify({
      id: 'fixture-1',
      league_id: 'league-1',
      home_club_id: 'club-home',
      away_club_id: 'club-away',
      home_club_name: 'Home FC',
      away_club_name: 'Away FC',
      status: 'scheduled',
      stats_processed: false,
    }),
  };
  const standings = [
    {
      id: 'standing-home',
      entity_type: 'regional_league_standing',
      league_id: 'league-1',
      club_id: 'club-home',
      data_json: JSON.stringify({
        id: 'standing-home',
        league_id: 'league-1',
        club_id: 'club-home',
        club_name: 'Home FC',
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals_for: 0,
        goals_against: 0,
        goal_difference: 0,
        points: 0,
        position: 1,
      }),
    },
    {
      id: 'standing-away',
      entity_type: 'regional_league_standing',
      league_id: 'league-1',
      club_id: 'club-away',
      data_json: JSON.stringify({
        id: 'standing-away',
        league_id: 'league-1',
        club_id: 'club-away',
        club_name: 'Away FC',
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals_for: 0,
        goals_against: 0,
        goal_difference: 0,
        points: 0,
        position: 2,
      }),
    },
  ];
  const conn = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async query(sql, params = []) {
      queries.push({ sql, params });
      if (/SELECT \* FROM league_entities\s+WHERE id = \? AND entity_type = 'regional_league_fixture'/.test(sql)) {
        return [[fixture], []];
      }
      if (/entity_type = 'regional_league_standing'\s+AND league_id = \?\s+AND club_id IN/.test(sql)) {
        return [standings, []];
      }
      if (/entity_type = 'regional_league_standing' AND league_id = \?/.test(sql)) {
        return [standings, []];
      }
      if (/UPDATE league_entities SET/.test(sql)) {
        updates.push({ sql, params });
        return [{ affectedRows: 1 }, []];
      }
      throw new Error(`Unexpected transaction SQL: ${sql}`);
    },
  };
  const executesql = async (sql, params = []) => {
    if (/SELECT id, email, role_id FROM users WHERE id = \?/.test(sql)) {
      return [{ id: params[0], email: 'admin@example.test', role_id: 0 }];
    }
    if (/INSERT INTO admin_audit_log/.test(sql)) {
      auditRows.push(params);
      return { affectedRows: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadFunctionsRouterWithDbMock(executesql, {
    pool: { promise: () => ({ getConnection: async () => conn }) },
  });
  const handle = postFunctionHandler(router);
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };

  await handle(
    {
      params: { name: 'regionalLeagueFixtureResult' },
      body: { fixture_id: 'fixture-1', home_score: 2, away_score: 1 },
      user: { id: 'admin-1' },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.success, true);
  assert.equal(auditRows.length, 1);
  assert.equal(queries.some(q => /FOR UPDATE/.test(q.sql)), true);
  const fixtureUpdate = updates.find(update => update.params.includes('regional_league_fixture'));
  assert.ok(fixtureUpdate);
  assert.equal(fixtureUpdate.params[1], 'played');
  const homeStandingUpdate = updates.find(update => update.params.includes('standing-home'));
  assert.ok(homeStandingUpdate);
  const homeStandingPayload = JSON.parse(homeStandingUpdate.params[0]);
  assert.equal(homeStandingPayload.played, 1);
  assert.equal(homeStandingPayload.wins, 1);
  assert.equal(homeStandingPayload.points, 3);
});

test('createMatchFromLeagueFixture creates match snapshots and links fixture server-side', async () => {
  const inserts = [];
  const fixtureUpdates = [];
  const fixture = {
    id: 'fixture-1',
    entity_type: 'competition_fixture',
    data_json: JSON.stringify({
      id: 'fixture-1',
      season_id: 'season-1',
      competition_id: 'competition-1',
      competition_name: 'Elite League',
      phase: 'league',
      matchday: 3,
      home_club_id: 'club-home',
      home_club_name: 'Home Snapshot',
      away_club_id: 'club-away',
      away_club_name: 'Away Snapshot',
      confirmed_date: '2026-06-01T20:00:00.000Z',
      status: 'scheduled',
    }),
  };
  const executesql = async (sql, params = []) => {
    if (/FROM league_entities\s+WHERE id = \? AND entity_type = \?/.test(sql)) return [fixture];
    if (/SELECT \* FROM matches WHERE id = \? LIMIT 1/.test(sql)) {
      if (!inserts.length) return [];
      return [{
        id: inserts[0][0],
        home_club_id: 'club-home',
        away_club_id: 'club-away',
        home_club_name: 'Home Snapshot',
        away_club_name: 'Away Snapshot',
        home_owner_email: 'home-owner@example.test',
        away_owner_email: 'away-owner@example.test',
        source_fixture_id: 'fixture-1',
        source_fixture_type: 'competition',
      }];
    }
    if (/FROM matches\s+WHERE source_fixture_id = \? AND source_fixture_type = \?/.test(sql)) return [];
    if (/SELECT id, name, owner_email FROM clubs WHERE id IN/.test(sql)) {
      return [
        { id: 'club-home', name: 'Home DB', owner_email: 'home-owner@example.test' },
        { id: 'club-away', name: 'Away DB', owner_email: 'away-owner@example.test' },
      ];
    }
    if (/INSERT INTO matches/.test(sql)) {
      inserts.push(params);
      return { affectedRows: 1 };
    }
    if (/UPDATE league_entities SET/.test(sql)) {
      fixtureUpdates.push(params);
      return { affectedRows: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadFunctionsRouterWithDbMock(executesql);
  const handle = postFunctionHandler(router);
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };

  await handle(
    {
      params: { name: 'createMatchFromLeagueFixture' },
      body: { fixture_id: 'fixture-1', fixture_type: 'competition' },
      user: { id: 'user-1' },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.success, true);
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0][1], null);
  assert.equal(inserts[0][6], 'home-owner@example.test');
  assert.equal(inserts[0][7], 'away-owner@example.test');
  assert.equal(inserts[0][57], 'fixture-1');
  assert.equal(inserts[0][58], 'competition');
  assert.equal(fixtureUpdates.length, 1);
  const linkedFixture = JSON.parse(fixtureUpdates[0][0]);
  assert.equal(linkedFixture.match_id, inserts[0][0]);
});

test('syncCompletedMatchToSource delegates completed match sync to service', async () => {
  let syncedMatch = null;
  const executesql = async (sql, params = []) => {
    if (/SELECT \* FROM matches WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: params[0], status: 'completed', source_fixture_id: 'fixture-1' }];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadFunctionsRouterWithDbMock(executesql, {
    serviceMock: {
      syncMatchResultToSource: async (match) => {
        syncedMatch = match;
        return { synced: true };
      },
    },
  });
  const handle = postFunctionHandler(router);
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };

  await handle(
    { params: { name: 'syncCompletedMatchToSource' }, body: { match_id: 'match-1' }, user: { id: 'user-1' } },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.synced, true);
  assert.equal(syncedMatch.id, 'match-1');
});

test('respondInboxMessage creates invite match with player email snapshots server-side', async () => {
  const inserts = [];
  const responseMessages = [];
  const inboxUpdates = [];
  const message = {
    id: 'message-1',
    recipient_email: 'away@example.test',
    sender_email: 'home@example.test',
    message_type: 'match_invite',
    subject: 'Ranked invite',
    related_entity_id: null,
    metadata: JSON.stringify({
      invitation_type: 'player_vs_player',
      challenger_player_id: 'player-home',
      opponent_player_id: 'player-away',
      challenger_name: 'HomeTag',
      opponent_name: 'AwayTag',
      scheduled_date: '2026-06-01T20:00:00.000Z',
    }),
  };
  const executesql = async (sql, params = []) => {
    if (/FROM users WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: params[0], email: 'away@example.test', player_id: 'player-away', owner_id: null }];
    }
    if (/SELECT \* FROM players WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: 'player-away', email: 'away@example.test', gamertag: 'AwayTag', club_id: null }];
    }
    if (/SELECT \* FROM players WHERE user_id = \? LIMIT 1/.test(sql)) return [];
    if (/SELECT \* FROM clubs WHERE/.test(sql)) return [];
    if (/SELECT \* FROM inbox_messages WHERE id = \? LIMIT 1/.test(sql)) return [message];
    if (/UPDATE inbox_messages SET status = \?/.test(sql)) {
      inboxUpdates.push({ sql, params });
      return { affectedRows: 1 };
    }
    if (/SELECT id, gamertag, email FROM players WHERE id IN/.test(sql)) {
      return [
        { id: 'player-home', gamertag: 'HomeTag', email: 'home-player@example.test' },
        { id: 'player-away', gamertag: 'AwayTag', email: 'away-player@example.test' },
      ];
    }
    if (/INSERT INTO matches/.test(sql)) {
      inserts.push(params);
      return { affectedRows: 1 };
    }
    if (/INSERT INTO inbox_messages/.test(sql)) {
      responseMessages.push(params);
      return { affectedRows: 1 };
    }
    if (/UPDATE inbox_messages SET related_entity_id = \?/.test(sql)) {
      inboxUpdates.push({ sql, params });
      return { affectedRows: 1 };
    }
    if (/SELECT id, gamertag, avatar_url, club_id FROM players WHERE LOWER\(email\)=LOWER\(\?\)/.test(sql)) {
      return [{ id: 'player-away', gamertag: 'AwayTag', avatar_url: 'away.png', club_id: null }];
    }
    if (/SELECT notification_settings FROM players/.test(sql)) return [];
    if (/SELECT id FROM notifications/.test(sql) && /related_id = \?/.test(sql)) return [];
    if (/INSERT INTO notifications/.test(sql)) return { affectedRows: 1 };
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadFunctionsRouterWithDbMock(executesql);
  const handle = postFunctionHandler(router);
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };

  await handle(
    { params: { name: 'respondInboxMessage' }, body: { message_id: 'message-1', action: 'accepted' }, user: { id: 'user-away' } },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0][2], null);
  assert.equal(inserts[0][3], null);
  assert.equal(inserts[0][8], 'player-home');
  assert.equal(inserts[0][10], 'home-player@example.test');
  assert.equal(inserts[0][11], 'player-away');
  assert.equal(inserts[0][13], 'away-player@example.test');
  assert.equal(responseMessages.length, 1);
  assert.equal(responseMessages[0][1], 'home@example.test');
  assert.equal(responseMessages[0][8], 'match_invite_response');
  assert.equal(responseMessages[0][12], inserts[0][0]);
  assert.equal(inboxUpdates.some(update => /related_entity_id/.test(update.sql)), true);
});

test('sendInboxMessage reuses an existing contract offer message', async () => {
  const inboxInserts = [];
  const inboxUpdates = [];
  const notificationInserts = [];
  const existingMessage = {
    id: 'message-existing',
    recipient_email: 'player@example.test',
    related_entity_id: 'contract-1',
    message_type: 'contract_offer',
  };
  let existingLookupCount = 0;
  const executesql = async (sql, params = []) => {
    if (/COALESCE\(NULLIF\(TRIM\(p.email\)/.test(sql)) {
      return [{ email: 'player@example.test' }];
    }
    if (/SELECT id, gamertag, avatar_url, club_id FROM players WHERE LOWER\(email\)=LOWER\(\?\)/.test(sql)) {
      return [{ id: 'sender-player', gamertag: 'SenderTag', avatar_url: 'sender.png', club_id: 'club-1' }];
    }
    if (/SELECT name FROM clubs WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ name: 'Sender FC' }];
    }
    if (/SELECT id, recipient_email FROM inbox_messages/.test(sql) && /related_entity_id = \?/.test(sql)) {
      existingLookupCount += 1;
      return existingLookupCount === 1 ? [] : [existingMessage];
    }
    if (/INSERT INTO inbox_messages/.test(sql)) {
      inboxInserts.push(params);
      return { affectedRows: 1 };
    }
    if (/UPDATE inbox_messages/.test(sql)) {
      inboxUpdates.push({ sql, params });
      return { affectedRows: 1 };
    }
    if (/SELECT notification_settings FROM players/.test(sql)) return [];
    if (/SELECT id FROM notifications/.test(sql) && /related_id = \?/.test(sql)) return [];
    if (/INSERT INTO notifications/.test(sql)) {
      notificationInserts.push(params);
      return { affectedRows: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadFunctionsRouterWithDbMock(executesql);
  const handle = postFunctionHandler(router);
  const makeResponse = () => ({
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  });
  const body = {
    recipient_player_id: 'player-1',
    sender_email: 'sender@example.test',
    subject: 'Contract Offer from Sender FC',
    body: 'Sender FC has sent you a squad contract offer.',
    message_type: 'contract_offer',
    action_type: 'contract_negotiation',
    related_entity_id: 'contract-1',
    related_entity_type: 'player_contract',
    metadata: { contract_id: 'contract-1' },
    send_notification: true,
  };

  const firstResponse = makeResponse();
  await handle({ params: { name: 'sendInboxMessage' }, body, user: { id: 'user-1' } }, firstResponse);
  const secondResponse = makeResponse();
  await handle({ params: { name: 'sendInboxMessage' }, body, user: { id: 'user-1' } }, secondResponse);

  assert.equal(firstResponse.statusCode, 200);
  assert.equal(secondResponse.statusCode, 200);
  assert.equal(inboxInserts.length, 1);
  assert.equal(inboxUpdates.length, 1);
  assert.equal(notificationInserts.length, 1);
  assert.equal(secondResponse.body.message.id, 'message-existing');
});

test('contractActions offer stores duration metadata for market offers', async () => {
  const contractInserts = [];
  const notificationLookups = [];
  const notificationInserts = [];
  const inboxUpdates = [];
  const notificationUpdates = [];
  let createdContractId = null;
  const executesql = async (sql, params = []) => {
    if (/FROM users WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: 'owner-user', email: 'owner@example.test', player_id: 'owner-player', owner_id: 'club-1' }];
    }
    if (/SELECT \* FROM players WHERE id = \? LIMIT 1/.test(sql) && params[0] === 'owner-player') {
      return [{ id: 'owner-player', email: 'owner@example.test', club_id: 'club-1' }];
    }
    if (/SELECT \* FROM clubs WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: 'club-1', owner_email: 'owner@example.test' }];
    }
    if (/CREATE TABLE IF NOT EXISTS transfer_windows/.test(sql)) return { affectedRows: 0 };
    if (/SELECT \* FROM transfer_windows WHERE status = 'open'/.test(sql)) return [];
    if (/INSERT INTO player_contracts/.test(sql)) {
      createdContractId = params[0];
      contractInserts.push({ sql, params });
      return { affectedRows: 1 };
    }
    if (/SELECT pc\.\*, pc\.user_id AS target_player_id/.test(sql)) {
      return [{
        id: createdContractId,
        team_id: 'club-1',
        user_id: 'target-player',
        contract_type: 'star',
        max_games: 400,
        max_days: 180,
        weekly_salary_stc: 170000,
        club_name: 'Club One',
        club_owner_email: 'owner@example.test',
        player_email: 'target@example.test',
      }];
    }
    if (/SELECT id, recipient_email FROM inbox_messages/.test(sql) && /related_entity_id = \?/.test(sql)) {
      return [{ id: 'message-existing', recipient_email: 'target@example.test' }];
    }
    if (/UPDATE inbox_messages/.test(sql)) {
      inboxUpdates.push(params);
      return { affectedRows: 1 };
    }
    if (/UPDATE notifications/.test(sql)) {
      notificationUpdates.push(params);
      return { affectedRows: 1 };
    }
    if (/SELECT id FROM inbox_messages WHERE idempotency_key = \?/.test(sql)) {
      return [{ id: 'message-existing' }];
    }
    if (/SELECT notification_settings FROM players/.test(sql)) return [];
    if (/SELECT id FROM notifications WHERE idempotency_key = \?/.test(sql)) {
      notificationLookups.push(params);
      return [{ id: 'notification-existing' }];
    }
    if (/SELECT id FROM notifications/.test(sql) && /related_id = \?/.test(sql)) {
      notificationLookups.push(params);
      return [{ id: 'notification-existing' }];
    }
    if (/INSERT INTO notifications/.test(sql)) {
      notificationInserts.push(params);
      return { affectedRows: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadFunctionsRouterWithDbMock(executesql);
  const handle = postFunctionHandler(router);
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };

  await handle(
    {
      params: { name: 'contractActions' },
      body: {
        action: 'offer',
        team_id: 'club-1',
        user_id: 'target-player',
        contract_type: 'star',
        weekly_salary_stc: 170000,
      },
      user: { id: 'owner-user' },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(contractInserts.length, 1);
  assert.match(contractInserts[0].sql, /max_games/);
  assert.match(contractInserts[0].sql, /max_days/);
  assert.equal(contractInserts[0].params[6], 400);
  assert.equal(contractInserts[0].params[7], 180);
  assert.equal(notificationLookups.length, 1);
  assert.equal(
    inboxUpdates.some(params => params.includes(`contract_offer:player_contract:${createdContractId}:target@example.test`)),
    true
  );
  assert.equal(
    notificationUpdates.some(params => params[0] === 'message-existing' && params[1] === '/inbox?id=message-existing'),
    true
  );
  assert.equal(notificationInserts.length, 0);
});

test('contractManagement accept writes active club membership', async () => {
  const queries = [];
  const contract = {
    id: 'contract-1',
    team_id: 'club-1',
    user_id: 'player-1',
    status: 'pending',
    contract_type: 'squad',
    weekly_salary_stc: 0,
    max_days: 90,
    captaincy_offered: 0,
  };
  const player = {
    id: 'player-1',
    user_id: 'user-player',
    email: 'player@example.test',
    club_id: null,
    role: 'member',
    club_roles: null,
  };
  const club = { id: 'club-1', name: 'Club One', wage_budget_stc: 1000000 };
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async query(sql, params = []) {
      queries.push({ sql, params });
      if (/SELECT \* FROM player_contracts WHERE id = \? LIMIT 1 FOR UPDATE/.test(sql)) return [[contract], []];
      if (/SELECT \* FROM players WHERE id = \? LIMIT 1 FOR UPDATE/.test(sql)) return [[player], []];
      if (/SELECT \* FROM clubs WHERE id = \? LIMIT 1 FOR UPDATE/.test(sql)) return [[club], []];
      if (/UPDATE player_contracts SET status = 'active'/.test(sql)) return [{ affectedRows: 1 }, []];
      if (/UPDATE players SET club_id = \?/.test(sql)) return [{ affectedRows: 1 }, []];
      if (/DELETE FROM club_memberships/.test(sql)) return [{ affectedRows: 0 }, []];
      if (/UPDATE club_memberships/.test(sql)) return [{ affectedRows: 1 }, []];
      if (/SELECT \* FROM club_memberships/.test(sql)) return [[], []];
      if (/INSERT INTO club_memberships/.test(sql)) return [{ affectedRows: 1 }, []];
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const pool = {
    promise() {
      return { getConnection: async () => connection };
    },
  };
  const executesql = async (sql) => {
    throw new Error(`Unexpected SQL outside transaction: ${sql}`);
  };
  const router = loadFunctionsRouterWithDbMock(executesql, { pool });
  const handle = postFunctionHandler(router);
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };

  await handle(
    {
      params: { name: 'contractManagement' },
      body: { action: 'accept', contract_id: 'contract-1' },
      user: { id: 'user-player' },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.status, 'active');
  assert.equal(queries.some((call) => /INSERT INTO club_memberships/.test(call.sql)), true);
  const insert = queries.find((call) => /INSERT INTO club_memberships/.test(call.sql));
  assert.deepEqual(insert.params.slice(1), ['club-1', 'player-1', 'user-player', 'member', 'contract_acceptance']);
});

test('contractManagement terminate releases player club membership when no active link remains', async () => {
  const queries = [];
  const contract = {
    id: 'contract-1',
    team_id: 'club-1',
    user_id: 'player-1',
    status: 'active',
  };
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async query(sql, params = []) {
      queries.push({ sql, params });
      if (/SELECT \*, user_id AS target_player_id FROM player_contracts WHERE id = \? LIMIT 1 FOR UPDATE/.test(sql)) {
        return [[contract], []];
      }
      if (/UPDATE player_contracts SET status = 'terminated'/.test(sql)) return [{ affectedRows: 1 }, []];
      if (/UPDATE players p/.test(sql)) return [{ affectedRows: 1 }, []];
      if (/UPDATE club_memberships cm/.test(sql)) return [{ affectedRows: 1 }, []];
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const pool = {
    promise() {
      return { getConnection: async () => connection };
    },
  };
  const executesql = async (sql) => {
    throw new Error(`Unexpected SQL outside transaction: ${sql}`);
  };
  const router = loadFunctionsRouterWithDbMock(executesql, { pool });
  const handle = postFunctionHandler(router);
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };

  await handle(
    {
      params: { name: 'contractManagement' },
      body: { action: 'terminate', contract_id: 'contract-1' },
      user: { id: 'admin-user' },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(queries.some((call) => /UPDATE players p/.test(call.sql)), true);
  assert.equal(queries.some((call) => /UPDATE club_memberships cm/.test(call.sql)), true);
});

test('createTournamentEntranceLink stores active token expiring at tournament start', async () => {
  const inserts = [];
  const executesql = async (sql, params = []) => {
    if (/SELECT id, email, role_id FROM users WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: params[0], email: 'admin@example.test', role_id: 0 }];
    }
    if (/SELECT \* FROM tournaments WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: params[0], name: 'Summer Cup', start_date: '2026-06-10T20:00:00.000Z' }];
    }
    if (/INSERT INTO league_entities/.test(sql)) {
      inserts.push({ sql, params });
      return { affectedRows: 1 };
    }
    if (/INSERT INTO admin_audit_log/.test(sql)) return { affectedRows: 1 };
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadFunctionsRouterWithDbMock(executesql);
  const handle = postFunctionHandler(router);
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };

  await handle(
    { params: { name: 'createTournamentEntranceLink' }, body: { tournament_id: 'tournament-1' }, user: { id: 'admin-1' } },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.success, true);
  assert.equal(response.body.data.link.status, 'active');
  assert.equal(inserts.length, 1);
  assert.match(inserts[0].sql, /tournament_entrance_link/);
});

test('resolveTournamentEntranceToken rejects expired tokens', async () => {
  const executesql = async (sql, params = []) => {
    if (/SELECT \* FROM league_entities\s+WHERE entity_type = 'tournament_entrance_link'/.test(sql)) {
      return [{
        id: 'link-1',
        entity_type: 'tournament_entrance_link',
        status: 'active',
        data_json: JSON.stringify({
          id: 'link-1',
          token: params[0],
          tournament_id: 'tournament-1',
          expires_at: '2026-01-01T00:00:00.000Z',
        }),
      }];
    }
    if (/SELECT \* FROM tournaments WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: 'tournament-1', status: 'registration_open', start_date: '2026-06-10T20:00:00.000Z' }];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadFunctionsRouterWithDbMock(executesql);
  const handle = postFunctionHandler(router);
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };

  await handle(
    { params: { name: 'resolveTournamentEntranceToken' }, body: { token: 'expired-token' }, user: null },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.success, false);
  assert.equal(response.body.data.reason, 'expired');
});

test('revokeTournamentEntranceLink invalidates token', async () => {
  const updates = [];
  const executesql = async (sql, params = []) => {
    if (/SELECT id, email, role_id FROM users WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: params[0], email: 'admin@example.test', role_id: 0 }];
    }
    if (/SELECT \* FROM league_entities WHERE id = \? AND entity_type = 'tournament_entrance_link' LIMIT 1/.test(sql)) {
      return [{
        id: 'link-1',
        entity_type: 'tournament_entrance_link',
        status: 'active',
        data_json: JSON.stringify({ id: 'link-1', token: 'tok', tournament_id: 'tournament-1', status: 'active' }),
      }];
    }
    if (/UPDATE league_entities SET/.test(sql)) {
      updates.push({ sql, params });
      return { affectedRows: 1 };
    }
    if (/INSERT INTO admin_audit_log/.test(sql)) return { affectedRows: 1 };
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadFunctionsRouterWithDbMock(executesql);
  const handle = postFunctionHandler(router);
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };

  await handle(
    { params: { name: 'revokeTournamentEntranceLink' }, body: { link_id: 'link-1' }, user: { id: 'admin-1' } },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.success, true);
  assert.equal(updates.length, 1);
  const payload = JSON.parse(updates[0].params[0]);
  assert.equal(payload.status, 'revoked');
});

test('applyTournamentEntranceAccessMode marks user as tournament_limited', async () => {
  const updates = [];
  const executesql = async (sql, params = []) => {
    if (/SELECT id, status, end_date FROM tournaments WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: 'tournament-1', status: 'registration_open', end_date: '2026-07-01T00:00:00.000Z' }];
    }
    if (/UPDATE users SET access_mode = 'tournament_limited'/.test(sql)) {
      updates.push(params);
      return { affectedRows: 1 };
    }
    if (/SELECT id, access_mode, limited_tournament_id FROM users WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: params[0], access_mode: 'tournament_limited', limited_tournament_id: 'tournament-1' }];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadFunctionsRouterWithDbMock(executesql);
  const handle = postFunctionHandler(router);
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };

  await handle(
    { params: { name: 'applyTournamentEntranceAccessMode' }, body: { tournament_id: 'tournament-1' }, user: { id: 'user-1' } },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.success, true);
  assert.equal(response.body.data.access_mode, 'tournament_limited');
  assert.equal(updates.length, 1);
});

test('releaseTournamentLimitedAccessIfEligible unlocks on completed or passed end_date', async () => {
  const updates = [];
  const executesql = async (sql, params = []) => {
    if (/SELECT id, access_mode, limited_tournament_id FROM users WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: params[0], access_mode: 'tournament_limited', limited_tournament_id: 'tournament-1' }];
    }
    if (/SELECT id, status, end_date FROM tournaments WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: 'tournament-1', status: 'registration_open', end_date: '2026-01-01T00:00:00.000Z' }];
    }
    if (/UPDATE users SET access_mode = 'standard'/.test(sql)) {
      updates.push(params);
      return { affectedRows: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadFunctionsRouterWithDbMock(executesql);
  const handle = postFunctionHandler(router);
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };

  await handle(
    { params: { name: 'releaseTournamentLimitedAccessIfEligible' }, body: {}, user: { id: 'user-1' } },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.released, true);
  assert.equal(updates.length, 1);
});

test('listTournamentEntranceLinks returns links for a tournament to admin', async () => {
  const executesql = async (sql, params = []) => {
    if (/SELECT id, email, role_id FROM users WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: params[0], email: 'admin@example.test', role_id: 0 }];
    }
    if (/FROM league_entities\s+WHERE entity_type = 'tournament_entrance_link'/.test(sql)) {
      return [{
        id: 'link-1',
        entity_type: 'tournament_entrance_link',
        status: 'active',
        data_json: JSON.stringify({
          id: 'link-1',
          tournament_id: params[0],
          token: 'abc-token',
          expires_at: '2026-06-10T20:00:00.000Z',
          status: 'active',
        }),
      }];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadFunctionsRouterWithDbMock(executesql);
  const handle = postFunctionHandler(router);
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };

  await handle(
    { params: { name: 'listTournamentEntranceLinks' }, body: { tournament_id: 'tournament-1' }, user: { id: 'admin-1' } },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.success, true);
  assert.equal(response.body.data.links.length, 1);
  assert.equal(response.body.data.links[0].tournament_id, 'tournament-1');
});

test('matchKickoff keeps matching scores in review when uploaded proofs do not verify', async () => {
  const updates = [];
  const match = {
    id: 'match-1',
    status: 'in_progress',
    mode: 'club',
    home_club_id: 'club-home',
    away_club_id: 'club-away',
    home_club_name: 'Home FC',
    away_club_name: 'Away FC',
    result_home_submitted: 1,
    result_away_submitted: 0,
    home_submission: JSON.stringify({
      home_score: 2,
      away_score: 1,
      player_stats: [],
      goal_events: [],
      proof_url: '/uploads/home-proof.png',
      proof_ocr: { ok: true, text: 'Unreadable menu screen' },
    }),
    away_submission: null,
  };

  const executesql = async (sql, params = []) => {
    if (/SELECT \* FROM matches WHERE id = \? LIMIT 1/.test(sql)) return [match];
    if (/UPDATE matches SET away_submission = \?/.test(sql)) {
      updates.push({ sql, params });
      match.away_submission = params[0];
      match.result_away_submitted = 1;
      return { affectedRows: 1 };
    }
    if (/UPDATE matches SET status = 'disputed'/.test(sql)) {
      updates.push({ sql, params });
      match.status = 'disputed';
      return { affectedRows: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadFunctionsRouterWithDbMock(executesql);
  const handle = postFunctionHandler(router);
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };

  await handle(
    {
      params: { name: 'matchKickoff' },
      body: {
        action: 'submit_result',
        match_id: 'match-1',
        is_home_team: false,
        home_score: 2,
        away_score: 1,
        proof_url: '/uploads/away-proof.png',
      },
      user: { id: 'user-1' },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.status, 'disputed');
  assert.equal(response.body.data.proof_verification.reason, 'proofs_differ_without_readable_score');
  assert.ok(updates.some((call) => /UPDATE matches SET status = 'disputed'/.test(call.sql)));
  assert.match(match.away_submission, /away-proof\.png/);
});

test('tournamentRegistration stores club registration proof photo', async () => {
  const updates = [];
  const tournament = {
    id: 'tournament-1',
    name: 'Pro Club Cup',
    status: 'registration',
    participant_type: 'club',
    max_teams: 8,
    entry_fee_stc: 0,
    entry_credits: 0,
    registered_clubs: JSON.stringify([]),
    registered_players: JSON.stringify([]),
    registration_proofs: JSON.stringify({}),
  };
  const club = {
    id: 'club-1',
    owner_email: 'owner@example.test',
    user_id: 'user-1',
    credits: 10,
    stc: 5000,
  };
  const pool = {
    promise() {
      return {
        async getConnection() {
          return {
            async beginTransaction() {},
            async commit() {},
            async rollback() {},
            release() {},
            async query(sql, params = []) {
              if (/SELECT \* FROM tournaments WHERE id = \? LIMIT 1 FOR UPDATE/.test(sql)) return [[tournament], []];
              if (/SELECT \* FROM clubs WHERE id = \? LIMIT 1 FOR UPDATE/.test(sql)) return [[club], []];
              if (/UPDATE tournaments SET registered_clubs = \?, registration_proofs = \?/.test(sql)) {
                updates.push({ sql, params });
                return [{ affectedRows: 1 }, []];
              }
              throw new Error(`Unexpected transaction SQL: ${sql}`);
            },
          };
        },
      };
    },
  };
  const executesql = async (sql, params = []) => {
    if (/SELECT id, email, role_id FROM users WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: params[0], email: 'owner@example.test', role_id: 1 }];
    }
    if (/SELECT \* FROM store_settings/.test(sql)) return [];
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadFunctionsRouterWithDbMock(executesql, { pool });
  const handle = postFunctionHandler(router);
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };

  await handle(
    {
      params: { name: 'tournamentRegistration' },
      body: {
        tournament_id: 'tournament-1',
        club_id: 'club-1',
        registration_proof_url: '/uploads/pro-club.png',
      },
      user: { id: 'user-1' },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.success, true);
  assert.equal(updates.length, 1);
  const proofs = JSON.parse(updates[0].params[1]);
  assert.equal(proofs.club['club-1'].proof_url, '/uploads/pro-club.png');
  assert.equal(proofs.club['club-1'].proof_type, 'pro_club');
});

test('tournamentRegistration stores player Ultimate Team registration proof photo', async () => {
  const updates = [];
  const tournament = {
    id: 'tournament-1',
    name: 'Ultimate Team Cup',
    status: 'registration',
    participant_type: 'player',
    max_teams: 8,
    entry_fee_stc: 0,
    entry_credits: 0,
    registered_clubs: JSON.stringify([]),
    registered_players: JSON.stringify([]),
    registration_proofs: JSON.stringify({}),
  };
  const player = {
    id: 'player-1',
    user_id: 'user-1',
    email: 'player@example.test',
    credits: 10,
    stc: 5000,
  };
  const pool = {
    promise() {
      return {
        async getConnection() {
          return {
            async beginTransaction() {},
            async commit() {},
            async rollback() {},
            release() {},
            async query(sql, params = []) {
              if (/SELECT \* FROM tournaments WHERE id = \? LIMIT 1 FOR UPDATE/.test(sql)) return [[tournament], []];
              if (/SELECT \* FROM players WHERE id = \? LIMIT 1 FOR UPDATE/.test(sql)) return [[player], []];
              if (/UPDATE tournaments SET registered_players = \?, registration_proofs = \?/.test(sql)) {
                updates.push({ sql, params });
                return [{ affectedRows: 1 }, []];
              }
              throw new Error(`Unexpected transaction SQL: ${sql}`);
            },
          };
        },
      };
    },
  };
  const executesql = async (sql, params = []) => {
    if (/SELECT id, email, role_id FROM users WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: params[0], email: 'player@example.test', role_id: 1 }];
    }
    if (/SELECT \* FROM store_configs/.test(sql)) return [];
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadFunctionsRouterWithDbMock(executesql, { pool });
  const handle = postFunctionHandler(router);
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };

  await handle(
    {
      params: { name: 'tournamentRegistration' },
      body: {
        tournament_id: 'tournament-1',
        player_id: 'player-1',
        registration_proof_url: '/uploads/ultimate-team.png',
      },
      user: { id: 'user-1' },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.success, true);
  assert.equal(updates.length, 1);
  const proofs = JSON.parse(updates[0].params[1]);
  assert.equal(proofs.player['player-1'].proof_url, '/uploads/ultimate-team.png');
  assert.equal(proofs.player['player-1'].proof_type, 'ultimate_team');
});
