import assert from "node:assert/strict";
import test from "node:test";
import {
  getContractTargetPlayerId,
  getContractType,
  isLastNegotiatedByTargetPlayer,
  normalizePlayerContract,
  normalizePlayerContracts,
} from "../playerContractFields.js";

test("getContractTargetPlayerId prefers explicit alias over legacy user_id", () => {
  assert.equal(getContractTargetPlayerId({ target_player_id: "player-1", user_id: "legacy" }), "player-1");
});

test("getContractTargetPlayerId falls back to legacy user_id", () => {
  assert.equal(getContractTargetPlayerId({ user_id: "player-legacy" }), "player-legacy");
});

test("normalizePlayerContracts removes malformed contract rows", () => {
  const validContract = { id: "contract-1", user_id: "player-1", status: "pending", contract_type: "star" };

  assert.deepEqual(
    normalizePlayerContracts([null, validContract, undefined, "bad-row", 12]),
    [validContract]
  );
  assert.deepEqual(normalizePlayerContracts(null), []);
});

test("getContractType uses a safe fallback for null or invalid contract types", () => {
  assert.equal(getContractType(null), "squad");
  assert.equal(getContractType({ contract_type: null }), "squad");
  assert.equal(getContractType({ contract_type: false }), "squad");
  assert.equal(getContractType({ contract_type: "star" }), "star");
});

test("isLastNegotiatedByTargetPlayer compares player id, not club id", () => {
  assert.equal(isLastNegotiatedByTargetPlayer({
    user_id: "player-1",
    last_negotiated_by: "player-1",
  }), true);
  assert.equal(isLastNegotiatedByTargetPlayer({
    user_id: "player-1",
    last_negotiated_by: "club-1",
  }), false);
  assert.equal(isLastNegotiatedByTargetPlayer({
    user_id: "player-1",
    last_negotiated_by: "president-player",
  }), false);
});

test("normalizePlayerContract keeps legacy contracts usable with safe defaults", () => {
  assert.deepEqual(
    normalizePlayerContract({ id: "legacy-contract", user_id: "player-1", status: null, contract_type: null }),
    { id: "legacy-contract", user_id: "player-1", status: "pending", contract_type: "squad" }
  );
});
