export function getContractAcceptanceFlow({ contract, player, windowOpen }) {
  const contractClubId = contract?.team_id ? String(contract.team_id) : "";
  const playerClubId = player?.club_id ? String(player.club_id) : "";
  const isRenewal = Boolean(playerClubId && contractClubId && playerClubId === contractClubId);
  const isClubTransfer = Boolean(playerClubId && contractClubId && playerClubId !== contractClubId);
  const waitingForWindowCheck = isClubTransfer && windowOpen == null;
  const queuedForTransferWindow = isClubTransfer && windowOpen === false;

  return {
    action: waitingForWindowCheck ? null : (queuedForTransferWindow ? "mark_pending_window" : "accept"),
    isRenewal,
    isClubTransfer,
    waitingForWindowCheck,
    queuedForTransferWindow,
  };
}
