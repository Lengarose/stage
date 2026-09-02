import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { canOpenTournamentGameDay, tournamentGameDayWebPath } from "../tournamentGameDay.js";

const root = resolve(import.meta.dirname, "../../..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

test("cup fixtures open Game Day after they are scheduled", () => {
  assert.equal(canOpenTournamentGameDay({ id: "m1", status: "scheduled" }), true);
  assert.equal(canOpenTournamentGameDay({ id: "m1", status: "in_progress" }), true);
  assert.equal(canOpenTournamentGameDay({ id: "m1", status: "awaiting_confirmation" }), true);
  assert.equal(canOpenTournamentGameDay({ id: "m1", status: "disputed" }), true);
  assert.equal(canOpenTournamentGameDay({ id: "m1", status: "unscheduled" }), false);
  assert.equal(canOpenTournamentGameDay({ id: "m1", status: "completed" }), false);
  assert.equal(tournamentGameDayWebPath("cup-9"), "/game-day?match=cup-9");
});

test("tournament page does not ship a second result engine", () => {
  const page = read("src/pages/TournamentDetail.jsx");
  const bracket = read("src/components/KnockoutBracket.jsx");
  const gameDay = read("src/pages/GameDay.jsx");

  assert.doesNotMatch(page, /TournamentResultDialog/);
  assert.doesNotMatch(page, /async function submitResult/);
  assert.doesNotMatch(page, /handleAgreement/);
  assert.doesNotMatch(page, /handleFirstSubmission/);
  assert.doesNotMatch(page, /savePlayerStats/);
  assert.doesNotMatch(page, /MatchPlayerStat\.create/);
  assert.match(page, /openGameDay/);
  assert.match(page, /tournamentGameDayWebPath/);
  assert.match(page, /onSubmit=\{openGameDay\}/);
  assert.match(page, /Game Day/);

  assert.match(bracket, /canOpenTournamentGameDay/);
  assert.match(bracket, />Game Day</);
  assert.doesNotMatch(bracket, />Result</);
  assert.doesNotMatch(bracket, />Confirm</);

  assert.match(gameDay, /searchParams\.get\("match"\)/);
});
