const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadModel(executesql) {
  const modelPath = path.resolve(__dirname, '../../models/competitionEngineModel.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  delete require.cache[modelPath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql, pool: {} },
  };
  return require(modelPath);
}

test('upsertInstance writes source identity idempotently', async () => {
  const calls = [];
  const CompetitionEngineModel = loadModel(async (sql, params) => {
    calls.push({ sql, params });
    return { affectedRows: 1 };
  });
  const model = new CompetitionEngineModel();
  await model.upsertInstance({
    id: 'instance-1',
    product_type: 'community_tournament',
    legacy_source_type: 'tournament',
    legacy_source_id: 'tournament-1',
    name: 'Weekend Cup',
    slug: 'weekend-cup',
    status: 'active',
  });
  assert.match(calls[0].sql, /INSERT INTO competition_instances/);
  assert.match(calls[0].sql, /ON DUPLICATE KEY UPDATE/);
  assert.deepEqual(calls[0].params.slice(0, 6), [
    'instance-1',
    'community_tournament',
    'tournament',
    'tournament-1',
    'Weekend Cup',
    'weekend-cup',
  ]);
});
