import assert from "node:assert/strict";
import test from "node:test";
import { getContractTypeLabel, formatContractTypeForSentence } from "../contractTypeLabels.js";

test("getContractTypeLabel presents ownership contracts as president contracts", () => {
  assert.equal(getContractTypeLabel("ownership"), "Club President");
});

test("getContractTypeLabel presents founder player contracts as player contracts", () => {
  assert.equal(getContractTypeLabel("founder_player"), "Founder Player");
});

test("formatContractTypeForSentence presents ownership contracts as president", () => {
  assert.equal(formatContractTypeForSentence("ownership"), "president");
});

test("formatContractTypeForSentence presents founder player contracts as founder player", () => {
  assert.equal(formatContractTypeForSentence("founder_player"), "founder player");
});

test("formatContractTypeForSentence keeps player contract types readable", () => {
  assert.equal(formatContractTypeForSentence("important_player"), "important player");
});
