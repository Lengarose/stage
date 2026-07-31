import assert from "node:assert/strict";
import test from "node:test";
import { getEffectiveInboxActionType, inboxMessageNeedsAction } from "../inboxActionTypes.js";

test("legacy actionable inbox messages recover their action type from message_type", () => {
  assert.equal(getEffectiveInboxActionType({ message_type: "match_invite" }), "accept_decline_date");
  assert.equal(getEffectiveInboxActionType({ message_type: "contract_offer" }), "contract_negotiation");
  assert.equal(getEffectiveInboxActionType({ message_type: "trial_request" }), "trial_response");
  assert.equal(getEffectiveInboxActionType({ message_type: "general" }), "none");
});

test("inboxMessageNeedsAction uses the recovered action type", () => {
  assert.equal(inboxMessageNeedsAction({ message_type: "contract_offer", status: "pending" }), true);
  assert.equal(inboxMessageNeedsAction({ message_type: "trial_request", status: "accepted" }), false);
});
