import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");

test("layout shell uses president-mode names for club identity navigation", () => {
  const source = readFileSync(resolve(root, "src/components/Layout.jsx"), "utf8");

  assert.match(source, /function getPresidentGroups/);
  assert.match(source, /function getMobileMoreGroupsPresident/);
  assert.match(source, /showAsPresident/);
  assert.match(source, /presidentGroups/);
  assert.doesNotMatch(source, /getOwnerGroups/);
  assert.doesNotMatch(source, /getMobileMoreGroupsOwner/);
  assert.doesNotMatch(source, /showAsOwner/);
  assert.doesNotMatch(source, /ownerGroups/);
  assert.doesNotMatch(source, /owner and tournament context/);
  assert.doesNotMatch(source, /owner OR member/);
});
