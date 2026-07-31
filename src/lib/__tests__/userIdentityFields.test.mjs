import assert from "node:assert/strict";
import test from "node:test";
import { getOwnedClubId } from "../userIdentityFields.js";

test("getOwnedClubId prefers explicit owned_club_id", () => {
  assert.equal(getOwnedClubId({ owned_club_id: "club-1", owner_id: "legacy-club" }), "club-1");
});

test("getOwnedClubId supports camelCase auth payload and legacy owner ids", () => {
  assert.equal(getOwnedClubId({ ownedClubId: "club-2" }), "club-2");
  assert.equal(getOwnedClubId({ ownerId: "club-3" }), "club-3");
  assert.equal(getOwnedClubId({ owner_id: "club-4" }), "club-4");
});
