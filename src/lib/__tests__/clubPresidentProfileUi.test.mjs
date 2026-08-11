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
  const hero = readRepoFile("src/components/profile/gamer/GamerClubProfileHero.jsx");
  const app = readRepoFile("src/App.jsx");
  const presidentPage = readRepoFile("src/pages/PresidentProfile.jsx");

  assert.match(detail, /ClubPresidentChip/, "ClubDetail should render a compact president chip in the hero");
  assert.match(detail, /infoAside=\{/);
  assert.match(detail, /entities\.President/, "ClubDetail should load the President entity");
  assert.match(detail, /\/presidents\//);
  assert.doesNotMatch(detail, /PresidentProfileCard/);
  assert.doesNotMatch(detail, /View president profile/);
  assert.match(hero, /infoAside/);
  assert.match(detail, /president\?\.avatar_url|president\.avatar_url/);
  assert.match(app, /path="\/presidents\/:id"/);
  assert.match(presidentPage, /entities\.President\.get/);
});

test("president profile supports owner/admin edit via shared ProfileEditShell", () => {
  const presidentPage = readRepoFile("src/pages/PresidentProfile.jsx");
  const presidentEdit = readRepoFile("src/components/presidents/PresidentProfileEdit.jsx");
  const shell = readRepoFile("src/components/profile/ProfileEditShell.jsx");
  const clubEdit = readRepoFile("src/components/club/ClubProfileEdit.jsx");
  const layout = readRepoFile("src/components/Layout.jsx");

  assert.match(presidentPage, /PresidentProfileEdit/);
  assert.match(presidentPage, /canEdit/);
  assert.match(presidentEdit, /ProfileEditShell/);
  assert.match(presidentEdit, /entities\.President\.update/);
  assert.match(presidentEdit, /profChangeBanner|onBannerChange/);
  assert.match(shell, /profPhotoBanner/);
  assert.match(shell, /profRepositionPhoto/);
  assert.match(shell, /profChangeBanner/);
  assert.match(clubEdit, /ProfileEditShell/);
  assert.match(clubEdit, /entities\.Club\.update/);
  assert.match(layout, /presProfileMenu/);
  assert.match(layout, /\/presidents\/\$\{/);
});

test("presidents list page is routed and linked in market nav", () => {
  const app = readRepoFile("src/App.jsx");
  const layout = readRepoFile("src/components/Layout.jsx");
  const page = readRepoFile("src/pages/Presidents.jsx");

  assert.match(app, /path="\/presidents-list"/);
  assert.match(app, /import\('\.\/pages\/Presidents'\)/);
  assert.match(layout, /\/presidents-list/);
  assert.match(layout, /nav\.presidents/);
  assert.match(page, /entities\.President\.list/);
  assert.match(page, /filterPublicPresidentProfiles/);
  assert.match(page, /\/presidents\/\$\{president\.id\}/);
});

test("president profile loads and renders club history", () => {
  const presidentPage = readRepoFile("src/pages/PresidentProfile.jsx");
  const contractsPanel = readRepoFile("src/components/presidents/PresidentContractsPanel.jsx");
  const client = readRepoFile("src/api/stageClient.js");
  const controller = readRepoFile("server/src/server/controllers/presidentController.js");
  const schema = readRepoFile("server/schema.sql");

  assert.match(schema, /CREATE TABLE IF NOT EXISTS president_club_history/);
  assert.match(controller, /\/:id\/history/);
  assert.match(controller, /listHistoryForPresident/);
  assert.match(client, /history\(presidentId/);
  assert.match(client, /\/presidents\/\$\{encodeURIComponent\(presidentId\)\}\/history/);
  assert.match(presidentPage, /presidents\.history/);
  assert.match(presidentPage, /presClubHistory/);
  assert.match(presidentPage, /clubHistory/);
  assert.match(presidentPage, /BannerSelector/);
  assert.match(presidentPage, /GamerPresidentProfileHero/);
  assert.match(presidentPage, /presTabHistory/);
  assert.match(presidentPage, /presTabContracts/);
  assert.match(presidentPage, /presTabPlayersSigned/);
  assert.match(presidentPage, /showOfferStatuses=\{canEdit\}/);
  assert.match(presidentPage, /PresidentContractsPanel/);
  assert.match(contractsPanel, /showOfferStatuses/);
  assert.match(contractsPanel, /presNoSignedPlayers/);
  assert.match(contractsPanel, /SIGNED_STATUSES|statuses:\s*\["active"\]/);
  assert.match(contractsPanel, /presOfferSent/);
  assert.match(contractsPanel, /presOfferAccepted/);
  assert.match(contractsPanel, /presOfferDeclined/);
  assert.match(contractsPanel, /presOfferNegotiable/);
});

test("admin clubs tab exposes president transfer dialog wired to stageClient.presidents.transfer", () => {
  const clubsTab = readRepoFile("src/components/admin/sections/ClubsTab.jsx");
  const dialog = readRepoFile("src/components/admin/PresidentTransferDialog.jsx");
  const client = readRepoFile("src/api/stageClient.js");

  assert.match(clubsTab, /PresidentTransferDialog/);
  assert.match(clubsTab, /setPresidentTransferClub/);
  assert.match(dialog, /stageClient\.presidents\.transfer/);
  assert.match(dialog, /club_id:\s*null/);
  assert.match(dialog, /MODE_MOVE/);
  assert.match(client, /const presidents = \{/);
  assert.match(client, /transfer\(presidentId/);
  assert.match(client, /\/presidents\/\$\{encodeURIComponent\(presidentId\)\}\/transfer/);
});
