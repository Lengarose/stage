import assert from 'node:assert/strict';
import test from 'node:test';
import { formatWindowDeadline } from '../transferWindowDeadline.js';

test('one deadline displays the correct local time and date across regions', () => {
  const deadline = '2026-11-15T23:00:00Z';
  assert.match(formatWindowDeadline(deadline, 'Europe/Brussels'), /16 Nov 2026, 00:00 GMT\+1/);
  assert.match(formatWindowDeadline(deadline, 'America/New_York'), /15 Nov 2026, 18:00 GMT-5/);
  assert.match(formatWindowDeadline(deadline, 'America/Los_Angeles'), /15 Nov 2026, 15:00 GMT-8/);
});

test('daylight-saving differences use the offset on the actual closing date', () => {
  const deadline = '2026-03-20T23:00:00Z';
  assert.match(formatWindowDeadline(deadline, 'Europe/Brussels'), /21 Mar 2026, 00:00 GMT\+1/);
  assert.match(formatWindowDeadline(deadline, 'America/New_York'), /20 Mar 2026, 19:00 GMT-4/);
});

test('missing or invalid deadlines and zones do not render a misleading date', () => {
  assert.equal(formatWindowDeadline(null), null);
  assert.equal(formatWindowDeadline('invalid'), null);
  assert.equal(formatWindowDeadline('2026-11-15T23:00:00Z', 'invalid'), null);
});
