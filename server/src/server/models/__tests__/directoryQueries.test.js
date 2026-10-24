const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');

function loadModel(name, execute) {
  const filename = path.resolve(__dirname, `../${name}Model.js`);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const requireOriginal = loaded.require.bind(loaded);
  loaded.require = request => request === '../db/database' ? { EXECUTESQL: execute } : requireOriginal(request);
  loaded._compile(fs.readFileSync(filename, 'utf8'), filename);
  return loaded.exports;
}

test('player and club directories sort deterministically before applying limit and offset', async () => {
  for (const [name, order, pattern] of [
    ['player', '-overall_rating', /ORDER BY `overall_rating` DESC, id ASC LIMIT \? OFFSET \?/],
    ['club', '-wins', /ORDER BY c\.`wins` DESC, c.id ASC LIMIT \? OFFSET \?/],
  ]) {
    const Model = loadModel(name, async (sql, params) => { assert.match(sql, pattern); assert.deepEqual(params.slice(-2), [50, 200]); return []; });
    await new Model().selectAll({ order_by: order, limit: 50, offset: 200 });
    assert.throws(() => new Model().selectAll({ order_by: 'id; DROP TABLE players' }), error => error.status === 400);
  }
});

test('directory search is applied in SQL and treats wildcard input literally', async () => {
  for (const name of ['player', 'club']) {
    const Model = loadModel(name, async (sql, params) => {
      assert.match(sql, /WHERE .*LIKE \? ESCAPE '!'/);
      assert.match(sql, /ORDER BY .* LIMIT \? OFFSET \?/);
      assert.equal(params[0], '%mid!%!_!!%');
      if (name === 'club') assert.match(sql, /p.gamertag/);
      return [];
    });
    await new Model().selectAll({ search: 'Mid%_!', limit: 50 });
  }
});
