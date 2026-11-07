import assert from "node:assert/strict";
import test from "node:test";

import {
  canShowContractOfferButton,
  canShowLoanRequestButton,
  findBlockingContractConflict,
  getSignedClubIdForPlayer,
} from "../contractOfferVisibility.js";

test("the same club cannot offer a duplicate active player contract", () => {
  assert.equal(
    canShowContractOfferButton({
      player: { id: "player-1", club_id: "club-current" },
      viewerClub: { id: "club-current" },
      playerContracts: [],
    }),
    false
  );
});

test("an active accepted contract links the player to its club even when player.club_id is stale", () => {
  const contracts = [
    { id: "contract-1", user_id: "player-1", team_id: "club-signed", status: "active" },
  ];

  assert.equal(getSignedClubIdForPlayer({ id: "player-1" }, contracts), "club-signed");
  assert.equal(
    canShowContractOfferButton({
      player: { id: "player-1" },
      viewerClub: { id: "club-viewer" },
      playerContracts: contracts,
    }),
    true
  );
});

test("free players can receive a contract offer from a club account", () => {
  assert.equal(
    canShowContractOfferButton({
      player: { id: "player-free" },
      viewerClub: { id: "club-viewer" },
      playerContracts: [],
    }),
    true
  );
});

test("contract conflict checks ignore malformed rows from the API", () => {
  const liveSquadContract = {
    id: "contract-live",
    user_id: "player-1",
    team_id: "club-1",
    status: "pending",
    contract_type: "star",
  };

  assert.deepEqual(
    findBlockingContractConflict({
      selectedType: "star",
      playerContracts: [
        null,
        undefined,
        { id: "contract-history", status: "declined", contract_type: "star" },
        liveSquadContract,
      ],
    }),
    liveSquadContract
  );
});

test("removed loans never expose a request action, regardless of legacy status", () => {
  for (const status of [null, "PROPOSED", "ACTIVE", "COMPLETED", "RETIRED"]) {
    assert.equal(canShowLoanRequestButton({
      player: { id: "player", club_id: "old" }, viewerClub: { id: "new" },
      loans: status ? [{ player_id: "player", status }] : [],
    }), false);
  }
});
