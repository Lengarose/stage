import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  getEffectiveInboxActionType,
  inboxGameDayHref,
  inboxMessageBelongsToTournament,
  inboxMessageNeedsAction,
  isMatchCancelRequest,
} from "../inboxActionTypes.js";

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
  assert.match(source, /inboxMessageBelongsToTournament/);
});

test("Inbox page ?id= lookup is gated by inboxMessageBelongsToTournament when scoped", async () => {
  const source = await readFile(path.join(srcRoot, "pages/Inbox.jsx"), "utf8");
  const idLookupStart = source.indexOf('params.get("id")');
  assert.ok(idLookupStart >= 0, "expected ?id= lookup");
  const lookupBlock = source.slice(idLookupStart, source.indexOf("setLoading", idLookupStart));
  assert.match(lookupBlock, /inboxMessageBelongsToTournament/);
  assert.match(lookupBlock, /scopedTournamentId/);
  assert.doesNotMatch(
    lookupBlock,
    /if\s*\(\s*target\s*\)\s*openMessage\(\s*target\s*\)/,
  );
});

test("inboxMessageBelongsToTournament includes mail with tournament_id", () => {
  assert.equal(inboxMessageBelongsToTournament({
    metadata: { tournament_id: "t1", match_id: "m1" },
  }, "t1"), true);
  assert.equal(inboxMessageBelongsToTournament({
    metadata: { tournamentId: "t1" },
  }, "t1"), true);
});

test("inboxMessageBelongsToTournament excludes mail with only match_id", () => {
  assert.equal(inboxMessageBelongsToTournament({
    metadata: { match_id: "m1", link: "/game-day?match=m1" },
    related_entity_type: "match",
    related_entity_id: "m1",
  }, "t1"), false);
});

test("inboxMessageBelongsToTournament is false when unscoped or missing id", () => {
  assert.equal(inboxMessageBelongsToTournament({
    metadata: { tournament_id: "t1" },
  }), false);
  assert.equal(inboxMessageBelongsToTournament({
    metadata: { tournament_id: "t1" },
  }, null), false);
  assert.equal(inboxMessageBelongsToTournament({
    metadata: { tournament_id: "t1" },
  }, ""), false);
  assert.equal(inboxMessageBelongsToTournament({ metadata: {} }, "t1"), false);
  assert.equal(inboxMessageBelongsToTournament({}, "t1"), false);
});

test("inboxGameDayHref prefers metadata.link then related match", () => {
  assert.equal(inboxGameDayHref({
    metadata: { link: "/custom-day?match=abc" },
    related_entity_id: "other",
  }), "/custom-day?match=abc");
  assert.equal(inboxGameDayHref({
    related_entity_id: "m1",
  }), "/game-day?match=m1");
  assert.equal(inboxGameDayHref({}), "/game-day");
});
