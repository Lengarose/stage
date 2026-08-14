const FULL_BLEED_PROFILE_ROUTE_PATTERNS = [
  /^\/profile(?:\/|$)/,
  /^\/players\/[^/]+\/?$/,
  /^\/clubs\/[^/]+\/?$/,
  /^\/presidents\/[^/]+\/?$/,
  /^\/tournaments\/profile-player(?:\/|$)/,
  /^\/tournaments\/profile-club(?:\/|$)/,
];

export function isProfileFullBleedRoute(pathname = "") {
  return FULL_BLEED_PROFILE_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

const FULL_BLEED_GAME_DAY_ROUTE_PATTERNS = [
  /^\/game-day(?:\/|$)/,
  /^\/tournaments\/game-day(?:\/|$)/,
];

export function isGameDayFullBleedRoute(pathname = "") {
  return FULL_BLEED_GAME_DAY_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

export function isTransferMarketFullBleedRoute(pathname = "") {
  return /^\/transfer-market(?:\/|$)/.test(pathname);
}

export function isFullBleedRoute(pathname = "") {
  return isProfileFullBleedRoute(pathname)
    || isGameDayFullBleedRoute(pathname)
    || isTransferMarketFullBleedRoute(pathname);
}
