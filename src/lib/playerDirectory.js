/**
 * Public player directory eligibility.
 * OAuth creates a stub `players` row for every login; president-only onboarding
 * never runs PlayerSetup, so those stubs must stay off /players-list.
 * Completing PlayerSetup always sets `country` (required field).
 */
export function isPublicPlayerProfile(player) {
  if (!player?.id) return false;
  const country = String(player.country || "").trim();
  const countryCode = String(player.country_code || "").trim();
  return Boolean(country || countryCode);
}

export function filterPublicPlayerProfiles(players) {
  if (!Array.isArray(players)) return [];
  return players.filter(isPublicPlayerProfile);
}
