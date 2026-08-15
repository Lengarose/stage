import assert from "node:assert/strict";
import test from "node:test";
import { getEffectiveInboxActionType, inboxMessageNeedsAction, isMatchCancelRequest } from "../inboxActionTypes.js";

test("legacy actionable inbox messages recover their action type from message_type", () => {
  assert.equal(getEffectiveInboxActionType({ message_type: "match_invite" }), "accept_decline_date");
  assert.equal(getEffectiveInboxActionType({ message_type: "contract_offer" }), "contract_negotiation");
  assert.equal(getEffectiveInboxActionType({ message_type: "trial_request" }), "trial_response");
  assert.equal(getEffectiveInboxActionType({ message_type: "loan_proposal" }), "loan_parent_response");
  assert.equal(getEffectiveInboxActionType({ message_type: "general" }), "none");
});

test("cancel requests stay accept/decline so the opponent must confirm", () => {
  const message = {
    message_type: "match_invite",
    action_type: "accept_decline_date",
    metadata: { cancel_request: true },
    status: "pending",
  };
  assert.equal(isMatchCancelRequest(message), true);
  assert.equal(getEffectiveInboxActionType(message), "accept_decline");
  assert.equal(inboxMessageNeedsAction(message), true);
});

test("inboxMessageNeedsAction uses the recovered action type", () => {
  assert.equal(inboxMessageNeedsAction({ message_type: "contract_offer", status: "pending" }), true);
  assert.equal(inboxMessageNeedsAction({ message_type: "trial_request", status: "accepted" }), false);
});
