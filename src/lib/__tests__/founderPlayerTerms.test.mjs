import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { canRenegotiateFounderPlayerContract } from "../lifecycleOwnedContracts.js";
import { suggestSalaryRange } from "../playerValue.js";
import {
  FOUNDER_PLAYER_WEEKLY_SALARY_MAX,
  FOUNDER_PLAYER_WEEKLY_SALARY_MIN,
  isFounderPlayerWageAllowed,
  normalizeFounderPlayerTerms,
  normalizePerformanceTargets,
} from "../founderPlayerTerms.js";

test("founder player terms keep wages and clean targets", () => {
  const terms = normalizeFounderPlayerTerms({
    weekly_salary_stc: "40000",
    signing_bonus_stc: "-5",
    performance_targets: [
      { stat: "goals", type: "min", value: "10" },
      { type: "min", value: 3 },
    ],
  });

  assert.deepEqual(terms, {
    weekly_salary_stc: 40000,
    signing_bonus_stc: 0,
    performance_targets: [{ stat: "goals", type: "min", value: 10, value_max: 0 }],
  });
});

test("performance target metadata objects do not count as targets", () => {
  assert.deepEqual(normalizePerformanceTargets({ source: "founder_onboarding" }), []);
  assert.deepEqual(normalizePerformanceTargets([{ stat: "assists", type: "exact", value: 4 }]), [
    { stat: "assists", type: "exact", value: 4 },
  ]);
});

test("founder player wages can be 0 but cannot pass the starter club wage budget", () => {
  assert.equal(FOUNDER_PLAYER_WEEKLY_SALARY_MIN, 0);
  assert.equal(FOUNDER_PLAYER_WEEKLY_SALARY_MAX, 250_000);
  assert.equal(isFounderPlayerWageAllowed(0), true);
  assert.equal(isFounderPlayerWageAllowed(18_500), true);
  assert.equal(isFounderPlayerWageAllowed(250_000), true);
  assert.equal(isFounderPlayerWageAllowed(250_001), false);
  assert.deepEqual(suggestSalaryRange("founder_player", 86), {
    min: 5000,
    max: 15000,
    label: "STAGE Card Level 1",
    based_on_value: false,
  });
});

test("new compensation forms use Board terms and onboarding never collects self-assigned pay", () => {
 const dialog=readFileSync(resolve(import.meta.dirname,"../../components/contracts/OfferContractDialog.jsx"),"utf8");
 const onboarding=readFileSync(resolve(import.meta.dirname,"../../components/onboarding/FounderPlayerTermsSetup.jsx"),"utf8");
 assert.match(dialog,/club-board\/proposals/);assert.match(dialog,/options\.band/);
 assert.doesNotMatch(onboarding,/<input|setWeekly|setBonus/);assert.match(onboarding,/boardSignupManagement/);
});

test("only active founder player contracts can be renegotiated", () => {
  assert.equal(canRenegotiateFounderPlayerContract({ contract_type: "founder_player", status: "active" }, { isMyContract: true }), true);
  assert.equal(canRenegotiateFounderPlayerContract({ contract_type: "ownership", status: "active" }, { isMyContract: true }), false);
  assert.equal(canRenegotiateFounderPlayerContract({ contract_type: "founder_player", status: "pending" }, { isMyContract: true }), false);
  assert.equal(canRenegotiateFounderPlayerContract({ contract_type: "squad", status: "active" }, { isMyContract: true }), false);
});
