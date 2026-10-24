'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const express = require('express');

test('stage routes are read-only and enforce home scheduling capability over HTTP', async () => {
  const tournament = {
    id: 'cup',
    type: 'knockout',
    participant_type: 'player',
    status: 'in_progress',
    max_teams: 4,
    registered_players: JSON.stringify(['p1', 'p2', 'p3', 'p4']),
  };
  const matches = [
    { id: 'm1', tournament_id: 'cup', type: 'knockout', round: 1, group_number: 0, status: 'scheduled', home_player_id: 'p1', away_player_id: 'p2', home_player_name: 'Home', away_player_name: 'Away' },
    { id: 'm2', tournament_id: 'cup', type: 'knockout', round: 1, group_number: 1, status: 'completed', result_state: 'confirmed', home_player_id: 'p3', away_player_id: 'p4', home_score: 1, away_score: 0 },
  ];
  const writes = [];
  async function query(sql, values = []) {
    if (/^\s*(INSERT|UPDATE|DELETE)/i.test(sql)) writes.push(sql);
    if (/FROM tournaments/.test(sql)) return values[0] === 'cup' ? [{ ...tournament }] : [];
    if (/FROM matches/.test(sql)) return matches.filter((match) => match.tournament_id === values[0]);
    if (/FROM players/.test(sql) && /gamertag/.test(sql)) return [{ id: 'p1', gamertag: 'Home', avatar_url: 'home.png' }];
    if (/FROM players/.test(sql)) return [{ id: values[0] === 'home-user' ? 'p1' : 'p2' }];
    if (/FROM users/.test(sql)) return [{ id: values[0], email: `${values[0]}@example.test` }];
    if (/FROM clubs/.test(sql)) return [];
    throw new Error(`Unexpected stage SQL: ${sql}`);
  }
  const inject = (file, exports) => {
    const id = path.resolve(__dirname, file);
    require.cache[id] = { id, filename: id, loaded: true, exports };
  };
  inject('../../db/database.js', { EXECUTESQL: query, withTransaction: async (fn) => fn(query) });
  inject('../functionsController.js', { HANDLERS: {} });
  const app = express();
  app.use('/api/stage/public', require('../publicTournamentController'));
  app.use('/api/stage/tournaments', (req, res, next) => {
    req.user = { id: req.headers['x-user'] || null };
    next();
  }, require('../tournamentController'));
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}/api/stage`;
  try {
    let response = await fetch(`${base}/public/tournaments/cup/stages`);
    assert.equal(response.status, 200);
    const catalogue = await response.json();
    assert.equal(catalogue.stages[0].key, 'sf');
    assert.equal(catalogue.stages.some((stage) => stage.key === 'playoff'), false);
    assert.equal(Object.hasOwn(catalogue.stages[0], 'can_schedule'), false);

    response = await fetch(`${base}/public/tournaments/cup/stages/sf/matches?classification=fixtures&limit=1&offset=0`);
    const preview = await response.json();
    assert.equal(response.status, 200);
    assert.equal(preview.total, 1);
    assert.equal(preview.matches[0].id, 'm1');
    assert.equal(preview.matches[0].classification, 'fixture');
    assert.equal(preview.has_more, false);
    assert.equal(Object.hasOwn(preview.matches[0], 'can_schedule'), false);

    response = await fetch(`${base}/public/tournaments/cup/stages/sf/matches?classification=results`);
    const results = await response.json();
    assert.equal(results.total, 1);
    assert.equal(results.matches[0].id, 'm2');
    assert.deepEqual(results.matches[0].score, { home: 1, away: 0 });

    response = await fetch(`${base}/tournaments/cup/stages`, { headers: { 'x-user': 'home-user' } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).stages[0].key, 'sf');
    response = await fetch(`${base}/tournaments/cup/stages/sf`, { headers: { 'x-user': 'home-user' } });
    assert.equal((await response.json()).stage.status, 'in_progress');

    response = await fetch(`${base}/tournaments/cup/stages/sf/matches?classification=fixtures`, { headers: { 'x-user': 'home-user' } });
    const home = await response.json();
    assert.equal(home.matches[0].can_schedule, true);
    response = await fetch(`${base}/tournaments/cup/stages/sf/matches?classification=fixtures`, { headers: { 'x-user': 'away-user' } });
    const away = await response.json();
    assert.equal(away.matches[0].can_schedule, false);

    response = await fetch(`${base}/public/tournaments/cup/stages/not-a-stage/matches`);
    assert.equal(response.status, 404);
    response = await fetch(`${base}/public/tournaments/cup/stages/sf/matches?limit=500`);
    assert.equal(response.status, 400);
    response = await fetch(`${base}/public/tournaments/missing/stages`);
    assert.equal(response.status, 404);

    const before = writes.length;
    response = await fetch(`${base}/public/tournaments/cup/stages`);
    await response.json();
    response = await fetch(`${base}/public/tournaments/cup/stages/final`);
    const finalStage = await response.json();
    assert.equal(response.status, 200);
    assert.equal(finalStage.stage.match_count, 0);
    assert.equal(finalStage.stage.status, 'awaiting_qualification');
    assert.equal(writes.length, before);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
