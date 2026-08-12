import test from "node:test";
import assert from "node:assert/strict";
import { getMentionPlayerId, parseGamertagMentions } from "../mentions.js";

test("parses unique gamertag mentions", () => {
  assert.deepEqual(parseGamertagMentions("gg @Alpha_10 and @Alpha_10 vs @Beta-FC"), ["Alpha_10", "Beta-FC"]);
});

test("ignores email addresses", () => {
  assert.deepEqual(parseGamertagMentions("mail me a@b.com and ping @Player"), ["Player"]);
});

test("resolves mention profile links from stored post tags", () => {
  assert.equal(
    getMentionPlayerId('[{"gamertag":"Alpha_10","player_id":"player-1"}]', "Alpha_10"),
    "player-1",
  );
  assert.equal(getMentionPlayerId([], "Missing"), null);
});
