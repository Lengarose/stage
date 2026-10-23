import assert from "node:assert/strict";
import test from "node:test";
import { buildTournamentStages, stageMatchSections, canScheduleTournamentMatch, isStageResult, stageAggregate } from "../tournamentStages.js";

test("knockout stages include future rounds without inventing participants", () => {
  const stages = buildTournamentStages({ type: "knockout", max_teams: 8 }, [{ id: "one", type: "knockout", round: 1, status: "scheduled" }]);
  assert.deepEqual(stages.map(s => s.label), ["Quarterfinals", "Semifinals", "Third-Place Playoff", "Final"]);
  assert.equal(stages[0].matches.length, 1);
  assert.equal(stages[1].matches.length, 0);
});
test("UCL legs share one stage, including when only second-leg results remain", () => {
  const matches = [9, 10].map(round => ({ id: String(round), type: "ucl_playoff", round, status: round === 9 ? "completed" : "scheduled" }));
  const stages = buildTournamentStages({ type: "swiss_ucl", max_teams: 36 }, matches);
  const stage = stages.find(s => s.id === "playoff");
  assert.equal(stage.matches.length, 2);
  assert.deepEqual(stageMatchSections(stage).map(s => s.label), ["First leg", "Second leg"]);
  assert.equal(stageMatchSections(stage, [matches[1]])[0].label, "Second leg");
  assert.equal(isStageResult(matches[0]), true);
  assert.equal(isStageResult(matches[1]), false);
});
test("aggregate uses recorded legs in participant order and waits for both results", () => {
  const first = { home_player_id: "a", away_player_id: "b", home_score: 2, away_score: 1, status: "completed" };
  const second = { home_player_id: "b", away_player_id: "a", home_score: 3, away_score: 0, status: "forfeit" };
  const stage = { id: "qf", matches: [first, second] };
  assert.deepEqual(stageAggregate(stage, first), [2, 4]);
  assert.deepEqual(stageAggregate(stage, second), [4, 2]);
  assert.equal(stageAggregate({ ...stage, matches: [first, { ...second, status: "scheduled" }] }, first), null);
});
test("other formats retain their own rounds and byes remain results", () => {
  assert.deepEqual(buildTournamentStages({ type: "swiss", max_teams: 8 }, []).map(s => s.label), ["Round 1", "Round 2", "Round 3"]);
  assert.deepEqual(buildTournamentStages({ type: "double_elimination", max_teams: 4 }, []).map(s => s.label), ["Semifinals", "Final"]);
  assert.equal(isStageResult({status:"bye"}), true);
  assert.equal(isStageResult({status:"cancelled"}), false);
});
test("group stages and leagues preserve groups and matchdays", () => {
  const matches = [{ type: "group", group_number: 1, round: 2 }, { type: "quarter_final", round: 3 }, { type: "quarter_final", round: 4 }];
  const stages = buildTournamentStages({ type: "group_stage", max_teams: 16, num_groups: 4 }, matches);
  assert.equal(stages[0].label, "Group Stage");
  assert.equal(stageMatchSections(stages[0])[0].label, "Group B · Matchday 2");
  assert.deepEqual(stageMatchSections(stages.find(s => s.id === "qf")).map(s => s.label), ["First leg", "Second leg"]);
  assert.deepEqual(buildTournamentStages({ type: "league", max_teams: 8 }, []).map(s => s.id), ["league"]);
  assert.deepEqual(buildTournamentStages({ type: "group_stage", knockout_enabled: 0, max_teams: 8 }, []).map(s => s.id), ["group"]);
});
test("scheduling belongs to the authenticated home player or home club manager", () => {
  const match = { status: "scheduled", home_player_id: "p1", away_player_id: "p2", home_club_id: "c1", away_club_id: "c2" };
  const user = { id: "u1" };
  assert.equal(canScheduleTournamentMatch(match, { participant_type: "player" }, user, { id: "p1" }), true);
  assert.equal(canScheduleTournamentMatch(match, { participant_type: "player" }, user, { id: "p2" }), false);
  assert.equal(canScheduleTournamentMatch(match, {}, user, {}, [{ id: "c1", president_user_id: "u1" }]), true);
  assert.equal(canScheduleTournamentMatch(match, {}, user, { club_id: "c1" }, [{ id: "c1", president_user_id: "u2" }]), false);
  assert.equal(canScheduleTournamentMatch({ ...match, status: "completed" }, { participant_type: "player" }, user, { id: "p1" }), false);
  assert.equal(canScheduleTournamentMatch({ ...match, scheduling_status: "home_proposed" }, { participant_type: "player" }, user, { id: "p1" }), false);
});
