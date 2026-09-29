const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadPublicRouter(executesql) {
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  const controllerPath = path.resolve(__dirname, '../publicTournamentController.js');
  delete require.cache[controllerPath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql, pool: {} },
  };
  return require(controllerPath);
}

function getTournamentHandler(router) {
  const layer = router.stack.find((entry) => entry.route?.path === '/tournaments/:id' && entry.route.methods.get);
  return layer.route.stack[0].handle;
}

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };
}

const tournament = {
  id: 'cup-1',
  name: 'Tournoi Test',
  start_date: '2026-09-01 21:00:00',
  rules_template_id: 'standard_cup',
  custom_rules: 'rules_template:standard_cup',
};

test('public tournament GET returns the template id and omits rendered rules without a locale', async () => {
  const router = loadPublicRouter(async () => [tournament]);
  const res = response();
  await getTournamentHandler(router)({ params: { id: 'cup-1' }, query: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.rules_template_id, 'standard_cup');
  assert.equal(Object.hasOwn(res.body, 'rules_rendered'), false);
});

test('public tournament GET renders rules only for locale fr or en', async () => {
  const router = loadPublicRouter(async () => [tournament]);
  const french = response();
  await getTournamentHandler(router)({ params: { id: 'cup-1' }, query: { locale: 'fr' } }, french);
  assert.match(french.body.rules_rendered, /Tournoi Test/);
  assert.match(french.body.rules_rendered, /01\/09\/2026 21:00/);
  assert.doesNotMatch(french.body.rules_rendered, /\{\{/);

  const other = response();
  await getTournamentHandler(router)({ params: { id: 'cup-1' }, query: { locale: 'nl' } }, other);
  assert.equal(Object.hasOwn(other.body, 'rules_rendered'), false);
  assert.equal(other.body.rules_template_id, 'standard_cup');
});
