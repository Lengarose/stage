import { lifestylePresentation, LIFESTYLE_ACCENTS } from './lifestylePresentation.js';
export const STANDS_ACCENTS = LIFESTYLE_ACCENTS;
export function standsPresentation(raw = {}) {
  const image = lifestylePresentation({banner_slides:[{url:raw.background_url,position:raw.background_position,zoom:raw.background_zoom}]}).banner_slides[0];
  return {
    background_url: image?.url || '',
    background_position: image?.position || '50% 50%',
    background_zoom: image?.zoom || 100,
    accent: Object.hasOwn(STANDS_ACCENTS,raw.accent) ? raw.accent : 'gold',
  };
}
