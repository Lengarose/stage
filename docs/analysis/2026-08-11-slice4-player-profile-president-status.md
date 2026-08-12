# Slice 4 Analysis: Player Profile President Status And Showcase Cleanup

Date: 2026-08-11
Status: Analysis and developer handoff. Implementation delegated separately.
Label: slice4-player-profile-president-status
Source branch observed: `codex/president-player-slice1`

## Context

Slices 1-3 established the new identity model:
- Player is the canonical public identity.
- `Create Player + President` is contract-backed.
- Public President routes/search/directory now point toward Player profiles.

The next inconsistency is inside the profile surfaces themselves:
- `Profile.jsx` and `PlayerProfile.jsx` still contain comments and logic saying President/Owner belongs to a separate President identity.
- `president` and `owner` are filtered out of player role badges.
- My Profile appears to have Posts, Stats, Career, Matches, and Trophies, but not the expected Showcase tab.
- Public PlayerProfile includes Lifestyle, but My Profile does not appear to expose a matching Showcase surface.
- Any old OW/OD/OL form strip above the bio should be removed if still present in the profile hero/layout.

This should be cleaned before feed/media work so the new public identity model is visible and understandable.

## What The Idea Is Trying To Achieve

Make the Player profile carry the President/Founder identity clearly:
- A Player who presides over a Club should show a President/Owner/Founder badge.
- The badge should be derived from canonical club-president data, not from a legacy President profile.
- My Profile and public PlayerProfile should not claim President is separate public identity.
- The user should have a clear Showcase tab/surface for profile presentation.

## What Is Strong

- It closes the loop after routing Presidents to Player profiles.
- It makes the Player profile feel more valuable and complete.
- It reduces confusion for scouts and clubs.
- It keeps the implementation mostly frontend/domain-helper focused, with low backend risk.
- It avoids touching feed/media/notifications before the identity display is stable.

## What Is Risky Or Confusing

- `club_roles` may include president/member/owner values used differently across squad, staff, and ownership logic.
- Showing every non-player role as a normal squad role could pollute football position/role display.
- President badge should not imply better skill rating.
- Existing President-only legacy accounts may lack a completed Player profile.
- My Profile and public PlayerProfile may use different data-loading paths.

## Logic That Could Break

- President badge appears for a Player who is only a staff member, not a club president.
- President badge disappears for founder Players because code still filters `president` out globally.
- Player profile shows "free agent" while also showing President of a Club.
- My Profile tabs and public PlayerProfile tabs drift further apart.
- Removing an old form strip accidentally removes recent-form display from the Career tab, where it may still be useful.

## Effects By Actor

Players:
- Understand that their Player profile is now their public identity for both football and president career.
- Can show founder/president status as reputation.

Clubs:
- Club ownership feels more legitimate because the president's Player profile has visible role context.

Presidents:
- President status becomes a badge/role on the Player profile, not a separate profile journey.

Admins:
- No migration or destructive admin changes needed.
- Admin legacy President tools should be unaffected.

Scouts:
- Can evaluate a Player president from one profile.

## Effects On Rankings, Trophies, Economy, Notifications, And Trust

Rankings:
- President badge must not affect skill ranking or rating.
- Keep ratings based on verified match/tournament performance.

Trophies:
- Do not move trophies in this slice.
- A later slice can add founder/club trophy credit presentation.

Economy:
- No STC changes.
- No contract changes.

Notifications:
- No notification changes.

Trust:
- The trust win is visual consistency: the profile now matches the identity model already implemented in routing and onboarding.

## Better Version Of The Idea

Do not simply add `president` back into the generic player role list.

Better approach:
- Keep football squad role/position separate from management status.
- Add a dedicated `managementBadges` or `profileStatusBadges` helper.
- Derive President/Founder from canonical data:
  - `player.id === club.president_player_id`
  - or player's active club membership has `primary_role = 'president'` / `source = 'founder_contract'`
  - or resolved auth/user president club relation for My Profile
- Render President/Founder as a badge near profile identity/hero, not as a position.

## Final Recommended Rules

1. Player profile is the President profile for public identity.
- Remove comments/copy that say President belongs to a separate public identity.
- Keep legacy President compatibility pages separate.

2. Do not mix football role with management status.
- Football role/position remains striker, CM, CB, etc.
- Management badge/status is President, Owner, Founder, Captain if applicable.

3. President/Founder badge appears when canonical ownership is true.
- Prefer `clubs.president_player_id`.
- Use membership/source fallback only where canonical club data is not loaded.
- Do not infer president status from display text or legacy President profile name.

4. Free-agent display must respect Player + President.
- If Player has active founder club state, do not show them as a free agent.

5. My Profile gets Showcase.
- Add a Showcase tab/surface consistent with the public profile direction.
- Keep it lightweight in this slice; do not build a full media system.

6. Remove OW/OD/OL above bio if present.
- Do not remove useful recent form from the Career/Stats area unless it is the specific hero/bio strip the user wanted removed.

7. Out of scope.
- Transfer Room.
- Feed likes/comments/media backend.
- STC economy.
- Contract lifecycle.
- Trophy migration.
- Admin President transfer tooling.

## Developer Implementation Notes

Likely files to review:
- `src/pages/Profile.jsx`
- `src/pages/PlayerProfile.jsx`
- `src/components/profile/*`
- `src/lib/clubStaffRoles.js`
- `src/lib/clubPresidentAccess.js`
- `src/lib/playerDirectory.js`
- `src/lib/__tests__/playerDirectory.test.mjs`
- `src/lib/__tests__/clubPresidentProfileUi.test.mjs`

Recommended implementation shape:

1. Add a small profile badge helper.
- Example: `src/lib/playerProfileStatus.js`.
- Inputs can include `{ player, club, presidentClub, memberships }`.
- Output should be stable badge objects like `{ id, label, tone, icon }`.

2. Update public PlayerProfile.
- Show President/Founder badge when the viewed player is `club.president_player_id` or resolved equivalent.
- Remove outdated comments that say President identity is separate.
- Keep player positions/roles clean.

3. Update My Profile.
- Show same management badges for current user.
- Add Showcase tab.
- Ensure Player + President does not render as free agent if club-attached.

4. Check hero/bio layout.
- Remove OW/OD/OL form strip above bio if present.
- Leave recent form in Career/Stats if it is not the hero/bio strip.

5. Tests to add/update.
- President/founder Player profile shows management badge.
- Non-president player does not show President badge.
- Football position/role display does not become polluted by `president`/`owner`.
- My Profile includes Showcase tab.
- Player + President profile does not show free-agent state after club attachment.
- No Transfer Room files touched.

## Recommended Developer Task

Proceed with Slice 4:

> Implement Player profile President/Founder status cleanup. Player profiles should visibly carry President/Founder status as management badges derived from canonical `president_player_id`/membership data, while keeping football positions separate. Add My Profile Showcase tab. Remove old OW/OD/OL hero/bio strip if present. Do not touch Transfer Room, feed/media/notifications, STC, contracts, trophies, or admin President transfer tooling.

