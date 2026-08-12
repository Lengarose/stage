import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../../..");

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

test("club president contract dialog is the canonical component imported by consumers", () => {
  assert.equal(
    existsSync(resolve(root, "src/components/contracts/PresidentContractDialog.jsx")),
    true
  );
  assert.equal(
    existsSync(resolve(root, "src/components/contracts/PresidentContractInfo.jsx")),
    true
  );

  const consumerFiles = [
    "src/pages/Profile.jsx",
  ];

  for (const file of consumerFiles) {
    const source = read(file);
    assert.match(source, /PresidentContractDialog/);
    assert.doesNotMatch(source, /OwnerContractDialog/);
    assert.doesNotMatch(source, /ownerContractPrompt/);
  }

  for (const file of ["src/components/ClubOnboardingModal.jsx", "src/components/onboarding/ClubSetup.jsx"]) {
    const source = read(file);
    assert.doesNotMatch(source, /PresidentContractDialog/);
    assert.doesNotMatch(source, /OwnerContractDialog/);
    assert.doesNotMatch(source, /ownerContractPrompt/);
  }
});
