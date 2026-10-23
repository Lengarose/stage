import assert from "node:assert/strict";
import test from "node:test";
import { isGostOfficialTournament, isTournamentOwner } from "../tournamentOwnership.js";

test("isTournamentOwner matches creator email", () => {
  assert.equal(
    isTournamentOwner(
      { creator_email: "Owner@stage.test" },
      { email: "owner@stage.test" },
      null,
    ),
    true,
  );
});

test("isTournamentOwner matches creator player id when email is missing", () => {
  assert.equal(
    isTournamentOwner(
      { creator_id: "player-1" },
      { id: "user-1", email: "other@stage.test" },
      { id: "player-1" },
    ),
    true,
  );
});

test("isTournamentOwner rejects a random registrant", () => {
  assert.equal(
    isTournamentOwner(
      { creator_email: "owner@stage.test", creator_id: "player-1" },
      { id: "user-2", email: "player@stage.test" },
      { id: "player-2" },
    ),
    false,
  );
});

test("isTournamentOwner does not treat admin or registrant flags as ownership", () => {
  assert.equal(
    isTournamentOwner(
      { creator_email: "owner@stage.test", creator_id: "player-1", organizer_email: "owner@stage.test" },
      { id: "user-9", email: "player@stage.test", role: "admin" },
      { id: "player-9", gamertag: "OwnerTag" },
    ),
    false,
  );
});

test("isGostOfficialTournament is only STAGE branded tournaments without a community creator", () => {
  assert.equal(isGostOfficialTournament({ name: "By STAGE · Supreme" }), true);
  assert.equal(isGostOfficialTournament({ name: "TEST", creator_email: "player@stage.test" }), false);
  assert.equal(isGostOfficialTournament({ name: "By STAGE · Cup", creator_gamertag: "PlayerOne" }), false);
});
