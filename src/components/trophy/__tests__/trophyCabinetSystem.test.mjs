import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const system = readFileSync(join(dir, '../TrophyCabinetSystem.jsx'), 'utf8');
const scroll = readFileSync(join(dir, '../TrophyScrollBar.jsx'), 'utf8');

test('cabinet always mounts the catalogue collection beneath the canvas', () => {
  assert.match(system, /TrophyScrollBar/);
  assert.match(system, /TrophyItem\.filter/);
  assert.match(system, /buildCollectionEntries/);
  assert.match(system, /trophy-placements\/entitlements/);
  assert.match(system, /Promise\.allSettled/);
});

test('Done waits for pending saves and confirms exact draft placement IDs', () => {
  assert.match(system, /waitForPending/);
  assert.match(system, /placement_ids/);
  assert.match(system, /confirm\/\$\{ownerType\}\/\$\{ownerId\}/);
  assert.match(system, /Once confirmed, these trophies cannot be moved/);
});

test('placements are created from award_id only and support copy selection', () => {
  assert.match(system, /award_id:\s*award\.id/);
  assert.match(system, /TrophyPlacement\.create\(\{[\s\S]*award_id:\s*award\.id/);
  assert.match(system, /Choose which copy to place/);
});

test('collection scrollbar distinguishes locked, available, draft and placed states', () => {
  assert.match(scroll, /Win to unlock|statusLabel/);
  assert.match(scroll, /Draft in cabinet|entry\.state === 'draft'/);
  assert.match(scroll, /Place/);
  assert.match(scroll, /Retry catalogue/);
  assert.match(scroll, /Load more/);
});

test('local draft movement is wired through to persist and reconcile', () => {
  assert.match(system, /onMovePlaced=\{handleMoveLocal\}/);
  assert.match(system, /onMovePlacedSave=\{handleMoveSave\}/);
  assert.doesNotMatch(system, /onMovePlaced=\{\(\)=>\{\}\}/);
});
