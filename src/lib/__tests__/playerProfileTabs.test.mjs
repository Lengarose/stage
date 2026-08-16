import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  PLAYER_PROFILE_TAB_IDS,
  getPlayerProfileTabContract,
  getPlayerProfileTabs,
} from "../playerProfileTabs.js";
import { buildPlayerProfileStats } from "../playerProfileStats.js";

const root = process.cwd();

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function t(key) {
  return key;
}

test("canonical profile tabs keep one business meaning across owner and public contexts", () => {
  const owner = getPlayerProfileTabs({ context: "owner", t });
  const publicTabs = getPlayerProfileTabs({ context: "public", t });

  assert.deepEqual(owner.map((tab) => tab.id), PLAYER_PROFILE_TAB_IDS);
  assert.deepEqual(publicTabs.map((tab) => tab.id), PLAYER_PROFILE_TAB_IDS);

  for (const tabId of PLAYER_PROFILE_TAB_IDS) {
    const contract = getPlayerProfileTabContract(tabId);
    assert.ok(contract.meaning.length > 20);
    assert.equal(
      owner.find((tab) => tab.id === tabId).meaning,
      publicTabs.find((tab) => tab.id === tabId).meaning,
    );
  }
});

test("tournament-limited profiles hide only lifestyle while preserving tab meanings", () => {
  const publicTournament = getPlayerProfileTabs({ context: "public", tournamentLimited: true, t });

  assert.deepEqual(
    publicTournament.map((tab) => tab.id),
    ["posts", "showcase", "career", "trophies"],
  );
  assert.equal(getPlayerProfileTabContract("career").domain, "stageleagues_cv");
  assert.equal(getPlayerProfileTabContract("stats"), null);
  assert.equal(getPlayerProfileTabContract("matches"), null);
});

test("shared stats adapter gives owner and public pages the same source precedence", () => {
  const player = {
    matches_played: 0,
    goals: 0,
    assists: 0,
    avg_match_rating: 0,
    wins_count: 0,
    losses_count: 0,
    form_last10: "[8.2,7.4]",
    overall_rating: 76,
  };
  const clubStats = { matches: 12, goals: 6, assists: 5, avgRating: 7.22 };
  const pvpMatches = [
    { id: "w", home_player_id: "p1", away_player_id: "p2", home_score: 2, away_score: 1 },
    { id: "d", home_player_id: "p2", away_player_id: "p1", home_score: 1, away_score: 1 },
  ];

  const ownerStats = buildPlayerProfileStats({ player, clubStats, pvpMatches, playerId: "p1" });
  const publicStats = buildPlayerProfileStats({ player, clubStats, pvpMatches, playerId: "p1" });

  assert.deepEqual(ownerStats, publicStats);
  assert.equal(ownerStats.playerFields.matches_played, 12);
  assert.equal(ownerStats.playerFields.goals, 6);
  assert.equal(ownerStats.playerFields.assists, 5);
  assert.equal(ownerStats.playerFields.avg_match_rating, 7.22);
  assert.deepEqual(ownerStats.pvpRecord, { wins: 1, draws: 1, losses: 0 });
});

test("profile pages use canonical helpers and do not keep EAFC-only career or stale founder creation", () => {
  const ownerSource = read("src/pages/Profile.jsx");
  const publicSource = read("src/pages/PlayerProfile.jsx");
  const clubSource = read("src/pages/ClubDetail.jsx");
  const operationsSource = read("src/components/club/ClubOperations.jsx");

  assert.match(ownerSource, /getPlayerProfileTabs/);
  assert.match(publicSource, /getPlayerProfileTabs/);
  assert.doesNotMatch(ownerSource, /profileTab === "stats"/);
  assert.doesNotMatch(ownerSource, /profileTab === "matches"/);
  assert.doesNotMatch(publicSource, /activeTab === "stats"/);
  assert.doesNotMatch(publicSource, /activeTab === "matches"/);
  assert.match(ownerSource, /<PlayerCareerSummary/);
  assert.match(publicSource, /<PlayerCareerSummary/);
  assert.match(ownerSource, /<PlayerShowcase player=\{player\} canEdit=\{true\}/);
  assert.match(publicSource, /<PlayerShowcase player=\{player\} canEdit=\{isOwnProfile\}/);
  assert.doesNotMatch(ownerSource, /async function _createClub/);
  assert.doesNotMatch(ownerSource, /stageClient\.entities\.Club\.create/);
  assert.doesNotMatch(ownerSource, /PresidentContractDialog/);
  assert.doesNotMatch(publicSource, /activeTab === "matches"[\s\S]*homeUpcoming/);
  assert.match(clubSource, /GamerClubTabNav/);
  assert.doesNotMatch(clubSource, /id: "stats"/);
  assert.doesNotMatch(clubSource, /id: "matches"/);
  assert.doesNotMatch(operationsSource, /coopTabOverview/);
  assert.match(operationsSource, /commonPages.cdCaptain/);
  assert.match(operationsSource, /commonPages.cdViceCaptain/);
});
