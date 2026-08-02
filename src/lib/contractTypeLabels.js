const CONTRACT_TYPE_LABELS = {
  ownership: "Club President",
};

const CONTRACT_TYPE_SENTENCE_LABELS = {
  ownership: "president",
};

function readableType(type) {
  return String(type || "squad").replace(/_/g, " ");
}

export function getContractTypeLabel(type) {
  return CONTRACT_TYPE_LABELS[type] || readableType(type);
}

export function formatContractTypeForSentence(type) {
  return CONTRACT_TYPE_SENTENCE_LABELS[type] || readableType(type);
}
