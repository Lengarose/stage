const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');

function setup(participantType = 'club') {
  const tournament = { id: 'cup', type: 'knockout', participant_type: participantType, status: 'in_progress', max_teams: 8 };
  const rows = Array.from({ length: 4 }, (_, i) => ({ id: `q${i}`, tournament_id: 'cup', type: 'knockout', round: 1, group_number: i, status: 'scheduled', home_score: 2, away_score: 0, [`home_${participantType}_id`]: `a${i}`, [`away_${participantType}_id`]: `b${i}`, [`home_${participantType}_name`]: `A${i}`, [`away_${participantType}_name`]: `B${i}` }));
  const audit = [];
  const queries = [];
  async function query(sql, values = []) {
    queries.push({ sql, values });
    if (/^(DELETE FROM|UPDATE) competition_fixtures/.test(sql) || /^UPDATE match_player_stats SET is_superseded/.test(sql)) return {};
    if (/^SELECT.*FROM tournaments/s.test(sql)) return [{ ...tournament }];
    if (/^SELECT.*FROM matches m /s.test(sql) || /^SELECT \* FROM matches WHERE tournament_id/s.test(sql)) return rows.map(m => ({ ...m }));
    if (/^SELECT \* FROM matches WHERE id/.test(sql)) return rows.filter(m => m.id === values[0]).map(m => ({ ...m }));
    if (/^INSERT INTO matches/.test(sql)) {
      const names = [...sql.matchAll(/`([^`]+)`/g)].map(m => m[1]);
      const row = Object.fromEntries(names.map((name, i) => [name, values[i]]));
      assert(!rows.some(m => m.progression_key && m.progression_key === row.progression_key), 'unique progression key');
      rows.push(row); return { affectedRows: 1 };
    }
    if (/^UPDATE matches SET/.test(sql)) {
      const row = rows.find(m => m.id === values.at(-1));
      const names = [...sql.matchAll(/`?(\w+)`?=\?/g)].map(m => m[1]);
      names.forEach((name, i) => { row[name] = values[i]; }); return { affectedRows: 1 };
    }
    if (/^DELETE FROM matches/.test(sql)) { const index = rows.findIndex(m => m.id === values[0]); if (index >= 0) rows.splice(index, 1); return {}; }
    if (/^UPDATE tournaments SET status='completed'/.test(sql)) { tournament.status = 'completed'; return {}; }
    if (/^UPDATE tournaments SET current_round=/.test(sql)) { tournament.current_round = values[0]; return {}; }
    if (/^INSERT INTO admin_audit_log/.test(sql)) { audit.push(values); return {}; }
    throw new Error(`Unexpected test SQL: ${sql}`);
  }
  let previous = Promise.resolve();
  const withTransaction = fn => {
    const result = previous.then(() => fn(query));
    previous = result.catch(() => {});
    return result;
  };
  const db = path.resolve(__dirname, '../../db/database.js');
  const socket = path.resolve(__dirname, '../../utils/socketBroadcast.js');
  const service = path.resolve(__dirname, '../tournamentProgressionService.js');
  require.cache[db] = { id: db, filename: db, loaded: true, exports: { EXECUTESQL: query, withTransaction } };
  require.cache[socket] = { id: socket, filename: socket, loaded: true, exports: { broadcastMatch() {}, broadcastTournament() {} } };
  delete require.cache[service];
  return { service: require(service), rows, tournament, query, audit, queries };
}

test('registration previews cannot be completed; starting the tournament unlocks result reporting', async () => {
  const { service, tournament, rows, query } = setup('player');
  tournament.status = 'registration';
  await assert.rejects(service.assertTournamentMatchAction(rows[0], {result:true}, query), /Start the tournament/);
  tournament.status = 'in_progress';
  await service.assertTournamentMatchAction(rows[0], {result:true}, query);
});

test('the final required club confirmation creates one draw despite concurrent retries', async () => {
  const { service, rows } = setup();
  for (const row of rows.slice(0, 3)) { row.status = 'completed'; row.result_state = 'CONFIRMED'; }
  assert.equal((await service.reconcileTournament('cup')).matches_created, 0);
  rows[3].status = 'completed'; rows[3].result_state = 'CONFIRMED';
  const results = await Promise.all([service.reconcileTournament('cup'), service.reconcileTournament('cup'), service.reconcileTournament('cup')]);
  assert.equal(results.reduce((n, result) => n + result.matches_created, 0), 2);
  assert.equal(rows.length, 6);
  assert(rows.slice(4).every(m => m.status === 'unscheduled'));
});
test('player bracket partial slots are filled without creating a match against an unknown opponent', async () => {
  const { service, rows } = setup('player');
  rows[0].status = 'completed'; rows[0].result_state = 'CONFIRMED';
  const partial = await service.reconcileTournament('cup');
  assert.equal(partial.matches_created, 1);
  const next = rows.find(m => Number(m.round) === 2);
  assert.equal(next.status, 'awaiting_qualification'); assert.equal(next.away_player_id, null);
  rows[1].status = 'completed'; rows[1].result_state = 'CONFIRMED';
  await service.reconcileTournament('cup');
  assert.equal(next.status, 'unscheduled'); assert.equal(next.away_player_id, 'a1');
});
test('dry reconciliation reports proposed repairs and does not change stored fixtures', async () => {
  const { service, rows } = setup();
  for (const row of rows) { row.status = 'completed'; row.result_state = 'CONFIRMED'; }
  const result = await service.reconcileTournament('cup', { dryRun: true });
  assert.equal(result.plan.fixtures.length, 2); assert.equal(rows.length, 4);
});
test('final reporting and conflicting schedules are blocked until third place is resolved', async () => {
  const { service, rows } = setup();
  rows.splice(0, rows.length,
    { id: 's1', type: 'semi_final', round: 1 },
    { id: 's2', type: 'semi_final', round: 1 },
    { id: 'third', type: 'third_place', round: 2, scheduled_date: '2026-10-23 18:00:00', status: 'scheduled', home_club_id: 'a', away_club_id: 'b' },
    { id: 'final', type: 'final', round: 2, tournament_id: 'cup', status: 'scheduled', home_club_id: 'c', away_club_id: 'd' });
  const final = rows.at(-1);
  await assert.rejects(service.assertTournamentMatchAction(final, { result: true }), /Complete the Third-Place Playoff/);
  await assert.rejects(service.assertTournamentMatchAction(final, { schedule: '2026-10-23 17:00:00' }), /Schedule the Final after/);
  await service.assertTournamentMatchAction(final, { schedule: '2026-10-23 19:00:00' });
  Object.assign(rows[2], { status: 'completed', result_state: 'CONFIRMED', home_score: 1, away_score: 0 });
  await service.assertTournamentMatchAction(final, { result: true });
});
test('corrections do not erase downstream activity', async () => {
  const { service, rows } = setup();
  rows.push({ id: 'next', round: 2, status: 'scheduled', scheduled_date: '2026-10-23 19:00:00' });
  await assert.rejects(service.correctTournamentResult(rows[0], { home_score: 0, away_score: 3 }, { id: 'admin' }), /Downstream matches have/);
  assert.equal(rows.length, 5);
});

test('idle downstream corrections retain superseded player evidence and write an audit', async () => {
  const { service, rows, audit, queries } = setup();
  rows[0].status = 'completed'; rows[0].result_state = 'CONFIRMED';
  rows.push({ id: 'next', round: 2, status: 'unscheduled' });
  const updated = await service.correctTournamentResult(rows[0], { home_score: 0, away_score: 3 }, { id: 'admin', email: 'admin@example.test' });
  assert.equal(updated.winner_club_id, 'b0');
  assert.equal(rows.some(m => m.id === 'next'), false);
  assert.equal(audit.length, 1);
  assert(queries.some(q => /UPDATE match_player_stats SET is_superseded=1/.test(q.sql)));
});
test('qualification dependencies protect successors sharing a decider round number', async () => {
  const { service, rows } = setup();
  rows[0].round = 11;
  rows.push({ id: 'same-round', round: 11, qualification_sources: JSON.stringify([rows[0].id]), scheduled_date: '2026-10-23 19:00:00' });
  await assert.rejects(service.correctTournamentResult(rows[0], { home_score: 0, away_score: 3 }, { id: 'admin' }), /Downstream matches/);
});
test('accepting a superseded schedule is rejected inside the tournament lock', async () => {
  const { service, rows } = setup();
  Object.assign(rows[0], { scheduling_status: 'home_proposed', home_proposed_date: '2026-10-23 19:00:00' });
  await assert.rejects(service.updateTournamentSchedule(rows[0], { scheduling_status: 'confirmed', confirmed_date: '2026-10-23 18:00:00', scheduled_date: '2026-10-23 18:00:00' }), /no longer current/);
});
