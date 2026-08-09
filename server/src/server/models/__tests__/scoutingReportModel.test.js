const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadModelWithMocks(executesql) {
  const modelPath = path.resolve(__dirname, '../scoutingReportModel.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');

  delete require.cache[modelPath];
  delete require.cache[dbPath];

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql },
  };

  return require(modelPath);
}

test('video links are stored as a JSON array and always come back as an array', async () => {
  const captured = {};
  const ScoutingReport = loadModelWithMocks(async (sql, params = []) => {
    if (/INSERT INTO scouting_reports/.test(sql)) {
      captured.insertParams = params;
      return { affectedRows: 1 };
    }
    // MySQL hands JSON columns back as a string here.
    if (/SELECT/.test(sql)) {
      return [{ id: 'report-1', club_id: 'club-1', video_links: captured.insertParams[5] }];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  const report = new ScoutingReport({
    club_id: 'club-1',
    target_player_id: 'target-1',
    video_links: ['https://youtu.be/abc', '  https://drive.google.com/file/d/xyz/view  '],
  });
  await report.create();

  assert.equal(
    captured.insertParams[5],
    JSON.stringify(['https://youtu.be/abc', 'https://drive.google.com/file/d/xyz/view']),
    'links are trimmed and serialized as a JSON array'
  );

  const [row] = await report.selectOne('report-1');
  assert.deepEqual(row.video_links, ['https://youtu.be/abc', 'https://drive.google.com/file/d/xyz/view']);
});

test('blank and empty links are dropped rather than stored', async () => {
  let insertParams = null;
  const ScoutingReport = loadModelWithMocks(async (sql, params = []) => {
    if (/INSERT INTO scouting_reports/.test(sql)) { insertParams = params; return { affectedRows: 1 }; }
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  await new ScoutingReport({
    club_id: 'club-1',
    target_player_id: 'target-1',
    video_links: ['https://youtu.be/abc', '', '   ', null],
  }).create();

  assert.equal(insertParams[5], JSON.stringify(['https://youtu.be/abc']));
});

test('a malformed video_links value degrades to an empty list instead of throwing', () => {
  const ScoutingReport = loadModelWithMocks(async () => []);
  assert.deepEqual(ScoutingReport.normalizeRow({ video_links: 'not json at all' }).video_links, []);
  assert.deepEqual(ScoutingReport.normalizeRow({ video_links: null }).video_links, []);
  assert.deepEqual(ScoutingReport.normalizeRow({ video_links: '{"a":1}' }).video_links, []);
});

test('updating a report never rewrites the vote tally', async () => {
  let updateSql = null;
  const ScoutingReport = loadModelWithMocks(async (sql, params = []) => {
    if (/UPDATE scouting_reports/.test(sql)) { updateSql = { sql, params }; return { affectedRows: 1 }; }
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  // A president closing a vote PATCHes the whole row back. Votes must survive it:
  // they are only ever written through JSON_SET by the vote endpoint.
  await new ScoutingReport({
    club_id: 'club-1',
    target_player_id: 'target-1',
    video_links: ['https://youtu.be/abc'],
    status: 'archived',
    votes: { 'player-1': 'for', 'player-2': 'against' },
  }).update('report-1');

  assert.doesNotMatch(updateSql.sql, /votes/, 'the generic update must not touch the votes column');
});

test('a malformed votes value degrades to an empty tally', () => {
  const ScoutingReport = loadModelWithMocks(async () => []);
  assert.deepEqual(ScoutingReport.normalizeRow({ votes: 'not json' }).votes, {});
  assert.deepEqual(ScoutingReport.normalizeRow({ votes: null }).votes, {});
  assert.deepEqual(ScoutingReport.normalizeRow({ votes: '[1,2]' }).votes, {});
  assert.deepEqual(ScoutingReport.normalizeRow({ votes: '{"p1":"for"}' }).votes, { p1: 'for' });
});

test('reports are always scoped to one club, and the club id is a bound parameter', async () => {
  let seen = null;
  const ScoutingReport = loadModelWithMocks(async (sql, params = []) => {
    seen = { sql, params };
    return [];
  });

  await new ScoutingReport().selectByClub('club-1', {});

  assert.match(seen.sql, /WHERE sr\.club_id = \?/, 'club scoping is in the query, not left to the caller');
  assert.equal(seen.params[0], 'club-1');
});
