import assert from "node:assert/strict";
import test from "node:test";

import { isFullBleedRoute, isGameDayFullBleedRoute, isNewsFullBleedRoute, isProfileFullBleedRoute, isTransferMarketFullBleedRoute } from "../profileRouteLayout.js";

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

test("game day fills the layout without the global max-width wrapper", () => {
  assert.equal(isGameDayFullBleedRoute("/game-day"), true);
  assert.equal(isGameDayFullBleedRoute("/tournaments/game-day"), true);
  assert.equal(isFullBleedRoute("/game-day"), true);
  assert.equal(isFullBleedRoute("/clubs"), false);
});

test("news fills the layout as a full newspaper sheet", () => {
  assert.equal(isNewsFullBleedRoute("/news"), true);
  assert.equal(isFullBleedRoute("/news"), true);
  assert.equal(isNewsFullBleedRoute("/notifications"), false);
});

test("transfer market fills the remaining viewport under the app header", () => {
  assert.equal(isTransferMarketFullBleedRoute("/transfer-market"), true);
  assert.equal(isFullBleedRoute("/transfer-market"), true);
  assert.equal(isTransferMarketFullBleedRoute("/transfers"), false);
});
