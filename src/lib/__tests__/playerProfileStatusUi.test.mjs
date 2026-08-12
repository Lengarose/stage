import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");

function readText(path) {
  return readFileSync(resolve(root, path), "utf8");
}

test("public PlayerProfile derives president status from canonical club player link", () => {
  const source = readText("src/pages/PlayerProfile.jsx");
  const model = readText("server/src/server/models/clubModel.js");
  const controller = readText("server/src/server/controllers/clubController.js");

  assert.match(source, /getPlayerManagementBadges/);
  assert.match(source, /president_player_id:\s*p\.id/);
  assert.match(source, /managementBadges=\{managementBadges\}/);
  assert.match(source, /setClub\(presidentClub\)/);
  assert.match(model, /selectByPresidentPlayerId/);
  assert.match(controller, /president_player_id/);
});

test("My Profile renders management status separately from football role and includes Showcase", () => {
  const source = readText("src/pages/Profile.jsx");

  assert.match(source, /getFootballRoleBadges/);
  assert.match(source, /getPlayerManagementBadges/);
  assert.match(source, /managementBadges=\{profileManagementBadges\}/);
  assert.match(source, /getPlayerProfileTabs/);
  assert.match(source, /profileTab === "showcase"/);
  assert.doesNotMatch(source, /President identity, which is deliberately\s+separate from the Player identity/);
});

test("shared player hero shows management badges and removes old above-bio record strip", () => {
  const source = readText("src/components/profile/gamer/GamerProfileHero.jsx");

  assert.match(source, /managementBadges = \[\]/);
  assert.match(source, /managementBadges\.map/);
  assert.doesNotMatch(source, /GamerRecordStrip/);
});
