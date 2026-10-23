import assert from "node:assert/strict";
import test from "node:test";

import {
  buildKnockoutContinuation,
  calculateGroupStandings,
  generateGroupStageMatches,
  generateKnockoutRound1,
  generateLeagueMatches,
  getLeagueTournamentFixtureMatches,
  getSwissUclDisplayMatches,
  generateUCLLeaguePhase,
  knockoutRoundType,
  matchSide,
  projectKnockoutBracket,
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
  assert.equal(matches[0].type, "quarter_final");
  assert.equal(knockoutRoundType(8), "round_of_16");
  assert.equal(knockoutRoundType(2), "semi_final");
  assertPlayableMatches(matches);
  assert.equal(new Set(matches.flatMap((m) => [m.home_club_id, m.away_club_id])).size, 8);
});

test("an 8-team knockout shows the semi-final and the final after the quarters", () => {
  const quarters = generateKnockoutRound1(clubs(8)).map((match, index) => ({ ...match, id: `qf-${index}` }));
  const projected = projectKnockoutBracket(quarters, "knockout");
  const types = projected.map((match) => match.type);

  assert.equal(types.filter((type) => type === "quarter_final").length, 4);
  assert.equal(types.filter((type) => type === "semi_final").length, 2);
  assert.equal(types.filter((type) => type === "final").length, 1);
  assert.equal(types.includes("third_place"), true);
});

test("completed knockout quarters create one semi-final round, then a final", () => {
  const quarters = [0, 1, 2, 3].map((index) => ({
    type: "knockout",
    round: 1,
    status: "completed",
    home_player_id: `h${index}`,
    home_player_name: `Home ${index}`,
    away_player_id: `a${index}`,
    away_player_name: `Away ${index}`,
    home_score: 2,
    away_score: 0,
  }));

  const semis = buildKnockoutContinuation(quarters, "player");
  assert.equal(semis.length, 2);
  assert.equal(semis.every((match) => match.type === "semi_final" && match.round === 2), true);

  const playedSemis = semis.map((match) => ({
    ...match,
    status: "completed",
    home_score: 2,
    away_score: 0,
  }));
  const finalRound = buildKnockoutContinuation([...quarters, ...playedSemis], "player");
  assert.deepEqual(finalRound.map((match) => match.type).sort(), ["final", "third_place"]);
});

test("group-stage quarters keep a two-leg semi-final and still show the final", () => {
  const quarters = [0, 1, 2, 3].flatMap((tie) => [2, 3].map((round) => ({
    type: "quarter_final",
    round,
    group_number: tie,
    status: "completed",
    home_club_id: `h${tie}`,
    home_club_name: `Home ${tie}`,
    away_club_id: `a${tie}`,
    away_club_name: `Away ${tie}`,
    home_score: 3,
    away_score: round === 3 ? 0 : 1,
  })));

  const next = buildKnockoutContinuation(quarters, "club");
  assert.equal(next.length, 4);
  assert.equal(next.every((match) => match.type === "semi_final"), true);
  assert.deepEqual([...new Set(next.map((match) => match.round))].sort(), [4, 5]);

  const projected = projectKnockoutBracket(quarters, "group_stage");
  assert.equal(projected.some((match) => match.type === "semi_final" && match.placeholder), true);
  assert.equal(projected.some((match) => match.type === "final" && match.placeholder), true);
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

test("player group standings use gamertags and the score when no winner id was saved", () => {
  const matches = [
    { type: "group", group: 0, status: "completed", home_player_id: "a", home_player_name: "Ante", away_player_id: "b", away_player_name: "Aron", home_score: 2, away_score: 0 },
    { type: "group", group: 0, status: "completed", home_player_id: "a", home_player_name: "Ante", away_player_id: "c", away_player_name: "Enzo", home_score: 1, away_score: 1 },
    { type: "group", group: 0, status: "completed", home_player_id: "b", home_player_name: "Aron", away_player_id: "c", away_player_name: "Enzo", home_score: 0, away_score: 3 },
  ];

  const [group] = calculateGroupStandings(matches, 1, "player");

  assert.deepEqual(group.map((row) => row.name), ["Enzo", "Ante", "Aron"]);
  assert.deepEqual(group.map((row) => row.Pts), [4, 4, 0]);
  assert.deepEqual(group.map((row) => row.P), [2, 2, 2]);
  assert.equal(group.some((row) => !row.name), false);
});

test("empty club ids do not collapse a player group into one phantom row", () => {
  const matches = [
    { type: "group", group_number: 0, status: "completed", home_player_id: "a", home_player_name: "Ante", away_player_id: "b", away_player_name: "Aron", home_score: 1, away_score: 2 },
    { type: "group", group_number: 0, status: "completed", home_player_id: "a", home_player_name: "Ante", away_player_id: "c", away_player_name: "Enzo", home_score: 3, away_score: 0 },
  ];

  const [group] = calculateGroupStandings(matches, 2, "player");

  assert.equal(group.length, 3);
  assert.deepEqual(group.map((row) => row.id).sort(), ["a", "b", "c"]);
});

test("completed player semi-finals create a final and a third-place match", () => {
  const matches = [
    { type: "semi_final", round: 2, group_number: 0, status: "completed", home_player_id: "ato", home_player_name: "Ato Bediako", away_player_id: "ezra", away_player_name: "Ezra Stone", home_score: 1, away_score: 4 },
    { type: "semi_final", round: 3, group_number: 0, status: "completed", home_player_id: "ezra", home_player_name: "Ezra Stone", away_player_id: "ato", away_player_name: "Ato Bediako", home_score: 3, away_score: 2 },
    { type: "semi_final", round: 2, group_number: 1, status: "completed", home_player_id: "ante", home_player_name: "Ante Sol", away_player_id: "anis", away_player_name: "Anis Belkacem", home_score: 5, away_score: 4 },
    { type: "semi_final", round: 3, group_number: 1, status: "completed", home_player_id: "anis", home_player_name: "Anis Belkacem", away_player_id: "ante", away_player_name: "Ante Sol", home_score: 0, away_score: 5 },
  ];

  const next = buildKnockoutContinuation(matches, "player");

  assert.equal(next.length, 2);
  assert.equal(next[0].type, "final");
  assert.equal(next[0].home_player_name, "Ezra Stone");
  assert.equal(next[0].away_player_name, "Ante Sol");
  assert.equal(next[1].type, "third_place");
  assert.equal(next[1].home_player_name, "Ato Bediako");
  assert.equal(next[1].away_player_name, "Anis Belkacem");
  assert.equal(next[0].round, 4);
});

test("a final is not created twice once it already exists", () => {
  const matches = [
    { type: "semi_final", round: 2, group_number: 0, status: "completed", home_player_id: "ezra", home_player_name: "Ezra Stone", away_player_id: "ato", away_player_name: "Ato Bediako", home_score: 2, away_score: 0 },
    { type: "semi_final", round: 2, group_number: 1, status: "completed", home_player_id: "ante", home_player_name: "Ante Sol", away_player_id: "anis", away_player_name: "Anis Belkacem", home_score: 1, away_score: 0 },
    { type: "final", round: 3, status: "unscheduled", home_player_id: "ezra", away_player_id: "ante" },
  ];

  assert.deepEqual(buildKnockoutContinuation(matches, "player"), []);
});

test("knockout cards can read the player on a side when the club fields are empty", () => {
  const side = matchSide({
    home_player_id: "p1",
    home_player_name: "Ante Sol",
    away_player_id: "p2",
    away_player_name: "Aron West",
  }, "away", "player");

  assert.equal(side.id, "p2");
  assert.equal(side.name, "Aron West");
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
