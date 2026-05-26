const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadFunctionsRouterWithDbMock(executesql, options = {}) {
  const controllerPath = path.resolve(__dirname, '../functionsController.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  const servicePath = path.resolve(__dirname, '../../services/competitionEngineService.js');
  const matchModelPath = path.resolve(__dirname, '../../models/matchModel.js');
  const socketPath = path.resolve(__dirname, '../../utils/socketBroadcast.js');

  delete require.cache[controllerPath];
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
  const executesql = async (sql, params) => {
    if (/FROM users WHERE id = \?/.test(sql)) {
      return [{ id: params[0], email: player.email, player_id: player.id, owner_id: null }];
    }
    if (/FROM players WHERE id = \?/.test(sql)) return [player];
    if (/FROM players WHERE user_id = \?/.test(sql)) return [];
    if (/FROM clubs WHERE/.test(sql)) return [];
    if (/FROM player_contracts/.test(sql)) return [];
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
  assert.equal(inserts[0][1], 'season-1');
  assert.equal(inserts[0][6], 'home-owner@example.test');
  assert.equal(inserts[0][7], 'away-owner@example.test');
  assert.equal(inserts[0][55], 'fixture-1');
  assert.equal(inserts[0][56], 'competition');
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
    if (/SELECT id, email, player_id, owner_id FROM users WHERE id = \? LIMIT 1/.test(sql)) {
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
