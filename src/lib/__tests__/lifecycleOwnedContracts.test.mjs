import assert from "node:assert/strict";
import test from "node:test";
import { isLifecycleOwnedContract, clubIsMissingPresidentContract } from "../lifecycleOwnedContracts.js";

test("founder and president contracts are lifecycle-owned and cannot be deleted", () => {
  assert.equal(isLifecycleOwnedContract("ownership"), true);
  assert.equal(isLifecycleOwnedContract("founder_player"), true);
  assert.equal(isLifecycleOwnedContract("founder"), true);
  assert.equal(isLifecycleOwnedContract({ contract_type: "ownership" }), true);
  assert.equal(isLifecycleOwnedContract({ contract_type: "founder_player" }), true);
  assert.equal(isLifecycleOwnedContract("squad"), false);
  assert.equal(isLifecycleOwnedContract({ contract_type: "star" }), false);
  assert.equal(isLifecycleOwnedContract(null), false);
});

test("a live founder contract without ownership means the president contract is missing", () => {
  assert.equal(
    clubIsMissingPresidentContract([
      { id: "1", contract_type: "founder", status: "active" },
    ]),
    true
  );
  assert.equal(
    clubIsMissingPresidentContract([
      { id: "1", contract_type: "founder_player", status: "active" },
      { id: "2", contract_type: "ownership", status: "active" },
    ]),
    false
  );
  assert.equal(
    clubIsMissingPresidentContract([
      { id: "1", contract_type: "squad", status: "active" },
    ]),
    false
  );
});
