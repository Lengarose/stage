import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { buildClubTabGroups } from "../clubOfficeTabs.js";

const root = resolve(import.meta.dirname, "../../..");
const t = (key) => key;

test("owner club nav keeps Office as a group with management subtabs", () => {
  const groups = buildClubTabGroups({
    t,
    canOpenOperations: true,
    isOwner: true,
    showRequests: false,
    limitedTournamentId: null,
  });
  const office = groups.find((group) => group.tabs.includes("stadium"));
  assert.ok(office);
  assert.equal(office.label, "commonPages.cdClubOffice");
  assert.deepEqual(office.tabs, ["stadium", "contracts", "finance", "shirts"]);
  assert.equal(groups.some((group) => group.tabs.length === 1 && group.tabs[0] === "finance"), false);
});

test("non-owners do not see Office tools", () => {
  const groups = buildClubTabGroups({
    t,
    canOpenOperations: true,
    isOwner: false,
    showRequests: false,
    limitedTournamentId: null,
  });
  assert.equal(groups.some((group) => group.tabs.includes("stadium")), false);
});

test("limited tournament clubs do not expose Office tools", () => {
  const groups = buildClubTabGroups({
    t,
    canOpenOperations: true,
    isOwner: true,
    showRequests: true,
    limitedTournamentId: "tour-1",
  });
  assert.equal(groups.some((group) => group.tabs.includes("stadium")), false);
  assert.equal(groups.some((group) => group.tabs.includes("requests")), false);
});

test("club detail uses grouped Office navigation", () => {
  const source = readFileSync(resolve(root, "src/pages/ClubDetail.jsx"), "utf8");
  assert.match(source, /GamerClubTabNav/);
  assert.match(source, /buildClubTabGroups/);
});
