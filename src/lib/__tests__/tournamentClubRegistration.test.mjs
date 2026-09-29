import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

test("official club tournament registration uses EA FC club name and community registration is direct", () => {
  const page = read("src/pages/TournamentDetail.jsx");
  const actions = read("src/api/tournamentActions.js");
  const functions = read("server/src/server/functions/legacyFunctions.js");

  assert.match(page, /Register Your Club/);
  assert.match(page, /EA FC Pro Clubs name/);
  assert.match(page, /requiresClubTournamentAdminReview/);
  assert.match(page, /requiresAdminReview \? \{ eaClubName: cleanEaClubName \} : \{\}/);
  assert.match(page, /if \(requiresClubRegistrationReview\) \{\s*setClubRegistrationOpen\(true\);\s*\} else \{\s*registerClub\(\);\s*\}/s);
  assert.doesNotMatch(page, /uploadProClubPhoto/);
  assert.doesNotMatch(page, /renderRegistrationProofUpload\("club"\)/);
  assert.doesNotMatch(page, /!registrationProofUrl \|\| \(!takeoverClub && !canAfford\)/);

  assert.match(actions, /ea_club_name:\s*options\.eaClubName/);
  assert.match(functions, /const requiresClubAdminReview = isOfficialTournament && !isAdmin/);
  assert.match(functions, /EA FC Pro Clubs name is required for official club registration/);
  assert.match(functions, /proof_type:\s*cleanProofUrl \? 'pro_club' : \(cleanEaClubName \? 'ea_club_name' : 'direct_entry'\)/);
  assert.match(functions, /ea_club_name:\s*cleanEaClubName \|\| null/);
});

test("player tournament registration does not ask for Ultimate Team photos", () => {
  const page = read("src/pages/TournamentDetail.jsx");
  const actions = read("src/api/tournamentActions.js");
  const functions = read("server/src/server/functions/legacyFunctions.js");

  assert.doesNotMatch(page, /renderPlayerRegistrationProofUpload/);
  assert.doesNotMatch(page, /uploadUtPhoto/);
  assert.doesNotMatch(page, /utPhoto/);
  assert.doesNotMatch(page, /registrationProofUrl/);
  assert.match(actions, /export async function registerTournamentPlayer\(tournamentId, playerId\)/);
  assert.doesNotMatch(actions, /registration_proof_url:\s*registrationProofUrl/);
  assert.doesNotMatch(functions, /Ultimate Team photo is required for player registration/);
  assert.doesNotMatch(functions, /proof_type:\s*'ultimate_team'/);
  assert.match(functions, /proof_type:\s*cleanProofUrl \? 'registration_upload' : 'direct_entry'/);
});
