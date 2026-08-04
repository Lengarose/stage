import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");

function readText(path) {
  return readFileSync(resolve(root, path), "utf8");
}

test("dashboard does not advertise account creation or profile upgrade actions", () => {
  const source = readText("src/pages/Dashboard.jsx");

  assert.doesNotMatch(source, /dashboardViewProfile/);
  assert.doesNotMatch(source, /dashboardSetupTitle/);
  assert.doesNotMatch(source, /dashboardSetupDesc/);
  assert.doesNotMatch(source, /dashboardSetupCta/);
  assert.doesNotMatch(source, /to="\/profile"/);
});

test("global header does not duplicate role upgrade prompts from settings", () => {
  const source = readText("src/components/Layout.jsx");

  assert.doesNotMatch(source, /\+ Create club/);
  assert.doesNotMatch(source, /myPlayer\s*&&\s*!myClubId[\s\S]{0,320}to="\/clubs"/);
});

test("president-only header does not expose the player profile menu item", () => {
  const source = readText("src/components/Layout.jsx");

  assert.match(source, /\{myPlayer \? \(\s*<DropdownMenuItem[\s\S]{0,320}<Link\s+to="\/profile"/);
  assert.doesNotMatch(source, /<DropdownMenuSeparator[\s\S]{0,140}\/>\s*<DropdownMenuItem[\s\S]{0,220}<Link\s+to="\/profile"/);
});
