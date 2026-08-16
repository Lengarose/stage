import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { getRegionForCountryCode } from "../countries.js";

const root = resolve(import.meta.dirname, "../../..");

test("club setup lists every country like player setup", () => {
  const clubSetup = readFileSync(resolve(root, "src/components/onboarding/ClubSetup.jsx"), "utf8");
  const playerSetup = readFileSync(resolve(root, "src/components/onboarding/PlayerSetup.jsx"), "utf8");

  assert.match(playerSetup, /COUNTRIES\.map/);
  assert.match(clubSetup, /COUNTRIES\.map/);
  assert.doesNotMatch(clubSetup, /COUNTRY_REGIONS\[region\]/);
  assert.doesNotMatch(clubSetup, /COUNTRIES\.filter/);
});

test("country codes map back to the club region used in onboarding", () => {
  assert.equal(getRegionForCountryCode("BE"), "Europe");
  assert.equal(getRegionForCountryCode("CD"), "Africa");
  assert.equal(getRegionForCountryCode("BR"), "South America");
  assert.equal(getRegionForCountryCode("JP"), "Asia");
  assert.equal(getRegionForCountryCode(""), null);
});
