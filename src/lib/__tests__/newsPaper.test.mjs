import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  NEWS_SECTION_FILTERS,
  formatNewspaperDate,
  matchesNewsSection,
  newsStoryImage,
  resolveNewsCategory,
  toNewspaperHeadline,
} from "../newsPaper.js";

test("newspaper headlines drop emoji so copy reads like print", () => {
  assert.equal(
    toNewspaperHeadline("✅ CALLMEDDZ JOINED THE HOODED F.C."),
    "CALLMEDDZ JOINED THE HOODED F.C.",
  );
  assert.equal(toNewspaperHeadline("  Simple story  "), "Simple story");
});

test("lead photo prefers story photos, then story image, then avatars", () => {
  assert.equal(newsStoryImage({ photo_url: "/p.jpg", player_avatar_url: "/a.jpg" }), "/p.jpg");
  assert.equal(newsStoryImage({ image_url: "/i.jpg", club_logo_url: "/c.jpg" }), "/i.jpg");
  assert.equal(newsStoryImage({ player_avatar_url: "/a.jpg" }), "/a.jpg");
  assert.equal(newsStoryImage({}), "");
});

test("edition dateline uses a print-style English date", () => {
  assert.equal(formatNewspaperDate(new Date("2026-08-15T10:00:00.000Z")), "Saturday, 15 August 2026");
});

test("news page is a STAGE TIMES broadsheet, not a dashboard card grid", () => {
  const page = readFileSync(resolve(import.meta.dirname, "../../pages/News.jsx"), "utf8");
  assert.match(page, /THE STAGE TIMES/);
  assert.match(page, /news-paper-sheet/);
  assert.match(page, /NewsBeatDesk/);
  assert.match(page, /MercatoPaper/);
  assert.match(page, /AllNewsPaper/);
  assert.doesNotMatch(page, /rounded-full text-xs font-semibold/);
  const mercato = readFileSync(resolve(import.meta.dirname, "../../components/news/MercatoPaper.jsx"), "utf8");
  assert.match(mercato, /NewspaperSection/);
  assert.match(mercato, /section="mercato"/);
  assert.doesNotMatch(mercato, /mercato-transfers\/desk/);
});

test("newspaper sections keep All first, then mercato, without Press Room", () => {
  assert.deepEqual(
    NEWS_SECTION_FILTERS.map((f) => f.id),
    ["all", "mercato", "club_news", "player_news", "tournament", "competitions", "daily_news", "world_news"],
  );
  assert.equal(resolveNewsCategory({ type: "contract", category: "contracts" }), "contracts");
  assert.equal(resolveNewsCategory({ type: "tournament" }), "tournament");
  assert.equal(resolveNewsCategory({ type: "ranking" }), "ranking");
  assert.equal(matchesNewsSection({ _category: "contracts" }, "daily_news"), false);
  assert.equal(matchesNewsSection({ _category: "transfers" }, "daily_news"), false);
  const today = new Date("2026-08-15T18:00:00.000Z");
  assert.equal(matchesNewsSection({ type: "stadium", published_at: "2026-08-15T10:00:00.000Z" }, "daily_news", today), true);
  assert.equal(matchesNewsSection({ type: "stadium", published_at: "2026-08-14T10:00:00.000Z" }, "daily_news", today), false);
  assert.equal(matchesNewsSection({ _category: "market" }, "mercato"), true);
  assert.equal(matchesNewsSection({ _category: "tournament" }, "tournament"), true);
  assert.equal(matchesNewsSection({ _category: "tournament" }, "competitions"), false);
  assert.equal(matchesNewsSection({ _category: "ranking" }, "player_news"), true);
  assert.equal(matchesNewsSection({ _category: "ranking" }, "competitions"), false);
  const page = readFileSync(resolve(import.meta.dirname, "../../pages/News.jsx"), "utf8");
  assert.match(page, /NEWS_SECTION_FILTERS/);
  assert.match(page, /NewsBeatDesk/);
  assert.match(page, /WorldNewsDesk/);
  assert.doesNotMatch(page, /press_conference/);
});

test("mercato is the transfer and contract newspaper, not club or player desks", () => {
  const offer = { type: "contract", category: "contracts", title: "Hooded F.C. offered a contract to Neo" };
  const signed = { type: "contract", category: "contracts", title: "Neo joined Hooded F.C." };
  const terminated = { type: "contract", category: "contracts", title: "Hooded F.C. terminated contract with Neo" };
  const fee = { type: "contract", category: "contracts", title: "Hooded F.C. paid 500,000 STC transfer fee for Neo" };

  assert.equal(matchesNewsSection(offer, "mercato"), true);
  assert.equal(matchesNewsSection(offer, "club_news"), false);
  assert.equal(matchesNewsSection(offer, "player_news"), false);

  assert.equal(matchesNewsSection(signed, "mercato"), true);
  assert.equal(matchesNewsSection(signed, "club_news"), false);
  assert.equal(matchesNewsSection(signed, "player_news"), false);

  assert.equal(matchesNewsSection(terminated, "mercato"), true);
  assert.equal(matchesNewsSection(terminated, "player_news"), false);
  assert.equal(matchesNewsSection(terminated, "club_news"), false);

  assert.equal(matchesNewsSection(fee, "mercato"), true);
  assert.equal(matchesNewsSection(fee, "club_news"), false);
  assert.equal(matchesNewsSection(fee, "player_news"), false);

  assert.equal(matchesNewsSection({ type: "stadium" }, "club_news"), true);
  assert.equal(matchesNewsSection({ type: "stadium" }, "mercato"), false);
  assert.equal(matchesNewsSection({ type: "shirts" }, "club_news"), true);
  assert.equal(matchesNewsSection({ type: "tickets" }, "club_news"), true);
  assert.equal(matchesNewsSection({ type: "trophy" }, "club_news"), true);
  assert.equal(matchesNewsSection({ type: "motm" }, "player_news"), true);
  assert.equal(matchesNewsSection({ type: "lifestyle" }, "player_news"), true);
  assert.equal(matchesNewsSection({ type: "lifestyle" }, "mercato"), false);
  assert.equal(matchesNewsSection({ type: "ranking" }, "player_news"), true);
  assert.equal(matchesNewsSection({ type: "ranking" }, "mercato"), false);

  assert.equal(matchesNewsSection({ type: "tournament", category: "tournament" }, "tournament"), true);
  assert.equal(matchesNewsSection({ type: "league", category: "competitions" }, "competitions"), true);
  assert.equal(matchesNewsSection({ _category: "transfers" }, "mercato"), true);
  assert.equal(matchesNewsSection({ _category: "market" }, "mercato"), true);
  const today = new Date("2026-08-15T18:00:00.000Z");
  assert.equal(matchesNewsSection({ tags: ["daily_news"] }, "daily_news", today), false);
});

test("desktop newspaper keeps the lead photo on screen and scrolls the rail", () => {
  const css = readFileSync(resolve(import.meta.dirname, "../../pages/newsPaper.css"), "utf8");
  const layout = readFileSync(resolve(import.meta.dirname, "../../components/Layout.jsx"), "utf8");
  assert.doesNotMatch(css, /min-height:\s*72vh/);
  assert.match(css, /news-paper-gutter--rail[\s\S]*overflow-y:\s*auto/);
  assert.match(css, /news-paper-page--viewport/);
  assert.match(layout, /isNewsFullBleedRoute/);
  assert.match(layout, /h-full min-h-0 overflow-hidden/);
});

test("world news uses a d3 geographic map and continent country flags", () => {
  const desk = readFileSync(resolve(import.meta.dirname, "../../components/news/WorldNewsDesk.jsx"), "utf8");
  const atlas = readFileSync(resolve(import.meta.dirname, "../../components/news/WorldAtlas.jsx"), "utf8");
  const pkg = readFileSync(resolve(import.meta.dirname, "../../../package.json"), "utf8");
  const service = readFileSync(resolve(import.meta.dirname, "../../../server/src/server/services/newsDeskService.js"), "utf8");
  assert.match(pkg, /"react-simple-maps"/);
  assert.match(pkg, /"world-atlas"/);
  assert.match(atlas, /react-simple-maps/);
  assert.match(atlas, /world-atlas\/countries-110m/);
  assert.match(atlas, /World map/);
  assert.match(desk, /world-country-flags/);
  assert.match(desk, /flagImageUrl/);
  assert.match(desk, /onSelectCountry/);
  assert.doesNotMatch(desk, /Select a country/);
  assert.match(service, /tallyCountries/);
  assert.match(service, /loadClubCatalog/);
});
