const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadService(executesql) {
  const servicePath = path.resolve(__dirname, '../competitionEngineService.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  const socketPath = path.resolve(__dirname, '../../utils/socketBroadcast.js');
  delete require.cache[servicePath];
  delete require.cache[path.resolve(__dirname, '../../models/competitionEngineModel.js')];
  delete require.cache[path.resolve(__dirname, '../../models/matchModel.js')];
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
  return require(servicePath);
}

test('createMatchFromFixture creates a match with club and owner snapshots', async () => {
  const calls = [];
  const fixture = {
    id: 'fixture-1',
    competition_instance_id: 'instance-1',
    participant_type: 'club',
    home_club_id: 'club-home',
    home_club_name: 'Home FC',
    home_owner_email: 'home-owner@example.test',
    away_club_id: 'club-away',
    away_club_name: 'Away FC',
    away_owner_email: 'away-owner@example.test',
    scheduled_at: '2026-06-01 19:00:00',
  };
  const service = loadService(async (sql, params = []) => {
    calls.push({ sql, params });
    if (/SELECT \* FROM competition_fixtures WHERE id = \?/.test(sql)) return [fixture];
    if (/INSERT INTO matches/.test(sql)) return { affectedRows: 1 };
    if (/INSERT INTO competition_fixtures/.test(sql)) return { affectedRows: 1 };
    if (/UPDATE competition_fixtures SET match_id/.test(sql)) return { affectedRows: 1 };
    return [];
  });

  const match = await service.createMatchFromFixture('fixture-1');

  assert.equal(match.home_club_name, 'Home FC');
  assert.equal(match.home_owner_email, 'home-owner@example.test');
  assert.equal(match.away_owner_email, 'away-owner@example.test');
  assert.equal(match.source_fixture_type, 'competition_engine');
  assert.ok(calls.some((call) => /INSERT INTO matches/.test(call.sql)));
});

test('submitResult marks fixture disputed when scores disagree', async () => {
  const fixture = { id: 'fixture-1', match_id: 'match-1', status: 'scheduled' };
  const submissions = [
    { side: 'home', score_home: 2, score_away: 1 },
    { side: 'away', score_home: 1, score_away: 2 },
  ];
  const service = loadService(async (sql, params = []) => {
    if (/SELECT \* FROM competition_fixtures WHERE match_id = \?/.test(sql)) return [fixture];
    if (/INSERT INTO competition_result_submissions/.test(sql)) return { affectedRows: 1 };
    if (/SELECT \* FROM competition_result_submissions WHERE match_id = \?/.test(sql)) return submissions;
    if (/UPDATE matches SET status = 'disputed'/.test(sql)) return { affectedRows: 1 };
    if (/UPDATE competition_fixtures SET status = 'disputed'/.test(sql)) return { affectedRows: 1 };
    return [];
  });

  const result = await service.submitResult({
    matchId: 'match-1',
    side: 'away',
    submittedByUserId: 'user-1',
    scoreHome: 1,
    scoreAway: 2,
  });

  assert.equal(result.status, 'disputed');
});
