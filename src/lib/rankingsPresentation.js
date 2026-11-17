import { LIFESTYLE_ACCENTS } from './lifestylePresentation.js';

export const RANKINGS_ACCENTS = LIFESTYLE_ACCENTS;

export function rankingsPresentation(raw = {}) {
  const accent = Object.hasOwn(RANKINGS_ACCENTS, raw.accent) ? raw.accent : 'blue';
  const zoom = Number(raw.background_zoom);
  return {
    background_url: typeof raw.background_url === 'string' ? raw.background_url.trim() : '',
    background_position: raw.background_position || '50% 40%',
    background_zoom: Number.isFinite(zoom) && zoom > 0 ? zoom : 100,
    accent,
  };
}
