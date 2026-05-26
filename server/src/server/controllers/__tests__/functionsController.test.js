const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadFunctionsRouterWithDbMock(executesql, options = {}) {
  const controllerPath = path.resolve(__dirname, '../functionsController.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  const servicePath = path.resolve(__dirname, '../../services/competitionEngineService.js');

  delete require.cache[controllerPath];
  delete require.cache[servicePath];
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
      ...options.serviceMock,
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
