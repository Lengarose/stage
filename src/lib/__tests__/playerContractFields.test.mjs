import assert from "node:assert/strict";
import test from "node:test";
import { getContractTargetPlayerId } from "../playerContractFields.js";

test("getContractTargetPlayerId prefers explicit alias over legacy user_id", () => {
  assert.equal(getContractTargetPlayerId({ target_player_id: "player-1", user_id: "legacy" }), "player-1");
});

test("getContractTargetPlayerId falls back to legacy user_id", () => {
  assert.equal(getContractTargetPlayerId({ user_id: "player-legacy" }), "player-legacy");
});
