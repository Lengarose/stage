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
  assert.ok(steps.length >= 7);
  assert.match(steps[0].title, /contract/i);
  assert.match(steps[0].description, /contract/i);
  assert.doesNotMatch(steps.map((s) => s.title).join(" "), /Join Clubs/i);
  const reputation = steps.find((step) => /reputation/i.test(step.title));
  assert.ok(reputation);
  assert.match(reputation.description, /better offers|player rating|profile/i);
});

test("president tutorial focuses on club management", () => {
  const steps = getTutorialSteps("president");
  assert.ok(steps.length >= 7);
  assert.equal(steps[0].title, "Found Your Club");
  assert.match(steps[1].description, /contract|squad|roster/i);
  assert.doesNotMatch(steps.map((s) => s.title).join(" "), /Join Clubs/i);
});

test("both tutorial covers player and president paths", () => {
  const steps = getTutorialSteps("both");
  assert.ok(steps.length >= 7);
  assert.match(steps[0].title, /both roles/i);
  const blob = steps.map((s) => `${s.title} ${s.description} ${s.tips.join(" ")}`).join(" ");
  assert.match(blob, /player/i);
  assert.match(blob, /club/i);
  assert.match(blob, /president/i);
});

test("each tutorial step carries a longer explanation and numbered points", () => {
  for (const intent of ["player", "president", "both"]) {
    const steps = getTutorialSteps(intent);
    for (const step of steps) {
      assert.ok(String(step.detail || "").length > 40, `${intent} ${step.title} needs detail`);
      assert.ok(Array.isArray(step.points) && step.points.length >= 6, `${intent} ${step.title} needs a full path`);
      assert.ok(step.where, `${intent} ${step.title} needs a where`);
    }
  }
});
