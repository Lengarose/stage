import { lifestylePresentation, LIFESTYLE_ACCENTS } from './lifestylePresentation.js';
export const DISCORD_ACCENTS = LIFESTYLE_ACCENTS;
export const DISCORD_PRESENTATION_DEFAULTS = {
  hero_title: 'DISCORD',
  hero_description: 'The game brings us together. The conversation keeps us connected. Meet the STAGE community beyond the final whistle.',
  accent: 'blue', banner_interval_seconds: 6, banner_slides: [],
};
export function discordPresentation(raw = {}) {
  return lifestylePresentation({ ...DISCORD_PRESENTATION_DEFAULTS, ...raw });
}
