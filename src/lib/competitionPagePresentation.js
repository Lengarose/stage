import { REGIONS } from './qualificationConfig.js';
import { lifestylePresentation, LIFESTYLE_ACCENTS } from './lifestylePresentation.js';
export const COMPETITION_PAGE_ACCENTS = LIFESTYLE_ACCENTS;
export const COMPETITION_PAGE_DEFAULTS = {
  gost: { hero_title: 'The global stage.', hero_description: 'Three competitions. One regional pathway. Follow the clubs, the rivalries and the journey to the trophy.', accent: 'ice', banner_slides: [], banner_interval_seconds: 6 },
  regional: { hero_title: 'Regional Leagues', hero_description: 'Find your region. Follow your division. Build a season worth remembering, from the first match to the final table.', accent: 'blue', banner_slides: [], banner_interval_seconds: 6 },
};
export function competitionPagePresentation(kind, raw = {}) {
  let headers = raw.region_headers;
  if (typeof headers === 'string') { try { headers = JSON.parse(headers); } catch { headers = {}; } }
  const region_headers = Object.fromEntries(REGIONS.map(({ slug }) => {
    const image = lifestylePresentation({ banner_slides: [headers?.[slug]] }).banner_slides[0];
    return [slug, image || { url: '', position: '50% 50%', zoom: 100 }];
  }));
  return { ...lifestylePresentation({ ...(COMPETITION_PAGE_DEFAULTS[kind] || COMPETITION_PAGE_DEFAULTS.regional), ...raw }), ...(kind === 'regional' ? { region_headers } : {}) };
}
