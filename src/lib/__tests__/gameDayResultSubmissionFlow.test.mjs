import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  canResolveDisputeWithScore,
  getKickoffControls,
  getResultSubmissionControls,
} from "../gameDayResultFlow.js";

const root = resolve(import.meta.dirname, "../../..");

function readRepoFile(path) {
  return readFileSync(resolve(root, path), "utf8");
}

test("away side cannot open result submission before home has submitted full time", () => {
  const controls = getResultSubmissionControls({
    game: { result_home_submitted: 0, result_away_submitted: "0" },
    isLive: true,
    showResultForm: false,
    amIHomeTeam: false,
  });

  assert.equal(controls.showAwaySubmit, false);
  assert.equal(controls.showAwayWaitingForHome, true);
});

test("away side can submit after home submission even when away flag is a string zero", () => {
  const controls = getResultSubmissionControls({
    game: { result_home_submitted: "1", result_away_submitted: "0" },
    isLive: true,
    showResultForm: false,
    amIHomeTeam: false,
  });

  assert.equal(controls.showAwaySubmit, true);
  assert.equal(controls.showAwayWaitingForHome, false);
});

test("home side sees waiting state after submitting full time", () => {
  const controls = getResultSubmissionControls({
    game: { result_home_submitted: "1", result_away_submitted: "0" },
    isLive: true,
    showResultForm: false,
    amIHomeTeam: true,
  });

  assert.equal(controls.showHomeSubmit, false);
  assert.equal(controls.showHomeWaitingForAway, true);
});

test("admin dispute resolution accepts only finite non-negative integer scores", () => {
  assert.equal(canResolveDisputeWithScore("home", { home_score: "2", away_score: "1" }), true);
  assert.equal(canResolveDisputeWithScore("home", { home_score: "", away_score: "1" }), false);
  assert.equal(canResolveDisputeWithScore("home", { home_score: "-1", away_score: "1" }), false);
  assert.equal(canResolveDisputeWithScore("home", { home_score: "1.5", away_score: "1" }), false);
  assert.equal(canResolveDisputeWithScore("home", { home_score: "Infinity", away_score: "1" }), false);
  assert.equal(canResolveDisputeWithScore("home", { home_score: "NaN", away_score: "1" }), false);
  assert.equal(canResolveDisputeWithScore("", { home_score: "2", away_score: "1" }), false);
});

test("home kickoff stays visible before the 15-minute window but cannot be pressed yet", () => {
  const controls = getKickoffControls({
    game: { status: "scheduled" },
    isMyMatch: true,
    amIHomeTeam: true,
    isLive: false,
    showResultForm: false,
    minutesUntilMatch: 90,
    isClubMatch: false,
    bothClubsReady: true,
  });

  assert.equal(controls.showHomeKickoff, true);
  assert.equal(controls.tooEarly, true);
  assert.equal(controls.canPressKickoff, false);
});

test("home kickoff can start a scheduled match once the window opens", () => {
  const controls = getKickoffControls({
    game: { status: "scheduled" },
    isMyMatch: true,
    amIHomeTeam: true,
    isLive: false,
    showResultForm: false,
    minutesUntilMatch: 10,
    isClubMatch: false,
    bothClubsReady: true,
  });

  assert.equal(controls.showHomeKickoff, true);
  assert.equal(controls.tooEarly, false);
  assert.equal(controls.canPressKickoff, true);
});

test("club kickoff is not blocked by dressing-room seats", () => {
  const controls = getKickoffControls({
    game: { status: "scheduled" },
    isMyMatch: true,
    amIHomeTeam: true,
    isLive: false,
    showResultForm: false,
    minutesUntilMatch: 0,
    isClubMatch: true,
    bothClubsReady: false,
  });

  assert.equal(controls.showHomeKickoff, true);
  assert.equal(controls.dressingBlocked, false);
  assert.equal(controls.canPressKickoff, true);
});

test("Game Day and admin pages are wired to the result-flow helpers", () => {
  const gameDaySource = readRepoFile("src/components/gameday/GameDayDetail.jsx");
  const source = readRepoFile("src/pages/Admin.jsx");

  assert.match(
    gameDaySource,
    /getResultSubmissionControls/,
    "GameDayDetail should use the tested result submission control helper"
  );
  assert.match(
    gameDaySource,
    /getKickoffControls/,
    "GameDayDetail should use the tested kickoff control helper"
  );
  assert.doesNotMatch(
    gameDaySource,
    /showDressingRoomPanel/,
    "GameDayDetail should not render the dressing-room gate in the main match flow"
  );
  assert.match(
    source,
    /canResolveDisputeWithScore/,
    "Admin dispute dialog should use the tested score validation helper"
  );
  assert.match(
    source,
    /admin_home_score:\s*Number\(resolutionScore\.home_score\)/,
    "Admin resolve action should send the editable home score to the server"
  );
  assert.match(
    source,
    /admin_away_score:\s*Number\(resolutionScore\.away_score\)/,
    "Admin resolve action should send the editable away score to the server"
  );
  assert.match(
    source,
    /value=\{resolutionScore\.home_score\}[\s\S]{0,220}onChange=\{e => setResolutionScore/,
    "Admin dialog should render an editable home score input"
  );
  assert.match(
    source,
    /value=\{resolutionScore\.away_score\}[\s\S]{0,220}onChange=\{e => setResolutionScore/,
    "Admin dialog should render an editable away score input"
  );
});

test("server match flow derives the submitted side from the authenticated match actor", () => {
  const source = readRepoFile("server/src/server/functions/legacyFunctions.js");

  assert.match(
    source,
    /requireMatchActorSide\([\s\S]{0,160}'home'[\s\S]{0,120}Only the home team can kick off this match\./,
    "Kickoff should be protected by a server-side home-team check"
  );
  assert.match(
    source,
    /const actor = await resolveMatchActorSide\(match, _auth_user_id\);[\s\S]{0,120}const isHomeSubmission = actor\.side === 'home';/,
    "Result submission should derive home/away from the authenticated actor"
  );
  assert.match(
    source,
    /MATCH_SIDE_MISMATCH/,
    "The server should reject client-submitted sides that do not match the actor"
  );
});
