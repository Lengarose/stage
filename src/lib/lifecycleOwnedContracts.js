export const LIFECYCLE_OWNED_CONTRACT_TYPES = new Set([
  "ownership",
  "founder_player",
  "founder",
]);

export const FOUNDER_PLAYER_CONTRACT_TYPES = new Set(["founder", "founder_player"]);
export const LIVE_CONTRACT_STATUSES = ["active", "pending", "pending_window", "negotiating"];

function getContractTypeValue(contractOrType) {
  if (typeof contractOrType === "string") return contractOrType.trim().toLowerCase();
  return String(contractOrType?.contract_type || contractOrType?.type || "").trim().toLowerCase();
}

export function isLifecycleOwnedContract(contractOrType) {
  return LIFECYCLE_OWNED_CONTRACT_TYPES.has(getContractTypeValue(contractOrType));
}

export function isFounderPlayerContract(contractOrType) {
  return FOUNDER_PLAYER_CONTRACT_TYPES.has(getContractTypeValue(contractOrType));
}

export function canRenegotiateFounderPlayerContract(contract, { isMyContract = false, canManage = false } = {}) {
  if (!isFounderPlayerContract(contract)) return false;
  if (String(contract?.status || "").toLowerCase() !== "active") return false;
  return Boolean(isMyContract || canManage);
}

export function clubIsMissingPresidentContract(contracts = []) {
  const live = (Array.isArray(contracts) ? contracts : []).filter((contract) => (
    LIVE_CONTRACT_STATUSES.includes(String(contract?.status || "").toLowerCase())
  ));
  const hasOwnership = live.some((contract) => getContractTypeValue(contract) === "ownership");
  if (hasOwnership) return false;
  return live.some((contract) => FOUNDER_PLAYER_CONTRACT_TYPES.has(getContractTypeValue(contract)));
}
