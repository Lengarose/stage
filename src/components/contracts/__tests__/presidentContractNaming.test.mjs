import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../../..");

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

test("club president contract dialog stays available for legacy admin compatibility", () => {
  assert.equal(
    existsSync(resolve(root, "src/components/contracts/PresidentContractDialog.jsx")),
    true
  );
  assert.equal(
    existsSync(resolve(root, "src/components/contracts/PresidentContractInfo.jsx")),
    true
  );

  for (const file of ["src/pages/Profile.jsx", "src/components/ClubOnboardingModal.jsx", "src/components/onboarding/ClubSetup.jsx"]) {
    const source = read(file);
    assert.doesNotMatch(source, /PresidentContractDialog/);
    assert.doesNotMatch(source, /OwnerContractDialog/);
    assert.doesNotMatch(source, /ownerContractPrompt/);
  }
});

test("player-president onboarding shows the president contract after club setup", () => {
  assert.equal(
    existsSync(resolve(root, "src/components/onboarding/PresidentContractSetup.jsx")),
    true
  );
  const onboarding = read("src/pages/Onboarding.jsx");
  const contractCard = read("src/components/contracts/ContractCard.jsx");
  assert.match(onboarding, /PresidentContractSetup/);
  assert.match(onboarding, /handleClubComplete/);
  assert.match(onboarding, /setStep\("president_contract"\)/);
  assert.match(contractCard, /isLifecycleOwnedContract/);
  assert.match(contractCard, /!lifecycleOwned/);
});
