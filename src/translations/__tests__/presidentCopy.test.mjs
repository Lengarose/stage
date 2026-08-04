import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { getCoreTranslations } from "../coreTranslations.js";

const root = resolve(import.meta.dirname, "../../..");

function readText(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function readJson(path) {
  return JSON.parse(readText(path));
}

test("Dutch player-president onboarding and contract copy uses president language", () => {
  const nl = readJson("src/translations/packs/nl.commonPages.json");

  assert.equal(nl.obClubOwner, "President");
  assert.match(nl.obClubOwnerDesc, /clubpresident/i);
  assert.match(nl.cccStillOfferPlayer, /presidentcontract/i);
  assert.match(nl.cccStillOfferOwnership, /presidentcontract/i);
  assert.match(nl.ocdStillOfferOwnership, /presidentcontract/i);
  assert.equal(nl.icoClubOwnership, "Club President");
  assert.match(nl.obNeedClubContinue, /president/i);
  assert.match(nl.cdTrialIntro, /clubpresident/i);
  assert.match(nl.agdClubMatchHint, /president/i);
  assert.match(nl.agdClubInviteNote, /president/i);
  assert.match(nl.agdCannotReachClub, /president/i);
});

test("onboarding role choices use translation keys for president copy", () => {
  const onboarding = readText("src/pages/Onboarding.jsx");

  assert.doesNotMatch(onboarding, />President</);
  assert.doesNotMatch(onboarding, />Player \+ President</);
  assert.doesNotMatch(onboarding, /Create your player profile, then found and manage your club\./);
  assert.match(onboarding, /commonPages\.obClubOwner/);
});

test("admin-facing international and club labels do not show owner wording", () => {
  const internationalAdmin = readText("src/components/admin/sections/InternationalTournamentsTab.jsx");
  const adminTranslations = readText("src/translations/adminTranslationExtras.js");

  assert.doesNotMatch(internationalAdmin, /National owner:/);
  assert.match(internationalAdmin, /National president:/);
  assert.doesNotMatch(adminTranslations, /owner: "Owner"/);
  assert.match(adminTranslations, /owner: "President"/);
});

test("common page packs use president wording for role, contract, and national vote keys", () => {
  const packsDir = resolve(root, "src/translations/packs");
  const files = readdirSync(packsDir).filter((file) => file.endsWith(".commonPages.json"));
  const keys = [
    "internationalSubtitle",
    "noInternationalOpenDesc",
    "ownersOnlyVote",
    "nationalOwnerVote",
    "chooseTopOwners",
    "selectOwnerCandidate",
    "obClubOwner",
    "obClubOwnerDesc",
    "cccStillOfferPlayer",
    "cccStillOfferOwnership",
    "ocdStillOfferOwnership",
    "icoClubOwnership",
    "obNeedClubContinue",
    "cdTrialIntro",
    "agdClubMatchHint",
    "agdClubInviteNote",
    "agdCannotReachClub",
  ];
  const forbiddenOwnerWords = /owner|owners|ownership|eigenaar|eigendom|sahip|właściciel|владел|오너|オーナー|所有|老板|مالك|propri|dueñ/i;

  for (const file of files) {
    const pack = readJson(`src/translations/packs/${file}`);
    for (const key of keys) {
      assert.doesNotMatch(String(pack[key] || ""), forbiddenOwnerWords, `${file}.${key}`);
    }
  }
});

test("core walkthrough and common translations use president wording for club management", () => {
  const languages = ["en", "fr", "nl", "es", "it", "zh", "ja"];
  const walkthroughKeys = ["tournamentClubs", "club", "tournaments", "players", "recruitment"];
  const commonKeys = [
    "internationalSubtitle",
    "noInternationalOpenDesc",
    "ownersOnlyVote",
    "nationalOwnerVote",
    "chooseTopOwners",
    "obClubOwner",
    "obClubOwnerDesc",
    "obNeedClubContinue",
  ];
  const forbiddenOwnerWords = /owner|owners|ownership|eigenaar|eigendom|sahip|właściciel|владел|오너|オーナー|所有|老板|مالك|propri|dueñ/i;

  for (const language of languages) {
    const translations = getCoreTranslations(language);
    for (const key of walkthroughKeys) {
      const steps = translations.walkthrough?.[key]?.steps || [];
      for (const step of steps) {
        assert.doesNotMatch(String(step), forbiddenOwnerWords, `${language}.walkthrough.${key}`);
      }
    }
    for (const key of commonKeys) {
      assert.doesNotMatch(String(translations.commonPages?.[key] || ""), forbiddenOwnerWords, `${language}.commonPages.${key}`);
    }
  }
});
