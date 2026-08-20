import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

test("club fixtures show approved tournament preparation availability before draw", () => {
  const clubDetail = read("src/pages/ClubDetail.jsx");
  const functions = read("server/src/server/functions/legacyFunctions.js");

  assert.match(clubDetail, /buildClubTournamentRegistrationFixtures/);
  assert.match(clubDetail, /tournamentRegistrationFixtures/);
  assert.match(clubDetail, /_fixtureType:\s*"tournament_registration"/);
  assert.match(clubDetail, /Tournament approved/);
  assert.match(clubDetail, /Available for this tournament costs/);
  assert.match(clubDetail, /stageClient\.functions\.invoke\("tournamentClubAvailability"/);

  assert.match(functions, /async tournamentClubAvailability/);
  assert.match(functions, /Only club members can set tournament availability/);
  assert.match(functions, /spendUserCredits\(_auth_user_id,\s*entryCost,\s*query\)/);
  assert.match(functions, /registration_submitter_exempt/);
  assert.match(functions, /deliverTournamentApprovedClubMessages/);
});
