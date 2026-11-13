import assert from "node:assert/strict";
import test from "node:test";

import { getContractProgress, isContractExpired } from "../contractTypes.js";

test("contract type helpers ignore missing contracts", () => {
  assert.equal(isContractExpired(null), false);
  assert.equal(getContractProgress(null), null);
});


test("retired founder contracts never display invented ten-year or match-count expiry", () => {
  for (const contract_type of ["founder", "founder_player", "ownership"]) {
    assert.equal(getContractProgress({ contract_type, start_date: "2020-01-01" }), null);
    assert.equal(isContractExpired({ contract_type, start_date: "2020-01-01", games_played: 9999 }), false);
  }
});
test("Board agreement progress follows its accepted end date and has no match limit", () => {
  const start_date = new Date(Date.now() - 86400000).toISOString();
  const end_date = new Date(Date.now() + 86400000 * 5).toISOString();
  const progress = getContractProgress({ contract_type: "squad", compensation_policy_version: "board_v1", start_date, end_date });
  assert.equal(progress.maxGames, 0);
  assert.ok(progress.daysLeft <= 5 && progress.daysLeft > 0);
  assert.equal(isContractExpired({ compensation_policy_version: "board_v1", start_date, end_date, games_played: 9999 }), false);
});
