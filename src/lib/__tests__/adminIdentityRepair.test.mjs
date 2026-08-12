import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function legacyIdentityRepairSource() {
  const source = read("server/src/server/functions/legacyFunctions.js");
  const start = source.indexOf("async repairPlayerPresidentIdentityLinks");
  assert.notEqual(start, -1, "repairPlayerPresidentIdentityLinks must exist");
  const end = source.indexOf("\n  },\n};", start + 1);
  return source.slice(start, end === -1 ? undefined : end);
}

test("admin identity repair UI describes canonical President Player link repair", () => {
  const tabSource = read("src/components/admin/sections/IdentityRepairTab.jsx");
  const translations = read("src/translations/adminTranslations.js");

  assert.match(tabSource, /normalizeRepairResult/);
  assert.match(tabSource, /groups\.ambiguous/);
  assert.match(tabSource, /current_president_player_id/);
  assert.match(translations, /President Player Link Repair/);
  assert.match(translations, /president_player_id/);
  assert.doesNotMatch(translations, /clears the player's club link/);
  assert.doesNotMatch(translations, /incorrectly turned into a club president/);
  assert.doesNotMatch(translations, /retire le lien au club/);
});

test("admin identity repair backend repairs toward canonical president_player_id only", () => {
  const source = legacyIdentityRepairSource();

  assert.match(source, /president_player_id/);
  assert.match(source, /admin_audit_log/);
  assert.match(source, /LEFT JOIN users club_user/);
  assert.doesNotMatch(source, /\bu\.(id|email)/);
  assert.doesNotMatch(source, /Separated auto-linked player from president-owned club/);
  assert.doesNotMatch(source, /UPDATE\s+players\s+SET[\s\S]*free_agent/);
  assert.doesNotMatch(source, /UPDATE\s+player_contracts/);
  assert.doesNotMatch(source, /DELETE\s+FROM\s+club_memberships/);
  assert.doesNotMatch(source, /DELETE\s+FROM\s+club_staff_roles/);
});
