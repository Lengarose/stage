const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadMatchRouterWithDbMock(executesql) {
  const controllerPath = path.resolve(__dirname, '../matchController.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  const socketPath = path.resolve(__dirname, '../../utils/socketBroadcast.js');

  delete require.cache[controllerPath];
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
    exports: { broadcastMatch() {}, broadcastMatchDeleted() {} },
  };

  return require(controllerPath);
}

function postMatchesHandler(router) {
  const layer = router.stack.find((entry) => entry.route?.path === '/' && entry.route.methods.post);
  return layer.route.stack[0].handle;
}

test('POST / snapshots club owner emails and player emails from ids', async () => {
  const inserted = [];
  const executesql = async (sql, params = []) => {
    if (/FROM users WHERE id = \?/.test(sql)) {
      return [{ id: 'user-1', email: 'captain@example.test', role_id: 1 }];
    }
    if (/FROM players\s+WHERE user_id/.test(sql)) {
      return [{ id: 'player-home', club_id: 'club-home' }];
    }
    if (/FROM clubs\s+WHERE user_id/.test(sql)) {
      return [];
    }
    if (/SELECT id, name, owner_email FROM clubs WHERE id IN/.test(sql)) {
      return [
        { id: 'club-home', name: 'Home FC', owner_email: 'home-owner@example.test' },
        { id: 'club-away', name: 'Away FC', owner_email: 'away-owner@example.test' },
      ];
    }
    if (/SELECT id, gamertag, email FROM players WHERE id IN/.test(sql)) {
      return [
        { id: 'player-home', gamertag: 'HomeTag', email: 'home-player@example.test' },
        { id: 'player-away', gamertag: 'AwayTag', email: 'away-player@example.test' },
      ];
    }
    if (/INSERT INTO matches/.test(sql)) {
      inserted.push(params);
      return { insertId: 'match-1', affectedRows: 1 };
    }
    if (/SELECT \* FROM matches WHERE id = \?/.test(sql)) {
      return [{
        id: 'match-1',
        home_club_id: 'club-home',
        away_club_id: 'club-away',
        home_club_name: 'Home FC',
        away_club_name: 'Away FC',
        home_owner_email: 'home-owner@example.test',
        away_owner_email: 'away-owner@example.test',
        home_player_id: 'player-home',
        home_player_name: 'HomeTag',
        home_player_email: 'home-player@example.test',
        away_player_id: 'player-away',
        away_player_name: 'AwayTag',
        away_player_email: 'away-player@example.test',
        status: 'scheduled',
        mode: 'club',
      }];
    }
    return [];
  };

  const router = loadMatchRouterWithDbMock(executesql);
  const handle = postMatchesHandler(router);
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

  await handle({
    user: { id: 'user-1' },
    body: {
      home_club_id: 'club-home',
      away_club_id: 'club-away',
      home_player_id: 'player-home',
      away_player_id: 'player-away',
      status: 'scheduled',
      mode: 'club',
    },
  }, response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.home_club_name, 'Home FC');
  assert.equal(response.body.away_club_name, 'Away FC');
  assert.equal(response.body.home_owner_email, 'home-owner@example.test');
  assert.equal(response.body.away_owner_email, 'away-owner@example.test');
  assert.equal(response.body.home_player_name, 'HomeTag');
  assert.equal(response.body.away_player_name, 'AwayTag');
  assert.equal(response.body.home_player_email, 'home-player@example.test');
  assert.equal(response.body.away_player_email, 'away-player@example.test');
  assert.equal(inserted.length, 1);
});
