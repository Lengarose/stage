const LIFECYCLE_OWNED_CONTRACT_TYPES = new Set(['ownership', 'founder_player', 'founder']);

function isLifecycleOwnedContractType(type) {
  return LIFECYCLE_OWNED_CONTRACT_TYPES.has(String(type || '').trim().toLowerCase());
}

function assertContractCanBeDeleted(contract) {
  if (!isLifecycleOwnedContractType(contract?.contract_type || contract?.type)) return;
  const err = new Error('Founder and president contracts cannot be deleted');
  err.status = 403;
  err.code = 'lifecycle_owned_contract';
  throw err;
}

module.exports = {
  LIFECYCLE_OWNED_CONTRACT_TYPES,
  isLifecycleOwnedContractType,
  assertContractCanBeDeleted,
};
