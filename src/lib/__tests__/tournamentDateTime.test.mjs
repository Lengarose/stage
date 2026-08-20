import assert from "node:assert/strict";
import test from "node:test";

import {
  asWallClockDateTimeString,
  isWallClockFuture,
  isWallClockPast,
  toDatetimeLocalValue,
  toMysqlDateTime,
} from "../momentDate.js";

test("datetime-local tournament starts are saved without a UTC shift", () => {
  assert.equal(toMysqlDateTime("2026-08-20T13:45"), "2026-08-20 13:45:00");
});

test("today at a later tournament start time is still open", () => {
  const nowBeforeStart = new Date(2026, 7, 20, 13, 17, 0);

  assert.equal(isWallClockPast("2026-08-20 13:45:00", nowBeforeStart), false);
  assert.equal(isWallClockFuture("2026-08-20 13:45:00", nowBeforeStart), true);
});

test("stored tournament datetimes round-trip into datetime-local inputs without shifting", () => {
  assert.equal(toDatetimeLocalValue("2026-08-20 13:45:00"), "2026-08-20T13:45");
  assert.equal(asWallClockDateTimeString("2026-08-20T13:45:00.000Z"), "2026-08-20 13:45:00");
});
