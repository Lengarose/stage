'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

test('closed GOST rejects old-client qualification writes over HTTP and retains readable history', async () => {
  const databasePath = require.resolve('../../db/database');
  const controllerPath = require.resolve('../leagueEntityController');
  const previous = [require.cache[databasePath], require.cache[controllerPath]];
  const history = { id: 'historical-ticket', entity_type: 'qualification_entry', status: 'confirmed', data_json: JSON.stringify({ club_id: 'historic-club', target_season_id: 'old-season' }) };
  const mutations = [];
  require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: {
    EXECUTESQL: async (sql) => {
      if (/^(INSERT|UPDATE|DELETE)/.test(sql)) { mutations.push(sql); return { affectedRows: 1 }; }
      if (/FROM users/.test(sql)) return [{ id: 'admin', role_id: 0 }];
      return [structuredClone(history)];
    },
  } };
  delete require.cache[controllerPath];
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 'admin' }; next(); });
  app.use('/qualification-entries', require('../leagueEntityController').makeRouter('qualification_entry'));
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const url = `http://127.0.0.1:${server.address().port}/qualification-entries`;
    for (const [method, suffix, body] of [
      ['POST', '', { source_type: 'regional_league', club_id: 'new-club', target_competition_id: 'supreme', status: 'pending', qualifications_open: true }],
      ['PATCH', '/historical-ticket', { status: 'confirmed', target_season_id: 'new-season', qualifications_open: true }],
    ]) {
      const response = await fetch(`${url}${suffix}`, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      assert.equal(response.status, 409, `${method} must not create or roll forward a qualification while GOST is closed`);
      assert.match((await response.json()).error, /GOST.*not open/i);
    }
    const response = await fetch(`${url}/historical-ticket`);
    assert.equal(response.status, 200);
    const ticket = await response.json();
    assert.equal(ticket.status, 'confirmed');
    assert.equal(ticket.target_season_id, 'old-season');
    assert.deepEqual(mutations, []);
  } finally {
    await new Promise(resolve => server.close(resolve));
    for (const [i, key] of [databasePath, controllerPath].entries()) {
      if (previous[i]) require.cache[key] = previous[i]; else delete require.cache[key];
    }
  }
});
