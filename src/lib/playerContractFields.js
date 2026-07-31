export function getContractTargetPlayerId(contract) {
  return contract?.target_player_id || contract?.user_id || null;
}
