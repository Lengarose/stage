import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DESK_FILTERS, filterDeskFeed, formatDeskAmount, matchesDeskFilter } from "../newsDesks.js";

test("each news tab has a dedicated desk filter set", () => {
  assert.deepEqual(Object.keys(DESK_FILTERS), ["club_news", "player_news", "tournament", "competitions", "daily_news"]);
  assert.ok(DESK_FILTERS.club_news.some((item) => item.id === "stadium"));
  assert.ok(DESK_FILTERS.player_news.some((item) => item.id === "ranking"));
  assert.ok(DESK_FILTERS.tournament.some((item) => item.id === "champion"));
  assert.ok(DESK_FILTERS.daily_news.some((item) => item.id === "mercato"));
});

test("desk filters keep club operations apart from player life", () => {
  const stadium = { kind: "stadium", title: "Arena upgrade", club_name: "Hooded" };
  const signed = { kind: "signed", title: "Neo joined Hooded", player_name: "Neo" };
  assert.equal(matchesDeskFilter(stadium, "stadium"), true);
  assert.equal(matchesDeskFilter(stadium, "contract"), false);
  assert.equal(matchesDeskFilter(signed, "signed"), true);
  assert.equal(filterDeskFeed([stadium, signed], { filter: "stadium" }).length, 1);
  assert.equal(formatDeskAmount(12_000), "12K STC");
});

test("daily mix filters by original desk", () => {
  const rows = [
    { beat: "club_news", kind: "stadium", title: "Arena" },
    { beat: "mercato", kind: "official", title: "Neo signs" },
  ];
  assert.equal(filterDeskFeed(rows, { filter: "mercato" }).length, 1);
  assert.equal(filterDeskFeed(rows, { filter: "club_news" })[0].title, "Arena");
});

test("news page mounts beat desks except mercato, all and world news", () => {
  const page = readFileSync(resolve(import.meta.dirname, "../../pages/News.jsx"), "utf8");
  assert.match(page, /NewsBeatDesk/);
  assert.match(page, /MercatoPaper/);
  assert.match(page, /AllNewsPaper/);
  assert.match(page, /WorldNewsDesk/);
  assert.match(page, /activeFilter === "mercato"/);
});
