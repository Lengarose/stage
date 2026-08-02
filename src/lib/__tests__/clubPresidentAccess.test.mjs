import assert from "node:assert/strict";
import test from "node:test";
import {
  canManageClubIdentity,
  getClubPresidentContactEmail,
  isClubPresidentForUser,
} from "../clubPresidentAccess.js";

test("isClubPresidentForUser prefers canonical president_user_id", () => {
  assert.equal(
    isClubPresidentForUser({
      user: { id: "president-user", email: "new-president@example.test" },
      club: { id: "club-1", president_user_id: "president-user", owner_email: "legacy@example.test" },
    }),
    true
  );
});

test("isClubPresidentForUser supports auth president club aliases", () => {
  assert.equal(
    isClubPresidentForUser({
      user: { id: "user-1", president_club_id: "club-1" },
      club: { id: "club-1", owner_email: "legacy@example.test" },
    }),
    true
  );
  assert.equal(
    isClubPresidentForUser({
      user: { id: "user-1", presidentClubId: "club-2" },
      club: { id: "club-2", owner_email: "legacy@example.test" },
    }),
    true
  );
});

test("isClubPresidentForUser keeps owner_email as legacy fallback only when requested", () => {
  const args = {
    user: { id: "user-1", email: "legacy@example.test" },
    club: { id: "club-1", owner_email: "legacy@example.test" },
  };
  assert.equal(isClubPresidentForUser(args), true);
  assert.equal(isClubPresidentForUser({ ...args, includeLegacyOwnerEmail: false }), false);
});

test("canManageClubIdentity includes admins, presidents, and staff permissions", () => {
  assert.equal(canManageClubIdentity({ user: { role: "admin" }, club: { id: "club-1" } }), true);
  assert.equal(canManageClubIdentity({ activeRoles: ["president"], club: { id: "club-1" } }), true);
  assert.equal(canManageClubIdentity({ staffPermissions: ["manage_finances"], requiredPermission: "manage_finances" }), true);
  assert.equal(canManageClubIdentity({ staffPermissions: ["review_applicants"], requiredPermission: "manage_finances" }), false);
});

test("canManageClubIdentity does not use president role for the wrong club", () => {
  assert.equal(
    canManageClubIdentity({
      activeRoles: ["president"],
      club: { id: "club-2" },
      presidentClub: { id: "club-1" },
    }),
    false
  );
});

test("getClubPresidentContactEmail prefers explicit president user email and falls back to owner_email", () => {
  assert.equal(
    getClubPresidentContactEmail({
      presidentUser: { email: "president@example.test" },
      club: { owner_email: "legacy@example.test" },
    }),
    "president@example.test"
  );
  assert.equal(
    getClubPresidentContactEmail({ club: { owner_email: "legacy@example.test" } }),
    "legacy@example.test"
  );
});

test("getClubPresidentContactEmail normalizes the selected email", () => {
  assert.equal(
    getClubPresidentContactEmail({
      club: { president_email: "  President@Example.TEST  ", owner_email: "legacy@example.test" },
    }),
    "president@example.test"
  );
});
