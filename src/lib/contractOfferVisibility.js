import { getContractTargetPlayerId, getContractType, normalizePlayerContracts } from "./playerContractFields.js";

const ACTIVE_STATUS = "active";
const LIVE_CONTRACT_STATUSES = new Set(["active", "pending", "pending_window", "negotiating"]);

export function findBlockingContractConflict({
  selectedType = "squad",
  playerContracts = [],
  existingActiveContract = null,
} = {}) {
  const isOwnershipOffer = selectedType === "ownership";
  // API rows are not trusted; a malformed contract must not crash transfer routes.
  const liveConflict = normalizePlayerContracts(playerContracts).find((contract) => (
    LIVE_CONTRACT_STATUSES.has(contract.status) &&
    (isOwnershipOffer ? getContractType(contract) === "ownership" : getContractType(contract) !== "ownership")
  ));

  return liveConflict || existingActiveContract || null;
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

export function getContractOfferBlockReason({ player, playerContracts = [] } = {}) {
  if (getSignedClubIdForPlayer(player, playerContracts)) return "signed";
  const hasLiveOffer = normalizePlayerContracts(playerContracts).some((contract) => (
    getContractTargetPlayerId(contract) === player?.id &&
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
  return getContractOfferBlockReason({ player, playerContracts }) === null;
}

export function canShowLoanRequestButton({
  player,
  viewerClub,
  playerContracts = [],
  limitedTournamentId = null,
} = {}) {
  if (!player?.id || !viewerClub?.id || limitedTournamentId) return false;
  const signedClubId = getSignedClubIdForPlayer(player, playerContracts);
  if (!signedClubId) return false;
  return String(signedClubId) !== String(viewerClub.id);
}
