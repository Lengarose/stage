import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");

test("GameDay keeps the selected match fresh through targeted realtime and fallback refresh", () => {
  const source = readFileSync(resolve(root, "src/pages/GameDay.jsx"), "utf8");

  assert.match(
    source,
    /stageClient\.entities\.Match\.subscribe\([\s\S]*\{\s*id:\s*selectedGame\.id\s*\}/,
    "GameDay should subscribe to the selected match room, not only the global match feed"
  );
  assert.match(
    source,
    /stageClient\.entities\.Match\.get\(selectedGame\.id\)/,
    "GameDay should repair missed socket events by refreshing the selected match"
  );
  assert.match(
    source,
    /setGames\(prev\s*=>\s*\{[\s\S]*prev\.map\(g\s*=>\s*sameRecordId\(g\.id,\s*fresh\.id\)\s*\?\s*\{\s*\.\.\.g,\s*\.\.\.fresh\s*\}\s*:\s*g\)/,
    "selected-match fallback refresh should update the game list used by the detail panel"
  );
  assert.match(
    source,
    /isActiveGameDayMatch/,
    "GameDay should drop cancelled and forfeited matches from the live list"
  );
  assert.match(
    source,
    /setOpsOpen\(true\)/,
    "GameDay should open live stream and match actions from a header button"
  );
  assert.match(
    source,
    /setChatOpen\(true\)/,
    "GameDay should open match chat from a header button"
  );
  assert.match(
    source,
    /isGameDayMatchSocketPayload/,
    "GameDay should ignore non-match payloads on the match socket"
  );
  assert.match(
    source,
    /sameRecordId/,
    "GameDay should match socket ids as strings so every phone sees kickoff and full time"
  );
});

test("GameDay detail subscribes to match and dressing-room sockets", () => {
  const source = readFileSync(resolve(root, "src/components/gameday/GameDayDetail.jsx"), "utf8");
  assert.match(source, /useGameDayMatchRealtime/);
  assert.match(source, /onDressing/);
});
