import assert from "node:assert/strict";
import test from "node:test";
import { asObject, asObjectArray, parseJsonArray } from "../safeData.js";

test("asObject returns null for missing or non-object values", () => {
  assert.equal(asObject(null), null);
  assert.equal(asObject(undefined), null);
  assert.equal(asObject("bad"), null);
  assert.deepEqual(asObject({ id: "ok" }), { id: "ok" });
});

test("asObjectArray removes null and non-object rows from API lists", () => {
  const valid = { id: "row-1" };
  assert.deepEqual(asObjectArray([null, valid, false, "bad", undefined]), [valid]);
  assert.deepEqual(asObjectArray(null), []);
});

test("parseJsonArray supports stored JSON arrays and rejects bad values", () => {
  assert.deepEqual(parseJsonArray('["a","b"]'), ["a", "b"]);
  assert.deepEqual(parseJsonArray(["a"]), ["a"]);
  assert.deepEqual(parseJsonArray("{bad"), []);
  assert.deepEqual(parseJsonArray({ nope: true }), []);
});
