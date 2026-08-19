const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const test = require('node:test');

const source = readFileSync(resolve(__dirname, '../legacyFunctions.js'), 'utf8');

function constantArrayBody(name) {
  const match = source.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
  assert.ok(match, `${name} should be declared as a top-level array`);
  return match[1];
}

test('tournament test club seed pack creates twenty clubs', () => {
  const clubsBody = constantArrayBody('TEST_CLUBS');
  const clubCount = (clubsBody.match(/\{\s*name:/g) || []).length;

  assert.equal(clubCount, 20);
});

test('each tournament test club has four to eight players', () => {
  const playersBody = constantArrayBody('TEST_PLAYER_NAMES');
  const playerGroups = [...playersBody.matchAll(/\[([^\]]+)\]/g)].map((match) => (
    match[1].split(',').map((name) => name.trim()).filter(Boolean)
  ));

  assert.equal(playerGroups.length, 20);
  for (const group of playerGroups) {
    assert.ok(group.length >= 4, `expected at least 4 players, got ${group.length}`);
    assert.ok(group.length <= 8, `expected at most 8 players, got ${group.length}`);
  }
});

test('seed handler rejects a misconfigured test pack before writing data', () => {
  assert.match(source, /TEST_CLUBS\.length !== 20/);
  assert.match(source, /TEST_PLAYER_NAMES\.length !== 20/);
  assert.match(source, /TEST_PACK_MISCONFIGURED/);
  assert.match(source, /names\.length < 4 \|\| names\.length > 8/);
});
