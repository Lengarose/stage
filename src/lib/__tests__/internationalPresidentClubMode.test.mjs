import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../../pages/InternationalTournaments.jsx', import.meta.url), 'utf8');

test('international tournaments only enable president mode for canonical president clubs', () => {
  assert.doesNotMatch(source, /presidentClub\s*\|\|\s*club/);
  assert.match(source, /setMyPresidentClub\(activePresidentClub\)/);
});

