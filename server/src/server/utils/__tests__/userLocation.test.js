const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeUserLocation,
  parseStoredLocation,
} = require('../userLocation');

test('Belgium GPS normalizes with BE country and rounded coords', () => {
  const loc = normalizeUserLocation({
    latitude: 50.8503396,
    longitude: 4.3517103,
    accuracy: 42.7,
    country: 'be',
    source: 'gps',
    captured_at: '2026-08-30T12:00:00.000Z',
  });
  assert.deepEqual(loc, {
    latitude: 50.85034,
    longitude: 4.35171,
    accuracy: 43,
    source: 'gps',
    captured_at: '2026-08-30T12:00:00.000Z',
    country: 'BE',
  });
});

test('lat/lng aliases and missing country still normalize', () => {
  const loc = normalizeUserLocation({ lat: 50.85, lng: 4.35 });
  assert.equal(loc.latitude, 50.85);
  assert.equal(loc.longitude, 4.35);
  assert.equal(loc.country, null);
  assert.equal(loc.source, 'gps');
});

test('rejects out-of-range or incomplete coordinates', () => {
  assert.equal(normalizeUserLocation({ latitude: 91, longitude: 4 }), null);
  assert.equal(normalizeUserLocation({ latitude: 50 }), null);
  assert.equal(normalizeUserLocation(null), null);
});

test('parseStoredLocation reads MySQL TEXT JSON', () => {
  const json = JSON.stringify({
    latitude: 50.85034,
    longitude: 4.35171,
    country: 'BE',
    source: 'gps',
    captured_at: '2026-08-30T12:00:00.000Z',
  });
  const loc = parseStoredLocation(json);
  assert.equal(loc.country, 'BE');
  assert.equal(loc.latitude, 50.85034);
  assert.equal(parseStoredLocation('not-json'), null);
  assert.equal(parseStoredLocation(null), null);
});
