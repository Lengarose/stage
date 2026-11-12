import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

test("admin-selected clubs retain transactional entry without auto-availability",()=>{
 const functions=read("server/src/server/functions/legacyFunctions.js"),actions=read("src/api/tournamentActions.js");
 assert.match(actions,/setAdminTournamentClubs/);assert.match(functions,/async adminSetTournamentClubs/);
 assert.match(functions,/spendUserCredits\(charge\.user_id,\s*entryCost,\s*query\)/);
 assert.doesNotMatch(functions,/admin_selected_auto_available/);
});

test("admin-selected club player lookup keeps DISTINCT ORDER BY MySQL-compatible", () => {
  const functions = read("server/src/server/functions/legacyFunctions.js");

  assert.doesNotMatch(
    functions,
    /SELECT DISTINCT p\.id, p\.gamertag, p\.email, p\.user_id, u\.id AS resolved_user_id, u\.email AS user_email, u\.credits\s+FROM players p[\s\S]*ORDER BY p\.updated_date DESC/,
  );
  assert.match(
    functions,
    /SELECT DISTINCT p\.id, p\.gamertag, p\.email, p\.user_id, p\.updated_date, u\.id AS resolved_user_id, u\.email AS user_email, u\.credits/,
  );
});
