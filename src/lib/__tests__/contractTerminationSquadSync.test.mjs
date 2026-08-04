import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");

function readText(path) {
  return readFileSync(resolve(root, path), "utf8");
}

test("contract termination refreshes the released player before removing them from the club squad", () => {
  const contractsTab = readText("src/components/contracts/ContractsTab.jsx");
  const clubDetail = readText("src/pages/ClubDetail.jsx");

  assert.match(contractsTab, /onPlayerReleased/);
  assert.match(contractsTab, /stageClient\.entities\.Player\.get\(playerId\)/);
  assert.match(contractsTab, /String\(releasedPlayer\?\.club_id \|\| ""\) !== String\(club\.id \|\| ""\)/);
  assert.match(contractsTab, /onPlayerReleased\?\.\(playerId,\s*releasedPlayer\)/);
  assert.match(clubDetail, /function handlePlayerReleasedFromContract\(playerId\)/);
  assert.match(clubDetail, /setPlayers\(\(prev\) => asObjectArray\(prev\)\.filter\(\(player\) => player\.id !== playerId\)\)/);
  assert.match(clubDetail, /onPlayerReleased=\{handlePlayerReleasedFromContract\}/);
});
