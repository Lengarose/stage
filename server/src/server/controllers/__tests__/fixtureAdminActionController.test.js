const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadRouter({ executesql, serviceMock = {}, actionModelMock = {} }) {
  const routerPath = path.resolve(__dirname, '../fixtureAdminActionController.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  const actionModelPath = path.resolve(__dirname, '../../models/fixtureAdminActionModel.js');
  const servicePath = path.resolve(__dirname, '../../services/competitionEngineService.js');
  delete require.cache[routerPath];
  delete require.cache[dbPath];
  delete require.cache[actionModelPath];
  delete require.cache[servicePath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql, pool: {} },
  };
  class FixtureAdminActionMock {
    constructor(payload) {
      this.payload = payload;
    }
    async create() {
      return actionModelMock.create ? actionModelMock.create(this.payload) : 'audit-1';
    }
    static async selectOne(id) {
      return actionModelMock.selectOne ? actionModelMock.selectOne(id) : { id, action_type: 'declare_forfeit' };
    }
    static async selectAll() {
      return [];
    }
    static async delete() {
      return { affectedRows: 1 };
    }
  }
  require.cache[actionModelPath] = {
    id: actionModelPath,
    filename: actionModelPath,
    loaded: true,
    exports: FixtureAdminActionMock,
  };
  require.cache[servicePath] = {
    id: servicePath,
    filename: servicePath,
    loaded: true,
    exports: {
      advanceAfterFinalResult: async () => ({ triggered: false }),
      ...serviceMock,
    },
  };
  return require(routerPath);
}

function findHandler(router, routePath, method) {
  const layer = router.stack.find((entry) => entry.route?.path === routePath && entry.route.methods[method]);
  return layer.route.stack[0].handle;
}

function makeResponse() {
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

test('declare-forfeit triggers central final-result progression for updated competition fixtures', async () => {
  const progressed = [];
  let fixture = {
    id: 'fixture-1',
    season_id: 'season-1',
    home_club_id: 'club-home',
    home_club_name: 'Home FC',
    away_club_id: 'club-away',
    away_club_name: 'Away FC',
    status: 'scheduled',
    scheduling_status: 'confirmed',
  };
  const router = loadRouter({
    executesql: async (sql, params = []) => {
      if (/SELECT id, role_id, email FROM users WHERE id = \? LIMIT 1/.test(sql)) {
        return [{ id: 'admin-1', role_id: 0, email: 'admin@example.test' }];
      }
      if (/SELECT \* FROM league_entities WHERE id = \? AND entity_type = \? LIMIT 1/.test(sql)) {
        return [{
          id: params[0],
          entity_type: params[1],
          status: fixture.status,
          scheduling_status: fixture.scheduling_status,
          season_id: fixture.season_id,
          data_json: JSON.stringify(fixture),
        }];
      }
      if (/UPDATE league_entities\s+SET data_json = \?/.test(sql)) {
        fixture = JSON.parse(params[0]);
        return { affectedRows: 1 };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    serviceMock: {
      advanceAfterFinalResult: async (payload, options) => {
        progressed.push({ payload, options });
        return { triggered: true, advance: { advanced: true } };
      },
    },
  });
  const handle = findHandler(router, '/declare-forfeit', 'post');
  const response = makeResponse();

  await handle({
    user: { id: 'admin-1' },
    body: {
      fixture_id: 'fixture-1',
      fixture_type: 'competition',
      forfeiting_club_id: 'club-home',
    },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.fixture.status, 'forfeit');
  assert.equal(response.body.progression.triggered, true);
  assert.equal(progressed.length, 1);
  assert.equal(progressed[0].payload.fixture.status, 'forfeit');
  assert.equal(progressed[0].options.sourceType, 'competition');
});
