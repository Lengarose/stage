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

test("club creation onboarding uses the founder lifecycle operation", () => {
  const clubSetup = readRepoFile("src/components/onboarding/ClubSetup.jsx");
  const modal = readRepoFile("src/components/ClubOnboardingModal.jsx");
  const presidentSetup = readRepoFile("src/components/onboarding/PresidentSetup.jsx");

  assert.match(clubSetup, /stageClient\.clubs\.createFounder/);
  assert.match(clubSetup, /player_id:\s*player\.id/);
  assert.match(modal, /stageClient\.clubs\.createFounder/);
  assert.match(modal, /player_id:\s*player\.id/);
  assert.doesNotMatch(clubSetup, /stageClient\.entities\.Club\.create/);
  assert.doesNotMatch(modal, /stageClient\.entities\.Club\.create/);
  assert.doesNotMatch(clubSetup, /president:\s*toPresidentApiPayload\(presidentProfile\)/);
  assert.doesNotMatch(modal, /president:\s*toPresidentApiPayload\(presidentProfile\)/);
  assert.doesNotMatch(clubSetup, /PresidentSetup/);
  assert.doesNotMatch(modal, /PresidentSetup/);

  for (const field of PRESIDENT_API_FIELDS) {
    assert.match(presidentSetup, new RegExp(`\\b${field}\\b`), `PresidentSetup is missing ${field}`);
  }
});

test("club creation skips standalone president profile in new player-president flows", () => {
  const clubSetup = readRepoFile("src/components/onboarding/ClubSetup.jsx");
  const modal = readRepoFile("src/components/ClubOnboardingModal.jsx");

  assert.match(clubSetup, /required \? "club_profile" : "choice"/);
  assert.doesNotMatch(clubSetup, /step === "president"/);
  assert.doesNotMatch(clubSetup, /setStep\("president"\)/);

  assert.match(modal, /choose \| club_profile \| join/);
  assert.doesNotMatch(modal, /step === "president"/);
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

test("club detail prefers canonical president Player identity", () => {
  const detail = readRepoFile("src/pages/ClubDetail.jsx");
  const hero = readRepoFile("src/components/profile/gamer/GamerClubProfileHero.jsx");
  const app = readRepoFile("src/App.jsx");
  const presidentPage = readRepoFile("src/pages/PresidentProfile.jsx");

  assert.match(detail, /ClubPresidentChip/, "ClubDetail should render a compact president chip in the hero");
  assert.match(detail, /infoAside=\{/);
  assert.match(detail, /c\?\.president_player_id/, "ClubDetail should read the canonical club president_player_id");
  assert.match(detail, /entities\.Player\.get\(c\.president_player_id\)/, "ClubDetail should load the President as a Player first");
  assert.match(detail, /profile_path:\s*`\/players\/\$\{presidentPlayer\.id\}`/);
  assert.match(detail, /club\?\.president_player_id \? `\/players\/\$\{club\.president_player_id\}`/);
  assert.match(detail, /entities\.President/, "ClubDetail should keep legacy President fallback compatibility");
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

  assert.match(presidentPage, /entities\.Player\s*\.\s*filter\(\{\s*user_id:\s*presidentRow\.user_id\s*\}/);
  assert.match(presidentPage, /navigate\(`\/players\/\$\{mappedPlayer\.id\}`,\s*\{\s*replace:\s*true\s*\}\)/);
  assert.match(presidentPage, /legacy President profile is kept for compatibility/i);
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
  assert.match(layout, /presMyClubMenu/);
  assert.match(layout, /playerProfileMenu/);
  assert.match(layout, /accountProfilesLabel/);
  assert.doesNotMatch(layout, /\/presidents\/\$\{/, "Layout should not route normal identity menus to legacy President profiles");
});

test("presidents list page derives public presidents from Player-linked clubs", () => {
  const app = readRepoFile("src/App.jsx");
  const layout = readRepoFile("src/components/Layout.jsx");
  const page = readRepoFile("src/pages/Presidents.jsx");
  const directory = readRepoFile("src/lib/presidentDirectory.js");

  assert.match(app, /path="\/presidents-list"/);
  assert.match(app, /import\('\.\/pages\/Presidents'\)/);
  assert.match(layout, /\/presidents-list/);
  assert.match(layout, /nav\.presidents/);
  assert.match(page, /entities\.Club\.list/);
  assert.match(page, /entities\.Player\.list/);
  assert.match(page, /buildPlayerPresidentDirectoryRows/);
  assert.match(page, /to=\{`\/players\/\$\{president\.player_id\}`\}/);
  assert.doesNotMatch(page, /entities\.President\.list/);
  assert.doesNotMatch(page, /filterPublicPresidentProfiles/);
  assert.match(directory, /club\?\.president_player_id/);
  assert.match(directory, /player_id:\s*player\.id/);
  assert.match(directory, /club_name:\s*club\.name/);
});

test("search President results use Player president links", () => {
  const search = readRepoFile("src/pages/Search.jsx");

  assert.match(search, /buildPlayerPresidentDirectoryRows\(allClubs,\s*allPlayers\)/);
  assert.match(search, /matchesPlayerPresidentQuery/);
  assert.match(search, /to=\{`\/players\/\$\{p\.player_id\}`\}/);
  assert.doesNotMatch(search, /entities\.President\.list/);
  assert.doesNotMatch(search, /isPublicPresidentProfile/);
  assert.doesNotMatch(search, /to=\{`\/presidents\/\$\{p\.id\}`\}/);
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
