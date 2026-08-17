import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { buildClubTabGroups } from "../clubOfficeTabs.js";

const root = resolve(import.meta.dirname, "../../..");
const t = (key) => key;

test("club nav exposes the simplified public tabs", () => {
  const groups = buildClubTabGroups({ t });
  assert.deepEqual(
    groups.map((group) => group.tabs[0]),
    ["posts", "squad", "stats", "fixtures", "trophies"],
  );
});

test("club office is a single top-level group", () => {
  const groups = buildClubTabGroups({
    t,
    canOpenClubOffice: true,
  });
  const office = groups.find((group) => group.tabs.includes("club-office"));
  assert.ok(office);
  assert.equal(office.label, "Club Office");
  assert.deepEqual(office.tabs, ["club-office"]);
  assert.equal(groups.some((group) => group.tabs.length === 1 && group.tabs[0] === "finance"), false);
  assert.equal(groups.some((group) => group.tabs.length === 1 && group.tabs[0] === "operations"), false);
});

test("club office and availability are hidden without permission", () => {
  const groups = buildClubTabGroups({
    t,
    canOpenClubOffice: false,
    canSeeAvailability: false,
  });
  assert.equal(groups.some((group) => group.tabs.includes("club-office")), false);
  assert.equal(groups.some((group) => group.tabs.includes("availability")), false);
});

test("chat tab is only included for squad players", () => {
  const hidden = buildClubTabGroups({ t, showChat: false });
  const visible = buildClubTabGroups({ t, showChat: true });
  assert.equal(hidden.some((group) => group.tabs.includes("chat")), false);
  assert.equal(visible.some((group) => group.tabs.includes("chat")), true);
});

test("availability tab is only included for club members", () => {
  const hidden = buildClubTabGroups({ t, canSeeAvailability: false });
  const visible = buildClubTabGroups({ t, canSeeAvailability: true });
  assert.equal(hidden.some((group) => group.tabs.includes("availability")), false);
  assert.equal(visible.some((group) => group.tabs.includes("availability")), true);
});

test("club detail uses grouped Office navigation", () => {
  const source = readFileSync(resolve(root, "src/pages/ClubDetail.jsx"), "utf8");
  assert.match(source, /GamerClubTabNav/);
  assert.match(source, /buildClubTabGroups/);
  assert.doesNotMatch(source, /value="operations"/);
  assert.doesNotMatch(source, /value="contracts"/);
});
