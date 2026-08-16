const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadFunctionsRouterWithDbMock(executesql, options = {}) {
  const controllerPath = path.resolve(__dirname, '../functionsController.js');
  const legacyFunctionsPath = path.resolve(__dirname, '../../functions/legacyFunctions.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  const identityServicePath = path.resolve(__dirname, '../../services/identityService.js');
  const clubOperationsServicePath = path.resolve(__dirname, '../../services/clubOperationsService.js');
  const clubContactServicePath = path.resolve(__dirname, '../../services/clubContactService.js');
  const messageDeliveryServicePath = path.resolve(__dirname, '../../services/messageDeliveryService.js');
  const contractRulesServicePath = path.resolve(__dirname, '../../services/contractRulesService.js');
  const transferWindowServicePath = path.resolve(__dirname, '../../services/transferWindowService.js');
  const clubFinanceServicePath = path.resolve(__dirname, '../../services/clubFinanceService.js');
  const clubMembershipServicePath = path.resolve(__dirname, '../../services/clubMembershipService.js');
  const presidentResolutionServicePath = path.resolve(__dirname, '../../services/presidentResolutionService.js');
  const scoreProofServicePath = path.resolve(__dirname, '../../services/scoreProofService.js');
  const servicePath = path.resolve(__dirname, '../../services/competitionEngineService.js');
  const matchModelPath = path.resolve(__dirname, '../../models/matchModel.js');
  const socketPath = path.resolve(__dirname, '../../utils/socketBroadcast.js');

  delete require.cache[controllerPath];
  delete require.cache[legacyFunctionsPath];
  delete require.cache[identityServicePath];
  delete require.cache[clubOperationsServicePath];
  delete require.cache[clubContactServicePath];
  delete require.cache[messageDeliveryServicePath];
  delete require.cache[contractRulesServicePath];
  delete require.cache[transferWindowServicePath];
  delete require.cache[clubFinanceServicePath];
  delete require.cache[clubMembershipServicePath];
  delete require.cache[presidentResolutionServicePath];
  delete require.cache[scoreProofServicePath];
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
      advanceAfterFinalResult: async () => ({ triggered: false }),
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
      broadcastTransferWindow() {},
    },
  };
  if (options.messageDeliveryServiceMock) {
    require.cache[messageDeliveryServicePath] = {
      id: messageDeliveryServicePath,
      filename: messageDeliveryServicePath,
      loaded: true,
      exports: options.messageDeliveryServiceMock,
    };
  }

  return require(controllerPath);
}

function postFunctionHandler(router) {
  const layer = router.stack.find((entry) => entry.route?.path === '/:name');
  return layer.route.stack[0].handle;
}

function makeJsonResponse() {
  return {
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
}

function makeFinanceReadyClub(overrides = {}) {
  return {
    id: 'club-1',
    name: 'Club One',
    stc: 2500000,
    wage_budget_stc: 1000000,
    transfer_budget_stc: 1000000,
    stadium_level: 0,
    ...overrides,
  };
}

function isClubFinanceUsageQuery(sql) {
  return /SELECT\s+COALESCE\(SUM\(CASE WHEN status = 'active' THEN weekly_salary_stc ELSE 0 END\), 0\) AS active_wages/.test(sql);
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

  assert.equal(response.statusCode, 200, response.body?.error);
  assert.equal(response.body.data.balance, 1234);
  assert.equal(contractLookups[0].params[0], 'player-1');
  assert.match(contractLookups[0].sql, /target_player_id/);
});

test('resolveClubContact prefers canonical president user over legacy owner email', async () => {
  const queries = [];
  const conn = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async query(sql, params = []) {
      queries.push({ sql, params });
      if (/SELECT \* FROM clubs WHERE id = \? LIMIT 1 FOR UPDATE/.test(sql)) {
        return [[{
          id: 'club-1',
          name: 'President FC',
          user_id: 'legacy-owner',
          president_user_id: 'president-user',
          owner_email: 'legacy-owner@example.test',
        }]];
      }
      if (/SELECT id, email, player_id FROM users WHERE id = \? LIMIT 1/.test(sql) && params[0] === 'president-user') {
        return [[{ id: 'president-user', email: 'President@Example.TEST', player_id: 'president-player' }]];
      }
      if (/SELECT id, email, player_id FROM users WHERE id = \? LIMIT 1/.test(sql) && params[0] === 'legacy-owner') {
        return [[{ id: 'legacy-owner', email: 'legacy-owner@example.test', player_id: 'legacy-player' }]];
      }
      if (/UPDATE users SET owner_id/.test(sql)) return [{ affectedRows: 1 }];
      if (/SELECT \* FROM players WHERE id = \? LIMIT 1 FOR UPDATE/.test(sql) && params[0] === 'president-player') {
        return [[{ id: 'president-player', email: 'President@Example.TEST', gamertag: 'Prez' }]];
      }
      if (/SELECT \* FROM players WHERE id = \? LIMIT 1 FOR UPDATE/.test(sql) && params[0] === 'legacy-player') {
        return [[{ id: 'legacy-player', email: 'legacy-owner@example.test', gamertag: 'Legacy' }]];
      }
      if (/UPDATE players SET/.test(sql)) return [{ affectedRows: 1 }];
      if (/UPDATE users SET player_id/.test(sql)) return [{ affectedRows: 1 }];
      if (/SELECT id, email, gamertag, role\s+FROM players/.test(sql)) return [[]];
      if (/SELECT id, email, gamertag\s+FROM players/.test(sql)) return [[]];
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const pool = {
    promise() {
      return {
        async getConnection() {
          return conn;
        },
      };
    },
  };
  const router = loadFunctionsRouterWithDbMock(async () => [], { pool });
  const handle = postFunctionHandler(router);
  const response = makeJsonResponse();

  await handle(
    { params: { name: 'resolveClubContact' }, body: { club_id: 'club-1' }, user: { id: 'viewer-user' } },
    response,
  );

  assert.equal(response.statusCode, 200, response.body?.error);
  assert.equal(response.body.data.recipient_email, 'President@Example.TEST');
  assert.equal(response.body.data.owner_user_id, 'president-user');
  assert.equal(queries.some(({ params }) => params[0] === 'president-user'), true);
});

test('competitionFixtureResult processes fixture and triggers central progression', async () => {
  const updates = [];
  const auditRows = [];
  const fixture = {
    id: 'fixture-1',
    entity_type: 'competition_fixture',
    status: 'scheduled',
    data_json: JSON.stringify({
      id: 'fixture-1',
      season_id: 'season-1',
      competition_id: 'competition-1',
      phase: 'league',
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
      entity_type: 'competition_standing',
      season_id: 'season-1',
      club_id: 'club-home',
      data_json: JSON.stringify({
        id: 'standing-home',
        season_id: 'season-1',
        club_id: 'club-home',
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
      entity_type: 'competition_standing',
      season_id: 'season-1',
      club_id: 'club-away',
      data_json: JSON.stringify({
        id: 'standing-away',
        season_id: 'season-1',
        club_id: 'club-away',
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
      if (/SELECT \* FROM league_entities\s+WHERE id = \? AND entity_type = 'competition_fixture'/.test(sql)) {
        return [[fixture], []];
      }
      if (/entity_type = 'competition_standing'\s+AND season_id = \?\s+AND club_id IN/.test(sql)) {
        return [standings, []];
      }
      if (/entity_type = 'competition_standing' AND season_id = \?/.test(sql)) {
        return [standings, []];
      }
      if (/UPDATE league_entities SET/.test(sql)) {
        updates.push({ sql, params });
        if (params.includes('competition_fixture')) {
          fixture.data_json = params[0];
          fixture.status = params[1] || fixture.status;
        }
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
  let progressionCall = null;
  const router = loadFunctionsRouterWithDbMock(executesql, {
    pool: { promise: () => ({ getConnection: async () => conn }) },
    serviceMock: {
      advanceAfterFinalResult: async (payload, options) => {
        progressionCall = { payload, options };
        return {
          triggered: true,
          source: 'fixture',
          source_type: options.sourceType,
          fixture_id: payload.fixture.id,
          advance: { advanced: false, reason: 'phase_incomplete' },
        };
      },
    },
  });
  const handle = postFunctionHandler(router);
  const response = makeJsonResponse();

  await handle(
    {
      params: { name: 'competitionFixtureResult' },
      body: { fixture_id: 'fixture-1', home_score: 3, away_score: 1 },
      user: { id: 'admin-1' },
    },
    response,
  );

  assert.equal(response.statusCode, 200, response.body?.error);
  assert.equal(response.body.data.success, true);
  assert.equal(response.body.data.progression.triggered, true);
  assert.equal(response.body.data.advance.reason, 'phase_incomplete');
  assert.equal(progressionCall.options.sourceType, 'competition');
  assert.equal(progressionCall.payload.fixture.status, 'completed');
  assert.equal(auditRows.length, 1);
  assert.equal(updates.length > 0, true);
});

test('regionalLeagueFixtureResult processes fixture and triggers central progression', async () => {
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
        if (params.includes('regional_league_fixture')) {
          fixture.data_json = params[0];
          fixture.status = params[1] || fixture.status;
        }
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

  let progressionCall = null;
  const router = loadFunctionsRouterWithDbMock(executesql, {
    pool: { promise: () => ({ getConnection: async () => conn }) },
    serviceMock: {
      advanceAfterFinalResult: async (payload, options) => {
        progressionCall = { payload, options };
        return {
          triggered: true,
          source: 'fixture',
          source_type: options.sourceType,
          fixture_id: payload.fixture.id,
          advance: { advanced: false, reason: 'season_incomplete' },
        };
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
    {
      params: { name: 'regionalLeagueFixtureResult' },
      body: { fixture_id: 'fixture-1', home_score: 2, away_score: 1 },
      user: { id: 'admin-1' },
    },
    response,
  );

  assert.equal(response.statusCode, 200, response.body?.error);
  assert.equal(response.body.data.success, true);
  assert.equal(response.body.data.progression.triggered, true);
  assert.equal(response.body.data.advance.reason, 'season_incomplete');
  assert.equal(progressionCall.options.sourceType, 'regional_league');
  assert.equal(progressionCall.payload.fixture.status, 'played');
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
  const router = loadFunctionsRouterWithDbMock(executesql, {
    messageDeliveryServiceMock: {
      messageTypeToNotificationType: () => 'message',
      deliverContractOfferMessage: async () => {},
      createNotificationIfEnabled: async () => ({ success: true, id: 'notification-1' }),
      sendActionMessage: async (payload) => {
        responseMessages.push(payload);
        return { success: true, message: { id: 'response-message-1' } };
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
    { params: { name: 'respondInboxMessage' }, body: { message_id: 'message-1', action: 'accepted' }, user: { id: 'user-away' } },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0][1], null);
  assert.equal(inserts[0][2], null);
  assert.equal(inserts[0][3], null);
  assert.equal(inserts[0][8], 'player-home');
  assert.equal(inserts[0][10], 'home-player@example.test');
  assert.equal(inserts[0][11], 'player-away');
  assert.equal(inserts[0][13], 'away-player@example.test');
  assert.equal(responseMessages.length, 1);
  assert.equal(responseMessages[0].recipientEmail, 'home@example.test');
  assert.equal(responseMessages[0].messageType, 'match_invite_response');
  assert.equal(responseMessages[0].relatedEntityId, inserts[0][0]);
  assert.equal(responseMessages[0].idempotencyKey, `match_invite_response:message-1:accepted:${inserts[0][0]}`);
  assert.equal(inboxUpdates.some(update => /related_entity_id/.test(update.sql)), true);
});

test('respondInboxMessage persists message status on legacy inbox tables without updated_date', async () => {
  const inboxUpdates = [];
  const message = {
    id: 'message-legacy',
    recipient_email: 'away@example.test',
    sender_email: null,
    message_type: 'match_invite',
    subject: 'Ranked invite',
    related_entity_id: null,
    metadata: JSON.stringify({
      invitation_type: 'player_vs_player',
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
    if (/UPDATE inbox_messages SET status = \?, is_read = 1, updated_date = NOW\(\) WHERE id = \?/.test(sql)) {
      const err = new Error("Unknown column 'updated_date' in 'field list'");
      err.code = 'ER_BAD_FIELD_ERROR';
      throw err;
    }
    if (/UPDATE inbox_messages SET status = \?, is_read = 1 WHERE id = \?/.test(sql)) {
      inboxUpdates.push({ sql, params });
      return { affectedRows: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadFunctionsRouterWithDbMock(executesql, {
    messageDeliveryServiceMock: {
      messageTypeToNotificationType: () => 'message',
      deliverContractOfferMessage: async () => {},
      createNotificationIfEnabled: async () => ({ success: true, id: 'notification-1' }),
      sendActionMessage: async () => ({ success: true, message: { id: 'response-message-1' } }),
    },
  });
  const handle = postFunctionHandler(router);
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };

  await handle(
    { params: { name: 'respondInboxMessage' }, body: { message_id: 'message-legacy', action: 'declined' }, user: { id: 'user-away' } },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(inboxUpdates.map(update => update.params), [['declined', 'message-legacy']]);
});

test('respondInboxMessage sends reschedule proposals through the central action message service', async () => {
  const deliveries = [];
  const inboxUpdates = [];
  const message = {
    id: 'message-1',
    recipient_email: 'away@example.test',
    sender_email: 'home@example.test',
    message_type: 'match_invite',
    subject: 'Ranked invite',
    related_entity_id: 'match-1',
    related_entity_type: 'match',
    metadata: JSON.stringify({
      invitation_type: 'player_vs_player',
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
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadFunctionsRouterWithDbMock(executesql, {
    messageDeliveryServiceMock: {
      messageTypeToNotificationType: () => 'message',
      deliverContractOfferMessage: async () => {},
      createNotificationIfEnabled: async () => ({ success: true, id: 'notification-1' }),
      sendActionMessage: async (payload) => {
        deliveries.push(payload);
        return { success: true, message: { id: 'reschedule-message-1' } };
      },
    },
  });
  const handle = postFunctionHandler(router);
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };

  await handle(
    {
      params: { name: 'respondInboxMessage' },
      body: { message_id: 'message-1', action: 'date_change_requested', new_date: '2026-06-02', new_time: '21:30' },
      user: { id: 'user-away' },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(inboxUpdates.length, 1);
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].recipientEmail, 'home@example.test');
  assert.equal(deliveries[0].messageType, 'match_invite');
  assert.equal(deliveries[0].actionType, 'accept_decline_date');
  assert.equal(deliveries[0].relatedEntityId, 'match-1');
  assert.equal(deliveries[0].idempotencyKey, 'match_reschedule:message-1:2026-06-02:21:30');
  assert.equal(deliveries[0].notification.type, 'match_reminder');
});

test('respondInboxMessage only cancels an arranged match after the opponent confirms', async () => {
  const matchUpdates = [];
  const responseMessages = [];
  const message = {
    id: 'cancel-message-1',
    recipient_email: 'away@example.test',
    sender_email: 'home@example.test',
    message_type: 'match_invite',
    subject: 'Cancel request',
    related_entity_id: 'match-1',
    related_entity_type: 'match',
    metadata: JSON.stringify({
      cancel_request: true,
      created_match_id: 'match-1',
      invitation_type: 'player_vs_player',
      challenger_name: 'HomeTag',
      opponent_name: 'AwayTag',
    }),
  };
  const match = {
    id: 'match-1',
    status: 'scheduled',
    mode: 'solo',
    type: 'ranked',
    tournament_id: null,
    source_fixture_type: null,
    home_player_id: 'player-home',
    away_player_id: 'player-away',
    home_player_email: 'home@example.test',
    away_player_email: 'away@example.test',
    home_player_name: 'HomeTag',
    away_player_name: 'AwayTag',
    cancel_status: 'pending',
    cancel_requested_by: 'home@example.test',
    wager_stc: 0,
    wager_status: null,
  };
  const executesql = async (sql, params = []) => {
    if (/FROM users WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: params[0], email: 'away@example.test', player_id: 'player-away', owner_id: null }];
    }
    if (/SELECT \* FROM players WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: 'player-away', email: 'away@example.test', gamertag: 'AwayTag', club_id: null }];
    }
    if (/SELECT \* FROM players WHERE user_id = \? LIMIT 1/.test(sql)) return [];
    if (/FROM club_memberships/.test(sql)) return [];
    if (/SELECT \* FROM clubs WHERE/.test(sql)) return [];
    if (/SELECT \* FROM inbox_messages WHERE id = \? LIMIT 1/.test(sql)) return [message];
    if (/UPDATE inbox_messages SET status = \?/.test(sql)) return { affectedRows: 1 };
    if (/SELECT \* FROM matches WHERE id = \? LIMIT 1/.test(sql)) return [match];
    if (/UPDATE matches SET/.test(sql)) {
      matchUpdates.push({ sql, params });
      return { affectedRows: 1 };
    }
    if (/SELECT id, gamertag, avatar_url, club_id FROM players WHERE LOWER\(email\)=LOWER\(\?\)/.test(sql)) {
      return [{ id: 'player-away', gamertag: 'AwayTag', avatar_url: null, club_id: null }];
    }
    if (/SELECT notification_settings FROM players/.test(sql)) return [];
    if (/SELECT id FROM notifications/.test(sql)) return [];
    if (/INSERT INTO notifications/.test(sql)) return { affectedRows: 1 };
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadFunctionsRouterWithDbMock(executesql, {
    messageDeliveryServiceMock: {
      messageTypeToNotificationType: () => 'message',
      deliverContractOfferMessage: async () => {},
      createNotificationIfEnabled: async () => ({ success: true, id: 'notification-1' }),
      sendActionMessage: async (payload) => {
        responseMessages.push(payload);
        return { success: true, message: { id: 'cancel-response-1' } };
      },
    },
  });
  const handle = postFunctionHandler(router);
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };

  await handle(
    { params: { name: 'respondInboxMessage' }, body: { message_id: 'cancel-message-1', action: 'accepted' }, user: { id: 'user-away' } },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(matchUpdates.some((update) => update.params.includes('cancelled')), true);
  assert.equal(responseMessages[0]?.recipientEmail, 'home@example.test');
});

test('matchFixtureActions request_cancel asks the opponent instead of deleting the match', async () => {
  const matchUpdates = [];
  const deliveries = [];
  const match = {
    id: 'match-1',
    status: 'scheduled',
    mode: 'solo',
    type: 'ranked',
    tournament_id: null,
    source_fixture_type: null,
    home_player_id: 'player-home',
    away_player_id: 'player-away',
    home_player_email: 'home@example.test',
    away_player_email: 'away@example.test',
    home_player_name: 'HomeTag',
    away_player_name: 'AwayTag',
    cancel_status: null,
    wager_stc: 0,
  };
  const executesql = async (sql, params = []) => {
    if (/FROM users WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: params[0], email: 'home@example.test', player_id: 'player-home', owner_id: null }];
    }
    if (/SELECT \* FROM players WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: 'player-home', email: 'home@example.test', gamertag: 'HomeTag', club_id: null }];
    }
    if (/SELECT \* FROM players WHERE user_id = \? LIMIT 1/.test(sql)) return [];
    if (/FROM club_memberships/.test(sql)) return [];
    if (/SELECT \* FROM clubs WHERE/.test(sql)) return [];
    if (/SELECT \* FROM matches WHERE id = \? LIMIT 1/.test(sql)) return [match];
    if (/UPDATE matches SET/.test(sql)) {
      matchUpdates.push({ sql, params });
      return { affectedRows: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadFunctionsRouterWithDbMock(executesql, {
    messageDeliveryServiceMock: {
      messageTypeToNotificationType: () => 'message',
      deliverContractOfferMessage: async () => {},
      createNotificationIfEnabled: async () => ({ success: true, id: 'notification-1' }),
      sendActionMessage: async (payload) => {
        deliveries.push(payload);
        return { success: true, message: { id: 'cancel-request-1' } };
      },
    },
  });
  const handle = postFunctionHandler(router);
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };

  await handle(
    { params: { name: 'matchFixtureActions' }, body: { action: 'request_cancel', match_id: 'match-1' }, user: { id: 'user-home' } },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(matchUpdates.some((update) => update.params.includes('cancelled')), false);
  assert.equal(matchUpdates.some((update) => update.params.includes('pending')), true);
  assert.equal(deliveries[0]?.recipientEmail, 'away@example.test');
  assert.equal(deliveries[0]?.metadata?.cancel_request, true);
});

test('sendInboxMessage delegates actionable delivery to the central message service', async () => {
  const deliveries = [];
  const inboxInserts = [];
  const notificationInserts = [];
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
    if (/INSERT INTO inbox_messages/.test(sql)) {
      inboxInserts.push(params);
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
  const router = loadFunctionsRouterWithDbMock(executesql, {
    messageDeliveryServiceMock: {
      messageTypeToNotificationType: () => 'contract_offer',
      deliverContractOfferMessage: async () => {},
      createNotificationIfEnabled: async () => ({ success: true, id: 'notification-1' }),
      sendActionMessage: async (payload) => {
        deliveries.push(payload);
        return { success: true, message: { id: 'message-created' } };
      },
    },
  });
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

  assert.equal(firstResponse.statusCode, 200);
  assert.equal(firstResponse.body.message.id, 'message-created');
  assert.equal(inboxInserts.length, 0);
  assert.equal(notificationInserts.length, 0);
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].recipientEmail, 'player@example.test');
  assert.equal(deliveries[0].senderEmail, 'sender@example.test');
  assert.equal(deliveries[0].senderGamertag, 'SenderTag');
  assert.equal(deliveries[0].senderAvatarUrl, 'sender.png');
  assert.equal(deliveries[0].senderClubName, 'Sender FC');
  assert.equal(deliveries[0].messageType, 'contract_offer');
  assert.equal(deliveries[0].actionType, 'contract_negotiation');
  assert.equal(deliveries[0].idempotencyKey, 'contract_offer:player_contract:contract-1:player@example.test');
});

test('sendInboxMessage preserves explicit sender display fields for club-sent actions', async () => {
  const deliveries = [];
  const executesql = async (sql) => {
    if (/SELECT id, gamertag, avatar_url, club_id FROM players WHERE LOWER\(email\)=LOWER\(\?\)/.test(sql)) return [];
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadFunctionsRouterWithDbMock(executesql, {
    messageDeliveryServiceMock: {
      messageTypeToNotificationType: () => 'match_reminder',
      deliverContractOfferMessage: async () => {},
      createNotificationIfEnabled: async () => ({ success: true, id: 'notification-1' }),
      sendActionMessage: async (payload) => {
        deliveries.push(payload);
        return { success: true, message: { id: 'message-created' } };
      },
    },
  });
  const handle = postFunctionHandler(router);
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };

  await handle(
    {
      params: { name: 'sendInboxMessage' },
      body: {
        recipient_email: 'opponent@example.test',
        sender_email: 'owner@example.test',
        sender_gamertag: 'Longue Vie FC',
        sender_avatar_url: '/uploads/club-logo.png',
        sender_club_name: 'Longue Vie FC',
        subject: 'Match Invitation',
        body: 'Please respond.',
        message_type: 'match_invite',
        action_type: 'accept_decline_date',
        related_entity_id: 'player-1',
        related_entity_type: 'player',
      },
      user: { id: 'owner-user' },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(deliveries[0].senderGamertag, 'Longue Vie FC');
  assert.equal(deliveries[0].senderAvatarUrl, '/uploads/club-logo.png');
  assert.equal(deliveries[0].senderClubName, 'Longue Vie FC');
});

test('contractActions offer stores duration metadata for market offers', async () => {
  const contractInserts = [];
  const notificationLookups = [];
  const notificationInserts = [];
  const inboxUpdates = [];
  const notificationUpdates = [];
  let createdContractId = null;
  const clubRow = makeFinanceReadyClub({
    id: 'club-1',
    user_id: 'owner-user',
    president_user_id: 'owner-user',
    president_id: 'pres-1',
    owner_email: 'owner@example.test',
  });
  const presidentRow = { id: 'pres-1', user_id: 'owner-user', club_id: 'club-1', email: 'owner@example.test' };
  const executesql = async (sql, params = []) => {
    if (/FROM users WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: 'owner-user', email: 'owner@example.test', player_id: 'owner-player', owner_id: 'club-1' }];
    }
    if (/SELECT \* FROM players WHERE id = \? LIMIT 1/.test(sql) && params[0] === 'owner-player') {
      return [{ id: 'owner-player', email: 'owner@example.test', club_id: 'club-1' }];
    }
    if (/SELECT \* FROM clubs WHERE id = \? LIMIT 1/.test(sql)) {
      return [clubRow];
    }
    if (/SELECT \* FROM clubs WHERE president_user_id = \? LIMIT 1/.test(sql)) {
      return [clubRow];
    }
    if (/SELECT \* FROM presidents WHERE id = \?/.test(sql)) return [presidentRow];
    if (/SELECT \* FROM presidents WHERE user_id = \?/.test(sql)) return [presidentRow];
    if (/FROM club_memberships/.test(sql)) return [];
    if (/FROM club_staff_roles/.test(sql)) return [{ id: 'staff-1', club_id: 'club-1', user_id: 'owner-user', player_id: 'owner-player', role: 'recruiter', permissions: JSON.stringify(['offer_contracts']) }];
    if (/CREATE TABLE IF NOT EXISTS transfer_windows/.test(sql)) return { affectedRows: 0 };
    if (/SELECT \* FROM transfer_windows WHERE status = 'open'/.test(sql)) return [{ id: 'window-open', status: 'open' }];
    if (/FROM player_contracts/.test(sql) && /status IN/.test(sql) && /team_id = \?/.test(sql)) return [];
    if (isClubFinanceUsageQuery(sql)) return [{ active_wages: 0, pending_wages: 0, pending_transfer_fees: 0 }];
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
    if (/FROM clubs c/.test(sql)) {
      return [{
        ...clubRow,
        name: 'Club One',
        president_user_email: 'owner@example.test',
      }];
    }
    if (/SELECT id, recipient_email FROM inbox_messages/.test(sql) && /related_entity_id = \?/.test(sql)) {
      return [{ id: 'message-existing', recipient_email: 'target@example.test' }];
    }
    if (/SELECT \* FROM inbox_messages WHERE id = \?/.test(sql)) {
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
  assert.match(contractInserts[0].sql, /offered_by_president_id/);
  assert.equal(contractInserts[0].params[4], 'pending');
  assert.equal(contractInserts[0].params[6], 'owner-user');
  assert.equal(contractInserts[0].params[7], 'club-1');
  assert.equal(contractInserts[0].params[8], 'pres-1');
  assert.equal(contractInserts[0].params[9], 400);
  assert.equal(contractInserts[0].params[10], 180);
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

test('contractActions offer rejects new contract offers while the transfer window is closed', async () => {
  let insertCalled = false;
  const clubRow = {
    id: 'club-1',
    user_id: 'owner-user',
    president_user_id: 'owner-user',
    president_id: 'pres-1',
    owner_email: 'owner@example.test',
  };
  const executesql = async (sql, params = []) => {
    if (/FROM users WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: 'owner-user', email: 'owner@example.test', player_id: 'owner-player', owner_id: 'club-1' }];
    }
    if (/SELECT \* FROM players WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: params[0], email: 'owner@example.test', club_id: 'club-1' }];
    }
    if (/SELECT \* FROM clubs WHERE id = \? LIMIT 1/.test(sql)) {
      return [clubRow];
    }
    if (/SELECT \* FROM clubs WHERE president_user_id = \? LIMIT 1/.test(sql)) {
      return [clubRow];
    }
    if (/SELECT \* FROM presidents WHERE/.test(sql)) {
      return [{ id: 'pres-1', user_id: 'owner-user', club_id: 'club-1' }];
    }
    if (/FROM club_memberships/.test(sql)) return [];
    if (/FROM club_staff_roles/.test(sql)) return [{ id: 'staff-1', club_id: 'club-1', user_id: 'owner-user', player_id: 'owner-player', role: 'recruiter', permissions: JSON.stringify(['offer_contracts']) }];
    if (/CREATE TABLE IF NOT EXISTS transfer_windows/.test(sql)) return { affectedRows: 0 };
    if (/SELECT \* FROM transfer_windows WHERE status = 'open'/.test(sql)) return [];
    if (/FROM player_contracts/.test(sql) && /status IN/.test(sql)) return [];
    if (/INSERT INTO player_contracts/.test(sql)) {
      insertCalled = true;
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
      },
      user: { id: 'owner-user' },
    },
    response,
  );

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.code, 'transfer_window_closed');
  assert.equal(insertCalled, false);
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
  const club = makeFinanceReadyClub();
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
      if (/SELECT \* FROM clubs WHERE id = \? LIMIT 1/.test(sql)) return [[club], []];
      if (isClubFinanceUsageQuery(sql)) return [[{ active_wages: 0, pending_wages: 0, pending_transfer_fees: 0 }], []];
      if (/FROM player_contracts/.test(sql) && /id <> \?/.test(sql) && /status IN/.test(sql)) return [[], []];
      if (/UPDATE player_contracts SET status = 'active'/.test(sql)) return [{ affectedRows: 1 }, []];
      if (/UPDATE inbox_messages/.test(sql)) return [{ affectedRows: 1 }, []];
      if (/UPDATE notifications/.test(sql)) return [{ affectedRows: 1 }, []];
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

test('contractManagement accept preserves president links for ownership contracts until Slice 2', async () => {
  const queries = [];
  const contract = {
    id: 'ownership-contract-1',
    team_id: 'club-1',
    user_id: 'player-president',
    status: 'pending',
    contract_type: 'ownership',
    weekly_salary_stc: 0,
    max_days: 3650,
    captaincy_offered: 0,
  };
  const player = {
    id: 'player-president',
    user_id: 'new-president-user',
    email: 'president@example.test',
    club_id: null,
    role: 'free_agent',
    club_roles: null,
  };
  const club = makeFinanceReadyClub({
    id: 'club-1',
    name: 'Club One',
    user_id: 'old-president-user',
    president_user_id: 'old-president-user',
    president_player_id: 'old-president-player',
    owner_email: 'old@example.test',
  });
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
      if (/FROM player_contracts/.test(sql) && /id <> \?/.test(sql) && /status IN/.test(sql)) return [[], []];
      if (/UPDATE player_contracts SET status = 'active'/.test(sql)) return [{ affectedRows: 1 }, []];
      if (/UPDATE inbox_messages/.test(sql)) return [{ affectedRows: 1 }, []];
      if (/UPDATE notifications/.test(sql)) return [{ affectedRows: 1 }, []];
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
  const router = loadFunctionsRouterWithDbMock(async (sql) => {
    throw new Error(`Unexpected SQL outside transaction: ${sql}`);
  }, { pool });
  const handle = postFunctionHandler(router);
  const response = makeJsonResponse();

  await handle(
    {
      params: { name: 'contractManagement' },
      body: { action: 'accept', contract_id: 'ownership-contract-1' },
      user: { id: 'new-president-user' },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.status, 'active');
  assert.equal(queries.some((call) => /UPDATE clubs SET president_user_id = \?/.test(call.sql)), false);
  assert.equal(queries.some((call) => /UPDATE users SET owner_id = \?/.test(call.sql)), false);
  assert.equal(queries.some((call) => /INSERT INTO club_memberships/.test(call.sql)), true);
});

test('identity repair dry run maps legacy President user to canonical president Player', async () => {
  const router = loadFunctionsRouterWithDbMock(async (sql, params = []) => {
    if (/SELECT id, email, role_id FROM users WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: 'admin-user', email: 'admin@example.test', role_id: 0 }];
    }
    if (/FROM clubs c/.test(sql)) {
      return [{
        club_id: 'club-1',
        club_name: 'Canonical FC',
        club_user_id: 'president-user',
        president_user_id: null,
        president_player_id: null,
        owner_email: 'president@example.test',
        president_id: 'legacy-president-1',
        legacy_president_id: 'legacy-president-1',
        legacy_president_name: 'Legacy President',
        legacy_president_user_id: 'president-user',
        legacy_president_email: 'president@example.test',
      }];
    }
    if (/SELECT id, email FROM users WHERE id IN/.test(sql)) {
      return [{ id: 'president-user', email: 'president@example.test' }];
    }
    if (/FROM players\s+WHERE user_id IN/.test(sql)) {
      return [{ id: 'player-president', user_id: 'president-user', email: 'president@example.test', gamertag: 'Prez', club_id: 'club-1', role: 'member', status: 'active' }];
    }
    if (/FROM players\s+WHERE LOWER\(TRIM\(email\)\) IN/.test(sql)) {
      return [{ id: 'player-president', user_id: 'president-user', email: 'president@example.test', gamertag: 'Prez', club_id: 'club-1', role: 'member', status: 'active' }];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  const handle = postFunctionHandler(router);
  const response = makeJsonResponse();

  await handle(
    { params: { name: 'repairPlayerPresidentIdentityLinks' }, body: { scan_all: true, dry_run: true }, user: { id: 'admin-user' } },
    response,
  );

  assert.equal(response.statusCode, 200, response.body?.error);
  assert.equal(response.body.dry_run, true);
  assert.equal(response.body.candidates.length, 1);
  assert.equal(response.body.candidates[0].mapping_status, 'repairable');
  assert.equal(response.body.candidates[0].player_id, 'player-president');
  assert.equal(response.body.candidates[0].current_president_player_id, null);
  assert.equal(response.body.groups.repairable.length, 1);
});

test('identity repair reports ambiguous President-to-Player mappings without repairing', async () => {
  const writes = [];
  const router = loadFunctionsRouterWithDbMock(async (sql, params = []) => {
    if (/SELECT id, email, role_id FROM users WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: 'admin-user', email: 'admin@example.test', role_id: 0 }];
    }
    if (/FROM clubs c/.test(sql)) {
      return [{
        club_id: 'club-1',
        club_name: 'Ambiguous FC',
        club_user_id: 'president-user',
        president_user_id: null,
        president_player_id: null,
        owner_email: 'president@example.test',
        president_id: 'legacy-president-1',
        legacy_president_id: 'legacy-president-1',
        legacy_president_name: 'Legacy President',
        legacy_president_user_id: 'president-user',
        legacy_president_email: 'president@example.test',
      }];
    }
    if (/SELECT id, email FROM users WHERE id IN/.test(sql)) return [{ id: 'president-user', email: 'president@example.test' }];
    if (/FROM players\s+WHERE user_id IN/.test(sql)) {
      return [
        { id: 'player-one', user_id: 'president-user', email: 'president@example.test', gamertag: 'PrezOne' },
        { id: 'player-two', user_id: 'president-user', email: 'president@example.test', gamertag: 'PrezTwo' },
      ];
    }
    if (/FROM players\s+WHERE LOWER\(TRIM\(email\)\) IN/.test(sql)) return [];
    if (/UPDATE clubs SET/.test(sql) || /INSERT INTO admin_audit_log/.test(sql) || /UPDATE players SET/.test(sql)) {
      writes.push({ sql, params });
      return { affectedRows: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  const handle = postFunctionHandler(router);
  const response = makeJsonResponse();

  await handle(
    { params: { name: 'repairPlayerPresidentIdentityLinks' }, body: { scan_all: true, dry_run: false }, user: { id: 'admin-user' } },
    response,
  );

  assert.equal(response.statusCode, 200, response.body?.error);
  assert.equal(response.body.repaired_count, 0);
  assert.equal(response.body.groups.ambiguous.length, 1);
  assert.equal(writes.length, 0);
});

test('identity repair writes canonical club president Player link and audit without detaching player', async () => {
  const writes = [];
  const router = loadFunctionsRouterWithDbMock(async (sql, params = []) => {
    if (/SELECT id, email, role_id FROM users WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: 'admin-user', email: 'admin@example.test', role_id: 0 }];
    }
    if (/FROM clubs c/.test(sql)) {
      return [{
        club_id: 'club-1',
        club_name: 'Canonical FC',
        club_user_id: null,
        president_user_id: null,
        president_player_id: null,
        owner_email: null,
        president_id: 'legacy-president-1',
        legacy_president_id: 'legacy-president-1',
        legacy_president_name: 'Legacy President',
        legacy_president_user_id: 'president-user',
        legacy_president_email: 'president@example.test',
      }];
    }
    if (/SELECT id, email FROM users WHERE id IN/.test(sql)) {
      return [{ id: 'president-user', email: 'president@example.test' }];
    }
    if (/FROM players\s+WHERE user_id IN/.test(sql)) {
      return [{ id: 'player-president', user_id: 'president-user', email: 'president@example.test', gamertag: 'Prez', club_id: 'club-1', role: 'president', status: 'active' }];
    }
    if (/FROM players\s+WHERE LOWER\(TRIM\(email\)\) IN/.test(sql)) return [];
    if (/UPDATE clubs SET/.test(sql)) {
      writes.push({ sql, params });
      return { affectedRows: 1 };
    }
    if (/INSERT INTO admin_audit_log/.test(sql)) {
      writes.push({ sql, params });
      return { affectedRows: 1 };
    }
    if (/UPDATE players SET/.test(sql) || /UPDATE player_contracts/.test(sql) || /DELETE FROM club_memberships/.test(sql) || /DELETE FROM club_staff_roles/.test(sql)) {
      throw new Error(`Destructive repair SQL must not run: ${sql}`);
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  const handle = postFunctionHandler(router);
  const response = makeJsonResponse();

  await handle(
    { params: { name: 'repairPlayerPresidentIdentityLinks' }, body: { scan_all: true, dry_run: false }, user: { id: 'admin-user' } },
    response,
  );

  assert.equal(response.statusCode, 200, response.body?.error);
  assert.equal(response.body.repaired_count, 1);
  const clubUpdate = writes.find((call) => /UPDATE clubs SET/.test(call.sql));
  assert.ok(clubUpdate, 'club update should run');
  assert.equal(clubUpdate.params[0], 'player-president');
  assert.equal(clubUpdate.params[1], 'president-user');
  assert.equal(clubUpdate.params[2], 'president-user');
  assert.equal(clubUpdate.params[3], 'president@example.test');
  assert.equal(clubUpdate.params[4], 'club-1');
  const audit = writes.find((call) => /INSERT INTO admin_audit_log/.test(call.sql));
  assert.ok(audit, 'admin audit row should be written');
  assert.equal(audit.params[3], 'repair_player_president_identity_links');
  assert.equal(audit.params[4], 'club');
  assert.equal(audit.params[5], 'club-1');
});

test('contractManagement accept rejects ownership contracts for unlinked player identities', async () => {
  const queries = [];
  const contract = {
    id: 'ownership-contract-unlinked',
    team_id: 'club-1',
    user_id: 'player-president',
    status: 'pending',
    contract_type: 'ownership',
    weekly_salary_stc: 0,
    max_days: 3650,
    captaincy_offered: 0,
  };
  const player = {
    id: 'player-president',
    user_id: null,
    email: 'president@example.test',
    club_id: null,
    role: 'free_agent',
    club_roles: null,
  };
  const club = {
    id: 'club-1',
    name: 'Club One',
    wage_budget_stc: 1000000,
    user_id: 'old-president-user',
    president_user_id: 'old-president-user',
    owner_email: 'old@example.test',
  };
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
      if (/UPDATE players SET user_id = COALESCE/.test(sql)) return [{ affectedRows: 1 }, []];
      if (/FROM player_contracts/.test(sql) && /id <> \?/.test(sql) && /status IN/.test(sql)) return [[], []];
      if (/UPDATE player_contracts SET status = 'active'/.test(sql)) return [{ affectedRows: 1 }, []];
      if (/UPDATE inbox_messages/.test(sql)) return [{ affectedRows: 1 }, []];
      if (/UPDATE notifications/.test(sql)) return [{ affectedRows: 1 }, []];
      if (/UPDATE players SET club_id = \?/.test(sql)) return [{ affectedRows: 1 }, []];
      if (/UPDATE clubs SET president_user_id = \?/.test(sql)) return [{ affectedRows: 1 }, []];
      if (/UPDATE users SET owner_id = \?/.test(sql)) return [{ affectedRows: 1 }, []];
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
  const router = loadFunctionsRouterWithDbMock(async (sql) => {
    throw new Error(`Unexpected SQL outside transaction: ${sql}`);
  }, { pool });
  const handle = postFunctionHandler(router);
  const response = makeJsonResponse();

  await handle(
    {
      params: { name: 'contractManagement' },
      body: { action: 'accept', contract_id: 'ownership-contract-unlinked' },
      user: { id: 'accepting-user' },
    },
    response,
  );

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /linked user account/);
  assert.equal(queries.some((call) => /UPDATE players SET user_id = COALESCE/.test(call.sql)), false);
  assert.equal(queries.some((call) => /UPDATE clubs SET president_user_id = \?/.test(call.sql)), false);
});

test('contractManagement mark_pending_window activates free-agent accepted contracts immediately', async () => {
  const queries = [];
  const contract = {
    id: 'contract-free-agent',
    team_id: 'club-1',
    user_id: 'player-1',
    status: 'pending',
    contract_type: 'star',
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
  const club = makeFinanceReadyClub();
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
      if (/SELECT \* FROM clubs WHERE id = \? LIMIT 1/.test(sql)) return [[club], []];
      if (isClubFinanceUsageQuery(sql)) return [[{ active_wages: 0, pending_wages: 0, pending_transfer_fees: 0 }], []];
      if (/FROM player_contracts/.test(sql) && /id <> \?/.test(sql) && /status IN/.test(sql)) return [[], []];
      if (/UPDATE player_contracts SET status = 'active'/.test(sql)) return [{ affectedRows: 1 }, []];
      if (/UPDATE inbox_messages/.test(sql)) return [{ affectedRows: 1 }, []];
      if (/UPDATE notifications/.test(sql)) return [{ affectedRows: 1 }, []];
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
  const executesql = async (sql, params = []) => {
    queries.push({ sql, params });
    if (/SELECT pc\.\*, p\.club_id AS player_club_id/.test(sql)) {
      return [{ ...contract, player_club_id: null }];
    }
    if (/UPDATE player_contracts SET status = 'pending_window'/.test(sql)) return { affectedRows: 1 };
    if (/UPDATE inbox_messages/.test(sql)) return { affectedRows: 1 };
    if (/UPDATE notifications/.test(sql)) return { affectedRows: 1 };
    if (/SELECT \*, user_id AS target_player_id FROM player_contracts WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ ...contract, status: 'pending_window' }];
    }
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
      body: { action: 'mark_pending_window', contract_id: 'contract-free-agent' },
      user: { id: 'user-player' },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.status, 'active');
  assert.equal(queries.some((call) => /UPDATE player_contracts SET status = 'pending_window'/.test(call.sql)), false);
  assert.equal(queries.some((call) => /UPDATE players SET club_id = \?/.test(call.sql)), true);
});

test('contractManagement offer rejects another live player contract from the same club', async () => {
  const contractInserts = [];
  const clubRow = {
    id: 'club-1',
    user_id: 'owner-user',
    president_user_id: 'owner-user',
    president_id: 'pres-1',
    owner_email: 'owner@example.test',
  };
  const executesql = async (sql, params = []) => {
    if (/SELECT id, email, player_id, owner_id, role_id, role FROM users WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: 'owner-user', email: 'owner@example.test', player_id: 'owner-player', owner_id: 'club-1', role_id: 1 }];
    }
    if (/SELECT \* FROM players WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: params[0], email: 'owner@example.test', club_id: 'club-1', club_roles: JSON.stringify(['president']) }];
    }
    if (/FROM club_memberships/.test(sql)) return [];
    if (/SELECT \* FROM clubs WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ ...clubRow, id: params[0] }];
    }
    if (/SELECT \* FROM clubs WHERE president_user_id = \? LIMIT 1/.test(sql)) {
      return [clubRow];
    }
    if (/SELECT \* FROM presidents WHERE/.test(sql)) {
      return [{ id: 'pres-1', user_id: 'owner-user', club_id: 'club-1' }];
    }
    if (/FROM club_staff_roles/.test(sql)) return [{ id: 'staff-1', club_id: 'club-1', user_id: 'owner-user', player_id: 'owner-player', role: 'recruiter', permissions: JSON.stringify(['offer_contracts']) }];
    if (/FROM player_contracts/.test(sql) && /status IN/.test(sql)) {
      return [{ id: 'active-contract', team_id: 'club-1', user_id: 'target-player', contract_type: 'squad', status: 'active' }];
    }
    if (/CREATE TABLE IF NOT EXISTS transfer_windows/.test(sql)) return { affectedRows: 0 };
    if (/SELECT \* FROM transfer_windows WHERE status = 'open'/.test(sql)) return [{ id: 'window-open', status: 'open' }];
    if (/SELECT \*, user_id AS target_player_id FROM player_contracts WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: params[0], team_id: 'club-1', user_id: 'target-player', contract_type: 'star', status: 'pending' }];
    }
    if (/INSERT INTO player_contracts/.test(sql)) {
      contractInserts.push(params);
      return { affectedRows: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadFunctionsRouterWithDbMock(executesql, {
    messageDeliveryServiceMock: {
      deliverContractOfferMessage: async () => {},
    },
  });
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
      body: {
        action: 'offer',
        team_id: 'club-1',
        user_id: 'target-player',
        contract_type: 'star',
      },
      user: { id: 'owner-user' },
    },
    response,
  );

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.code, 'contract_conflict');
  assert.equal(contractInserts.length, 0);
});

test('contractManagement accept closes competing live offers for the same player contract group', async () => {
  const queries = [];
  const contract = {
    id: 'accepted-contract',
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
  const club = makeFinanceReadyClub();
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
      if (/SELECT \* FROM clubs WHERE id = \? LIMIT 1/.test(sql)) return [[club], []];
      if (isClubFinanceUsageQuery(sql)) return [[{ active_wages: 0, pending_wages: 0, pending_transfer_fees: 0 }], []];
      if (/FROM player_contracts/.test(sql) && /id <> \?/.test(sql)) {
        return [[
          { id: 'other-offer', team_id: 'club-2', user_id: 'player-1', contract_type: 'important', status: 'pending' },
          { id: 'old-active', team_id: 'club-1', user_id: 'player-1', contract_type: 'academy', status: 'active' },
        ], []];
      }
      if (/UPDATE player_contracts SET status = 'active'/.test(sql)) return [{ affectedRows: 1 }, []];
      if (/UPDATE player_contracts/.test(sql) && /CASE WHEN team_id = \? THEN 'completed' ELSE 'terminated' END/.test(sql)) return [{ affectedRows: 1 }, []];
      if (/UPDATE player_contracts/.test(sql) && /status = 'cancelled'/.test(sql)) return [{ affectedRows: 1 }, []];
      if (/UPDATE inbox_messages/.test(sql)) return [{ affectedRows: 1 }, []];
      if (/UPDATE notifications/.test(sql)) return [{ affectedRows: 1 }, []];
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
  const router = loadFunctionsRouterWithDbMock(async (sql) => {
    throw new Error(`Unexpected SQL outside transaction: ${sql}`);
  }, { pool });
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
      body: { action: 'accept', contract_id: 'accepted-contract' },
      user: { id: 'user-player' },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(queries.some((call) => /status = 'cancelled'/.test(call.sql) && call.params.includes('other-offer')), true);
  assert.equal(queries.some((call) => /CASE WHEN team_id = \? THEN 'completed' ELSE 'terminated' END/.test(call.sql) && call.params.includes('old-active')), true);
  assert.equal(queries.some((call) => /UPDATE inbox_messages/.test(call.sql) && call.params.includes('other-offer')), true);
});

test('transferWindowActions execute_pending activates accepted window-waiting contracts', async () => {
  const queries = [];
  const pendingContract = {
    id: 'pending-window-contract',
    team_id: 'club-1',
    user_id: 'player-1',
    status: 'pending_window',
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
  const club = makeFinanceReadyClub();
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async query(sql, params = []) {
      queries.push({ sql, params });
      if (/SELECT \* FROM player_contracts WHERE id = \? LIMIT 1 FOR UPDATE/.test(sql)) return [[pendingContract], []];
      if (/SELECT \* FROM players WHERE id = \? LIMIT 1 FOR UPDATE/.test(sql)) return [[player], []];
      if (/SELECT \* FROM clubs WHERE id = \? LIMIT 1 FOR UPDATE/.test(sql)) return [[club], []];
      if (/SELECT \* FROM clubs WHERE id = \? LIMIT 1/.test(sql)) return [[club], []];
      if (isClubFinanceUsageQuery(sql)) return [[{ active_wages: 0, pending_wages: 0, pending_transfer_fees: 0 }], []];
      if (/FROM player_contracts/.test(sql) && /id <> \?/.test(sql)) return [[], []];
      if (/UPDATE player_contracts SET status = 'active'/.test(sql)) return [{ affectedRows: 1 }, []];
      if (/UPDATE inbox_messages/.test(sql)) return [{ affectedRows: 1 }, []];
      if (/UPDATE notifications/.test(sql)) return [{ affectedRows: 1 }, []];
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
  const executesql = async (sql, params = []) => {
    if (/CREATE TABLE IF NOT EXISTS transfer_windows/.test(sql)) return { affectedRows: 0 };
    if (/SELECT \* FROM transfer_windows WHERE status = 'open'/.test(sql)) {
      return [{ id: 'window-1', status: 'open' }];
    }
    if (/SELECT \*, user_id AS target_player_id FROM player_contracts WHERE status = 'pending_window'/.test(sql)) {
      return [pendingContract];
    }
    if (/UPDATE transfer_windows SET transfers_executed/.test(sql)) {
      queries.push({ sql, params });
      return { affectedRows: 1 };
    }
    if (/SELECT \* FROM transfer_windows WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: params[0], status: 'open', transfers_executed: 1 }];
    }
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
      params: { name: 'transferWindowActions' },
      body: { action: 'execute_pending' },
      user: { id: 'admin-user' },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.transfers_executed, 1);
  assert.equal(queries.some((call) => /UPDATE player_contracts SET status = 'active'/.test(call.sql)), true);
  assert.equal(queries.some((call) => /UPDATE players SET club_id = \?/.test(call.sql)), true);
});

test('contractManagement expire_overdue completes max-game contracts and releases player membership', async () => {
  const queries = [];
  const completeByGames = {
    id: 'contract-games-done',
    team_id: 'club-1',
    user_id: 'player-1',
    status: 'active',
    contract_type: 'squad',
    max_games: 2,
    games_played: 2,
    end_date: null,
  };
  const expiredByDate = {
    id: 'contract-date-done',
    team_id: 'club-2',
    user_id: 'player-2',
    status: 'active',
    contract_type: 'squad',
    max_games: 100,
    games_played: 1,
    end_date: '2026-01-01',
  };
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async query(sql, params = []) {
      queries.push({ sql, params });
      if (/FROM player_contracts/.test(sql) && /status = 'active'/.test(sql) && /FOR UPDATE/.test(sql)) {
        return [[completeByGames, expiredByDate], []];
      }
      if (/UPDATE player_contracts SET status = \?/.test(sql)) return [{ affectedRows: 1 }, []];
      if (/INSERT INTO player_contract_history/.test(sql)) return [{ affectedRows: 1 }, []];
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
  const router = loadFunctionsRouterWithDbMock(async (sql) => {
    throw new Error(`Unexpected SQL outside transaction: ${sql}`);
  }, { pool });
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
      body: { action: 'expire_overdue' },
      user: { id: 'admin-user' },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.completed_count, 1);
  assert.equal(response.body.data.expired_count, 1);
  assert.equal(queries.some((call) => /UPDATE player_contracts SET status = \?/.test(call.sql) && call.params[0] === 'completed'), true);
  assert.equal(queries.some((call) => /UPDATE player_contracts SET status = \?/.test(call.sql) && call.params[0] === 'expired'), true);
  assert.equal(queries.filter((call) => /UPDATE players p/.test(call.sql)).length, 2);
  assert.equal(queries.filter((call) => /UPDATE club_memberships cm/.test(call.sql)).length, 2);
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

test('contractManagement terminate rejects founder and president lifecycle contracts', async () => {
  const queries = [];
  const contract = {
    id: 'founder-contract-1',
    team_id: 'club-1',
    user_id: 'player-1',
    status: 'active',
    contract_type: 'ownership',
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
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const pool = {
    promise() {
      return { getConnection: async () => connection };
    },
  };
  const router = loadFunctionsRouterWithDbMock(async (sql) => {
    throw new Error(`Unexpected SQL outside transaction: ${sql}`);
  }, { pool });
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
      body: { action: 'terminate', contract_id: 'founder-contract-1' },
      user: { id: 'admin-user' },
    },
    response,
  );

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.code, 'lifecycle_owned_contract');
  assert.equal(queries.some((call) => /UPDATE player_contracts SET status = 'terminated'/.test(call.sql)), false);
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

test('matchKickoff completes when both sides submit the same score even if proofs are unreadable', async () => {
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
    stats_processed: 0,
    home_submission: JSON.stringify({
      home_score: 5,
      away_score: 2,
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
    if (/UPDATE matches SET status='completed'/.test(sql)) {
      updates.push({ sql, params });
      match.status = 'completed';
      match.home_score = params[0];
      match.away_score = params[1];
      return { affectedRows: 1 };
    }
    if (/UPDATE clubs SET/.test(sql)) {
      updates.push({ sql, params });
      return { affectedRows: 1 };
    }
    if (/SELECT \* FROM clubs WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: params[0], name: params[0] === 'club-home' ? 'Home FC' : 'Away FC', stadium_level: 0, wins: 0, losses: 0, draws: 0 }];
    }
    if (/SELECT \* FROM stadium_config ORDER BY level ASC/.test(sql)) return [];
    if (/SELECT id FROM stc_transactions WHERE club_id = \? AND category = 'ticket_revenue'/.test(sql)) {
      return [{ id: 'existing-ticket-revenue' }];
    }
    if (/UPDATE matches SET home_ticket_revenue=/.test(sql)) return { affectedRows: 1 };
    if (/UPDATE matches SET stats_processed = 1/.test(sql)) {
      match.stats_processed = 1;
      return { affectedRows: 1 };
    }
    if (/UPDATE matches SET wager_status = 'settling'/.test(sql)) return { affectedRows: 0 };
    if (/SELECT \* FROM match_player_stats WHERE match_id = \?/.test(sql)) return [];
    if (/FROM matches WHERE id = \? LIMIT 1/.test(sql)) return [match];
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadFunctionsRouterWithDbMock(executesql, {
    serviceMock: {
      advanceAfterFinalResult: async () => ({ triggered: true }),
    },
  });
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
        home_score: 5,
        away_score: 2,
        proof_url: '/uploads/away-proof.png',
      },
      user: { id: 'user-1' },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.status, 'completed');
  assert.equal(match.status, 'completed');
  assert.equal(match.home_score, 5);
  assert.equal(match.away_score, 2);
  assert.ok(updates.some((call) => /UPDATE clubs SET/.test(call.sql)));
  assert.ok(!updates.some((call) => /status = 'disputed'/.test(call.sql)));
});

test('matchKickoff disputes only when the two sides declare different scores', async () => {
  const updates = [];
  const match = {
    id: 'match-disagree',
    status: 'in_progress',
    mode: 'club',
    home_club_id: 'club-home',
    away_club_id: 'club-away',
    home_club_name: 'Home FC',
    away_club_name: 'Away FC',
    result_home_submitted: 1,
    result_away_submitted: 0,
    home_submission: JSON.stringify({
      home_score: 5,
      away_score: 2,
      player_stats: [],
      goal_events: [],
      proof_url: '/uploads/home-proof.png',
    }),
    away_submission: null,
  };

  const executesql = async (sql, params = []) => {
    if (/SELECT \* FROM matches WHERE id = \? LIMIT 1/.test(sql)) return [match];
    if (/UPDATE matches SET away_submission = \?/.test(sql)) {
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
        match_id: 'match-disagree',
        is_home_team: false,
        home_score: 2,
        away_score: 5,
        proof_url: '/uploads/away-proof.png',
      },
      user: { id: 'user-1' },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.status, 'disputed');
  assert.equal(response.body.data.reason, 'submitted_scores_disagree');
  assert.ok(updates.some((call) => /UPDATE matches SET status = 'disputed'/.test(call.sql)));
});

test('matchKickoff completes when away reports the same team goals from their side', async () => {
  const match = {
    id: 'match-perspective-agree',
    status: 'in_progress',
    mode: 'club',
    home_club_id: 'club-home',
    away_club_id: 'club-away',
    home_club_name: 'Home FC',
    away_club_name: 'Away FC',
    result_home_submitted: 1,
    result_away_submitted: 0,
    stats_processed: 0,
    home_submission: JSON.stringify({
      home_score: 5,
      away_score: 2,
      own_score: 5,
      opponent_score: 2,
      player_stats: [],
      goal_events: [],
      proof_url: '/uploads/home-proof.png',
    }),
    away_submission: null,
  };

  const executesql = async (sql, params = []) => {
    if (/SELECT \* FROM matches WHERE id = \? LIMIT 1/.test(sql)) return [match];
    if (/UPDATE matches SET away_submission = \?/.test(sql)) {
      match.away_submission = params[0];
      match.result_away_submitted = 1;
      return { affectedRows: 1 };
    }
    if (/UPDATE matches SET status='completed'/.test(sql)) {
      match.status = 'completed';
      match.home_score = params[0];
      match.away_score = params[1];
      return { affectedRows: 1 };
    }
    if (/UPDATE clubs SET/.test(sql)) return { affectedRows: 1 };
    if (/SELECT \* FROM clubs WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: params[0], name: params[0] === 'club-home' ? 'Home FC' : 'Away FC', stadium_level: 0, wins: 0, losses: 0, draws: 0 }];
    }
    if (/SELECT \* FROM stadium_config ORDER BY level ASC/.test(sql)) return [];
    if (/SELECT id FROM stc_transactions WHERE club_id = \? AND category = 'ticket_revenue'/.test(sql)) {
      return [{ id: 'existing-ticket-revenue' }];
    }
    if (/UPDATE matches SET home_ticket_revenue=/.test(sql)) return { affectedRows: 1 };
    if (/UPDATE matches SET stats_processed = 1/.test(sql)) {
      match.stats_processed = 1;
      return { affectedRows: 1 };
    }
    if (/UPDATE matches SET wager_status = 'settling'/.test(sql)) return { affectedRows: 0 };
    if (/SELECT \* FROM match_player_stats WHERE match_id = \?/.test(sql)) return [];
    if (/FROM matches WHERE id = \? LIMIT 1/.test(sql)) return [match];
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadFunctionsRouterWithDbMock(executesql, {
    serviceMock: { advanceAfterFinalResult: async () => ({ triggered: true }) },
  });
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
        match_id: 'match-perspective-agree',
        is_home_team: false,
        own_score: 2,
        opponent_score: 5,
        proof_url: '/uploads/away-proof.png',
      },
      user: { id: 'user-1' },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.status, 'completed');
  assert.equal(match.home_score, 5);
  assert.equal(match.away_score, 2);
});

test('matchKickoff disputes when home 2-5 and away 2-5 are different team goals', async () => {
  const match = {
    id: 'match-perspective-disagree',
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
      away_score: 5,
      own_score: 2,
      opponent_score: 5,
      player_stats: [],
      goal_events: [],
      proof_url: '/uploads/home-proof.png',
    }),
    away_submission: null,
  };

  const executesql = async (sql, params = []) => {
    if (/SELECT \* FROM matches WHERE id = \? LIMIT 1/.test(sql)) return [match];
    if (/UPDATE matches SET away_submission = \?/.test(sql)) {
      match.away_submission = params[0];
      match.result_away_submitted = 1;
      return { affectedRows: 1 };
    }
    if (/UPDATE matches SET status = 'disputed'/.test(sql)) {
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
        match_id: 'match-perspective-disagree',
        is_home_team: false,
        own_score: 2,
        opponent_score: 5,
        proof_url: '/uploads/away-proof.png',
      },
      user: { id: 'user-1' },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.status, 'disputed');
  assert.equal(response.body.data.reason, 'submitted_scores_disagree');
});

test('matchKickoff admin_resolve requires admin and validates manual scores', async () => {
  const match = {
    id: 'match-dispute-1',
    status: 'disputed',
    mode: 'club',
    home_club_id: 'club-home',
    away_club_id: 'club-away',
    home_club_name: 'Home FC',
    away_club_name: 'Away FC',
    home_submission: JSON.stringify({
      home_score: 2,
      away_score: 1,
      player_stats: [],
      goal_events: [],
      proof_url: '/uploads/home-proof.png',
    }),
    away_submission: JSON.stringify({
      home_score: 1,
      away_score: 2,
      player_stats: [],
      goal_events: [],
      proof_url: '/uploads/away-proof.png',
    }),
    stats_processed: 0,
  };

  const updates = [];
  const executesql = async (sql, params = []) => {
    if (/SELECT id, email, role_id FROM users WHERE id = \? LIMIT 1/.test(sql)) {
      if (params[0] === 'admin-1') return [{ id: 'admin-1', email: 'admin@example.test', role_id: 0 }];
      return [{ id: params[0], email: 'player@example.test', role_id: 1 }];
    }
    if (/SELECT \* FROM matches WHERE id = \? LIMIT 1/.test(sql)) return [match];
    if (/SELECT \* FROM clubs WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: params[0], name: params[0] === 'club-home' ? 'Home FC' : 'Away FC', stadium_level: 0 }];
    }
    if (/SELECT \* FROM stadium_config ORDER BY level ASC/.test(sql)) return [];
    if (/SELECT id FROM stc_transactions WHERE club_id = \? AND category = 'ticket_revenue'/.test(sql)) {
      return [{ id: 'existing-ticket-revenue' }];
    }
    if (/UPDATE matches SET status='completed'/.test(sql)) {
      updates.push({ sql, params });
      match.status = 'completed';
      match.home_score = params[0];
      match.away_score = params[1];
      match.stats_processed = 1;
      return { affectedRows: 1 };
    }
    if (/UPDATE clubs SET/.test(sql)) return { affectedRows: 1 };
    if (/UPDATE matches SET home_ticket_revenue=/.test(sql)) return { affectedRows: 1 };
    if (/UPDATE matches SET stats_processed = 1/.test(sql)) {
      match.stats_processed = 1;
      return { affectedRows: 1 };
    }
    if (/UPDATE matches SET wager_status = 'settling'/.test(sql)) return { affectedRows: 0 };
    if (/SELECT \* FROM match_player_stats WHERE match_id = \?/.test(sql)) return [];
    if (/FROM matches WHERE id = \? LIMIT 1/.test(sql)) return [match];
    if (/sync/.test(sql)) return [];
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const progressedMatches = [];
  const router = loadFunctionsRouterWithDbMock(executesql, {
    serviceMock: {
      advanceAfterFinalResult: async (record) => {
        progressedMatches.push(record);
        return { triggered: true, source: 'match', match_id: record.id };
      },
    },
  });
  const handle = postFunctionHandler(router);

  const nonAdminResponse = makeJsonResponse();
  await handle(
    {
      params: { name: 'matchKickoff' },
      body: {
        action: 'admin_resolve',
        match_id: 'match-dispute-1',
        admin_resolve_winner: 'home',
        admin_home_score: 2,
        admin_away_score: 1,
      },
      user: { id: 'player-user' },
    },
    nonAdminResponse,
  );
  assert.notEqual(nonAdminResponse.statusCode, 200);
  assert.equal(nonAdminResponse.body.error, 'Admin only');

  const invalidScoreResponse = makeJsonResponse();
  await handle(
    {
      params: { name: 'matchKickoff' },
      body: {
        action: 'admin_resolve',
        match_id: 'match-dispute-1',
        admin_resolve_winner: 'home',
        admin_home_score: 'NaN',
        admin_away_score: 1,
      },
      user: { id: 'admin-1' },
    },
    invalidScoreResponse,
  );
  assert.notEqual(invalidScoreResponse.statusCode, 200);
  assert.equal(invalidScoreResponse.body.error, 'admin_home_score must be a non-negative integer');

  const emptyScoreResponse = makeJsonResponse();
  await handle(
    {
      params: { name: 'matchKickoff' },
      body: {
        action: 'admin_resolve',
        match_id: 'match-dispute-1',
        admin_resolve_winner: 'home',
        admin_home_score: '',
        admin_away_score: ' ',
      },
      user: { id: 'admin-1' },
    },
    emptyScoreResponse,
  );
  assert.notEqual(emptyScoreResponse.statusCode, 200);
  assert.equal(emptyScoreResponse.body.error, 'admin_home_score must be a non-negative integer');

  const validResponse = makeJsonResponse();
  await handle(
    {
      params: { name: 'matchKickoff' },
      body: {
        action: 'admin_resolve',
        match_id: 'match-dispute-1',
        admin_resolve_winner: 'home',
        admin_home_score: '3',
        admin_away_score: 2,
      },
      user: { id: 'admin-1' },
    },
    validResponse,
  );

  assert.equal(validResponse.statusCode, 200);
  assert.equal(validResponse.body.data.status, 'completed');
  assert.equal(match.home_score, 3);
  assert.equal(match.away_score, 2);
  assert.equal(updates.length, 1);
  assert.equal(progressedMatches.length, 1);
  assert.equal(progressedMatches[0].id, 'match-dispute-1');
});

test('adminMatchActions approve forfeit triggers central final-result progression', async () => {
  const match = {
    id: 'match-forfeit-1',
    status: 'scheduled',
    mode: 'club',
    home_club_id: 'club-home',
    away_club_id: 'club-away',
    home_club_name: 'Home FC',
    away_club_name: 'Away FC',
    forfeit_claimed_by: 'club-home',
  };
  const auditRows = [];
  const conn = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async query(sql, params = []) {
      if (/SELECT \* FROM matches WHERE id = \? LIMIT 1 FOR UPDATE/.test(sql)) return [[match], []];
      if (/UPDATE matches\s+SET status = \?/.test(sql)) {
        match.status = params[0];
        match.forfeit_status = params[1];
        match.winner_club_id = params[2];
        match.winner_club_name = params[3];
        return [{ affectedRows: 1 }, []];
      }
      if (/SELECT \* FROM matches WHERE id = \? LIMIT 1/.test(sql)) return [[match], []];
      throw new Error(`Unexpected transaction SQL: ${sql}`);
    },
  };
  const executesql = async (sql, params = []) => {
    if (/SELECT id, email, role_id FROM users WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: params[0], email: 'admin@example.test', role_id: 0 }];
    }
    if (/INSERT INTO admin_audit_log/.test(sql)) {
      auditRows.push(params);
      return { affectedRows: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const progressed = [];
  const router = loadFunctionsRouterWithDbMock(executesql, {
    pool: { promise: () => ({ getConnection: async () => conn }) },
    serviceMock: {
      advanceAfterFinalResult: async (record) => {
        progressed.push(record);
        return { triggered: true, source: 'match', match_id: record.id };
      },
    },
  });
  const handle = postFunctionHandler(router);
  const response = makeJsonResponse();

  await handle(
    {
      params: { name: 'adminMatchActions' },
      body: { action: 'resolve_forfeit', match_id: 'match-forfeit-1', approve: true },
      user: { id: 'admin-1' },
    },
    response,
  );

  assert.equal(response.statusCode, 200, response.body?.error);
  assert.equal(response.body.data.success, true);
  assert.equal(response.body.data.match.status, 'forfeit');
  assert.equal(response.body.data.progression.triggered, true);
  assert.equal(progressed.length, 1);
  assert.equal(progressed[0].id, 'match-forfeit-1');
  assert.equal(progressed[0].status, 'forfeit');
  assert.equal(auditRows.length, 1);
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
              if (/SELECT credits FROM users WHERE id = \? LIMIT 1/.test(sql)) return [[{ credits: 150 }], []];
              if (/SELECT id, subscription/.test(sql) && /FROM players/.test(sql)) {
                return [[{ id: 'player-1', subscription: 'stage_plus' }], []];
              }
              if (/SELECT role_id/.test(sql) && /FROM users/.test(sql)) return [[{ role_id: 0 }], []];
              if (/SELECT id/.test(sql) && /FROM clubs/.test(sql) && /president_user_id/.test(sql)) return [[], []];
              if (/registered_clubs, registered_players/.test(sql)) return [[], []];
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
    if (/SELECT \* FROM store_settings/.test(sql) || /FROM store_configs/.test(sql)) return [];
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

  assert.equal(response.statusCode, 200, response.body?.error || JSON.stringify(response.body));
  assert.equal(response.body.data.success, true);
  assert.equal(updates.length, 1);
  const proofs = JSON.parse(updates[0].params[1]);
  assert.equal(proofs.club['club-1'].proof_url, '/uploads/pro-club.png');
  assert.equal(proofs.club['club-1'].proof_type, 'pro_club');
});

test('tournamentRegistration allows canonical president user to register their club', async () => {
  const updates = [];
  const tournament = {
    id: 'tournament-1',
    name: 'President Cup',
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
    president_user_id: 'president-user',
    owner_email: 'legacy-owner@example.test',
    user_id: 'legacy-owner-user',
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
              if (/SELECT credits FROM users WHERE id = \? LIMIT 1/.test(sql)) return [[{ credits: 150 }], []];
              if (/SELECT id, subscription/.test(sql) && /FROM players/.test(sql)) {
                return [[{ id: 'player-1', subscription: 'stage_plus' }], []];
              }
              if (/SELECT role_id/.test(sql) && /FROM users/.test(sql)) return [[{ role_id: 0 }], []];
              if (/SELECT id/.test(sql) && /FROM clubs/.test(sql) && /president_user_id/.test(sql)) return [[], []];
              if (/registered_clubs, registered_players/.test(sql)) return [[], []];
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
      return [{ id: params[0], email: 'president@example.test', role_id: 1 }];
    }
    if (/SELECT \* FROM store_settings/.test(sql) || /FROM store_configs/.test(sql)) return [];
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
      user: { id: 'president-user' },
    },
    response,
  );

  assert.equal(response.statusCode, 200, response.body?.error || JSON.stringify(response.body));
  assert.equal(response.body.data.success, true);
  assert.equal(updates.length, 1);
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
              if (/SELECT credits FROM users WHERE id = \? LIMIT 1/.test(sql)) return [[{ credits: 150 }], []];
              if (/SELECT id, subscription/.test(sql) && /FROM players/.test(sql)) {
                return [[{ id: 'player-1', subscription: 'stage_plus' }], []];
              }
              if (/SELECT role_id/.test(sql) && /FROM users/.test(sql)) return [[{ role_id: 0 }], []];
              if (/SELECT id/.test(sql) && /FROM clubs/.test(sql) && /president_user_id/.test(sql)) return [[], []];
              if (/registered_clubs, registered_players/.test(sql)) return [[], []];
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
    if (/SELECT \* FROM store_configs/.test(sql) || /FROM store_settings/.test(sql)) return [];
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

  assert.equal(response.statusCode, 200, response.body?.error || JSON.stringify(response.body));
  assert.equal(response.body.data.success, true);
  assert.equal(updates.length, 1);
  const proofs = JSON.parse(updates[0].params[1]);
  assert.equal(proofs.player['player-1'].proof_url, '/uploads/ultimate-team.png');
  assert.equal(proofs.player['player-1'].proof_type, 'ultimate_team');
});

test('tournamentWithdrawal allows canonical president user to withdraw their club', async () => {
  const updates = [];
  const tournament = {
    id: 'tournament-1',
    status: 'registration',
    registered_clubs: JSON.stringify(['club-1']),
    entry_credits: 50,
    entry_fee_stc: 0,
  };
  const club = {
    id: 'club-1',
    president_user_id: 'president-user',
    owner_email: 'legacy-owner@example.test',
    user_id: 'legacy-owner-user',
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
              if (/SELECT credits FROM users WHERE id = \? LIMIT 1/.test(sql)) return [[{ credits: 100 }], []];
              if (/UPDATE users SET credits = COALESCE\(credits, 0\) \+ \?/.test(sql)) {
                updates.push({ sql, params });
                return [{ affectedRows: 1 }, []];
              }
              if (/UPDATE tournaments SET registered_clubs = \?/.test(sql)) {
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
      return [{ id: params[0], email: 'president@example.test', role_id: 1 }];
    }
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
      params: { name: 'tournamentWithdrawal' },
      body: {
        tournament_id: 'tournament-1',
        club_id: 'club-1',
      },
      user: { id: 'president-user' },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.success, true);
  assert.equal(JSON.parse(updates.find((call) => /UPDATE tournaments/.test(call.sql)).params[0]).length, 0);
});
