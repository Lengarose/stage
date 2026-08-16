import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  ACCOUNT_INTENT_KEY,
  clearAccountIntent,
  isPresidentAccountIntent,
  readAccountIntent,
  writeAccountIntent,
} from "../accountIntent.js";

const root = resolve(import.meta.dirname, "../../..");

function readText(path) {
  return readFileSync(resolve(root, path), "utf8");
}

test("player-only onboarding completes after player identity instead of showing club setup", () => {
  const source = readText("src/pages/Onboarding.jsx");

  assert.match(source, /writeAccountIntent/);
  assert.match(source, /const handlePlayerComplete = async/);
  assert.match(source, /if\s*\(\s*intent\s*===\s*"both"\s*\)\s*setStep\("founder_terms"\);[\s\S]{0,80}else finishOnboarding\(\)/);
  assert.doesNotMatch(source, /setStep\(intent\s*===\s*"both"\s*\?\s*"owner_club"\s*:\s*"club"\)/);
});

test("onboarding role flows remove president-only and use player identity for club creation", () => {
  const onboarding = readText("src/pages/Onboarding.jsx");
  const clubSetup = readText("src/components/onboarding/ClubSetup.jsx");

  assert.match(onboarding, /clubSetupPhase/);
  assert.match(onboarding, /getStepMeta\(intent,\s*step,\s*clubSetupPhase\)/);
  assert.match(onboarding, /dual \? 6 : 3/);
  assert.match(onboarding, /FounderPlayerTermsSetup/);
  assert.match(onboarding, /setStep\("founder_terms"\)/);
  assert.match(onboarding, /playerContract=\{founderPlayerTerms\}/);
  assert.match(onboarding, /phase === "club"/);
  assert.match(onboarding, /label: "Club Profile"/);
  assert.match(onboarding, /setStep\("president_contract"\)/);
  assert.match(onboarding, /PresidentContractSetup/);
  assert.match(onboarding, /playerContract=\{founderPlayerTerms\}/);
  assert.doesNotMatch(onboarding, /setStep\("owner_club"\)/);
  assert.doesNotMatch(onboarding, /step === "owner_club"/);
  assert.doesNotMatch(onboarding, /setOnboardingIntent\("president"/);
  assert.match(clubSetup, /onPhaseChange/);
  assert.match(clubSetup, /required \? "club_profile" : "choice"/);
  assert.match(clubSetup, /stageClient\.clubs\.createFounder/);
  assert.match(clubSetup, /player_id:\s*player\.id/);
  assert.match(clubSetup, /playerContract:\s*playerContract/);
  assert.doesNotMatch(clubSetup, /stageClient\.entities\.Club\.create/);
  assert.doesNotMatch(clubSetup, /toPresidentApiPayload/);
});

test("onboarding stores whether the user chose player or player-president", () => {
  const source = readText("src/pages/Onboarding.jsx");

  assert.match(source, /setOnboardingIntent\("player",\s*"player"\)/);
  assert.match(source, /setOnboardingIntent\("both",\s*"player"\)/);
  assert.doesNotMatch(source, /setOnboardingIntent\("president"/);
});

test("player-only setup continues without club wording while player-president keeps club handoff", () => {
  const onboarding = readText("src/pages/Onboarding.jsx");
  const playerSetup = readText("src/components/onboarding/PlayerSetup.jsx");

  assert.match(onboarding, /<PlayerSetup[\s\S]{0,180}intent=\{intent\}/);
  assert.match(playerSetup, /export default function PlayerSetup\(\{ onComplete, user, initialPlayer = null, intent = "player" \}\)/);
  assert.match(playerSetup, /const continueLabel = intent === "both"[\s\S]{0,160}obContinueClub[\s\S]{0,160}agdContinue/);
  assert.match(playerSetup, /\) : continueLabel\}/);
});

test("layout only prompts for club onboarding when president intent exists", () => {
  const source = readText("src/components/Layout.jsx");

  assert.match(source, /readAccountIntent\(u\.id\)/);
  assert.match(source, /setCurrentUserId\(u\.id \|\| null\)/);
  assert.match(source, /isPresidentAccountIntent\(accountIntent\)/);
  assert.match(source, /canPromptForClubOnboarding/);
  assert.match(source, /setShowClubModal\(true\)/);
  assert.match(source, /isPresidentAccountIntent\(storedIntent\)[\s\S]{0,80}setShowClubModal\(true\)/);
  assert.match(source, /open=\{showClubModal\s*&&\s*!showProfileModal\s*&&\s*canPromptForClubOnboarding\}/);
  assert.match(source, /allowClubOnboarding=\{canPromptForClubOnboarding\}/);
  assert.match(source, /myPresidentClubId/);
  assert.match(source, /writeAccountIntent\(nextIntent,\s*currentUserId\)/);
  assert.doesNotMatch(source, /myPlayer\s*&&\s*!myClubId[\s\S]{0,260}\+ Create club/);
  assert.doesNotMatch(source, /writeAccountIntent\(nextIntent,\s*effectiveUser\?\.id\)/);
});

test("mobile header role switch uses the canonical president club only", () => {
  const source = readText("src/components/Layout.jsx");

  assert.match(source, /function MobileHeaderIdentity\(\{ myPlayer, myClub, presidentClub, accountIntent, accountMode, switchMode \}\)/);
  assert.match(source, /const canSwitchRole = accountIntent === "both"[\s\S]{0,80}myPlayer[\s\S]{0,80}presidentClub\?\.id/);
  assert.match(source, /const identityHref = showAsPresident[\s\S]{0,120}presidentClub\?\.id \? `\/clubs\/\$\{presidentClub\.id\}` : "\/profile"/);
  assert.match(source, /<Link to=\{identityHref\}/);
  assert.match(source, /accountIntent=\{accountIntent\}/);
  assert.match(source, /presidentClub=\{myClub\}/);
  assert.match(source, /myClub=\{mobileClubIdentity\}/);
  assert.doesNotMatch(source, /myPresidentId/);
  assert.doesNotMatch(source, /presidentProfilePath/);
  assert.doesNotMatch(source, /\/presidents\/\$\{/);
  assert.doesNotMatch(source, /const canSwitchRole = Boolean\(myPlayer && myClub\?\.id\)/);
  assert.doesNotMatch(source, /if \(!canSwitchRole\)[\s\S]{0,120}<Link to="\/profile"/);
});

test("account intent is stored per user and cleared with auth tokens", () => {
  const helper = readText("src/lib/accountIntent.js");
  const stageClient = readText("src/api/stageClient.js");

  assert.match(helper, /`\$\{ACCOUNT_INTENT_KEY\}:\$\{userId\}`/);
  assert.match(helper, /if \(!userId\) return/);
  assert.match(stageClient, /clearAccountIntent\(userId\)/);
  assert.match(stageClient, /const userId = localStorage\.getItem\(USER_KEY\)/);
});

test("profile completion modal only opens club onboarding when explicitly allowed", () => {
  const source = readText("src/components/ProfileCompletionModal.jsx");

  assert.match(source, /allowClubOnboarding = false/);
  assert.match(source, /if \(allowClubOnboarding && !player\.club_id\)/);
  assert.doesNotMatch(source, /if \(!player\.club_id\)/);
});

test("president-only header does not offer a player profile switch", () => {
  const source = readText("src/components/Layout.jsx");

  assert.match(source, /accountIntent,/);
  assert.match(source, /const canSwitchRole = accountIntent === "both"[\s\S]{0,80}myPlayer[\s\S]{0,80}myClubId/);
  assert.match(source, /accountIntent=\{accountIntent\}/);
  assert.doesNotMatch(source, /\+ Player profile/);
  assert.doesNotMatch(source, /myClubId && !myPlayer[\s\S]{0,260}to="\/profile"/);
});

test("profile page club onboarding prompts are gated by president intent", () => {
  const source = readText("src/pages/Profile.jsx");

  assert.match(source, /presidentClub: rawPresidentClub/);
  assert.match(source, /const resolvedPresidentClub = asObject\(rawPresidentClub\)/);
  assert.doesNotMatch(source, /club: rawClub/);
  assert.match(source, /isPresidentAccountIntent\(accountIntent\)/);
  assert.match(source, /canPromptForClubOnboarding/);
  assert.match(source, /const canUsePlayerProfile = accountIntent !== "president"/);
  assert.match(source, /const effectiveIntent = resolvedPresidentClub && !resolvedPlayer && storedIntent === "player"/);
  assert.match(source, /setAccountIntent\(effectiveIntent\)/);
  assert.match(source, /else if \(resolvedPresidentClub\)[\s\S]{0,120}setView\("club"\)/);
  assert.doesNotMatch(source, /else if \(storedIntent !== "president"\)[\s\S]{0,80}setView\("edit_player"\)/);
  assert.match(source, /\{canUsePlayerProfile \? \([\s\S]{0,220}setView\("edit_player"\)/);
  assert.match(source, /allowClubOnboarding=\{canPromptForClubOnboarding\}/);
  assert.match(source, /player && player\.gamertag && player\.position && player\.platform && !myClub && canPromptForClubOnboarding/);
  assert.match(source, /!myClub && canPromptForClubOnboarding/);
  assert.match(source, /resolvedPresidentClub\?\.id[\s\S]{0,120}JoinRequest\.filter\(\{ club_id: resolvedPresidentClub\.id/);
  assert.match(source, /\{!player && canUsePlayerProfile && \(/);
  assert.match(source, /stageClient\.clubs\.leave\(clubId/);
  assert.match(source, /writeAccountIntent\("player"/);
  assert.doesNotMatch(source, /entities\.Player\.update\(player\.id, \{ club_id: null/);
});

test("account intent helper isolates users and never writes global fallback intent", () => {
  const store = new Map();
  const previousLocalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };

  try {
    writeAccountIntent("both", "user-a");
    writeAccountIntent("president", undefined);
    assert.equal(readAccountIntent("user-a"), "both");
    assert.equal(readAccountIntent("user-b"), "player");
    assert.equal(readAccountIntent(), "player");
    assert.equal(isPresidentAccountIntent(readAccountIntent("user-a")), true);
    assert.equal(store.has(ACCOUNT_INTENT_KEY), false);

    clearAccountIntent("user-a");
    assert.equal(readAccountIntent("user-a"), "player");
  } finally {
    if (previousLocalStorage === undefined) {
      delete globalThis.localStorage;
    } else {
      globalThis.localStorage = previousLocalStorage;
    }
  }
});
