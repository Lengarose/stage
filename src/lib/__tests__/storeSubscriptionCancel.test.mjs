import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

test("Store STAGE Plus card can subscribe and cancel at period end", () => {
  const store = read("src/pages/Store.jsx");
  assert.match(store, /stripeSubscription/);
  assert.match(store, /cancelStagePlus/);
  assert.match(store, /storeCancelSubscription/);
  assert.match(store, /subscription_cancel_at_period_end/);
  assert.doesNotMatch(store, /billingPortal/);
});

test("cancelStagePlus stops Stripe renewals without dropping access immediately", () => {
  const functions = read("server/src/server/functions/legacyFunctions.js");
  const webhook = read("server/src/server/controllers/stripeWebhookController.js");

  assert.match(functions, /async cancelStagePlus/);
  assert.match(functions, /cancel_at_period_end:\s*true/);
  assert.match(functions, /subscription_cancel_at_period_end = 1/);
  assert.match(functions, /updateStripeSubscription/);
  assert.match(webhook, /customer\.subscription\.updated/);
  assert.match(webhook, /COALESCE\(subscription_cancel_at_period_end, 0\) = 0/);
});
