import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../../../..");

test("admin clubs tab displays president contact through the president helper", () => {
  const source = readFileSync(resolve(root, "src/components/admin/sections/ClubsTab.jsx"), "utf8");

  assert.match(source, /getClubPresidentContactEmail/);
  assert.match(source, /presidentContactEmail/);
  assert.doesNotMatch(source, /\{c\.owner_email\}/);
});
