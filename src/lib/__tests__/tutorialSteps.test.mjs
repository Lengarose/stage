import assert from "node:assert/strict";
import test from "node:test";
import { getTutorialSteps, normalizeTutorialIntent } from "../tutorialSteps.js";

test("normalizeTutorialIntent maps unknown values to player", () => {
  assert.equal(normalizeTutorialIntent("player"), "player");
  assert.equal(normalizeTutorialIntent("president"), "president");
  assert.equal(normalizeTutorialIntent("both"), "both");
  assert.equal(normalizeTutorialIntent("club"), "player");
  assert.equal(normalizeTutorialIntent(undefined), "player");
});

test("player tutorial is contract-first, not join-clubs", () => {
  const steps = getTutorialSteps("player");
  assert.equal(steps.length, 4);
  assert.match(steps[0].title, /contract/i);
  assert.match(steps[0].description, /contract/i);
  assert.doesNotMatch(steps.map((s) => s.title).join(" "), /Join Clubs/i);
  assert.match(steps[2].title, /reputation/i);
  assert.match(steps[2].description, /player rating/i);
});

test("president tutorial focuses on club management", () => {
  const steps = getTutorialSteps("president");
  assert.equal(steps.length, 4);
  assert.equal(steps[0].title, "Found Your Club");
  assert.match(steps[1].description, /contract|squad|roster/i);
  assert.doesNotMatch(steps.map((s) => s.title).join(" "), /Join Clubs/i);
});

test("both tutorial covers player and president paths", () => {
  const steps = getTutorialSteps("both");
  assert.equal(steps.length, 4);
  assert.match(steps[0].title, /both roles/i);
  const blob = steps.map((s) => `${s.title} ${s.description} ${s.tips.join(" ")}`).join(" ");
  assert.match(blob, /player/i);
  assert.match(blob, /club/i);
  assert.match(blob, /president/i);
});
