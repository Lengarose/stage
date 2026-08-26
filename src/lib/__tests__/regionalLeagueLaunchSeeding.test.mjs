import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

test("first-season regional league admin approval can seed any open setup division", () => {
  const frontendRules = read("src/lib/regionalLeagueRules.js");
  const backendFunctions = read("server/src/server/functions/legacyFunctions.js");

  assert.match(frontendRules, /function hasTruthyFlag/);
  assert.match(frontendRules, /\["active", "completed", "archived"\]\.includes\(status\)/);
  assert.match(frontendRules, /if \(hasTruthyFlag\(league\?\.fixtures_generated\)\) return false;\s*if \(\(Number\(league\?\.season_number\) \|\| 1\) === 1\) return true;/);
  assert.match(frontendRules, /league\.status === "registration" \|\| isRegionalLeagueSetupSeedingOpen\(league\)/);
  assert.match(frontendRules, /const setupSeedLeagues = withCapacity\.filter\(isRegionalLeagueSetupSeedingOpen\)/);
  assert.match(frontendRules, /eligibleLeagues: setupSeedLeagues/);

  assert.match(backendFunctions, /function hasTruthyFlag/);
  assert.match(backendFunctions, /\['active', 'completed', 'archived'\]\.includes\(status\)/);
  assert.match(backendFunctions, /if \(hasTruthyFlag\(league\?\.fixtures_generated\)\) return false;\s*if \(\(Number\(league\?\.season_number\) \|\| 1\) === 1\) return true;/);
  assert.match(backendFunctions, /status IN \('draft', 'setup', 'registration', 'seeded'\)/);
  assert.match(backendFunctions, /const leagueForSeeding = \{ \.\.\.league, fixtures_generated: false \};/);
  assert.match(backendFunctions, /const firstSeasonSetupSeeding = \(Number\(league\.season_number\) \|\| 1\) === 1/);
  assert.match(backendFunctions, /!setupSeeding && !firstSeasonSetupSeeding && !season_registration_id/);
  assert.match(backendFunctions, /setupSeeding && !firstSeasonSetupSeeding && !isRegionalLeagueSetupSeedingOpen\(leagueForSeeding\)/);
  assert.match(backendFunctions, /const seedingCandidates = candidates\.filter\(isRegionalLeagueSetupSeedingOpen\)/);
  assert.match(backendFunctions, /if \(seedingCandidates\.length && isRegionalLeagueSetupSeedingOpen\(targetLeague\)\) \{\s*return;\s*\}/);
});
