import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  canConfirmMatchCancel,
  canRequestMatchCancel,
  isPlayerManagedMatch,
} from "../matchFixtureLifecycle.js";

const root = resolve(import.meta.dirname, "../../..");
const arranged = {
  id: "match-1",
  status: "scheduled",
  mode: "solo",
  home_player_id: "p-home",
  away_player_id: "p-away",
  home_player_email: "home@example.test",
  away_player_email: "away@example.test",
};

test("web Game Day only lets a player request cancel, not delete the fixture alone", () => {
  const home = { email: "home@example.test", playerId: "p-home" };
  assert.equal(isPlayerManagedMatch(arranged), true);
  assert.equal(canRequestMatchCancel(arranged, home), true);
  assert.equal(canConfirmMatchCancel(arranged, home), false);
  const source = readFileSync(resolve(root, "src/components/gameday/GameDayDetail.jsx"), "utf8");
  assert.match(source, /GameDayFixtureActions/);
  assert.match(readFileSync(resolve(root, "src/components/gameday/GameDayFixtureActions.jsx"), "utf8"), /request_cancel/);
});
