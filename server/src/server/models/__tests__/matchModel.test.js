const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadMatchModelWithDbMock(executesql) {
  const modelPath = path.resolve(__dirname, '../matchModel.js');
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

test('Match.create keeps insert columns and placeholders aligned', async () => {
  const Match = loadMatchModelWithDbMock(async (sql, params = []) => {
    assert.match(sql, /INSERT INTO matches/);

    const columnSection = sql.match(/INSERT INTO matches \((.*)\) VALUES/s)?.[1] || '';
    const columns = columnSection.split(',').map((column) => column.trim()).filter(Boolean);
    const placeholders = sql.match(/\?/g) || [];

    assert.equal(columns.length, params.length);
    assert.equal(placeholders.length, params.length);

    return { affectedRows: 1 };
  });

  await new Match({
    id: 'match-1',
    tournament_id: 'tournament-1',
    home_club_id: 'club-home',
    away_club_id: 'club-away',
    home_club_name: 'Home Club',
    away_club_name: 'Away Club',
    status: 'unscheduled',
    mode: 'club',
    type: 'league',
    round: 1,
  }).create();
});
