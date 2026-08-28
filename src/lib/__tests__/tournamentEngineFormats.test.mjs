import assert from "node:assert/strict";
import test from "node:test";

import {
  generateGroupStageMatches,
  generateKnockoutRound1,
  generateLeagueMatches,
  getLeagueTournamentFixtureMatches,
  getSwissUclDisplayMatches,
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

test("league tournament fixtures ignore old knockout and final artifacts", () => {
  const matches = generateLeagueMatches(clubs(4));
  const visibleMatches = getLeagueTournamentFixtureMatches([
    ...matches,
    { id: "old-final", round: 3, type: "final", status: "scheduled" },
    { id: "old-knockout", round: 3, type: "knockout", status: "scheduled" },
    { id: "old-unknown", round: 4, status: "scheduled" },
  ]);

  assert.equal(visibleMatches.length, matches.length);
  assert.deepEqual([...new Set(visibleMatches.map((m) => m.round))].sort((a, b) => a - b), [1, 2]);
  assert.equal(new Set(visibleMatches.map((m) => m.type)).size, 1);
  assert.equal(visibleMatches[0].type, "league");
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

test("swiss UCL fixtures hide third-place and bronze artifacts", () => {
  const visibleMatches = getSwissUclDisplayMatches([
    { id: "league", round: 1, type: "ucl_league", status: "scheduled" },
    { id: "playoff", round: 9, type: "ucl_playoff", status: "scheduled" },
    { id: "r16", round: 11, type: "ucl_r16", status: "scheduled" },
    { id: "qf", round: 13, type: "ucl_qf", status: "scheduled" },
    { id: "sf", round: 15, type: "ucl_sf", status: "scheduled" },
    { id: "final", round: 17, type: "final", status: "scheduled" },
    { id: "old-third", round: 17, type: "third_place", status: "scheduled" },
    { id: "old-bronze", round: 17, type: "bronze", status: "scheduled" },
  ]);

  assert.deepEqual(visibleMatches.map((match) => match.id), ["league", "playoff", "r16", "qf", "sf", "final"]);
});
