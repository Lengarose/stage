const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadService(executesql, edition = { status: 'in_progress' }) {
  let transactionActive = false;
  const sourceQuery = executesql;
  executesql = async (sql, params = []) => {
    if (sql === 'SELECT * FROM league_entities WHERE id=? AND entity_type=? FOR UPDATE') {
      assert.equal(transactionActive, true, 'edition guard must use the result-write transaction');
      if (params[1] === 'competition') return [{ id: params[0], status: 'active', data_json: '{}' }];
      return edition ? [{ id: params[0], entity_type: params[1], status: edition.status, data_json: JSON.stringify({ competition_id: 'gost', ...edition }) }] : [];
    }
    return sourceQuery(sql, params, { inTransaction: transactionActive });
  };
  let transactionQueue = Promise.resolve();
  const withTransaction = fn => {const result=transactionQueue.then(async()=>{transactionActive=true;try{return await fn(executesql);}finally{transactionActive=false;}});transactionQueue=result.catch(()=>{});return result;};
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
    exports: { EXECUTESQL: executesql, withTransaction, pool: {} },
  };
  const prizesPath = path.resolve(__dirname,'../competitionPrizeService.js');
  require.cache[prizesPath] = {id:prizesPath,filename:prizesPath,loaded:true,exports:{capture:async()=>{},review:async()=>({state:'paid'})}};
  const scopePath = path.resolve(__dirname,'../../models/competitionScopeModel.js');
  require.cache[scopePath] = {id:scopePath,filename:scopePath,loaded:true,exports:{unpack: row=>({...JSON.parse(row.data_json || '{}'),...row}),CompetitionScopeModel:class {
    async selectOne(kind,id) {
      const regional = kind === 'regional_league';
      const fixtures = await executesql(regional ? "SELECT * FROM league_entities WHERE entity_type = 'regional_league_fixture' AND league_id = ? LIMIT 1000" : 'SELECT * FROM league_entities WHERE entity_type = ? AND `season_id` = ? LIMIT 1000',regional ? [id] : ['competition_fixture',id]);
      const standings = await executesql(`SELECT * FROM league_entities WHERE entity_type = '${regional ? 'regional_league_standing' : 'competition_standing'}' AND ${regional ? 'league_id' : 'season_id'} = ?`,[id]);
      const roots = await executesql(regional ? 'SELECT * FROM league_entities WHERE id = ? AND entity_type = ? LIMIT 1' : "SELECT * FROM league_entities WHERE id = ? AND entity_type = 'competition_season' LIMIT 1",regional ? [id,'regional_league'] : [id]);
      const unpack = row=>({...JSON.parse(row.data_json || '{}'),...row});
      return {source_type:kind,root:roots[0] ? unpack(roots[0]) : {id},fixtures:fixtures.map(unpack),standings:standings.map(unpack),participants:standings.map(unpack).map(s=>({id:s.club_id,name:s.club_name})),matches:fixtures.map(unpack).map(f=>({...f,tournament_id:id,fixture_id:f.id,type:f.phase || 'league',round:f.leg || f.round || 1,status:f.status === 'played' ? 'completed' : f.status}))};
    }
  }}};
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

test('completed tournament retries missing prize settlement even when progression has nothing to advance', async () => {
  const progression = path.resolve(__dirname, '../tournamentProgressionService.js');
  const legacy = path.resolve(__dirname, '../../functions/legacyFunctions.js');
  const prior = [require.cache[progression], require.cache[legacy]];
  let attempts = 0;
  require.cache[progression] = { id: progression, filename: progression, loaded: true, exports: { reconcileTournament: async () => ({ completed: false, advanced: false, tournament: { id: 'paid-cup', status: 'completed' }, conflicts: [] }) } };
  require.cache[legacy] = { id: legacy, filename: legacy, loaded: true, exports: { HANDLERS: { distributeTournamentPrizes: async () => { attempts++; return { success: true }; } } } };
  try {
    const service = loadService(async () => []);
    await service.advanceCommunityTournamentIfReady({ id: 'final', tournament_id: 'paid-cup', status: 'completed' });
    assert.equal(attempts, 1, 'A completed tournament with a previously awarded trophy must still retry its unpaid STC obligations');
  } finally {
    for (const [i, key] of [progression, legacy].entries()) { if (prior[i]) require.cache[key] = prior[i]; else delete require.cache[key]; }
  }
});

test('linked tournament result submissions reuse the authenticated GameDay lifecycle', async () => {
  const legacyPath = path.resolve(__dirname, '../../functions/legacyFunctions.js');
  const previous = require.cache[legacyPath];
  const received = [];
  require.cache[legacyPath] = { id: legacyPath, filename: legacyPath, loaded: true, exports: { HANDLERS: { matchKickoff: async args => { received.push(args); return { data: { status: 'awaiting_away_confirmation' } }; } } } };
  try {
    const service = loadService(async sql => /FROM competition_fixtures WHERE match_id/.test(sql) ? [{ id: 'linked', legacy_fixture_type: 'tournament_match' }] : assert.fail(`Unexpected SQL: ${sql}`));
    const result = await service.submitResult({ matchId: 'match', side: 'away', submittedByUserId: 'actor', scoreHome: 3, scoreAway: 1, payloadJson: { _auth_user_id: 'spoofed', action: 'admin_resolve' } });
    assert.equal(result.status, 'awaiting_away_confirmation');
    assert.equal(received[0]._auth_user_id, 'actor'); assert.equal(received[0].action, 'submit_result');
    assert.equal(received[0].own_score, 1); assert.equal(received[0].opponent_score, 3);
  } finally { if (previous) require.cache[legacyPath] = previous; else delete require.cache[legacyPath]; }
});

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
  assert.equal(match.allow_penalties, 0);
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

test('submitResult completion returns progression trace after agreed result finalizes', async () => {
  const fixtureRows = [{
    id: 'engine-fixture-1',
    match_id: 'match-1',
    status: 'scheduled',
    legacy_fixture_type: 'competition_fixture',
    legacy_fixture_id: 'fixture-legacy',
    home_participant_id: 'participant-home',
    away_participant_id: 'participant-away',
  }];
  const submissions = [
    { side: 'home', score_home: 2, score_away: 1 },
    { side: 'away', score_home: 2, score_away: 1 },
  ];
  const service = loadService(async (sql, params = []) => {
    if (/SELECT \* FROM competition_fixtures WHERE match_id = \? LIMIT 1/.test(sql)) return fixtureRows;
    if (/INSERT INTO competition_result_submissions/.test(sql)) return { affectedRows: 1 };
    if (/SELECT \* FROM competition_result_submissions WHERE match_id = \?/.test(sql)) return submissions;
    if (/UPDATE matches\s+SET status = 'completed'/.test(sql)) return { affectedRows: 1 };
    if (/UPDATE competition_fixtures\s+SET status = 'completed'/.test(sql)) {
      fixtureRows[0] = { ...fixtureRows[0], status: 'completed', home_score: params[0], away_score: params[1], winner_participant_id: params[2], stats_processed: 1 };
      return { affectedRows: 1 };
    }
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
    if (/entity_type = 'competition_standing'\s+AND season_id = \?\s+AND club_id IN/.test(sql)) return [];
    if (/entity_type = 'competition_standing' AND season_id = \?/.test(sql)) return [];
    if (/UPDATE league_entities SET/.test(sql)) return { affectedRows: 1 };
    if (/SELECT \* FROM league_entities WHERE entity_type = \? AND `season_id` = \? LIMIT 1000/.test(sql)) {
      return [{ id: 'fixture-legacy', entity_type: 'competition_fixture', status: 'completed', data_json: JSON.stringify({ phase: 'league', round: 1, status: 'completed' }) }];
    }
    if (/SELECT \* FROM competition_instances/.test(sql)) return [];
    return [];
  });

  const result = await service.submitResult({
    matchId: 'match-1',
    side: 'away',
    submittedByUserId: 'user-1',
    scoreHome: 2,
    scoreAway: 1,
  });

  assert.equal(result.status, 'completed');
  assert.equal(result.progression.triggered, true);
  assert.equal(result.progression.sync.legacy.synced, true);
  assert.equal(result.progression.sync.advance.reason, 'Expected league matchdays are not configured');
});

test('advanceAfterFinalResult treats forfeited matches as final without score sync', async () => {
  const service = loadService(async (sql) => {
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  const result = await service.advanceAfterFinalResult({
    id: 'match-forfeit-1',
    status: 'forfeit',
    tournament_id: null,
  });

  assert.equal(result.triggered, true);
  assert.equal(result.source, 'match');
  assert.equal(result.sync.synced, false);
  assert.equal(result.sync.reason, 'non_played_final_result');
  assert.equal(result.community.reason, 'not_completed_tournament_match');
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

test('syncMatchResultToSource updates regional league fixture and standings server-side', async () => {
  const updates = [];
  const service = loadService(async (sql, params = []) => {
    if (/SELECT \* FROM competition_fixtures WHERE match_id = \? LIMIT 1/.test(sql)) return [];
    if (/WHERE id = \? AND entity_type = 'regional_league_fixture'/.test(sql)) {
      return [{
        id: 'regional-fixture-1',
        entity_type: 'regional_league_fixture',
        status: 'scheduled',
        data_json: JSON.stringify({
          league_id: 'regional-league-1',
          home_club_id: 'club-home',
          home_club_name: 'Home FC',
          away_club_id: 'club-away',
          away_club_name: 'Away FC',
          stats_processed: false,
        }),
      }];
    }
    if (/entity_type = 'regional_league_standing'\s+AND league_id = \?\s+AND club_id IN/.test(sql)) {
      return [
        { id: 'regional-standing-home', entity_type: 'regional_league_standing', league_id: 'regional-league-1', club_id: 'club-home', data_json: JSON.stringify({ club_id: 'club-home', club_name: 'Home FC', points: 0, played: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0, goal_difference: 0, form: [] }) },
        { id: 'regional-standing-away', entity_type: 'regional_league_standing', league_id: 'regional-league-1', club_id: 'club-away', data_json: JSON.stringify({ club_id: 'club-away', club_name: 'Away FC', points: 0, played: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0, goal_difference: 0, form: [] }) },
      ];
    }
    if (/entity_type = 'regional_league_standing' AND league_id = \?/.test(sql)) {
      return [
        { id: 'regional-standing-home', entity_type: 'regional_league_standing', league_id: 'regional-league-1', club_id: 'club-home', data_json: JSON.stringify({ club_id: 'club-home', club_name: 'Home FC', points: 0, goals_for: 0, goals_against: 0, goal_difference: 0 }) },
        { id: 'regional-standing-away', entity_type: 'regional_league_standing', league_id: 'regional-league-1', club_id: 'club-away', data_json: JSON.stringify({ club_id: 'club-away', club_name: 'Away FC', points: 0, goals_for: 0, goals_against: 0, goal_difference: 0 }) },
      ];
    }
    if (/UPDATE league_entities SET/.test(sql)) {
      updates.push({ sql, params, data: JSON.parse(params[0]) });
      return { affectedRows: 1 };
    }
    return [];
  });

  const result = await service.syncMatchResultToSource({
    id: 'match-regional-1',
    status: 'completed',
    source_fixture_id: 'regional-fixture-1',
    source_fixture_type: 'regional_league',
    home_score: 1,
    away_score: 1,
  });

  assert.equal(result.legacy.synced, true);
  assert.ok(updates.some(update => update.params.includes('regional-fixture-1') && update.data.status === 'played'));
  assert.ok(updates.some(update => update.params.includes('regional-standing-home') && update.data.points === 1 && update.data.draws === 1));
  assert.ok(updates.some(update => update.params.includes('regional-standing-away') && update.data.points === 1 && update.data.draws === 1));
});

test('raw league result sync blocks closed, reset and invalidated editions before fixture, mirror or standing writes', async () => {
  for (const kind of ['regional_league', 'competition']) {
    for (const edition of [{ status: 'cancelled' }, { status: 'abandoned' }, { status: 'reset' }, { status: 'superseded' }, { status: 'retired' }, { status: 'in_progress', edition_invalidated: true }, null]) {
      const writes = [];
      const fixtureType = kind === 'regional_league' ? 'regional_league_fixture' : 'competition_fixture';
      const service = loadService(async (sql, params) => {
        if (/SELECT \* FROM competition_fixtures WHERE match_id/.test(sql)) return [{ id: 'mirror', legacy_fixture_type: fixtureType, legacy_fixture_id: 'fixture' }];
        if (sql.includes(`entity_type = '${fixtureType}'`)) return [{ id: 'fixture', entity_type: fixtureType, data_json: JSON.stringify({ league_id: 'edition', season_id: 'edition', home_club_id: 'home', away_club_id: 'away' }) }];
        if (/^(UPDATE|INSERT|DELETE)/.test(sql)) writes.push({ sql, params });
        return [];
      }, edition);
      await assert.rejects(service.syncMatchResultToSource({ id: 'match', status: 'completed', source_fixture_type: 'competition_engine', source_fixture_id: 'mirror', home_score: 2, away_score: 0 }), { status: edition ? 409 : 404 });
      assert.deepEqual(writes, [], `${kind}: ${JSON.stringify(edition)} must preserve all result evidence`);
    }
  }
});

test('raw sync rechecks the locked fixture and keeps legacy and mirror writes in the guarded transaction', async () => {
  for (const kind of ['regional_league', 'competition']) {
    const fixtureType = kind === 'regional_league' ? 'regional_league_fixture' : 'competition_fixture';
    const writes = [];
    let processed = false;
    const service = loadService(async (sql, params, context) => {
      if (/SELECT \* FROM competition_fixtures WHERE match_id/.test(sql)) return [{ id: 'mirror', legacy_fixture_type: fixtureType, legacy_fixture_id: 'fixture' }];
      if (sql.includes(`entity_type = '${fixtureType}'`)) return [{ id: 'fixture', entity_type: fixtureType, data_json: JSON.stringify({ league_id: 'edition', season_id: 'edition', phase: 'league', home_club_id: 'home', away_club_id: 'away', stats_processed: sql.endsWith('FOR UPDATE') && processed }) }];
      if (/UPDATE league_entities|UPDATE competition_fixtures/.test(sql)) {
        assert.equal(context.inTransaction, true);
        writes.push(sql);
        if (params.includes('fixture')) processed = true;
        return { affectedRows: 1 };
      }
      return [];
    });
    const match = { id: 'match', status: 'completed', source_fixture_type: 'competition_engine', source_fixture_id: 'mirror', home_score: 1, away_score: 0 };
    assert.equal((await service.syncMatchResultToSource(match)).legacy.synced, true);
    assert.equal((await service.syncMatchResultToSource(match)).legacy.reason, 'already_processed');
    assert.equal(writes.filter(sql => sql.startsWith('UPDATE league_entities')).length, 1);
    assert.equal(writes.filter(sql => sql.includes('UPDATE competition_fixtures')).length, 2);
  }
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

test('a completed phase cannot seed playoffs from unverifiable registration and fabricated standing totals', async () => {
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
  for (let i=1;i<24;i++) fixtureRows.push({id:`league-${i}`,entity_type:'competition_fixture',season_id:'season-1',status:'completed',data_json:JSON.stringify({phase:'league',home_club_id:`club-${i+1}`,away_club_id:`club-${(i+1)%24+1}`,home_score:1,away_score:0,stats_processed:true})});
  const service = loadService(async (sql, params = []) => {
    if (sql.includes("WHERE id = ? AND entity_type = 'competition_season' LIMIT 1")) return [{id:'season-1',data_json:JSON.stringify({num_league_matchdays:2})}];
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

  assert.equal(result.advance.advanced, false);
  assert.equal(result.advance.reason, 'Standings integrity requires authorised review');
  assert.equal(inserts.length, 0);
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
  assert.equal(result.advance.reason, 'Expected league matchdays are not configured');
  assert.equal(inserts.length, 0);
});

test('advanceCommunityTournamentIfReady delegates to locked tournament reconciliation', async () => {
  const calls = [];
  const progressionPath = path.resolve(__dirname, '../tournamentProgressionService.js');
  require.cache[progressionPath] = { id: progressionPath, filename: progressionPath, loaded: true, exports: { reconcileTournament: async id => { calls.push(id); return { advanced: true, matches_created: 2, completed: false }; } } };
  const service = loadService(async () => []);
  const result = await service.advanceCommunityTournamentIfReady({ tournament_id: 'cup', status: 'completed' });
  assert.deepEqual(calls, ['cup']);
  assert.equal(result.matches_created, 2);
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
          stats_processed: true,
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
  const standings = Array.from({ length: 20 }, (_, index) => ({
    id: `standing-${index + 1}`,
    entity_type: 'regional_league_standing',
    league_id: 'league-1',
    club_id: `club-${index + 1}`,
    data_json: JSON.stringify({
      id: `standing-${index + 1}`,
      league_id: 'league-1',
      club_id: `club-${index + 1}`,
      club_name: `Club ${index + 1}`,
      points: 6 * (19 - index),
      goal_difference: 38 - 4 * index,
      goals_for: 2 * (19 - index),
      goals_against: 2 * index,
      played: 38,
      wins: 2 * (19 - index),
      draws: 0,
      losses: 2 * index,
      region: 'EU',
      platform: 'PS5',
    }),
  }));
  const service = loadService(async (sql, params = []) => {
    if (/entity_type = 'regional_league_fixture'\s+AND league_id = \?/.test(sql)) {
      return standings.flatMap((a,i)=>standings.filter((_,j)=>j!==i).map(b=>({id:`${a.club_id}-${b.club_id}`,entity_type:'regional_league_fixture',status:'played',data_json:JSON.stringify({league_id:'league-1',status:'played',home_club_id:a.club_id,away_club_id:b.club_id,home_score:i < standings.indexOf(b) ? 1 : 0,away_score:i < standings.indexOf(b) ? 0 : 1,stats_processed:true})})));
    }
    if (/WHERE id = \? AND entity_type = \? LIMIT 1/.test(sql) && params[1] === 'regional_league') {
      return [{ id: 'league-1', entity_type: 'regional_league', data_json: JSON.stringify({ id: 'league-1', name: 'EU Division 1', registered_club_ids: standings.map(s=>s.club_id), region_slug: 'eu', platform: 'PS5', season_number: 1, division: 1, status: 'in_progress', linked_league_slug: 'eu-div-2' }) }];
    }
    if (sql === "SELECT * FROM league_entities WHERE entity_type = 'regional_league'") {
      return [{
        id: 'league-2',
        entity_type: 'regional_league',
        slug: 'eu-div-2',
        data_json: JSON.stringify({ id: 'league-2', name: 'EU Division 2', region_slug: 'eu', platform: 'PS5', season_number: 1, division: 2, slug: 'eu-div-2' }),
      }];
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
  assert.equal(result.qualified, 18);
  assert.equal(result.relegated, 2);
  assert.equal(inserts.length, 18);
  assert.deepEqual(inserts.map(insert => insert.data.target_competition_id), [
    'comp-supreme', 'comp-supreme', 'comp-supreme', 'comp-supreme', 'comp-supreme', 'comp-supreme',
    'comp-elite', 'comp-elite', 'comp-elite', 'comp-elite', 'comp-elite', 'comp-elite',
    'comp-challenger', 'comp-challenger', 'comp-challenger', 'comp-challenger', 'comp-challenger', 'comp-challenger',
  ]);
  assert.ok(updates.some(update => update.params.includes('regional_league') && update.data.status === 'completed'));
});

test('regional division resolution uses the permanent link and exact season/reset series rather than row order', () => {
  const { resolveRegionalLeagueEdition } = loadService(async () => []);
  const source = { id: 'source-s2', permanent_league_id: 'source', region_slug: 'eu', platform: 'crossplay', division: 3, season_number: 2, reset_series: 1, linked_league_id: 'upper', linked_league_slug: 'eu-div-2' };
  const root = { id: 'upper', slug: 'eu-div-2', region_slug: 'eu', platform: 'Cross-Platform', division: 2, season_number: 1, reset_series: 0, status: 'completed' };
  const correct = { ...root, id: 'upper-reset1-s2', permanent_league_id: root.id, slug: 'eu-div-2-s2', season_number: 2, reset_series: 1, status: 'registration' };
  const rows = [{ ...correct, id: 'latest', season_number: 3, slug: 'eu-div-2-s3' }, { ...correct, id: 'historical', reset_series: 0 }, correct, root];
  for (const order of [rows, [...rows].reverse()]) {
    assert.equal(resolveRegionalLeagueEdition(source, 2, order, { linked: true }).id, correct.id);
    assert.equal(resolveRegionalLeagueEdition(source, 2, order).id, correct.id);
    assert.equal(resolveRegionalLeagueEdition({ ...source, linked_league_id: undefined }, 2, order, { linked: true }).id, correct.id);
  }
  assert.equal(resolveRegionalLeagueEdition(source, 4, rows), null, 'an unconfigured lower division has no relegation target');
});

test('regional division resolution rejects ambiguous identities, wrong linked scope and missing/invalidated editions', () => {
  const { resolveRegionalLeagueEdition } = loadService(async () => []);
  const source = { id: 'source', region_slug: 'eu', platform: 'cross-platform', division: 1, season_number: 2, reset_series: 1, linked_league_id: 'lower' };
  const root = { id: 'lower', slug: 'eu-div-2', region_slug: 'eu', platform: 'cross-platform', division: 2, season_number: 1 };
  const child = { ...root, id: 'lower-s2', permanent_league_id: root.id, slug: 'eu-div-2-s2', season_number: 2, reset_series: 1, status: 'completed' };
  const linked = rows => resolveRegionalLeagueEdition(source, 2, rows, { linked: true });
  assert.throws(() => linked([root]), /same season and reset series/);
  assert.throws(() => linked([root, child, { ...child, id: 'duplicate' }]), /exactly one edition/);
  assert.throws(() => resolveRegionalLeagueEdition(source, 2, [root, child, { ...root, id: 'independent' }]), /Multiple permanent leagues/);
  assert.throws(() => linked([{ ...root, platform: 'xbox' }, child]), /division and platform/);
  assert.throws(() => linked([{ ...root, retired: true }, child]), /retired/);
  for (const patch of [{ edition_invalidated: true }, { status: 'reset' }, { status: 'cancelled' }, { reset_series: 0 }]) assert.throws(() => linked([root, { ...child, ...patch }]), /closed or invalidated|same season and reset series/);
  assert.throws(() => resolveRegionalLeagueEdition({ ...source, linked_league_slug: 'different-root' }, 2, [root, child, { ...root, id: 'different', slug: 'different-root' }], { linked: true }), /ambiguous/);
});

test('concurrent last semifinal confirmations persist exactly one final and wait for every aggregate tie', async () => {
  const fixtures=[];
  for(let tie=0;tie<2;tie++) for(let leg=1;leg<=2;leg++) fixtures.push({id:`sf-${tie}-${leg}`,entity_type:'competition_fixture',season_id:'season',status:'completed',data_json:JSON.stringify({phase:'knockout_sf',season_id:'season',competition_id:'parent',competition_name:'Local GOST',bracket_position:tie+1,tie_id:`tie-${tie}`,leg,home_club_id:leg===1 ? `a${tie}`:`b${tie}`,away_club_id:leg===1 ? `b${tie}`:`a${tie}`,home_score:leg===1 ? 4:1,away_score:0,stats_processed:true})});
  fixtures[3].status='scheduled';
  const service=loadService(async(sql,values=[])=>{
    if(sql.includes("WHERE id = ? AND entity_type = 'competition_season' LIMIT 1")) return [{id:'season',data_json:JSON.stringify({status:'knockout_sf'})}];
    if(sql.includes('entity_type = ? AND `season_id` = ? LIMIT 1000')) return fixtures;
    if(/AND phase = \?/.test(sql)) return fixtures.filter(f=>JSON.parse(f.data_json).phase===values[1]);
    if(/INSERT INTO league_entities/.test(sql)) {fixtures.push({id:values[0],entity_type:values[1],data_json:values[2],season_id:'season',status:'scheduled'});return {affectedRows:1};}
    if(/UPDATE league_entities/.test(sql)) return {affectedRows:1};
    return [];
  });
  const pending=await service.advanceLegacyOfficialCompetitionIfReady({season_id:'season',phase:'knockout_sf'});assert.equal(pending.advanced,false);assert.equal(fixtures.length,4);
  fixtures[3].status='completed';
  await Promise.all(Array.from({length:3},()=>service.advanceLegacyOfficialCompetitionIfReady({season_id:'season',phase:'knockout_sf'})));
  const finals=fixtures.filter(f=>JSON.parse(f.data_json).phase==='knockout_final');assert.equal(finals.length,1);
  const final=JSON.parse(finals[0].data_json);assert.deepEqual(new Set([final.home_club_id,final.away_club_id]),new Set(['a0','a1']));assert.equal(final.competition_id,'parent');assert.equal(final.scheduling_status,'open');
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
