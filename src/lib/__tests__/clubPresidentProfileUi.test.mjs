import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");

const PRESIDENT_FIELDS = [
  "president_name",
  "president_role_title",
  "president_avatar_url",
  "president_banner_url",
  "president_banner_position",
  "president_banner_zoom",
  "president_bio",
  "president_success_level",
  "president_country_code",
  "president_quote",
  "president_management_style",
  "president_started_at",
  "president_social_links",
];

function readRepoFile(path) {
  return readFileSync(resolve(root, path), "utf8");
}

test("club creation onboarding submits the president profile fields", () => {
  const clubSetup = readRepoFile("src/components/onboarding/ClubSetup.jsx");
  const modal = readRepoFile("src/components/ClubOnboardingModal.jsx");

  for (const field of PRESIDENT_FIELDS) {
    assert.match(clubSetup, new RegExp(`\\b${field}\\b`), `ClubSetup is missing ${field}`);
    assert.match(modal, new RegExp(`\\b${field}\\b`), `ClubOnboardingModal is missing ${field}`);
  }
});

test("club detail renders a public president profile section", () => {
  const detail = readRepoFile("src/pages/ClubDetail.jsx");

  assert.match(detail, /PresidentProfileCard/, "ClubDetail should render a dedicated president profile card");
  assert.match(detail, /isSafePresidentUrl/, "ClubDetail should validate public president links");
  assert.doesNotMatch(detail, /href=\{link\.url\}/, "ClubDetail should not render raw public president social URLs");
  assert.match(detail, /president_avatar_url/, "ClubDetail should render the president avatar");
  assert.match(detail, /president_banner_url/, "ClubDetail should render the president banner");
  assert.match(detail, /president_success_level/, "ClubDetail should render the success level");
  assert.match(detail, /president_management_style/, "ClubDetail should render the management style");
  assert.match(detail, /club\?\.president_country_code/, "ClubDetail should show the section for president country data alone");
  assert.match(detail, /club\?\.president_started_at/, "ClubDetail should show the section for president start date alone");
  assert.match(detail, /club\?\.president_social_links/, "ClubDetail should show the section for president social data alone");
});
