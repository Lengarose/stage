const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadModelWithDbMock(executesql) {
  const modelPath = path.resolve(__dirname, '../clubMembershipModel.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');

  delete require.cache[modelPath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql },
  };

  return require(modelPath);
}

test('ClubMembership creates and filters active player club links', async () => {
  const calls = [];
  const executesql = async (sql, params = []) => {
    calls.push({ sql, params });
    return [];
  };
  const ClubMembership = loadModelWithDbMock(executesql);
  const model = new ClubMembership({
    id: 'membership-1',
    club_id: 'club-1',
    player_id: 'player-1',
    user_id: 'user-1',
    primary_role: 'captain',
    source: 'legacy_backfill',
  });

  await model.create();
  await model.selectAll({ club_id: 'club-1', status: 'active' });

  assert.match(calls[0].sql, /INSERT INTO club_memberships/);
  assert.deepEqual(calls[0].params, ['membership-1', 'club-1', 'player-1', 'user-1', 'active', 'captain', 'legacy_backfill']);
  assert.match(calls[1].sql, /LEFT JOIN players/);
  assert.match(calls[1].sql, /cm\.club_id = \?/);
  assert.match(calls[1].sql, /cm\.status = \?/);
});
