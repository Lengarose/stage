import assert from "node:assert/strict";
import test from "node:test";

import { getContractProgress, isContractExpired } from "../contractTypes.js";

test("contract type helpers ignore missing contracts", () => {
  assert.equal(isContractExpired(null), false);
  assert.equal(getContractProgress(null), null);
});
