import { getContractTargetPlayerId } from "./playerContractFields.js";

const ACTIVE_STATUS = "active";
const LIVE_CONTRACT_STATUSES = new Set(["active", "pending", "pending_window", "negotiating"]);

export function getSignedClubIdForPlayer(player, playerContracts = []) {
  if (player?.club_id) return player.club_id;
  const activeContract = playerContracts.find((contract) => (
    getContractTargetPlayerId(contract) === player?.id &&
    contract?.status === ACTIVE_STATUS &&
    contract?.team_id
  ));
  return activeContract?.team_id || null;
}

export function getContractOfferBlockReason({ player, playerContracts = [] } = {}) {
  if (getSignedClubIdForPlayer(player, playerContracts)) return "signed";
  const hasLiveOffer = playerContracts.some((contract) => (
    getContractTargetPlayerId(contract) === player?.id &&
    LIVE_CONTRACT_STATUSES.has(contract?.status)
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
