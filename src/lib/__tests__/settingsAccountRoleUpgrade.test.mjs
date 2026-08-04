import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");

function readText(path) {
  return readFileSync(resolve(root, path), "utf8");
}

test("settings renders a focused account role upgrade section", () => {
  const settings = readText("src/pages/Settings.jsx");

  assert.match(settings, /import AccountRoleUpgradeSection from "@\/components\/settings\/AccountRoleUpgradeSection"/);
  assert.match(settings, /<AccountRoleUpgradeSection \/>/);
});

test("phase 1 lets player-only accounts create a club to become player-president", () => {
  const source = readText("src/components/settings/AccountRoleUpgradeSection.jsx");

  assert.match(source, /resolveMyPlayerAndClub/);
  assert.match(source, /readAccountIntent\(resolvedUser\.id\)/);
  assert.match(source, /const canUpgradePlayerToPresident = accountIntent === "player"[\s\S]{0,140}player\?\.id[\s\S]{0,140}!presidentClub\?\.id/);
  assert.match(source, /<ClubSetup[\s\S]{0,220}required[\s\S]{0,220}onComplete=\{handleClubUpgradeComplete\}/);
  assert.match(source, /writeAccountIntent\("both",\s*user\.id\)/);
  assert.match(source, /localStorage\.setItem\("stage-account-mode",\s*"club"\)/);
  assert.match(source, /localStorage\.setItem\("stage_president_club_id",\s*club\.id\)/);
});

test("phase 2 lets president-only accounts create a player profile to become player-president", () => {
  const source = readText("src/components/settings/AccountRoleUpgradeSection.jsx");

  assert.match(source, /import PlayerSetup from "@\/components\/onboarding\/PlayerSetup"/);
  assert.match(source, /const canUpgradePresidentToPlayer = accountIntent === "president"[\s\S]{0,160}presidentClub\?\.id[\s\S]{0,160}!player\?\.id/);
  assert.match(source, /<PlayerSetup[\s\S]{0,220}user=\{user\}[\s\S]{0,220}intent="player"[\s\S]{0,220}onComplete=\{handlePlayerUpgradeComplete\}/);
  assert.match(source, /function handlePlayerUpgradeComplete\(savedPlayer\)/);
  assert.match(source, /localStorage\.setItem\("stage-account-mode",\s*"player"\)/);
  assert.match(source, /localStorage\.setItem\("stage_player_id",\s*savedPlayer\.id\)/);
  assert.match(source, /localStorage\.setItem\("stage_president_club_id",\s*presidentClub\.id\)/);
});

test("role upgrade copy covers both directions", () => {
  const source = readText("src/translations/coreTranslations.js");

  assert.match(source, /roleUpgradePresidentDesc/);
  assert.match(source, /roleUpgradePresidentButton/);
  assert.match(source, /roleUpgradePresidentDialogTitle/);
});
