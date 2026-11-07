import { getContractTargetPlayerId, getContractType, normalizePlayerContracts } from "./playerContractFields.js";

const ACTIVE_STATUS = "active";
const LIVE_CONTRACT_STATUSES = new Set(["active", "pending", "pending_window", "negotiating"]);

export function findBlockingContractConflict({
  selectedType = "squad",
  playerContracts = [],
  existingActiveContract = null,
  targetClubId = null,
} = {}) {
  const isOwnershipOffer = selectedType === "ownership";
  // API rows are not trusted; a malformed contract must not crash transfer routes.
  const liveConflict = normalizePlayerContracts(playerContracts).find((contract) => (
    (!targetClubId || !contract.team_id || String(contract.team_id) === String(targetClubId)) && LIVE_CONTRACT_STATUSES.has(contract.status) &&
    (isOwnershipOffer ? getContractType(contract) === "ownership" : getContractType(contract) !== "ownership")
  ));

  return liveConflict || ((!targetClubId || String(existingActiveContract?.team_id) === String(targetClubId)) ? existingActiveContract : null) || null;
}

export function getSignedClubIdForPlayer(player, playerContracts = []) {
  if (player?.club_id) return player.club_id;
  const activeContract = normalizePlayerContracts(playerContracts).find((contract) => (
    getContractTargetPlayerId(contract) === player?.id &&
    contract.status === ACTIVE_STATUS &&
    contract.team_id
  ));
  return activeContract?.team_id || null;
}

export function getContractOfferBlockReason({ player, playerContracts = [], viewerClub = null } = {}) {
  const signedClub=getSignedClubIdForPlayer(player, playerContracts);
  if (signedClub && (!viewerClub?.id || String(signedClub)===String(viewerClub.id))) return "signed";
  const hasLiveOffer = normalizePlayerContracts(playerContracts).some((contract) => (
    getContractTargetPlayerId(contract) === player?.id &&
    (!viewerClub?.id || !contract.team_id || String(contract.team_id)===String(viewerClub.id)) &&
    LIVE_CONTRACT_STATUSES.has(contract.status)
  ));
  return hasLiveOffer ? "live_offer" : null;
}

export function canShowContractOfferButton({
  player,
  viewerClub,
  playerContracts = [],
  limitedTournamentId = null,
} = {}) {
  if (!player?.id || !viewerClub?.id || limitedTournamentId) return false;
  return getContractOfferBlockReason({ player, playerContracts, viewerClub }) === null;
}

// Compatibility for old consumers: loans have been removed from the app.
export function canShowLoanRequestButton() {
  return false;
}
