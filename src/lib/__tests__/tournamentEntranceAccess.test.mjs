import assert from "node:assert/strict";
import test from "node:test";

import { shouldApplyTournamentEntranceAccess } from "../tournamentEntranceAccess.js";

test("tournament entrance links apply limited access to free player accounts", () => {
  assert.equal(shouldApplyTournamentEntranceAccess({ role_id: 1, subscription: "free" }), true);
  assert.equal(shouldApplyTournamentEntranceAccess({ role_id: 1, subscription: null }), true);
});

test("tournament entrance links do not downgrade admins or Stage Plus accounts", () => {
  assert.equal(shouldApplyTournamentEntranceAccess({ role_id: 0, subscription: "free" }), false);
  assert.equal(shouldApplyTournamentEntranceAccess({ role_id: 1, subscription: "stage_plus" }), false);
  assert.equal(shouldApplyTournamentEntranceAccess({ role: "admin", subscription: null }), false);
  assert.equal(shouldApplyTournamentEntranceAccess({
    role_id: 1,
    subscription: "stage_plus",
    subscription_expires_at: "2099-01-01T00:00:00.000Z",
  }), false);
});

test("tournament entrance links treat expired Stage Plus as free", () => {
  assert.equal(shouldApplyTournamentEntranceAccess({
    role_id: 1,
    subscription: "stage_plus",
    subscription_expires_at: "2020-01-01T00:00:00.000Z",
  }), true);
});
