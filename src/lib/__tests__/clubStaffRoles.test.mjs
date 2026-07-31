import assert from "node:assert/strict";
import test from "node:test";

import {
  getPrimaryClubRole,
  mergeStaffRolesIntoPlayers,
} from "../clubStaffRoles.js";

test("mergeStaffRolesIntoPlayers adds operations roles to matching squad players", () => {
  const players = [{ id: "player-1", role: "member", club_roles: [] }];
  const staffRoles = [{ player_id: "player-1", role: "vice_captain" }];

  const [player] = mergeStaffRolesIntoPlayers(players, staffRoles);

  assert.deepEqual(player.club_roles, ["vice_captain"]);
  assert.equal(player.role, "vice_captain");
});

test("getPrimaryClubRole prioritizes president over other roles", () => {
  assert.equal(
    getPrimaryClubRole({ role: "member", club_roles: ["recruiter", "president"] }),
    "president",
  );
});
