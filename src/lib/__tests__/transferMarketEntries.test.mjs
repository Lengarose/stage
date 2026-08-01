import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTransferMarketEntries,
  normalizeTransferMarketPlayers,
} from "../transferMarketEntries.js";

test("transfer market ignores malformed entries instead of crashing render", () => {
  const { freeAgents, expiringPlayers } = normalizeTransferMarketPlayers({
    free_agents: [{ id: "free-1", gamertag: "Free One" }, null],
    expiring_players: [
      { player: { id: "exp-1", gamertag: "Expiring One" }, contract: { id: "contract-1" }, days_left: 10 },
      { contract: { id: "missing-player" }, days_left: 5 },
      null,
    ],
  });

  assert.deepEqual(freeAgents.map((player) => player.id), ["free-1"]);
  assert.deepEqual(expiringPlayers.map((entry) => entry.player.id), ["exp-1"]);
});

test("transfer market entry builder supports normalized and flat expiring players", () => {
  const entries = buildTransferMarketEntries(
    [{ id: "free-1", gamertag: "Free One" }],
    [
      { player: { id: "exp-1", gamertag: "Expiring One" }, days_left: 2 },
      { id: "flat-exp-1", gamertag: "Flat Expiring", days_left: 12 },
    ]
  );

  assert.deepEqual(entries.map((entry) => entry.player.id), ["free-1", "exp-1", "flat-exp-1"]);
  assert.equal(entries[1].badgeType, "expiring_soon");
  assert.equal(entries[2].badgeType, "expiring");
});
