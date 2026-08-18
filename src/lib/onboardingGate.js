/**
 * A finished player profile is one the user completed in onboarding.
 * OAuth mints a stub row with a gamertag (and sometimes an avatar) immediately;
 * that must not skip role setup.
 */
export function isFinishedOnboardingProfile(player) {
  return Boolean(String(player?.country || '').trim());
}
