const assert = require('node:assert/strict');
const test = require('node:test');

const {
  isWallClockPast,
  toMysqlDateTime,
} = require('../datetime');

test('datetime-local tournament starts are normalized without a UTC shift', () => {
  assert.equal(toMysqlDateTime('2026-08-20T13:45'), '2026-08-20 13:45:00');
});

test('a same-day later tournament start is not treated as passed', () => {
  const nowBeforeStart = new Date(2026, 7, 20, 13, 17, 0);
  assert.equal(isWallClockPast('2026-08-20 13:45:00', nowBeforeStart), false);
});
