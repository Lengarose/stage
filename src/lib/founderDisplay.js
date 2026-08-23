/** Public name for a founder seat. The contract document still says Founder. */

export const FOUNDER_PUBLIC_ROLE_LABEL = 'Player';
export const FOUNDER_CONTRACT_LABEL = 'Founder';
export const FOUNDER_PLAYER_CONTRACT_LABEL = 'Founder Player';

export function isNamedFounder(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/-/g, '_');
  return normalized === 'founder' || normalized === 'founder_player';
}

export function displayNamedFounder({ forContract = false, type } = {}) {
  if (!forContract) return FOUNDER_PUBLIC_ROLE_LABEL;
  const contractType = String(type || '').trim().toLowerCase().replace(/-/g, '_');
  if (contractType === 'founder_player') return FOUNDER_PLAYER_CONTRACT_LABEL;
  return FOUNDER_CONTRACT_LABEL;
}
