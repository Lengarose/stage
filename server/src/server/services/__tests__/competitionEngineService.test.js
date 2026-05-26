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

test('backfillCommunityTournaments writes instance participants and linked fixtures', async () => {
  const calls = [];
  const service = loadService(async (sql, params = []) => {
    calls.push({ sql, params });
    if (/SELECT \* FROM tournaments/.test(sql)) {
      return [{
        id: 'tournament-1',
        name: 'Weekend Cup',
        type: 'knockout',
        participant_type: 'club',
        status: 'in_progress',
        platform: 'ps5',
        region: 'EU',
        registered_clubs: JSON.stringify([
          { id: 'club-home', name: 'Home FC', owner_email: 'home@example.test' },
          { id: 'club-away', name: 'Away FC', owner_email: 'away@example.test' },
        ]),
        registered_players: null,
        created_date: '2026-05-26 10:00:00',
      }];
    }
    if (/SELECT \* FROM matches WHERE tournament_id = \?/.test(sql)) {
      return [{
        id: 'match-1',
        tournament_id: 'tournament-1',
        home_club_id: 'club-home',
        away_club_id: 'club-away',
        home_club_name: 'Home FC',
        away_club_name: 'Away FC',
        home_owner_email: 'home@example.test',
        away_owner_email: 'away@example.test',
        status: 'completed',
        round: 1,
        home_score: 2,
        away_score: 1,
        winner_club_id: 'club-home',
        scheduled_date: '2026-05-26 20:00:00',
        stats_processed: 1,
      }];
    }
    if (/INSERT INTO competition_instances/.test(sql)) return { affectedRows: 1 };
    if (/INSERT INTO competition_participants/.test(sql)) return { affectedRows: 1 };
    if (/INSERT INTO competition_fixtures/.test(sql)) return { affectedRows: 1 };
    return [];
  });

  const result = await service.backfillCommunityTournaments({ status: 'in_progress' });

  assert.deepEqual(result, {
    tournaments: 1,
    instances: 1,
    participants: 2,
    fixtures: 1,
  });
  assert.ok(calls.some((call) => /INSERT INTO competition_instances/.test(call.sql)));
  assert.ok(calls.some((call) => /INSERT INTO competition_participants/.test(call.sql)));
  assert.ok(calls.some((call) => /INSERT INTO competition_fixtures/.test(call.sql)));
});
