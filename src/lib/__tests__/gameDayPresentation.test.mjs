import assert from "node:assert/strict";
import test from "node:test";

import {
  clubInitials,
  formatBroadcastUnit,
  getKickoffCountdownParts,
  getMatchSideNames,
  pad2,
} from "../gameDayPresentation.js";

test("club initials use two words, then a compact tag", () => {
  assert.equal(clubInitials("Lutina FC"), "LF");
  assert.equal(clubInitials("Lengarose"), "LEN");
  assert.equal(clubInitials("Lutina_17"), "L1");
  assert.equal(clubInitials(""), "?");
});

test("match side names follow club vs solo mode", () => {
  assert.deepEqual(
    getMatchSideNames({ mode: "club", home_club_name: "Lutina", away_club_name: "Lengarose" }),
    { isClub: true, home: "Lutina", away: "Lengarose" },
  );
  assert.deepEqual(
    getMatchSideNames({ mode: "solo", home_player_name: "Lutina_17", away_player_name: "Lyano24" }),
    { isClub: false, home: "Lutina_17", away: "Lyano24" },
  );
});

test("kickoff countdown splits remaining time into broadcast units", () => {
  const now = new Date("2026-08-14T21:00:00.000Z");
  const parts = getKickoffCountdownParts("2026-08-17T22:00:00.000Z", now);
  assert.equal(parts.started, false);
  assert.equal(parts.hours, 73);
  assert.equal(parts.minutes, 0);
  assert.equal(parts.seconds, 0);
  assert.equal(pad2(5), "05");
  assert.equal(formatBroadcastUnit(73), "73");
});

test("kickoff countdown marks a kickoff that already started", () => {
  const now = new Date("2026-08-14T21:00:00.000Z");
  const parts = getKickoffCountdownParts("2026-08-14T20:00:00.000Z", now);
  assert.equal(parts.started, true);
  assert.equal(parts.hours, 0);
});
