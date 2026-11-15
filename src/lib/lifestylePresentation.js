import { transferRoomPresentation } from './transferRoomPresentation.js';
export const LIFESTYLE_ACCENTS = { ice: '#c2edfa', blue: '#4d8dff', cyan: '#00d4ff', gold: '#f5c542', red: '#ff6575', violet: '#c3a6ff' };
export const LIFESTYLE_PRESENTATION_DEFAULTS = { hero_title: 'Lifestyle', hero_description: 'From your first apartment to your next escape. Discover properties, cars and more for your STAGE life.', accent: 'ice', banner_interval_seconds: 6, banner_slides: [] };
export function lifestylePresentation(raw = {}) {
  const normalized = transferRoomPresentation({ ...LIFESTYLE_PRESENTATION_DEFAULTS, ...raw });
  return { hero_title: normalized.hero_title, hero_description: normalized.hero_description, accent: Object.hasOwn(LIFESTYLE_ACCENTS, raw.accent) ? raw.accent : 'ice', banner_interval_seconds: normalized.banner_interval_seconds, banner_slides: normalized.banner_slides };
}
