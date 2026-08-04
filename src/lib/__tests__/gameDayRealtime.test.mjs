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
    /setGames\(prev\s*=>\s*\{[\s\S]*prev\.map\(g\s*=>\s*g\.id\s*===\s*fresh\.id\s*\?\s*fresh\s*:\s*g\)/,
    "selected-match fallback refresh should update the game list used by the detail panel"
  );
});
