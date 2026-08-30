const assert = require('node:assert/strict');
const test = require('node:test');

const {
  isWallClockPast,
  toMysqlDateTime,
  wallClockToOffsetIso,
  normalizeMatchForApi,
} = require('../datetime');

test('datetime-local tournament starts are normalized without a UTC shift', () => {
  assert.equal(toMysqlDateTime('2026-08-20T13:45'), '2026-08-20 13:45:00');
});

test('a same-day later tournament start is not treated as passed', () => {
  const nowBeforeStart = new Date(2026, 7, 20, 13, 17, 0);
  assert.equal(isWallClockPast('2026-08-20 13:45:00', nowBeforeStart), false);
});

test('Brussels August wall clock becomes offset ISO +02:00', () => {
  assert.equal(
    wallClockToOffsetIso('2026-08-30 17:20:00', 'Europe/Brussels'),
    '2026-08-30T17:20:00+02:00',
  );
});

test('normalizeMatchForApi emits scheduled_date offset ISO and timezone', () => {
  const out = normalizeMatchForApi({
    id: 'm1',
    scheduled_date: '2026-08-30 17:20:00',
    timezone: 'Europe/Brussels',
  });
  assert.equal(out.timezone, 'Europe/Brussels');
  assert.equal(out.scheduled_date, '2026-08-30T17:20:00+02:00');
});
