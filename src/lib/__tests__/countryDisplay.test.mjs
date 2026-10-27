import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { build } from "esbuild";

// Bundle the real browser module and its JSON country data for Node's test runner.
const result = await build({
  entryPoints: [resolve(import.meta.dirname, "../countryDisplay.js")],
  alias: { "@": resolve(import.meta.dirname, "../..") },
  bundle: true, write: false, format: "esm", platform: "node",
});
const { getCountryShortName, getCountryDisplayName, normalizeCountryCode, getPlayerNationality } =
  await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);

test("DR Congo aliases share DRC only in short-name contexts", () => {
  for (const code of ["CD", "cd", "COD", "DRC"]) {
    assert.equal(getCountryShortName(code), "DRC");
    assert.equal(normalizeCountryCode(code), "CD");
  }
  for (const name of ["DR Congo", "D.R. Congo", "DRC", "Congo (Kinshasa)", "Democratic Republic of the Congo", "Congo, Democratic Republic of the", "🇨🇩 DR Congo"]) {
    assert.equal(getCountryShortName(null, name), "DRC", name);
  }
  assert.equal(getCountryDisplayName("CD"), "DR Congo");
  const player = { country_code: "COD", country: "Democratic Republic of the Congo" };
  assert.deepEqual(getPlayerNationality(player), { code: "CD", label: "DR Congo" });
  assert.equal(player.country_code, "COD");
  assert.equal(player.country, "Democratic Republic of the Congo");
});

test("Republic of the Congo stays distinct, and explicit canonical codes win", () => {
  for (const code of ["CG", "COG"]) assert.equal(getCountryShortName(code), "Congo");
  for (const name of ["Congo", "Republic of the Congo", "Republic of Congo", "Congo (Brazzaville)"]) {
    assert.equal(normalizeCountryCode(null, name), "CG", name);
    assert.equal(getCountryShortName(null, name), "Congo", name);
  }
  assert.equal(getCountryShortName("CG", "DR Congo"), "Congo");
});

test("other country labels, flags and full selectors are unchanged", async () => {
  for (const code of ["BE", "GB", "US", "ENG", "FR", "CA"]) {
    assert.equal(getCountryShortName(code), getCountryDisplayName(code));
  }
  assert.equal(getCountryShortName("", "Unlisted country"), "Unlisted country");
  assert.equal(getCountryShortName(null), "Unknown");
  const { COUNTRIES } = await import("../countries.js");
  assert.equal(COUNTRIES.find(c => c.code === "CD").name, "🇨🇩 DR Congo");
  assert.equal(COUNTRIES.find(c => c.code === "CG").name, "🇨🇬 Congo");
});
