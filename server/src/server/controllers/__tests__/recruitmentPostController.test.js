const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadRecruitmentPostRouterWithMocks(executesql) {
  const controllerPath = path.resolve(__dirname, '../recruitmentPostController.js');
  const modelPath = path.resolve(__dirname, '../../models/recruitmentPostModel.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');

  delete require.cache[controllerPath];
  delete require.cache[modelPath];
  delete require.cache[dbPath];

  class RecruitmentPostMock {
    constructor(body = {}) {
      this.body = body;
      this.id = body.id || 'post-1';
    }

    create() {
      return executesql('TEST_CREATE_RECRUITMENT_POST', [this.id, this.body]);
    }

    update(id) {
      return executesql('TEST_UPDATE_RECRUITMENT_POST', [id, this.body]);
    }

    selectOne(id) {
      return executesql('TEST_SELECT_RECRUITMENT_POST', [id]);
    }
  }

  require.cache[modelPath] = {
    id: modelPath,
    filename: modelPath,
    loaded: true,
    exports: RecruitmentPostMock,
  };
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql },
  };

  return require(controllerPath);
}

function routeHandler(router, method, pathName) {
  const layer = router.stack.find((entry) => entry.route?.path === pathName && entry.route.methods[method]);
  return layer.route.stack[0].handle;
}

function makeResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };
}

test('club recruiting posts can be created by canonical club presidents without player profiles', async () => {
  const queries = [];
  let createdBody = null;
  const executesql = async (sql, params = []) => {
    queries.push({ sql, params });
    if (/SELECT id, email, role_id FROM users WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: 'president-user', email: 'president@example.test', role_id: 1 }];
    }
    if (/SELECT id FROM clubs WHERE id = \? AND/.test(sql)) {
      assert.match(sql, /president_user_id = \?/);
      assert.deepEqual(params, ['club-1', 'president-user', 'president-user', 'president@example.test']);
      return [{ id: 'club-1' }];
    }
    if (sql === 'TEST_CREATE_RECRUITMENT_POST') {
      createdBody = params[1];
      return { affectedRows: 1 };
    }
    if (sql === 'TEST_SELECT_RECRUITMENT_POST') {
      return [{ id: params[0], ...createdBody }];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadRecruitmentPostRouterWithMocks(executesql);
  const handle = routeHandler(router, 'post', '/');
  const response = makeResponse();

  await handle(
    {
      body: {
        post_type: 'club_recruiting',
        author_club_id: 'club-1',
        title: 'Need a striker',
        platform: 'PlayStation',
        region: 'Europe',
      },
      user: { id: 'president-user' },
    },
    response
  );

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.author_user_id, 'president-user');
  assert.equal(response.body.author_player_id, null);
  assert.equal(queries.some(({ sql }) => sql === 'TEST_CREATE_RECRUITMENT_POST'), true);
});

test('canonical presidents can close existing club recruitment posts', async () => {
  const queries = [];
  let updatedBody = null;
  const executesql = async (sql, params = []) => {
    queries.push({ sql, params });
    if (/SELECT id, email, role_id FROM users WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: 'president-user', email: 'president@example.test', role_id: 1 }];
    }
    if (sql === 'TEST_SELECT_RECRUITMENT_POST') {
      if (updatedBody) return [{ id: params[0], ...updatedBody }];
      return [{
        id: params[0],
        post_type: 'club_recruiting',
        author_user_id: 'other-manager',
        author_club_id: 'club-1',
        title: 'Need a striker',
        platform: 'PlayStation',
        region: 'Europe',
        status: 'open',
      }];
    }
    if (/SELECT id FROM clubs WHERE id = \? AND/.test(sql)) {
      assert.match(sql, /president_user_id = \?/);
      return [{ id: 'club-1' }];
    }
    if (/UPDATE recruitment_posts/.test(sql) || sql === 'TEST_UPDATE_RECRUITMENT_POST') {
      updatedBody = params[1] || {};
      return { affectedRows: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadRecruitmentPostRouterWithMocks(executesql);
  const handle = routeHandler(router, 'patch', '/:id');
  const response = makeResponse();

  await handle(
    {
      params: { id: 'post-1' },
      body: { status: 'closed' },
      user: { id: 'president-user' },
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, 'closed');
  assert.equal(queries.some(({ sql }) => /SELECT id FROM clubs WHERE id = \? AND/.test(sql)), true);
});
