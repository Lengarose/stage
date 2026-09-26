/**
 * Canonical page-banner height — matches Transfer Room.
 * Use this on every full-width page hero / banner so heights stay identical.
 */
export const PAGE_BANNER_HEIGHT_CLASS =
  "h-[200px] sm:h-[260px] xl:h-[300px]";

/**
 * Homepage / landing feature images.
 * Height scales with container width so `cover` keeps faces and key subjects
 * visible as the viewport grows (fixed px heights crop harder on wide screens).
 */
export const HOME_FEATURE_IMAGE_CLASS =
  "aspect-[16/10] w-full min-h-[200px] sm:min-h-[240px]";

/** Routes that use PageBannerShell sticky scroll (bounded main + absolute fill). */
const BANNER_STICKY_FULL_BLEED_PATTERNS = [
  /^\/transfer-market(?:\/|$)/,
  /^\/game-day(?:\/|$)/,
  /^\/tournaments\/game-day(?:\/|$)/,
  /^\/leagues\/[^/]+\/?$/,
  /^\/competitions\/[^/]+\/?$/,
  /^\/tournaments\/(?!profile-player|profile-club|game-day)[^/]+\/?$/,
  /^\/profile(?:\/|$)/,
  /^\/players\/[^/]+\/?$/,
  /^\/clubs\/[^/]+\/?$/,
  /^\/presidents\/[^/]+\/?$/,
  /^\/tournaments\/profile-player(?:\/|$)/,
  /^\/tournaments\/profile-club(?:\/|$)/,
];

const SCHEDULE_FULL_BLEED_PATTERNS = [
  /^\/schedule(?:\/|$)/,
  /^\/tournaments\/schedule(?:\/|$)/,
];

export function isBannerStickyFullBleedRoute(pathname = "") {
  return BANNER_STICKY_FULL_BLEED_PATTERNS.some((pattern) => pattern.test(pathname));
}

export function isScheduleFullBleedRoute(pathname = "") {
  return SCHEDULE_FULL_BLEED_PATTERNS.some((pattern) => pattern.test(pathname));
}
