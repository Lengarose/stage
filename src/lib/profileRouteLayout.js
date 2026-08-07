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
