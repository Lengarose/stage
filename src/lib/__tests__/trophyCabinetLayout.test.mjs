import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CABINET_ASPECT_RATIO,
  clientPointToCabinetPercent,
  normalizePlacementCoords,
  trophyPixelSize,
} from '../trophyCabinetLayout.js';

test('placement coords stay percentage-based and match DB precision', () => {
  assert.deepEqual(
    normalizePlacementCoords({ x_percent: 12.3456, y_percent: 88.999, scale: 1.23456 }),
    { x_percent: 12.35, y_percent: 89, scale: 1.235 },
  );
});

test('trophy pixel size scales with cabinet width across devices', () => {
  const phone = trophyPixelSize(320, 1);
  const ipad = trophyPixelSize(768, 1);
  const tv = trophyPixelSize(1600, 1);
  assert.ok(ipad > phone);
  assert.ok(tv > ipad);
  assert.equal(trophyPixelSize(1000, 2), trophyPixelSize(1000, 1) * 2);
});

test('pointer mapping uses the live cabinet rect, not absolute screen pixels', () => {
  const rect = { left: 100, top: 50, width: 400, height: 400 / CABINET_ASPECT_RATIO };
  assert.deepEqual(clientPointToCabinetPercent(rect, 300, 50 + rect.height / 2), { x: 50, y: 50 });
  assert.equal(clientPointToCabinetPercent(rect, 100, 50).x, 5); // clamped
  assert.equal(clientPointToCabinetPercent(rect, 1000, 50).x, 95);
});
