import assert from "node:assert/strict";
import test from "node:test";
import { flagImageUrl } from "../flagImages.js";

test("flagImageUrl uses flagcdn and Home Nations slugs", () => {
  assert.equal(flagImageUrl("BE"), "https://flagcdn.com/w80/be.png");
  assert.equal(flagImageUrl("eng"), "https://flagcdn.com/w80/gb-eng.png");
  assert.equal(flagImageUrl("SCO"), "https://flagcdn.com/w80/gb-sct.png");
  assert.equal(flagImageUrl(""), "");
});
