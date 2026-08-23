import { FOUNDER_CONTRACT_LABEL, FOUNDER_PLAYER_CONTRACT_LABEL } from './founderDisplay.js';

const CONTRACT_TYPE_LABELS = {
  founder_player: FOUNDER_PLAYER_CONTRACT_LABEL,
  founder: FOUNDER_CONTRACT_LABEL,
  ownership: "Club President",
};

const CONTRACT_TYPE_SENTENCE_LABELS = {
  founder_player: "founder player",
  founder: "founder",
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
