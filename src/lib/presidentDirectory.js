/**
 * Public president directory eligibility.
 * Ensure/backfill can create stub rows with only user_id/email — hide those until
 * PresidentSetup (or equivalent) filled a public identity.
 */
export function isPublicPresidentProfile(president) {
  if (!president?.id) return false;
  const name = String(president.display_name || "").trim();
  const country = String(president.country_code || "").trim();
  return Boolean(name || country);
}

export function filterPublicPresidentProfiles(presidents) {
  if (!Array.isArray(presidents)) return [];
  return presidents.filter(isPublicPresidentProfile);
}
