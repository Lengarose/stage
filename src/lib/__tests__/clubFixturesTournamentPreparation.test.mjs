import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

test("club fixtures preserve entries while availability no longer gates participation",()=>{
 const source=read("src/pages/ClubDetail.jsx"),functions=read("server/src/server/functions/legacyFunctions.js");
 assert.match(source,/buildClubTournamentRegistrationFixtures/);assert.match(source,/function fixtureCanSetAvailability\(\) \{ return false/);
 assert.doesNotMatch(source,/stageClient\.functions\.invoke\("tournamentClubAvailability"/);
 assert.match(functions,/async tournamentClubAvailability/);assert.match(functions,/Match Squad/);
});
