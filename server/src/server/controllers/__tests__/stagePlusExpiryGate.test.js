const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

function jsonRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

function loadTournamentRouter(executesql, { getUserCredits = async () => 999 } = {}) {
  const controllerPath = path.resolve(__dirname, '../tournamentController.js');
  const modelPath = path.resolve(__dirname, '../../models/tournamentModel.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  const socketPath = path.resolve(__dirname, '../../utils/socketBroadcast.js');
  const creditsPath = path.resolve(__dirname, '../../services/userCreditsService.js');
  const helperPath = path.resolve(__dirname, '../../utils/subscriptionAccess.js');

  for (const cached of [controllerPath, modelPath, helperPath]) {
    delete require.cache[cached];
  }

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql, pool: {} },
  };
  require.cache[socketPath] = {
    id: socketPath,
    filename: socketPath,
    loaded: true,
    exports: { broadcastTournament() {}, broadcastTournamentDeleted() {} },
  };
  require.cache[creditsPath] = {
    id: creditsPath,
    filename: creditsPath,
    loaded: true,
    exports: {
      getUserCredits,
      spendUserCredits: async () => ({ credits_after: 900 }),
    },
  };

  return require(controllerPath);
}

function loadSeasonRegistrationRouter(executesql) {
  const controllerPath = path.resolve(__dirname, '../leagueEntityController.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  const helperPath = path.resolve(__dirname, '../../utils/subscriptionAccess.js');

  delete require.cache[controllerPath];
  delete require.cache[helperPath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql, pool: {} },
  };

  return require(controllerPath).makeRouter('season_registration');
}

function postHandler(router) {
  const layer = router.stack.find((entry) =>
    entry.route?.path === '/' &&
    entry.route.stack.some((routeEntry) => routeEntry.method === 'post')
  );
  return layer.route.stack.find((entry) => entry.method === 'post').handle;
}

function playerSql(sql) {
  return /FROM players/.test(sql) && /subscription/.test(sql);
}

function createdRegistration(clubId = 'club-1') {
  return [{
    id: 'reg-1',
    entity_type: 'season_registration',
    data_json: JSON.stringify({ club_id: clubId, id: 'reg-1' }),
    club_id: clubId,
  }];
}

test('create tournament allows Plus without expiry', async () => {
  const created = { id: 'cup-1', name: 'Open Cup' };
  const executesql = async (sql) => {
    if (/FROM users WHERE id = \?/.test(sql)) {
      return [{ id: 'user-1', email: 'plus@test.com', role_id: 1 }];
    }
    if (playerSql(sql)) {
      return [{ id: 'player-1', subscription: 'stage_plus', subscription_expires_at: null }];
    }
    if (/INSERT INTO tournaments/.test(sql)) return { insertId: 1 };
    if (/SELECT \* FROM tournaments WHERE id = \?/.test(sql)) return [created];
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadTournamentRouter(executesql);
  const res = jsonRes();
  await postHandler(router)({ user: { id: 'user-1' }, body: { name: 'Open Cup', type: 'knockout' } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.id, 'cup-1');
});

test('create tournament rejects Plus whose subscription_expires_at is in the past', async () => {
  const executesql = async (sql) => {
    if (/FROM users WHERE id = \?/.test(sql)) {
      return [{ id: 'user-1', email: 'expired@test.com', role_id: 1 }];
    }
    if (playerSql(sql)) {
      return [{
        id: 'player-1',
        subscription: 'stage_plus',
        subscription_expires_at: '2020-01-01T00:00:00.000Z',
      }];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadTournamentRouter(executesql);
  const res = jsonRes();
  await postHandler(router)({ user: { id: 'user-1' }, body: { name: 'Expired Cup' } }, res);
  assert.equal(res.statusCode, 403);
  assert.match(String(res.body?.error || ''), /STAGE Plus/i);
});

test('create tournament allows Plus with future expiry', async () => {
  const created = { id: 'cup-2', name: 'Future Cup' };
  const executesql = async (sql) => {
    if (/FROM users WHERE id = \?/.test(sql)) {
      return [{ id: 'user-1', email: 'plus@test.com', role_id: 1 }];
    }
    if (playerSql(sql)) {
      return [{
        id: 'player-1',
        subscription: 'stage_plus',
        subscription_expires_at: '2099-01-01T00:00:00.000Z',
      }];
    }
    if (/INSERT INTO tournaments/.test(sql)) return { insertId: 1 };
    if (/SELECT \* FROM tournaments WHERE id = \?/.test(sql)) return [created];
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadTournamentRouter(executesql);
  const res = jsonRes();
  await postHandler(router)({ user: { id: 'user-1' }, body: { name: 'Future Cup', type: 'knockout' } }, res);
  assert.equal(res.statusCode, 201);
});

test('create tournament allows admin even without Plus', async () => {
  const created = { id: 'cup-admin', name: 'Admin Cup' };
  const executesql = async (sql) => {
    if (/FROM users WHERE id = \?/.test(sql)) {
      return [{ id: 'admin-1', email: 'admin@test.com', role_id: 2 }];
    }
    if (playerSql(sql)) {
      throw new Error('admin must not be gated on player Plus');
    }
    if (/INSERT INTO tournaments/.test(sql)) return { insertId: 1 };
    if (/SELECT \* FROM tournaments WHERE id = \?/.test(sql)) return [created];
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadTournamentRouter(executesql);
  const res = jsonRes();
  await postHandler(router)({ user: { id: 'admin-1' }, body: { name: 'Admin Cup', type: 'knockout' } }, res);
  assert.equal(res.statusCode, 201);
});

test('GOST season_registration rejects expired Plus', async () => {
  const executesql = async (sql) => {
    if (/FROM users WHERE id = \?/.test(sql)) {
      return [{ id: 'user-1', email: 'expired@test.com', role_id: 1 }];
    }
    if (/FROM players/.test(sql)) {
      return [{
        id: 'player-1',
        subscription: 'stage_plus',
        subscription_expires_at: '2020-06-01T00:00:00.000Z',
      }];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadSeasonRegistrationRouter(executesql);
  const res = jsonRes();
  await postHandler(router)({ user: { id: 'user-1' }, body: { club_id: 'club-1' } }, res);
  assert.equal(res.statusCode, 403);
  assert.match(String(res.body?.error || ''), /STAGE Plus/i);
});

test('GOST season_registration allows Plus without expiry', async () => {
  const executesql = async (sql) => {
    if (/FROM users WHERE id = \?/.test(sql)) {
      return [{ id: 'user-1', email: 'plus@test.com', role_id: 1 }];
    }
    if (playerSql(sql)) {
      return [{ id: 'player-1', subscription: 'stage_plus', subscription_expires_at: null }];
    }
    if (/INSERT INTO/.test(sql)) return { insertId: 1 };
    if (/SELECT \*/.test(sql)) return createdRegistration();
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadSeasonRegistrationRouter(executesql);
  const res = jsonRes();
  await postHandler(router)({ user: { id: 'user-1' }, body: { club_id: 'club-1', status: 'pending' } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.club_id, 'club-1');
});

test('GOST season_registration allows Plus with future expiry', async () => {
  const executesql = async (sql) => {
    if (/FROM users WHERE id = \?/.test(sql)) {
      return [{ id: 'user-1', email: 'plus@test.com', role_id: 1 }];
    }
    if (playerSql(sql)) {
      return [{
        id: 'player-1',
        subscription: 'stage_plus',
        subscription_expires_at: '2099-12-31T00:00:00.000Z',
      }];
    }
    if (/INSERT INTO/.test(sql)) return { insertId: 1 };
    if (/SELECT \*/.test(sql)) return createdRegistration();
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadSeasonRegistrationRouter(executesql);
  const res = jsonRes();
  await postHandler(router)({ user: { id: 'user-1' }, body: { club_id: 'club-1' } }, res);
  assert.equal(res.statusCode, 201);
});

test('GOST season_registration allows admin even without Plus', async () => {
  const executesql = async (sql) => {
    if (/FROM users WHERE id = \?/.test(sql)) {
      return [{ id: 'admin-1', email: 'admin@test.com', role_id: 0 }];
    }
    if (playerSql(sql)) {
      throw new Error('admin must not be gated on player Plus');
    }
    if (/INSERT INTO/.test(sql)) return { insertId: 1 };
    if (/SELECT \*/.test(sql)) return createdRegistration();
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadSeasonRegistrationRouter(executesql);
  const res = jsonRes();
  await postHandler(router)({ user: { id: 'admin-1' }, body: { club_id: 'club-1' } }, res);
  assert.equal(res.statusCode, 201);
});

test('five controllers share subscriptionAccess.hasStagePlus and select expiry', () => {
  const controllers = [
    'tournamentController.js',
    'leagueEntityController.js',
    'playerController.js',
    'clubController.js',
    'rankingController.js',
  ];
  for (const file of controllers) {
    const source = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
    assert.match(source, /require\('\.\.\/utils\/subscriptionAccess'\)/, `${file} must use shared helper`);
    assert.doesNotMatch(source, /function hasStagePlus\(/, `${file} must not keep a local hasStagePlus copy`);
  }

  const tournament = fs.readFileSync(path.resolve(__dirname, '../tournamentController.js'), 'utf8');
  const league = fs.readFileSync(path.resolve(__dirname, '../leagueEntityController.js'), 'utf8');
  const ranking = fs.readFileSync(path.resolve(__dirname, '../rankingController.js'), 'utf8');
  const club = fs.readFileSync(path.resolve(__dirname, '../clubController.js'), 'utf8');

  assert.match(tournament, /subscription_expires_at/);
  assert.match(league, /subscription_expires_at/);
  assert.match(ranking, /subscription_expires_at/);
  assert.match(club, /subscription_expires_at/);
});
