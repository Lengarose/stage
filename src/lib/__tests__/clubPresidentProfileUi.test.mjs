import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");

const PRESIDENT_API_FIELDS = [
  "display_name",
  "role_title",
  "avatar_url",
  "avatar_position",
  "avatar_zoom",
  "banner_url",
  "banner_position",
  "banner_zoom",
  "bio",
  "success_level",
  "country_code",
  "quote",
  "management_style",
  "started_at",
  "social_links",
];

function readRepoFile(path) {
  return readFileSync(resolve(root, path), "utf8");
}

test("club creation onboarding submits nested president entity payload", () => {
  const clubSetup = readRepoFile("src/components/onboarding/ClubSetup.jsx");
  const modal = readRepoFile("src/components/ClubOnboardingModal.jsx");
  const presidentSetup = readRepoFile("src/components/onboarding/PresidentSetup.jsx");

  assert.match(clubSetup, /president:\s*toPresidentApiPayload\(presidentProfile\)/);
  assert.match(modal, /president:\s*toPresidentApiPayload\(presidentProfile\)/);
  assert.match(clubSetup, /PresidentSetup/);
  assert.match(modal, /PresidentSetup/);

  for (const field of PRESIDENT_API_FIELDS) {
    assert.match(presidentSetup, new RegExp(`\\b${field}\\b`), `PresidentSetup is missing ${field}`);
  }
});

test("club creation separates president profile and club profile into different steps", () => {
  const clubSetup = readRepoFile("src/components/onboarding/ClubSetup.jsx");
  const modal = readRepoFile("src/components/ClubOnboardingModal.jsx");

  assert.match(clubSetup, /required \? "president" : "choice"/);
  assert.match(clubSetup, /step === "president"/);
  assert.match(clubSetup, /setStep\("club_profile"\)/);

  assert.match(modal, /choose \| president \| club_profile \| join/);
  assert.match(modal, /step === "president"/);
  assert.match(modal, /step === "club_profile"/);
});

test("president onboarding uses the same ImagePositionEditor photo UX as players", () => {
  const presidentSetup = readRepoFile("src/components/onboarding/PresidentSetup.jsx");
  const playerSetup = readRepoFile("src/components/onboarding/PlayerSetup.jsx");

  assert.match(presidentSetup, /ImagePositionEditor/);
  assert.match(presidentSetup, /GamerPlayerPhotoFrame/);
  assert.match(presidentSetup, /aspect="card"/);
  assert.match(presidentSetup, /president-avatar\.jpg/);
  assert.match(presidentSetup, /avatar_position/);
  assert.match(presidentSetup, /avatar_zoom/);
  assert.match(playerSetup, /ImagePositionEditor/);
  assert.match(playerSetup, /GamerPlayerPhotoFrame/);
  assert.doesNotMatch(presidentSetup, /border-dashed/);
});

test("club detail loads President entity and links to president profile", () => {
  const detail = readRepoFile("src/pages/ClubDetail.jsx");
  const app = readRepoFile("src/App.jsx");
  const presidentPage = readRepoFile("src/pages/PresidentProfile.jsx");

  assert.match(detail, /PresidentProfileCard/, "ClubDetail should render a dedicated president profile card");
  assert.match(detail, /entities\.President/, "ClubDetail should load the President entity");
  assert.match(detail, /View president profile/);
  assert.match(detail, /\/presidents\//);
  assert.match(detail, /isSafePresidentUrl/, "ClubDetail should validate public president links");
  assert.doesNotMatch(detail, /href=\{link\.url\}/, "ClubDetail should not render raw public president social URLs");
  assert.match(detail, /president\?\.avatar_url|president\.avatar_url/);
  assert.match(detail, /president\?\.success_level|president\.success_level/);
  assert.match(app, /path="\/presidents\/:id"/);
  assert.match(presidentPage, /entities\.President\.get/);
});

test("president profile supports owner/admin edit via PresidentSetup", () => {
  const presidentPage = readRepoFile("src/pages/PresidentProfile.jsx");
  const presidentSetup = readRepoFile("src/components/onboarding/PresidentSetup.jsx");
  const layout = readRepoFile("src/components/Layout.jsx");

  assert.match(presidentPage, /mode="edit"/);
  assert.match(presidentPage, /entities\.President\.update/);
  assert.match(presidentPage, /buildProfileFromPresident/);
  assert.match(presidentPage, /canEdit/);
  assert.match(presidentSetup, /buildProfileFromPresident/);
  assert.match(presidentSetup, /mode === "edit"/);
  assert.match(layout, /presProfileMenu/);
  assert.match(layout, /\/presidents\/\$\{/);
});
