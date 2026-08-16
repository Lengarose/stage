import { CONTRACT_TYPES } from "./contractTypes.js";

const DEFAULT_CONTRACT_TYPE = "squad";
const VALID_CONTRACT_TYPES = new Set(Object.keys(CONTRACT_TYPES));

export function getContractType(contract, fallback = DEFAULT_CONTRACT_TYPE) {
  const safeFallback = VALID_CONTRACT_TYPES.has(fallback) ? fallback : DEFAULT_CONTRACT_TYPE;
  const rawType = typeof contract?.contract_type === "string" ? contract.contract_type.trim() : "";
  return VALID_CONTRACT_TYPES.has(rawType) ? rawType : safeFallback;
}

export function normalizePlayerContract(contract) {
  if (!contract || typeof contract !== "object") return null;
  return {
    ...contract,
    contract_type: getContractType(contract),
    status: contract.status || "pending",
  };
}

export function normalizePlayerContracts(value) {
  return Array.isArray(value)
    ? value.map(normalizePlayerContract).filter(Boolean)
    : [];
}

export function getContractTargetPlayerId(contract) {
  return contract?.target_player_id || contract?.user_id || null;
}

/** True when the last counter came from the player the contract is offered to. */
export function isLastNegotiatedByTargetPlayer(contract) {
  const lastBy = contract?.last_negotiated_by;
  const targetId = getContractTargetPlayerId(contract);
  return Boolean(lastBy && targetId && String(lastBy) === String(targetId));
}
