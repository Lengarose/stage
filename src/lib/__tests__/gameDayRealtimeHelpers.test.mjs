import assert from "node:assert/strict";
import test from "node:test";

import {
  isGameDayMatchSocketPayload,
  resolveGameDayMatchEvent,
  sameRecordId,
} from "../gameDayRealtime.js";

test("game day socket ids compare as strings", () => {
  assert.equal(sameRecordId(12, "12"), true);
  assert.equal(sameRecordId("m1", "m2"), false);
});

test("match-stat payloads are ignored on the match channel", () => {
  assert.equal(isGameDayMatchSocketPayload({
    _entity: "MatchPlayerStat",
    id: "stat-1",
    match_id: "m1",
    player_id: "p1",
    goals: 2,
  }), false);
});

test("kickoff and full-time match payloads are accepted", () => {
  assert.equal(isGameDayMatchSocketPayload({ id: "m1", status: "in_progress" }), true);
  assert.equal(isGameDayMatchSocketPayload({
    id: "m1",
    status: "awaiting_confirmation",
    result_home_submitted: 1,
  }), true);
});

test("only events for the open match are resolved", () => {
  assert.equal(resolveGameDayMatchEvent({
    type: "update",
    data: { id: "m1", status: "in_progress" },
  }, "m1")?.type, "update");
  assert.equal(resolveGameDayMatchEvent({
    type: "update",
    data: { id: "m2", status: "in_progress" },
  }, "m1"), null);
  assert.equal(resolveGameDayMatchEvent({ type: "delete", id: "m1" }, "m1")?.type, "delete");
});
