import assert from "node:assert/strict";
import test from "node:test";

import { mergeActiveContractPlayersIntoSquad } from "../clubSquadContracts.js";

test("active star contracts add missing signed players to the club squad", () => {
  const squad = [{ id: "player-existing", gamertag: "Already Here", club_id: "club-zaire" }];
  const contracts = [
    {
      id: "contract-cp",
      user_id: "player-cp",
      team_id: "club-zaire",
      status: "active",
      contract_type: "star",
    },
  ];
  const contractedPlayers = [{ id: "player-cp", gamertag: "CP", club_id: null, role: "free_agent" }];

  const merged = mergeActiveContractPlayersIntoSquad(squad, contracts, contractedPlayers, "club-zaire");

  assert.equal(merged.length, 2);
  assert.deepEqual(
    merged.find((player) => player.id === "player-cp"),
    {
      id: "player-cp",
      gamertag: "CP",
      club_id: "club-zaire",
      role: "member",
      club_roles: ["member"],
      status: "active",
    },
  );
});

test("pending window contracts do not add players before transfer execution", () => {
  const contracts = [
    { id: "contract-cp", user_id: "player-cp", team_id: "club-zaire", status: "pending_window" },
  ];
  const contractedPlayers = [{ id: "player-cp", gamertag: "CP" }];

  const merged = mergeActiveContractPlayersIntoSquad([], contracts, contractedPlayers, "club-zaire");

  assert.deepEqual(merged, []);
});

test("active contract players are not duplicated when player.club_id is already correct", () => {
  const squad = [{ id: "player-cp", gamertag: "CP", club_id: "club-zaire", role: "captain" }];
  const contracts = [{ id: "contract-cp", user_id: "player-cp", team_id: "club-zaire", status: "active" }];
  const contractedPlayers = [{ id: "player-cp", gamertag: "CP" }];

  const merged = mergeActiveContractPlayersIntoSquad(squad, contracts, contractedPlayers, "club-zaire");

  assert.equal(merged.length, 1);
  assert.equal(merged[0].role, "captain");
});
