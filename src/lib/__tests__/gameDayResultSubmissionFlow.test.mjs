import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  canResolveDisputeWithScore,
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

test("Game Day and admin pages are wired to the result-flow helpers", () => {
  const gameDaySource = readRepoFile("src/components/gameday/GameDayDetail.jsx");
  const source = readRepoFile("src/pages/Admin.jsx");

  assert.match(
    gameDaySource,
    /getResultSubmissionControls/,
    "GameDayDetail should use the tested result submission control helper"
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
