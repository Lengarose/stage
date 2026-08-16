const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('mobile team leave delegates to the shared leave club lifecycle', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../teamRoutes.js'), 'utf8');
  assert.match(source, /leaveClubLifecycle/);
  assert.match(source, /playerId:\s*ctx\.player\.id/);
  assert.match(source, /router\.post\('\/:id\/leave'[\s\S]+leaveClubLifecycle\(/);
});
