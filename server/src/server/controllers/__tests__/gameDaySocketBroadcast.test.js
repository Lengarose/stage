const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('dressing-room seat changes always broadcast the match', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../dressingRoomController.js'),
    'utf8',
  );
  assert.match(source, /broadcastDressingRoom\(record\)/);
  assert.equal(
    source.split('if (record?.match_id) await broadcastMatchById(record.match_id)').length - 1,
    2,
  );
});

test('wager actions broadcast the match so opponents see the lock live', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../functions/legacyFunctions.js'),
    'utf8',
  );
  assert.match(source, /action === 'accept_wager'[\s\S]*await broadcastMatchById\(match_id\)/);
  assert.match(source, /action === 'decline_wager'[\s\S]*await broadcastMatchById\(match_id\)/);
  assert.match(source, /action === 'cancel_wager'[\s\S]*await broadcastMatchById\(match_id\)/);
});
