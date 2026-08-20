import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

test("club tournament registration uses EA FC club name instead of required Pro Club photo", () => {
  const page = read("src/pages/TournamentDetail.jsx");
  const actions = read("src/api/tournamentActions.js");
  const functions = read("server/src/server/functions/legacyFunctions.js");

  assert.match(page, /Register Your Club/);
  assert.match(page, /EA FC Pro Clubs name/);
  assert.match(page, /registerTournamentClub\(tournament\.id,\s*effectiveId,\s*\{\s*eaClubName:\s*cleanEaClubName\s*\}/);
  assert.doesNotMatch(page, /uploadProClubPhoto/);
  assert.doesNotMatch(page, /renderRegistrationProofUpload\("club"\)/);
  assert.doesNotMatch(page, /!registrationProofUrl \|\| \(!takeoverClub && !canAfford\)/);

  assert.match(actions, /ea_club_name:\s*options\.eaClubName/);
  assert.match(functions, /EA FC Pro Clubs name is required for club registration/);
  assert.match(functions, /ea_club_name:\s*cleanEaClubName/);
});
