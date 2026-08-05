import assert from "node:assert/strict";
import test from "node:test";
import { getOwnedClubId, getPresidentClubId, getPresidentId } from "../userIdentityFields.js";

test("getPresidentClubId supports snake_case and camelCase auth payloads", () => {
  assert.equal(getPresidentClubId({ president_club_id: "club-president-1" }), "club-president-1");
  assert.equal(getPresidentClubId({ presidentClubId: "club-president-2" }), "club-president-2");
});

test("getPresidentId supports snake_case and camelCase auth payloads", () => {
  assert.equal(getPresidentId({ president_id: "pres-1" }), "pres-1");
  assert.equal(getPresidentId({ presidentId: "pres-2" }), "pres-2");
});

test("getOwnedClubId prefers explicit owned_club_id", () => {
  assert.equal(getOwnedClubId({ president_club_id: "club-president", owned_club_id: "club-1", owner_id: "legacy-club" }), "club-president");
});

test("getOwnedClubId supports camelCase auth payload and legacy owner ids", () => {
  assert.equal(getOwnedClubId({ ownedClubId: "club-2" }), "club-2");
  assert.equal(getOwnedClubId({ ownerId: "club-3" }), "club-3");
  assert.equal(getOwnedClubId({ owner_id: "club-4" }), "club-4");
});
