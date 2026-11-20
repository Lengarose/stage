import { getEffectiveInboxActionType, inboxMessageNeedsAction } from './inboxActionTypes.js';
export const STAGE_SYSTEM_AVATAR = '/images/inbox/stage-system.png';
export function inboxSender(message = {}) {
  const name = message.sender_club_name || message.sender_gamertag || '';
  const system = /^(stage(?: system)?|system)$/i.test(name.trim()) || (!name && Boolean(Number(message.is_system)));
  return { name: system ? 'STAGE System' : name || 'Unknown sender', avatar: system ? STAGE_SYSTEM_AVATAR : message.sender_avatar_url, system };
}
export function inboxCategory(message = {}) {
  const type = `${message.message_type || ''} ${message.related_entity_type || ''}`.toLowerCase();
  if (/contract|trial|transfer|board/.test(type)) return 'contracts';
  if (/match|schedule|reschedule|fixture/.test(type)) return 'matches';
  if (/tournament|league|competition|cup|reward|trophy|qualification/.test(type)) return 'competitions';
  return 'system';
}
export function inboxNeedsResponse(message) {
  return inboxMessageNeedsAction(message) && getEffectiveInboxActionType(message) !== 'open_match';
}
