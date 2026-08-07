import assert from "node:assert/strict";
import test from "node:test";

import { isProfileFullBleedRoute } from "../profileRouteLayout.js";

test("profile hero routes render outside the global max-width wrapper", () => {
  assert.equal(isProfileFullBleedRoute("/profile"), true);
  assert.equal(isProfileFullBleedRoute("/players/player-1"), true);
  assert.equal(isProfileFullBleedRoute("/clubs/club-1"), true);
  assert.equal(isProfileFullBleedRoute("/presidents/pres-1"), true);
  assert.equal(isProfileFullBleedRoute("/tournaments/profile-player"), true);
  assert.equal(isProfileFullBleedRoute("/tournaments/profile-player/edit"), true);
  assert.equal(isProfileFullBleedRoute("/tournaments/profile-club"), true);
});

test("list and market routes keep the standard page wrapper", () => {
  assert.equal(isProfileFullBleedRoute("/clubs"), false);
  assert.equal(isProfileFullBleedRoute("/players-list"), false);
  assert.equal(isProfileFullBleedRoute("/presidents-list"), false);
  assert.equal(isProfileFullBleedRoute("/tournaments/clubs"), false);
  assert.equal(isProfileFullBleedRoute("/transfer-market"), false);
});
