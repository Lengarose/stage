const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadServiceWithDbMock(executesql) {
  const servicePath = path.resolve(__dirname, '../clubPlayerService.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');

  delete require.cache[servicePath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql },
  };

  return require(servicePath);
}

test('listActiveClubPlayers reads active memberships as well as legacy player club_id', async () => {
  const calls = [];
  const executesql = async (sql, params = []) => {
    calls.push({ sql, params });
    if (/LEFT JOIN club_memberships/.test(sql)) {
      return [
        { id: 'membership-player', club_id: null },
        { id: 'legacy-player', club_id: 'club-1' },
      ];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const { listActiveClubPlayers } = loadServiceWithDbMock(executesql);

  const players = await listActiveClubPlayers('club-1', { limit: 11 });

  assert.deepEqual(players.map((player) => player.id), ['membership-player', 'legacy-player']);
  assert.match(calls[0].sql, /cm\.club_id = \?/);
  assert.match(calls[0].sql, /OR p\.club_id = \?/);
  assert.deepEqual(calls[0].params, ['club-1', 'club-1', 11]);
});

test('listActiveClubPlayerEmails returns distinct emails for membership and legacy links', async () => {
  const executesql = async (sql, params = []) => {
    assert.match(sql, /SELECT DISTINCT p\.email/);
    assert.match(sql, /cm\.club_id IN/);
    assert.deepEqual(params, ['club-1', 'club-2', 'club-1', 'club-2']);
    return [{ email: 'one@example.test' }, { email: 'two@example.test' }];
  };
  const { listActiveClubPlayerEmails } = loadServiceWithDbMock(executesql);

  const emails = await listActiveClubPlayerEmails(['club-1', 'club-2']);

  assert.deepEqual(emails, ['one@example.test', 'two@example.test']);
});
