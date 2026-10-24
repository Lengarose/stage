const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const express = require('express');

test('statistics and authenticated reconciliation endpoints respond over local HTTP', async () => {
  const tournament = { id: 'cup', status: 'registration', type: 'knockout', participant_type: 'player', registered_players: JSON.stringify(['p1', 'p2', 'p3']) };
  const matches = [{ id: 'm1', tournament_id: 'cup', type: 'knockout', round: 1, status: 'completed', result_state: 'CONFIRMED', home_player_id: 'p1', away_player_id: 'p2', home_score: 3, away_score: 1 }];
  const audits = [];
  async function query(sql, values = []) {
    if (/FROM tournaments/.test(sql)) return values[0] === 'cup' ? [{ ...tournament }] : [];
    if (/FROM users/.test(sql)) return [{ id: values[0], role_id: values[0] === 'admin' ? 0 : 1, email: `${values[0]}@example.test` }];
    if (/FROM matches/.test(sql)) return matches;
    if (/FROM match_player_stats/.test(sql)) return [];
    if (/FROM players/.test(sql)) return ['p1', 'p2', 'p3'].map(id => ({ id, gamertag: id }));
    if (/INSERT INTO admin_audit_log/.test(sql)) { audits.push(values); return { affectedRows: 1 }; }
    throw new Error(`Unexpected HTTP test SQL: ${sql}`);
  }
  const inject = (file, exports) => { const id = path.resolve(__dirname, file); require.cache[id] = { id, filename: id, loaded: true, exports }; };
  inject('../../db/database.js', { EXECUTESQL: query, withTransaction: async fn => fn(query) });
  inject('../functionsController.js', { HANDLERS: {} });
  inject('../../utils/socketBroadcast.js', { broadcastMatch() {}, broadcastTournament() {} });
  const { reconcileTournament } = require('../../services/tournamentProgressionService');
  inject('../../services/competitionEngineService.js', { advanceCommunityTournamentIfReady: async m => reconcileTournament(m.tournament_id) });
  const app = express(); app.use(express.json());
  app.use('/api/stage/public', require('../publicTournamentController'));
  app.use('/api/stage/tournaments', (req, res, next) => { req.user = { id: req.headers.authorization === 'Bearer admin-token' ? 'admin' : 'player' }; next(); }, require('../tournamentController'));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api/stage`;
  try {
    let response = await fetch(`${base}/public/tournaments/cup/statistics`);
    assert.equal(response.status, 200);
    const stats = await response.json();
    assert.equal(stats.participants.goals.length, 3); assert.equal(stats.participants.goals[0].goals, 3);
    assert.equal(stats.categories[0].key, 'most_goals_scored');
    response = await fetch(`${base}/public/tournaments/cup/statistics/most_goals_scored?limit=1&offset=0`);
    assert.equal(response.status, 200);
    const page = await response.json();
    assert.equal(page.category.title, 'Most Goals Scored');
    assert.equal(page.total, 3);
    assert.equal(page.rows.length, 1);
    assert.equal(page.has_more, true);
    response = await fetch(`${base}/public/tournaments/cup/statistics/top_scorers`);
    assert.equal(response.status, 400);
    response = await fetch(`${base}/tournaments/cup/statistics/fewest_goals_conceded?limit=10`, { headers: { Authorization: 'Bearer admin-token' } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).category.title, 'Fewest Goals Conceded');
    response = await fetch(`${base}/public/tournaments/missing/statistics`); assert.equal(response.status, 404);
    response = await fetch(`${base}/tournaments/cup/reconcile-progression`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); assert.equal(response.status, 403);
    response = await fetch(`${base}/tournaments/cup/reconcile-progression`, { method: 'POST', headers: { Authorization: 'Bearer admin-token', 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(response.status, 200); assert.equal((await response.json()).dry_run, true); assert.equal(audits.length, 0);
    response = await fetch(`${base}/tournaments/cup/reconcile-progression`, { method: 'POST', headers: { Authorization: 'Bearer admin-token', 'Content-Type': 'application/json' }, body: JSON.stringify({ dry_run: false, reason: 'Local HTTP verification' }) });
    assert.equal(response.status, 200); assert.equal(audits.length, 1);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
