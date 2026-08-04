import assert from "node:assert/strict";
import test from "node:test";

import {
  generateGroupStageMatches,
  generateKnockoutRound1,
  generateLeagueMatches,
  generateUCLLeaguePhase,
} from "../tournamentEngine.js";

function clubs(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `club-${index + 1}`,
    name: `Club ${index + 1}`,
  }));
}

function assertPlayableMatches(matches) {
  assert.ok(matches.length > 0);
  for (const match of matches) {
    assert.ok(match.home_club_id);
    assert.ok(match.away_club_id);
    assert.notEqual(match.home_club_id, match.away_club_id);
    assert.equal(match.status, "scheduled");
  }
}

test("knockout and double-elimination opening rounds pair every team once", () => {
  const matches = generateKnockoutRound1(clubs(8));
  assert.equal(matches.length, 4);
  assertPlayableMatches(matches);
  assert.equal(new Set(matches.flatMap((m) => [m.home_club_id, m.away_club_id])).size, 8);
});

test("league format creates home and away fixtures for every pair", () => {
  const matches = generateLeagueMatches(clubs(4));
  assert.equal(matches.length, 12);
  assertPlayableMatches(matches);
  assert.equal(matches.filter((m) => m.round === 1).length, 6);
  assert.equal(matches.filter((m) => m.round === 2).length, 6);
});

test("group stage keeps clubs inside groups and creates group metadata", () => {
  const matches = generateGroupStageMatches(clubs(8), 2);
  assert.equal(matches.length, 12);
  assertPlayableMatches(matches);
  assert.deepEqual([...new Set(matches.map((m) => m.group))].sort(), [0, 1]);
  assert.equal(new Set(matches.map((m) => m.type)).size, 1);
  assert.equal(matches[0].type, "group");
});

test("swiss UCL league phase creates eight scheduled rounds", () => {
  const matches = generateUCLLeaguePhase(clubs(36));
  assert.equal(matches.length, 144);
  assertPlayableMatches(matches);
  assert.deepEqual([...new Set(matches.map((m) => m.round))].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(new Set(matches.map((m) => m.type)).size, 1);
  assert.equal(matches[0].type, "ucl_league");
});
