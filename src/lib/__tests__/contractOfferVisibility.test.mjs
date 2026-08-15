import assert from "node:assert/strict";
import test from "node:test";

import {
  canShowContractOfferButton,
  canShowLoanRequestButton,
  findBlockingContractConflict,
  getSignedClubIdForPlayer,
} from "../contractOfferVisibility.js";

test("signed players do not show the contract offer button", () => {
  assert.equal(
    canShowContractOfferButton({
      player: { id: "player-1", club_id: "club-current" },
      viewerClub: { id: "club-viewer" },
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
    false
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

test("signed players show Request Loan to a different club, not a contract offer", () => {
  const player = { id: "player-1", club_id: "club-a" };
  const viewerClub = { id: "club-b" };
  const playerContracts = [
    { id: "contract-1", user_id: "player-1", team_id: "club-a", status: "active" },
  ];

  assert.equal(canShowContractOfferButton({ player, viewerClub, playerContracts }), false);
  assert.equal(canShowLoanRequestButton({ player, viewerClub, playerContracts }), true);
});

test("a club cannot request a loan for its own contracted player", () => {
  assert.equal(
    canShowLoanRequestButton({
      player: { id: "player-1", club_id: "club-a" },
      viewerClub: { id: "club-a" },
      playerContracts: [],
    }),
    false
  );
});

test("free agents do not get a loan request button", () => {
  assert.equal(
    canShowLoanRequestButton({
      player: { id: "player-free" },
      viewerClub: { id: "club-b" },
      playerContracts: [],
    }),
    false
  );
});
