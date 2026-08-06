import assert from "node:assert/strict";
import test from "node:test";
import { filterPublicPlayerProfiles, isPublicPlayerProfile } from "../playerDirectory.js";

test("president-only OAuth stub is not a public player profile", () => {
  assert.equal(
    isPublicPlayerProfile({
      id: "stub-1",
      gamertag: "Ada",
      email: "ada@example.test",
      role: "president",
      club_roles: ["president"],
    }),
    false
  );
});

test("completed player profile is listed even if also president", () => {
  assert.equal(
    isPublicPlayerProfile({
      id: "p-1",
      gamertag: "Ada",
      country: "France",
      country_code: "FR",
      role: "president",
      club_roles: ["president", "member"],
    }),
    true
  );
});

test("filterPublicPlayerProfiles drops stubs and keeps real players", () => {
  const rows = filterPublicPlayerProfiles([
    { id: "stub", gamertag: "Boss" },
    { id: "real", gamertag: "Striker", country: "Spain" },
    { id: null, country: "Italy" },
  ]);
  assert.deepEqual(rows.map((p) => p.id), ["real"]);
});
