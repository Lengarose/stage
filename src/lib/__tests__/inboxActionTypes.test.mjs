import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { getEffectiveInboxActionType, inboxMessageNeedsAction, isMatchCancelRequest } from "../inboxActionTypes.js";

const srcRoot = path.resolve(import.meta.dirname, "../..");

test("legacy actionable inbox messages recover their action type from message_type", () => {
  assert.equal(getEffectiveInboxActionType({ message_type: "match_invite" }), "accept_decline_date");
  assert.equal(getEffectiveInboxActionType({ message_type: "contract_offer" }), "contract_negotiation");
  assert.equal(getEffectiveInboxActionType({ message_type: "trial_request" }), "trial_response");
  assert.equal(getEffectiveInboxActionType({ message_type: "loan_proposal" }), "loan_parent_response");
  assert.equal(getEffectiveInboxActionType({ message_type: "loan_early_end" }), "loan_early_end_response");
  assert.equal(getEffectiveInboxActionType({
    message_type: "loan_proposal",
    action_type: "loan_player_response",
  }), "loan_player_response");
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
  assert.equal(inboxMessageNeedsAction({ message_type: "loan_recalled", status: "pending" }), false);
  assert.equal(inboxMessageNeedsAction({ message_type: "loan_early_end", status: "pending" }), true);
  assert.equal(inboxMessageNeedsAction({ message_type: "loan_terminated_early", status: "pending" }), false);
});

test("open_match stays an actionable navigation type", () => {
  assert.equal(getEffectiveInboxActionType({
    message_type: "match_result",
    action_type: "open_match",
    status: "pending",
  }), "open_match");
  assert.equal(inboxMessageNeedsAction({
    message_type: "match_result",
    action_type: "open_match",
    status: "pending",
  }), true);
});

test("Home inbox rows deep-link to a message id", async () => {
  const source = await readFile(path.join(srcRoot, "pages/Home.jsx"), "utf8");
  assert.match(source, /\/inbox\?id=\$/);
});

test("Inbox page filters tournament mailbox when tournamentId is set", async () => {
  const source = await readFile(path.join(srcRoot, "pages/Inbox.jsx"), "utf8");
  assert.match(source, /scopedTournamentId/);
  assert.match(source, /tournament_id/);
});
