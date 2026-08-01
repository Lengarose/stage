import assert from "node:assert/strict";
import test from "node:test";

import {
  canShowContractOfferButton,
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
