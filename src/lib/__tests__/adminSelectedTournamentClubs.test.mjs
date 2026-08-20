import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

test("admin-selected tournament clubs charge users, seed availability, and auto-seat matches", () => {
  const functions = read("server/src/server/functions/legacyFunctions.js");
  const clubsRegistered = read("src/pages/ClubsRegistered.jsx");
  const actions = read("src/api/tournamentActions.js");

  assert.match(actions, /setAdminTournamentClubs/);
  assert.match(clubsRegistered, /setAdminTournamentClubs\(id,\s*\[\.\.\.selected\]\)/);
  assert.doesNotMatch(clubsRegistered, /Tournament\.update\(id,\s*\{\s*registered_clubs:\s*\[\.\.\.selected\]\s*\}/);

  assert.match(functions, /async adminSetTournamentClubs/);
  assert.match(functions, /spendUserCredits\(charge\.user_id,\s*entryCost,\s*query\)/);
  assert.match(functions, /admin_selected_auto_available/);
  assert.match(functions, /deliverAdminSelectedTournamentPresidentMessage/);
  assert.match(functions, /seedAdminSelectedClubMatchPreparation/);
  assert.match(functions, /upsertDressingRoom/);
  assert.match(functions, /seedAdminSelectedTournamentMatchPreparation\(tournament\)/);
  assert.match(functions, /listSimulatedMatchPlayers/);
});
