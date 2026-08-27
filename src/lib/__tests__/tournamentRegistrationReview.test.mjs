import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

test("official club tournament registrations stay pending until admin review", () => {
  const functions = read("server/src/server/functions/legacyFunctions.js");
  const detailPage = read("src/pages/TournamentDetail.jsx");
  const registeredPage = read("src/pages/ClubsRegistered.jsx");
  const actions = read("src/api/tournamentActions.js");

  assert.match(functions, /const requiresClubAdminReview = isOfficialTournament && !isAdmin/);
  assert.match(functions, /status:\s*requiresClubAdminReview \? 'pending' : 'approved'/);
  assert.match(functions, /pending_review:\s*requiresClubAdminReview/);
  assert.match(functions, /if \(!requiresClubAdminReview\) \{\s*registered = \[\.\.\.registered, String\(club_id\)\];\s*\}/s);
  assert.match(functions, /notifyTournamentRegistrationAdmins/);
  assert.match(functions, /async tournamentRegistrationReview/);
  assert.match(functions, /deliverTournamentRegistrationReviewMessage/);
  assert.match(functions, /deliverTournamentApprovedClubMessages/);
  assert.match(functions, /listActiveClubPlayerEmails\(club\.id\)/);
  assert.match(functions, /approve_tournament_club_registration/);
  assert.match(functions, /decline_tournament_club_registration/);
  assert.match(functions, /addUserCredits\(proof\.submitted_by_user_id,\s*refundedCredits,\s*query\)/);

  assert.match(actions, /reviewTournamentClubRegistration/);
  assert.match(detailPage, /requiresClubRegistrationReview/);
  assert.match(detailPage, /Pending admin approval/);
  assert.match(detailPage, /fetchTournamentPublic\(tournament\.id\)/);
  assert.doesNotMatch(detailPage, /notifyTournamentRegistration\(tournament\.id,\s*effectiveId\)/);

  assert.match(registeredPage, /Pending club registrations/);
  assert.match(registeredPage, /reviewTournamentClubRegistration\(id,\s*clubId,\s*action,\s*reason\)/);
});
