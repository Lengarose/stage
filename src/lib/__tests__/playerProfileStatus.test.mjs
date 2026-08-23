import assert from "node:assert/strict";
import test from "node:test";
import {
  getFootballRoleBadges,
  getPlayerManagementBadges,
  getVisibleFootballRole,
} from "../playerProfileStatus.js";

test("canonical president player gets management badges without football role pollution", () => {
  const player = { id: "player-1", user_id: "user-1", role: "president", club_roles: ["president", "member"] };
  const club = { id: "club-1", name: "Founders FC", president_player_id: "player-1", president_user_id: "user-1" };

  assert.deepEqual(getFootballRoleBadges(player), []);
  assert.equal(getVisibleFootballRole(player), "");
  assert.deepEqual(getPlayerManagementBadges({ player, club }).map((badge) => badge.id), ["president"]);
});

test("founder membership adds Player beside canonical President status", () => {
  const player = { id: "player-1", user_id: "user-1", role: "member" };
  const club = { id: "club-1", name: "Founders FC", president_player_id: "player-1" };
  const memberships = [{
    club_id: "club-1",
    player_id: "player-1",
    status: "active",
    primary_role: "president",
    source: "founder_contract",
  }];

  const badges = getPlayerManagementBadges({ player, club, memberships });
  assert.deepEqual(badges.map((badge) => badge.id), ["founder", "president"]);
  assert.equal(badges.find((badge) => badge.id === "founder").label, "Player");
});

test("active founder contract adds Player for public profile viewers", () => {
  const player = { id: "player-1", user_id: "user-1" };
  const club = { id: "club-1", name: "Founders FC", president_player_id: "player-1" };
  const contracts = [{ team_id: "club-1", user_id: "player-1", contract_type: "founder", status: "active" }];

  const badges = getPlayerManagementBadges({ player, club, contracts });
  assert.deepEqual(badges.map((badge) => badge.id), ["founder", "president"]);
  assert.equal(badges.find((badge) => badge.id === "founder").label, "Player");
});

test("active founder player contract adds Player without replacing President ownership status", () => {
  const player = { id: "player-1", user_id: "user-1" };
  const club = { id: "club-1", name: "Founders FC", president_player_id: "player-1" };
  const contracts = [
    { team_id: "club-1", user_id: "player-1", contract_type: "founder_player", status: "active" },
    { team_id: "club-1", user_id: "player-1", contract_type: "ownership", status: "active" },
  ];

  assert.deepEqual(getPlayerManagementBadges({ player, club, contracts }).map((badge) => badge.id), ["founder", "president"]);
});

test("non-president player does not get management status", () => {
  assert.deepEqual(
    getPlayerManagementBadges({
      player: { id: "player-2", user_id: "user-2", role: "captain", club_roles: ["captain"] },
      club: { id: "club-1", president_player_id: "player-1" },
    }),
    []
  );
  assert.deepEqual(getFootballRoleBadges({ role: "captain", club_roles: ["captain", "member"] }), ["captain"]);
});
