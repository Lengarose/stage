import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDeadlineCountdown,
  formatMercatoFee,
  formatSignedBalance,
  mercatoStatusLabel,
  transferToNewspaperItem,
} from "../mercato.js";
import { NEWS_SECTION_FILTERS, matchesNewsSection } from "../newsPaper.js";

test("mercato stamps and STC fees", () => {
  assert.equal(mercatoStatusLabel("rumour"), "RUMOUR");
  assert.equal(mercatoStatusLabel("agreement"), "AGREEMENT REACHED");
  assert.equal(formatMercatoFee(45_000_000), "45M STC");
  assert.equal(formatMercatoFee(0), "Undisclosed");
  assert.equal(formatDeadlineCountdown(5 * 3600_000 + 12 * 60_000), "05:12:00");
  assert.equal(formatSignedBalance(-85_000_000), "−85M STC");
});

test("news masthead puts All first and mercato next", () => {
  assert.deepEqual(
    NEWS_SECTION_FILTERS.map((f) => f.id),
    ["all", "mercato", "club_news", "player_news", "tournament", "competitions", "daily_news", "world_news"],
  );
  const offer = { type: "contract", category: "contracts", title: "Hooded F.C. offered a contract to Neo" };
  const signed = { type: "contract", category: "contracts", title: "Neo joined Hooded F.C." };
  const counter = { type: "contract", category: "contracts", title: "Hooded F.C. sent a counter-offer to Neo", published_at: "2026-08-15T09:00:00.000Z" };
  assert.equal(matchesNewsSection(offer, "mercato"), true);
  assert.equal(matchesNewsSection(offer, "club_news"), false);
  assert.equal(matchesNewsSection(signed, "mercato"), true);
  assert.equal(matchesNewsSection(signed, "player_news"), false);
  const today = new Date("2026-08-15T18:00:00.000Z");
  assert.equal(matchesNewsSection(counter, "daily_news", today), true);
  assert.equal(matchesNewsSection({ ...counter, published_at: "2026-08-14T09:00:00.000Z" }, "daily_news", today), false);
  assert.equal(matchesNewsSection(counter, "mercato"), true);
});

test("mercato newspaper cards use the player photo as the splash", () => {
  const item = transferToNewspaperItem({
    id: "t1",
    headline: "Neo to Ajax",
    player_name: "Neo",
    player_avatar_url: "/neo.jpg",
    to_club_name: "Ajax",
    transfer_fee: 12_000_000,
    status: "official",
    player_id: "p1",
  });
  assert.equal(item.photo_url, "/neo.jpg");
  assert.equal(item._category, "transfers");
  assert.equal(item.link, "/players/p1");
  assert.equal(item.transfer_fee_stc, 12_000_000);
});
