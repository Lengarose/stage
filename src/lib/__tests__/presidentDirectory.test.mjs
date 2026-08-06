import assert from "node:assert/strict";
import test from "node:test";
import { filterPublicPresidentProfiles, isPublicPresidentProfile } from "../presidentDirectory.js";

test("stub president without public identity is hidden", () => {
  assert.equal(
    isPublicPresidentProfile({ id: "pres-1", email: "a@test.com", user_id: "u1" }),
    false
  );
});

test("president with display name is listed", () => {
  assert.equal(
    isPublicPresidentProfile({ id: "pres-1", display_name: "Ada", club_id: "c1" }),
    true
  );
});

test("filterPublicPresidentProfiles keeps only public rows", () => {
  const rows = filterPublicPresidentProfiles([
    { id: "a", email: "x@test.com" },
    { id: "b", display_name: "Bob" },
    { id: "c", country_code: "FR" },
  ]);
  assert.deepEqual(rows.map((p) => p.id), ["b", "c"]);
});
