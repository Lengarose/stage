import test from 'node:test';
import assert from 'node:assert/strict';
import { clubPathway, qualificationRange } from '../gostOverview.js';
const club = { id: 'club', name: 'Home FC' };
const league = { id: 'league', slug: 'benelux-div-1', name: 'Benelux', division: 1, season_number: 1, status: 'in_progress' };
const row = { club_id: 'club', league_id: 'league', position: 4, played: 3 };
test('qualification ranges reuse the regional rules', () => {
  assert.equal(qualificationRange('supreme'), '1 – 6');
  assert.equal(qualificationRange('elite'), '7 – 12');
  assert.equal(qualificationRange('challenger'), '13 – 18');
});
test('pathway distinguishes standings eligibility from confirmed qualification', () => {
  const path = clubPathway(club, [league], [row], []);
  assert.match(path.text, /Provisional/); assert.match(path.text, /not yet confirmed/);
  assert.equal(path.href, '/leagues/benelux-div-1');
  assert.match(clubPathway(club, [league], [row], [{ club_id: 'club', regional_league_id: 'league', status: 'confirmed', target_competition_name: 'Supreme' }]).text, /Confirmed qualification/);
  assert.match(clubPathway(club, [league], [{ ...row, played: 0 }], []).text, /not started/);
  assert.equal(clubPathway(club, [league], [{ ...row, played: 0 }], []).position, null);
});
test('unresolved identities, duplicate standings and lower divisions do not claim qualification', () => {
  assert.match(clubPathway(null, [], [], []).text, /Join a regional club/);
  assert.match(clubPathway(club, [], [], []).text, /no applicable/);
  assert.match(clubPathway(club, [league], [row, row], []).text, /needs review/);
  assert.match(clubPathway(club, [{ ...league, division: 2 }], [row], []).text, /Promotion/);
});
