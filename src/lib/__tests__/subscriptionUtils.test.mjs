import assert from "node:assert/strict";
import test from "node:test";

import { hasStagePlus } from "../subscriptionUtils.js";

const NOW = new Date("2026-08-29T10:00:00.000Z");

test("hasStagePlus treats paid tiers without expiry as active", () => {
  assert.equal(hasStagePlus("stage_plus", null, NOW), true);
  assert.equal(hasStagePlus({ subscription: "pro" }, undefined, NOW), true);
});

test("hasStagePlus rejects expired Plus", () => {
  assert.equal(hasStagePlus("stage_plus", "2026-01-01T00:00:00.000Z", NOW), false);
  assert.equal(hasStagePlus({
    subscription: "stage_plus",
    subscription_expires_at: "2026-08-29T10:00:00.000Z",
  }, undefined, NOW), false);
});

test("hasStagePlus allows future expiry", () => {
  assert.equal(hasStagePlus("stage_plus", "2026-09-01T00:00:00.000Z", NOW), true);
});
