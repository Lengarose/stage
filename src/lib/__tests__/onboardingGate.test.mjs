import assert from "node:assert/strict";
import test from "node:test";
import { isFinishedOnboardingProfile } from "../onboardingGate.js";

test("oauth stub gamertag is not a finished onboarding profile", () => {
  assert.equal(isFinishedOnboardingProfile({ gamertag: "Alex", oauth_provider: "google" }), false);
  assert.equal(isFinishedOnboardingProfile({ id: "p-1", gamertag: "Alex" }), false);
  assert.equal(isFinishedOnboardingProfile(null), false);
});

test("a player with a country has finished the onboarding profile", () => {
  assert.equal(isFinishedOnboardingProfile({ gamertag: "Alex", country: "Belgium" }), true);
});
