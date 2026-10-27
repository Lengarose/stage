const test = require('node:test');
const assert = require('node:assert/strict');

test('GOST overview and audited catalogue assignment over isolated local HTTP', async () => {
  const dbPath = require.resolve('../../db/database');
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { EXECUTESQL: async () => [], withTransaction: fn => fn(async () => []) } };
  const express = require('express');
  const { createRouter } = require('../gostOverviewController');
  const entities = [{ id: 'sup', entity_type: 'competition', data_json: JSON.stringify({ name: 'Supreme League', slug: 'supreme', tier: 1 }) }];
  const items = [{ id: 'cup', name: 'Catalogue cup', image_url: '/uploads/cup.png', price: 999, admin_only: 1 }];
  const audits = [];
  const query = async (sql, args = []) => {
    if (sql.includes('FROM users')) return [{ id: args[0], email: 'local@example.test', role_id: args[0] === 'admin' ? 2 : 1 }];
    if (sql.includes('FROM trophy_items')) return items;
    if (sql.includes('FROM trophy_awards') || sql.includes('FROM reward_configs')) return [];
    if (sql.includes("entity_type='competition' AND id=?")) return entities.filter(e => e.id === args[0] && e.entity_type === 'competition');
    if (sql.includes("entity_type='reward_configuration' AND id=?")) return entities.filter(e => e.id === args[0]);
    if (sql.includes('SELECT * FROM league_entities')) return entities;
    if (sql.startsWith('INSERT INTO league_entities')) { const row = entities.find(e => e.id === args[0]); if (row) row.data_json = args[1]; else entities.push({ id: args[0], entity_type: 'reward_configuration', data_json: args[1] }); return {}; }
    if (sql.startsWith('INSERT INTO admin_audit_log')) { audits.push(args); return {}; }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const app = express(); app.use(express.json());
  app.use((req, res, next) => { const id = req.headers.authorization?.replace('Bearer ', ''); if (id) req.user = { id }; next(); });
  app.use('/gost', createRouter({ query, transaction: fn => fn(query) }));
  const server = await new Promise((resolve, reject) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); s.on('error', reject); });
  const base = `http://127.0.0.1:${server.address().port}/gost`;
  const call = (path, user = 'member', body) => fetch(base + path, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${user}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    assert.equal((await fetch(base + '/overview')).status, 401);
    const overview = await call('/overview'); assert.equal(overview.status, 200);
    assert.equal((await overview.json()).competitions[0].assignment.state, 'unassigned');
    assert.equal((await call('/sup/trophy')).status, 403);
    assert.equal((await call('/sup/trophy', 'member', { trophy_item_id: 'cup' })).status, 403);
    assert.equal((await call('/missing/trophy', 'admin')).status, 404);
    const review = await (await call('/sup/trophy', 'admin')).json();
    assert.equal(review.items[0].price, undefined); assert.equal(review.items[0].admin_only, undefined);
    assert.equal((await call('/sup/trophy', 'admin', { trophy_item_id: 'cup', revision: review.revision })).status, 400);
    const saved = await call('/sup/trophy', 'admin', { trophy_item_id: 'cup', revision: review.revision, reason: 'Reviewed local assignment', admin_user_id: 'spoofed' });
    assert.equal(saved.status, 200, await saved.clone().text());
    assert.equal((await (await call('/sup/trophy', 'admin')).json()).selected_id, 'cup');
    assert.equal((await (await call('/overview')).json()).competitions[0].assignment.trophy.image_url, '/uploads/cup.png');
    assert.equal(audits.length, 1); assert.equal(audits[0][1], 'admin');
  } finally { await new Promise(resolve => server.close(resolve)); }
});
