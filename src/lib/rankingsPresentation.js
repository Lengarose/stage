import { LIFESTYLE_ACCENTS } from './lifestylePresentation.js';

export const RANKINGS_ACCENTS = LIFESTYLE_ACCENTS;

export function rankingsPresentation(raw = {}) {
  const accent = Object.hasOwn(RANKINGS_ACCENTS, raw.accent) ? raw.accent : 'blue';
  const zoom = Number(raw.background_zoom);
  const interval = Number(raw.slide_interval_seconds);
  return {
    background_url: typeof raw.background_url === 'string' ? raw.background_url.trim() : '',
    background_position: raw.background_position || '50% 40%',
    background_zoom: Number.isFinite(zoom) && zoom > 0 ? zoom : 100,
    background_slides: (Array.isArray(raw.background_slides) ? raw.background_slides : []).slice(0, 5).map(slide => ({
      url: typeof slide?.url === 'string' ? slide.url.trim() : '',
      position: slide?.position || '50% 40%',
      zoom: Number(slide?.zoom) > 0 ? Number(slide.zoom) : 100,
    })),
    slideshow_enabled: raw.slideshow_enabled === true,
    slide_interval_seconds: Number.isFinite(interval) ? Math.min(30, Math.max(3, interval)) : 8,
    accent,
  };
}
