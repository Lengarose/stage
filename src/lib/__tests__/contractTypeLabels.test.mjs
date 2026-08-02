import assert from "node:assert/strict";
import test from "node:test";
import { getContractTypeLabel, formatContractTypeForSentence } from "../contractTypeLabels.js";

test("getContractTypeLabel presents ownership contracts as president contracts", () => {
  assert.equal(getContractTypeLabel("ownership"), "Club President");
});

test("formatContractTypeForSentence presents ownership contracts as president", () => {
  assert.equal(formatContractTypeForSentence("ownership"), "president");
});

test("formatContractTypeForSentence keeps player contract types readable", () => {
  assert.equal(formatContractTypeForSentence("important_player"), "important player");
});
