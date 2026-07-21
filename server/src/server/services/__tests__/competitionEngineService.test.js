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
    exports: {
      broadcastMatch() {},
      broadcastMatchDeleted() {},
      broadcastNotification() {},
      broadcastTournament() {},
    },
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

test('syncMatchResultToSource updates official fixture and standings server-side', async () => {
  const updates = [];
  const service = loadService(async (sql, params = []) => {
    if (/SELECT \* FROM competition_fixtures WHERE match_id = \? LIMIT 1/.test(sql)) return [];
    if (/WHERE id = \? AND entity_type = 'competition_fixture'/.test(sql)) {
      return [{
        id: 'fixture-legacy',
        entity_type: 'competition_fixture',
        status: 'scheduled',
        data_json: JSON.stringify({
          season_id: 'season-1',
          phase: 'league',
          home_club_id: 'club-home',
          home_club_name: 'Home FC',
          away_club_id: 'club-away',
          away_club_name: 'Away FC',
          stats_processed: false,
        }),
      }];
    }
    if (/entity_type = 'competition_standing'\s+AND season_id = \?\s+AND club_id IN/.test(sql)) {
      return [
        { id: 'standing-home', entity_type: 'competition_standing', season_id: 'season-1', club_id: 'club-home', data_json: JSON.stringify({ club_id: 'club-home', club_name: 'Home FC', points: 0, played: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0, goal_difference: 0, form: [] }) },
        { id: 'standing-away', entity_type: 'competition_standing', season_id: 'season-1', club_id: 'club-away', data_json: JSON.stringify({ club_id: 'club-away', club_name: 'Away FC', points: 0, played: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0, goal_difference: 0, form: [] }) },
      ];
    }
    if (/entity_type = 'competition_standing' AND season_id = \?/.test(sql)) {
      return [
        { id: 'standing-home', entity_type: 'competition_standing', season_id: 'season-1', club_id: 'club-home', data_json: JSON.stringify({ club_id: 'club-home', club_name: 'Home FC', points: 0, goals_for: 0, goals_against: 0, goal_difference: 0 }) },
        { id: 'standing-away', entity_type: 'competition_standing', season_id: 'season-1', club_id: 'club-away', data_json: JSON.stringify({ club_id: 'club-away', club_name: 'Away FC', points: 0, goals_for: 0, goals_against: 0, goal_difference: 0 }) },
      ];
    }
    if (/UPDATE league_entities SET/.test(sql)) {
      updates.push({ sql, params, data: JSON.parse(params[0]) });
      return { affectedRows: 1 };
    }
    return [];
  });

  const result = await service.syncMatchResultToSource({
    id: 'match-1',
    status: 'completed',
    source_fixture_id: 'fixture-legacy',
    source_fixture_type: 'competition',
    home_score: 2,
    away_score: 1,
  });

  assert.equal(result.legacy.synced, true);
  assert.ok(updates.some(update => update.params.includes('fixture-legacy') && update.data.status === 'completed'));
  assert.ok(updates.some(update => update.params.includes('standing-home') && update.data.points === 3));
  assert.ok(updates.some(update => update.params.includes('standing-away') && update.data.losses === 1));
});

test('syncMatchResultToSource marks legacy official phase ready when all fixtures are complete', async () => {
  const notificationWrites = [];
  const service = loadService(async (sql, params = []) => {
    if (/SELECT \* FROM competition_fixtures WHERE match_id = \? LIMIT 1/.test(sql)) return [];
    if (/WHERE id = \? AND entity_type = 'competition_fixture'/.test(sql)) {
      return [{
        id: 'fixture-legacy',
        entity_type: 'competition_fixture',
        status: 'scheduled',
        data_json: JSON.stringify({
          season_id: 'season-1',
          phase: 'league',
          round: 1,
          home_club_id: 'club-home',
          home_club_name: 'Home FC',
          away_club_id: 'club-away',
          away_club_name: 'Away FC',
          stats_processed: false,
        }),
      }];
    }
    if (/entity_type = 'competition_standing'\s+AND season_id = \?\s+AND club_id IN/.test(sql)) {
      return [
        { id: 'standing-home', entity_type: 'competition_standing', season_id: 'season-1', club_id: 'club-home', data_json: JSON.stringify({ club_id: 'club-home', club_name: 'Home FC' }) },
        { id: 'standing-away', entity_type: 'competition_standing', season_id: 'season-1', club_id: 'club-away', data_json: JSON.stringify({ club_id: 'club-away', club_name: 'Away FC' }) },
      ];
    }
    if (/entity_type = 'competition_standing' AND season_id = \?/.test(sql)) return [];
    if (/UPDATE league_entities SET/.test(sql)) return { affectedRows: 1 };
    if (/SELECT \* FROM competition_instances WHERE product_type = \? AND legacy_source_type = \? AND legacy_source_id = \? LIMIT 1/.test(sql)) {
      return [{ id: 'instance-1', name: 'Supreme Season', legacy_source_type: 'competition_season', legacy_source_id: 'season-1' }];
    }
    if (/SELECT \* FROM league_entities WHERE entity_type = \? AND `season_id` = \? LIMIT 1000/.test(sql)) {
      return [{
        id: 'fixture-legacy',
        entity_type: 'competition_fixture',
        season_id: 'season-1',
        status: 'completed',
        data_json: JSON.stringify({ phase: 'league', round: 1 }),
      }];
    }
    if (/SELECT \* FROM competition_phase_states/.test(sql)) return [];
    if (/INSERT INTO competition_phase_states/.test(sql)) return { affectedRows: 1 };
    if (/SELECT \* FROM competition_instances WHERE id = \?/.test(sql)) {
      return [{ id: 'instance-1', name: 'Supreme Season', legacy_source_type: 'competition_season', legacy_source_id: 'season-1' }];
    }
    if (/SELECT email FROM users WHERE role_id IN/.test(sql)) return [{ email: 'admin@example.test' }];
    if (/SELECT data_json FROM league_entities WHERE id = \? AND entity_type = \? LIMIT 1/.test(sql)) return [];
    if (/INSERT IGNORE INTO notifications/.test(sql)) {
      notificationWrites.push(params);
      return { affectedRows: 1 };
    }
    if (/INSERT IGNORE INTO inbox_messages/.test(sql)) return { affectedRows: 1 };
    return [];
  });

  const result = await service.syncMatchResultToSource({
    id: 'match-1',
    status: 'completed',
    source_fixture_id: 'fixture-legacy',
    source_fixture_type: 'competition',
    home_score: 2,
    away_score: 1,
  });

  assert.equal(result.ready.notified, true);
  assert.equal(notificationWrites.length, 1);
  assert.equal(notificationWrites[0][1], 'admin@example.test');
});

test('syncMatchResultToSource automatically generates official playoff fixtures when league phase completes', async () => {
  const inserts = [];
  const updates = [];
  const standings = Array.from({ length: 24 }, (_, index) => {
    const position = index + 1;
    return {
      id: `standing-${position}`,
      entity_type: 'competition_standing',
      season_id: 'season-1',
      club_id: `club-${position}`,
      data_json: JSON.stringify({
        id: `standing-${position}`,
        season_id: 'season-1',
        competition_id: 'competition-1',
        competition_name: 'STAGE Supreme League',
        competition_slug: 'supreme',
        competition_tier: 1,
        club_id: `club-${position}`,
        club_name: `Club ${position}`,
        club_logo_url: '',
        club_tag: `C${position}`,
        points: 100 - position,
        goal_difference: 0,
        goals_for: 0,
        position,
      }),
    };
  });
  const fixtureRows = [
    {
      id: 'fixture-legacy',
      entity_type: 'competition_fixture',
      status: 'scheduled',
      season_id: 'season-1',
      data_json: JSON.stringify({
        id: 'fixture-legacy',
        season_id: 'season-1',
        competition_id: 'competition-1',
        competition_name: 'STAGE Supreme League',
        competition_slug: 'supreme',
        competition_tier: 1,
        phase: 'league',
        round: 1,
        matchday: 1,
        home_club_id: 'club-1',
        home_club_name: 'Club 1',
        away_club_id: 'club-2',
        away_club_name: 'Club 2',
        stats_processed: false,
      }),
    },
  ];
  const service = loadService(async (sql, params = []) => {
    if (/SELECT \* FROM competition_fixtures WHERE match_id = \? LIMIT 1/.test(sql)) return [];
    if (/WHERE id = \? AND entity_type = 'competition_fixture'/.test(sql)) return fixtureRows.filter(row => row.id === params[0]);
    if (/entity_type = 'competition_standing'\s+AND season_id = \?\s+AND club_id IN/.test(sql)) return standings.slice(0, 2);
    if (/entity_type = 'competition_standing' AND season_id = \?/.test(sql)) return standings;
    if (/UPDATE league_entities SET/.test(sql)) {
      updates.push({ sql, params, data: JSON.parse(params[0]) });
      const entityType = params[params.length - 1];
      const id = params[params.length - 2];
      if (entityType === 'competition_fixture' && id === 'fixture-legacy') {
        fixtureRows[0] = {
          ...fixtureRows[0],
          status: 'completed',
          data_json: params[0],
        };
      }
      return { affectedRows: 1 };
    }
    if (/SELECT \* FROM league_entities WHERE entity_type = \? AND `season_id` = \? LIMIT 1000/.test(sql)) {
      return fixtureRows;
    }
    if (/SELECT \* FROM league_entities\s+WHERE entity_type = 'competition_fixture'\s+AND season_id = \?\s+AND phase = \?/.test(sql)) {
      return [];
    }
    if (/INSERT INTO league_entities/.test(sql)) {
      inserts.push({ sql, params, data: JSON.parse(params[2]) });
      return { affectedRows: 1 };
    }
    if (/SELECT \* FROM competition_instances/.test(sql)) return [];
    return [];
  });

  const result = await service.syncMatchResultToSource({
    id: 'match-1',
    status: 'completed',
    source_fixture_id: 'fixture-legacy',
    source_fixture_type: 'competition',
    home_score: 2,
    away_score: 1,
  });

  assert.equal(result.advance.advanced, true);
  assert.equal(result.advance.next_phase, 'playoff_round');
  assert.equal(inserts.length, 16);
  assert.equal(inserts[0].data.phase, 'playoff_round');
  assert.equal(inserts[0].data.home_club_id, 'club-24');
  assert.equal(inserts[0].data.away_club_id, 'club-9');
  assert.ok(updates.some(update => update.params.includes('fixture-legacy') && update.data.status === 'completed'));
});

test('syncMatchResultToSource does not generate official next phase before all current fixtures finish', async () => {
  const inserts = [];
  const service = loadService(async (sql, params = []) => {
    if (/SELECT \* FROM competition_fixtures WHERE match_id = \? LIMIT 1/.test(sql)) return [];
    if (/WHERE id = \? AND entity_type = 'competition_fixture'/.test(sql)) {
      return [{
        id: 'fixture-legacy',
        entity_type: 'competition_fixture',
        status: 'scheduled',
        season_id: 'season-1',
        data_json: JSON.stringify({
          id: 'fixture-legacy',
          season_id: 'season-1',
          competition_id: 'competition-1',
          phase: 'league',
          round: 1,
          home_club_id: 'club-home',
          away_club_id: 'club-away',
          stats_processed: false,
        }),
      }];
    }
    if (/entity_type = 'competition_standing'\s+AND season_id = \?\s+AND club_id IN/.test(sql)) return [];
    if (/entity_type = 'competition_standing' AND season_id = \?/.test(sql)) return [];
    if (/UPDATE league_entities SET/.test(sql)) return { affectedRows: 1 };
    if (/SELECT \* FROM league_entities WHERE entity_type = \? AND `season_id` = \? LIMIT 1000/.test(sql)) {
      return [
        { id: 'fixture-legacy', entity_type: 'competition_fixture', status: 'completed', data_json: JSON.stringify({ phase: 'league', round: 1, status: 'completed' }) },
        { id: 'fixture-open', entity_type: 'competition_fixture', status: 'scheduled', data_json: JSON.stringify({ phase: 'league', round: 1, status: 'scheduled' }) },
      ];
    }
    if (/INSERT INTO league_entities/.test(sql)) {
      inserts.push(params);
      return { affectedRows: 1 };
    }
    if (/SELECT \* FROM competition_instances/.test(sql)) return [];
    return [];
  });

  const result = await service.syncMatchResultToSource({
    id: 'match-1',
    status: 'completed',
    source_fixture_id: 'fixture-legacy',
    source_fixture_type: 'competition',
    home_score: 2,
    away_score: 1,
  });

  assert.equal(result.advance.advanced, false);
  assert.equal(result.advance.reason, 'phase_not_complete');
  assert.equal(inserts.length, 0);
});

test('advanceCommunityTournamentIfReady waits for all knockout matches before creating next round', async () => {
  const inserts = [];
  const updates = [];
  const service = loadService(async (sql, params = []) => {
    if (/SELECT \* FROM tournaments WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: 'tournament-1', name: 'Cup', type: 'knockout', participant_type: 'club', status: 'in_progress', current_round: 1 }];
    }
    if (/SELECT \* FROM matches WHERE tournament_id = \? ORDER BY round/.test(sql)) {
      return [
        { id: 'm1', tournament_id: 'tournament-1', round: 1, type: 'knockout', status: 'completed', winner_club_id: 'club-1', home_club_id: 'club-1', home_club_name: 'Club 1', away_club_id: 'club-2', away_club_name: 'Club 2' },
        { id: 'm2', tournament_id: 'tournament-1', round: 1, type: 'knockout', status: 'scheduled', home_club_id: 'club-3', home_club_name: 'Club 3', away_club_id: 'club-4', away_club_name: 'Club 4' },
      ];
    }
    if (/INSERT INTO matches/.test(sql)) {
      inserts.push(params);
      return { affectedRows: 1 };
    }
    if (/UPDATE tournaments SET/.test(sql)) {
      updates.push(params);
      return { affectedRows: 1 };
    }
    return [];
  });

  const result = await service.advanceCommunityTournamentIfReady({ id: 'm1', tournament_id: 'tournament-1', status: 'completed', round: 1 });

  assert.equal(result.advanced, false);
  assert.equal(result.reason, 'round_not_complete');
  assert.equal(inserts.length, 0);
  assert.equal(updates.length, 0);
});

test('advanceCommunityTournamentIfReady creates next knockout round once current round is complete', async () => {
  const inserts = [];
  const updates = [];
  const service = loadService(async (sql, params = []) => {
    if (/SELECT \* FROM tournaments WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: 'tournament-1', name: 'Cup', type: 'knockout', participant_type: 'club', status: 'in_progress', current_round: 1 }];
    }
    if (/SELECT \* FROM matches WHERE tournament_id = \? ORDER BY round/.test(sql)) {
      return [
        { id: 'm1', tournament_id: 'tournament-1', round: 1, type: 'knockout', status: 'completed', winner_club_id: 'club-1', home_club_id: 'club-1', home_club_name: 'Club 1', away_club_id: 'club-2', away_club_name: 'Club 2' },
        { id: 'm2', tournament_id: 'tournament-1', round: 1, type: 'knockout', status: 'completed', winner_club_id: 'club-3', home_club_id: 'club-3', home_club_name: 'Club 3', away_club_id: 'club-4', away_club_name: 'Club 4' },
      ];
    }
    if (/INSERT INTO matches/.test(sql)) {
      inserts.push(params);
      return { affectedRows: 1 };
    }
    if (/UPDATE tournaments SET/.test(sql)) {
      updates.push(params);
      return { affectedRows: 1 };
    }
    return [];
  });

  const result = await service.advanceCommunityTournamentIfReady({ id: 'm2', tournament_id: 'tournament-1', status: 'completed', round: 1 });

  assert.equal(result.advanced, true);
  assert.equal(result.next_round, 2);
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0][2], 'club-1');
  assert.equal(inserts[0][3], 'club-3');
  assert.equal(updates[0][0], 2);
});

test('advanceCommunityTournamentIfReady creates group-stage knockout ties automatically', async () => {
  const inserts = [];
  const updates = [];
  const service = loadService(async (sql, params = []) => {
    if (/SELECT \* FROM tournaments WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: 'tournament-1', name: 'Groups Cup', type: 'group_stage', participant_type: 'club', status: 'in_progress', current_round: 1, num_groups: 2 }];
    }
    if (/SELECT \* FROM matches WHERE tournament_id = \? ORDER BY round/.test(sql)) {
      return [
        { id: 'g1', tournament_id: 'tournament-1', round: 1, group_number: 0, type: 'group', status: 'completed', home_club_id: 'club-1', home_club_name: 'Club 1', away_club_id: 'club-2', away_club_name: 'Club 2', home_score: 2, away_score: 0, winner_club_id: 'club-1' },
        { id: 'g2', tournament_id: 'tournament-1', round: 1, group_number: 1, type: 'group', status: 'completed', home_club_id: 'club-3', home_club_name: 'Club 3', away_club_id: 'club-4', away_club_name: 'Club 4', home_score: 1, away_score: 0, winner_club_id: 'club-3' },
      ];
    }
    if (/INSERT INTO matches/.test(sql)) {
      inserts.push(params);
      return { affectedRows: 1 };
    }
    if (/UPDATE tournaments SET/.test(sql)) {
      updates.push(params);
      return { affectedRows: 1 };
    }
    return [];
  });

  const result = await service.advanceCommunityTournamentIfReady({ id: 'g2', tournament_id: 'tournament-1', status: 'completed', round: 1 });

  assert.equal(result.advanced, true);
  assert.equal(result.phase, 'semi_final');
  assert.equal(result.matches_created, 4);
  assert.equal(inserts.length, 4);
  assert.equal(updates[0][0], 2);
});

test('advanceLegacyOfficialCompetitionIfReady creates cross-competition qualification when final completes', async () => {
  const inserts = [];
  const updates = [];
  const service = loadService(async (sql, params = []) => {
    if (/SELECT \* FROM league_entities WHERE entity_type = \? AND `season_id` = \? LIMIT 1000/.test(sql)) {
      return [{
        id: 'final-1',
        entity_type: 'competition_fixture',
        status: 'completed',
        season_id: 'season-elite',
        data_json: JSON.stringify({
          id: 'final-1',
          season_id: 'season-elite',
          competition_slug: 'elite',
          phase: 'knockout_final',
          status: 'completed',
          home_club_id: 'club-1',
          home_club_name: 'Elite Winner',
          away_club_id: 'club-2',
          away_club_name: 'Runner Up',
          home_score: 2,
          away_score: 1,
        }),
      }];
    }
    if (/entity_type = 'competition_standing' AND season_id = \?/.test(sql)) {
      return [{
        id: 'standing-1',
        entity_type: 'competition_standing',
        club_id: 'club-1',
        data_json: JSON.stringify({ club_id: 'club-1', club_name: 'Elite Winner', points: 10, goal_difference: 4, goals_for: 7, position: 1 }),
      }];
    }
    if (/WHERE id = \? AND entity_type = 'competition_season' LIMIT 1/.test(sql)) {
      return [{
        id: 'season-elite',
        entity_type: 'competition_season',
        data_json: JSON.stringify({ id: 'season-elite', competition_slug: 'elite', status: 'knockout_final' }),
      }];
    }
    if (/entity_type = 'competition'\s+AND slug = \?/.test(sql)) {
      return [{
        id: 'competition-supreme',
        entity_type: 'competition',
        slug: 'supreme',
        data_json: JSON.stringify({ id: 'competition-supreme', slug: 'supreme', name: 'STAGE Supreme League', tier: 1 }),
      }];
    }
    if (/entity_type = 'qualification_entry'/.test(sql)) return [];
    if (/UPDATE league_entities SET/.test(sql)) {
      updates.push({ params, data: JSON.parse(params[0]) });
      return { affectedRows: 1 };
    }
    if (/INSERT INTO league_entities/.test(sql)) {
      inserts.push({ params, data: JSON.parse(params[2]) });
      return { affectedRows: 1 };
    }
    return [];
  });

  const result = await service.advanceLegacyOfficialCompetitionIfReady({
    season_id: 'season-elite',
    phase: 'knockout_final',
  });

  assert.equal(result.advanced, true);
  assert.equal(result.next_phase, 'completed');
  assert.equal(result.qualifications_created, 1);
  assert.equal(inserts[0].data.source_type, 'competition_season');
  assert.equal(inserts[0].data.target_competition_id, 'competition-supreme');
  assert.ok(updates.some(update => update.data.status === 'completed' && update.data.winner_club_id === 'club-1'));
});

test('advanceRegionalLeagueIfReady processes completed division one qualification automatically', async () => {
  const inserts = [];
  const updates = [];
  const standings = Array.from({ length: 8 }, (_, index) => ({
    id: `standing-${index + 1}`,
    entity_type: 'regional_league_standing',
    league_id: 'league-1',
    club_id: `club-${index + 1}`,
    data_json: JSON.stringify({
      id: `standing-${index + 1}`,
      league_id: 'league-1',
      club_id: `club-${index + 1}`,
      club_name: `Club ${index + 1}`,
      points: 20 - index,
      goal_difference: 0,
      goals_for: 0,
      region: 'EU',
      platform: 'PS5',
    }),
  }));
  const service = loadService(async (sql, params = []) => {
    if (/entity_type = 'regional_league_fixture'\s+AND league_id = \?/.test(sql)) {
      return [{ id: 'rf-1', entity_type: 'regional_league_fixture', status: 'played', data_json: JSON.stringify({ league_id: 'league-1', status: 'played' }) }];
    }
    if (/WHERE id = \? AND entity_type = \? LIMIT 1/.test(sql) && params[1] === 'regional_league') {
      return [{ id: 'league-1', entity_type: 'regional_league', data_json: JSON.stringify({ id: 'league-1', name: 'EU Division 1', division: 1, status: 'in_progress', linked_league_slug: 'eu-div-2' }) }];
    }
    if (/entity_type = 'regional_league_standing' AND league_id = \?/.test(sql)) return standings;
    if (/entity_type = 'competition'\s+AND slug = \?/.test(sql)) {
      const bySlug = {
        supreme: { id: 'comp-supreme', name: 'STAGE Supreme League', tier: 1 },
        elite: { id: 'comp-elite', name: 'STAGE Elite League', tier: 2 },
        challenger: { id: 'comp-challenger', name: 'STAGE Challenger League', tier: 3 },
      };
      const comp = bySlug[params[0]];
      return [{ id: comp.id, entity_type: 'competition', slug: params[0], data_json: JSON.stringify({ id: comp.id, slug: params[0], ...comp }) }];
    }
    if (/entity_type = 'qualification_entry'/.test(sql)) return [];
    if (/UPDATE league_entities SET/.test(sql)) {
      updates.push({ params, data: JSON.parse(params[0]) });
      return { affectedRows: 1 };
    }
    if (/INSERT INTO league_entities/.test(sql)) {
      inserts.push({ params, data: JSON.parse(params[2]) });
      return { affectedRows: 1 };
    }
    return [];
  });

  const result = await service.advanceRegionalLeagueIfReady({ league_id: 'league-1' });

  assert.equal(result.advanced, true);
  assert.equal(result.qualified, 6);
  assert.equal(result.relegated, 2);
  assert.equal(inserts.length, 6);
  assert.deepEqual(inserts.map(insert => insert.data.target_competition_id), [
    'comp-supreme', 'comp-supreme', 'comp-elite', 'comp-elite', 'comp-challenger', 'comp-challenger',
  ]);
  assert.ok(updates.some(update => update.params.includes('regional_league') && update.data.status === 'completed'));
});

test('notifyPhaseReady sends deterministic admin and organizer messages once phase is complete', async () => {
  const notificationWrites = [];
  const inboxWrites = [];
  const service = loadService(async (sql, params = []) => {
    if (/SELECT \* FROM competition_fixtures/.test(sql)) {
      return [{ id: 'fixture-1', status: 'completed' }];
    }
    if (/SELECT \* FROM competition_phase_states/.test(sql)) return [];
    if (/INSERT INTO competition_phase_states/.test(sql)) return { affectedRows: 1 };
    if (/SELECT \* FROM competition_instances WHERE id = \?/.test(sql)) {
      return [{
        id: 'instance-1',
        name: 'Supreme Season',
        legacy_source_type: 'tournament',
        legacy_source_id: 'tournament-1',
      }];
    }
    if (/SELECT email FROM users WHERE role_id IN/.test(sql)) {
      return [{ email: 'admin@example.test' }];
    }
    if (/SELECT organizer_email, creator_email FROM tournaments/.test(sql)) {
      return [{ organizer_email: 'organizer@example.test', creator_email: null }];
    }
    if (/INSERT IGNORE INTO notifications/.test(sql)) {
      notificationWrites.push(params);
      return { affectedRows: 1 };
    }
    if (/INSERT IGNORE INTO inbox_messages/.test(sql)) {
      inboxWrites.push(params);
      return { affectedRows: 1 };
    }
    return [];
  });

  const result = await service.notifyPhaseReady({
    competition_instance_id: 'instance-1',
    format: 'league',
    phase: 'league',
    round: 1,
  });

  assert.equal(result.notified, true);
  assert.equal(result.recipients, 2);
  assert.deepEqual(notificationWrites.map(row => row[1]).sort(), ['admin@example.test', 'organizer@example.test']);
  assert.deepEqual(inboxWrites.map(row => row[1]).sort(), ['admin@example.test', 'organizer@example.test']);
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
        registered_clubs: JSON.stringify(['club-home', 'club-away']),
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
    conflicts: 0,
  });
  assert.ok(calls.some((call) => /INSERT INTO competition_instances/.test(call.sql)));
  assert.ok(calls.some((call) => /INSERT INTO competition_participants/.test(call.sql)));
  assert.ok(calls.some((call) => /INSERT INTO competition_fixtures/.test(call.sql)));
});

test('backfillCommunityTournaments skips fixture when match_id belongs to another legacy fixture', async () => {
  const calls = [];
  const service = loadService(async (sql, params = []) => {
    calls.push({ sql, params });
    if (/SELECT \* FROM tournaments/.test(sql)) {
      return [{
        id: 'tournament-1',
        name: 'Weekend Cup',
        participant_type: 'club',
        status: 'in_progress',
        registered_clubs: JSON.stringify(['club-home', 'club-away']),
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
        status: 'scheduled',
      }];
    }
    if (/SELECT \* FROM competition_fixtures WHERE match_id = \? LIMIT 1/.test(sql)) {
      return [{
        id: 'existing-fixture',
        match_id: params[0],
        legacy_fixture_type: 'competition_fixture',
        legacy_fixture_id: 'different-fixture',
      }];
    }
    if (/INSERT INTO competition_instances/.test(sql)) return { affectedRows: 1 };
    if (/INSERT INTO competition_participants/.test(sql)) return { affectedRows: 1 };
    if (/INSERT INTO competition_fixtures/.test(sql)) return { affectedRows: 1 };
    return [];
  });

  const result = await service.backfillCommunityTournaments({ status: 'in_progress' });

  assert.equal(result.fixtures, 0);
  assert.equal(result.conflicts, 1);
  assert.equal(calls.filter((call) => /INSERT INTO competition_fixtures/.test(call.sql)).length, 0);
});

test('backfillCommunityTournaments writes scalar registered player participants', async () => {
  const participantWrites = [];
  const service = loadService(async (sql, params = []) => {
    if (/SELECT \* FROM tournaments/.test(sql)) {
      return [{
        id: 'tournament-player-1',
        name: 'Solo Cup',
        type: 'knockout',
        participant_type: 'player',
        status: 'in_progress',
        registered_clubs: null,
        registered_players: JSON.stringify(['player-home', 'player-away']),
        created_date: '2026-05-26 10:00:00',
      }];
    }
    if (/SELECT \* FROM matches WHERE tournament_id = \?/.test(sql)) return [];
    if (/INSERT INTO competition_instances/.test(sql)) return { affectedRows: 1 };
    if (/INSERT INTO competition_participants/.test(sql)) {
      participantWrites.push(params);
      return { affectedRows: 1 };
    }
    return [];
  });

  const result = await service.backfillCommunityTournaments({ status: 'in_progress' });

  assert.equal(result.participants, 2);
  assert.equal(participantWrites.length, 2);
  assert.equal(participantWrites[0][2], 'player');
  assert.equal(participantWrites[0][4], 'player-home');
  assert.equal(participantWrites[1][4], 'player-away');
});

test('backfillLeagueEntities writes official competition seasons from league_entities', async () => {
  const calls = [];
  const service = loadService(async (sql, params = []) => {
    calls.push({ sql, params });
    if (/FROM league_entities WHERE entity_type = \?/.test(sql) && params[0] === 'competition_season') {
      return [{
        id: 'season-1',
        entity_type: 'competition_season',
        status: 'in_progress',
        platform: 'ps5',
        region: 'EU',
        data_json: JSON.stringify({ name: 'Supreme Season 1', competition_id: 'competition-1' }),
        created_date: '2026-05-26 10:00:00',
      }];
    }
    if (/FROM league_entities WHERE entity_type = \? AND `season_id` = \?/.test(sql) && params[0] === 'competition_standing') {
      return [{
        id: 'standing-1',
        entity_type: 'competition_standing',
        season_id: 'season-1',
        club_id: 'club-home',
        data_json: JSON.stringify({ club_name: 'Home FC', rank: 1 }),
        created_date: '2026-05-26 10:00:00',
      }];
    }
    if (/FROM league_entities WHERE entity_type = \? AND `season_id` = \?/.test(sql) && params[0] === 'competition_fixture') {
      return [{
        id: 'fixture-1',
        entity_type: 'competition_fixture',
        season_id: 'season-1',
        status: 'completed',
        scheduling_status: 'confirmed',
        data_json: JSON.stringify({
          match_id: 'match-1',
          home_club_id: 'club-home',
          home_club_name: 'Home FC',
          away_club_id: 'club-away',
          away_club_name: 'Away FC',
          home_score: 3,
          away_score: 1,
          winner_club_id: 'club-home',
        }),
        created_date: '2026-05-26 11:00:00',
      }];
    }
    if (/INSERT INTO competition_instances/.test(sql)) return { affectedRows: 1 };
    if (/INSERT INTO competition_participants/.test(sql)) return { affectedRows: 1 };
    if (/INSERT INTO competition_fixtures/.test(sql)) return { affectedRows: 1 };
    return [];
  });

  const result = await service.backfillLeagueEntities({ productType: 'official_competition', status: 'in_progress' });

  assert.equal(result.product_type, 'official_competition');
  assert.equal(result.parents, 1);
  assert.equal(result.instances, 1);
  assert.equal(result.participants, 1);
  assert.equal(result.fixtures, 1);
  assert.ok(calls.some((call) => call.params.includes('competition_fixture')));
});
