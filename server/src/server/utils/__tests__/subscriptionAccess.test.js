const assert = require('node:assert/strict');
const test = require('node:test');
const { hasStagePlus } = require('../subscriptionAccess');

const NOW = new Date('2026-08-29T10:00:00.000Z');

test('hasStagePlus treats paid tiers without expiry as active legacy Plus', () => {
  assert.equal(hasStagePlus('stage_plus', null, NOW), true);
  assert.equal(hasStagePlus('plus', undefined, NOW), true);
  assert.equal(hasStagePlus({ subscription: 'pro' }, undefined, NOW), true);
  assert.equal(hasStagePlus({ subscription: 'elite', subscription_expires_at: '' }, null, NOW), true);
});

test('hasStagePlus rejects free and unknown tiers', () => {
  assert.equal(hasStagePlus('free', null, NOW), false);
  assert.equal(hasStagePlus('rookie', '2099-01-01T00:00:00.000Z', NOW), false);
  assert.equal(hasStagePlus(null, null, NOW), false);
});

test('hasStagePlus rejects parseable expiry at or before now', () => {
  assert.equal(hasStagePlus('stage_plus', '2026-08-29T10:00:00.000Z', NOW), false);
  assert.equal(hasStagePlus({
    subscription: 'stage_plus',
    subscription_expires_at: '2026-01-01T00:00:00.000Z',
  }, undefined, NOW), false);
});

test('hasStagePlus allows parseable expiry in the future', () => {
  assert.equal(hasStagePlus('stage_plus', '2026-09-01T00:00:00.000Z', NOW), true);
  assert.equal(hasStagePlus({
    subscription: 'plus',
    expires_at: '2026-12-31T23:59:59.000Z',
  }, undefined, NOW), true);
});

test('hasStagePlus treats unparseable expiry as active legacy Plus', () => {
  assert.equal(hasStagePlus('stage_plus', 'not-a-date', NOW), true);
});
