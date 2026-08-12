# Profile Tabs Business Logic Analysis

Date: 2026-08-12

Scope:
- `src/pages/Profile.jsx`
- `src/pages/PlayerProfile.jsx`

Constraint:
- Transfer Room is out of scope.
- This is analysis and product logic only. No implementation change is approved by this note.

## Executive Summary

The issue is real: the profile tabs currently do not have one clear business meaning across the owner profile and the public player profile.

The confusing part is not the UI styling. It is that the same labels represent different data domains:

- `Stats` means a basic stored Player stats panel in `Profile.jsx`, but a mixed market-value, stored-stats, derived-club-stats, recent-form, and PvP-record surface in `PlayerProfile.jsx`.
- `Career` means EAFC/FUT match data in both pages, not StageLeagues career history.
- `Matches` means completed PvP history in `Profile.jsx`, but upcoming signed-club fixtures plus PvP history in `PlayerProfile.jsx`.
- `Showcase` exists in the owner profile but not the public profile.
- `Lifestyle` exists in the public profile but not the owner profile.

That makes the business logic hard to explain to players, presidents, scouts, and future developers.

## Current Tab Map

### My Profile (`Profile.jsx`)

Tabs:

- `Posts`: owner feed.
- `Showcase`: bio, management badges, positions, current club card.
- `Stats`: `GamerProfileStatsPanel` using the raw `player` row.
- `Career`: EAFC club link and FUT match log.
- `Matches`: completed PvP solo match history.
- `Trophies`: player trophy cabinet.

Data loaded:

- Player identity from `resolveMyPlayerAndClub()`.
- Management club as `myClub`.
- Signed player club as `signedClub`, derived from contracts/membership.
- Active club memberships.
- Player contracts.
- Completed PvP matches.
- FUT matches and EAFC summary.
- Identity claims.
- Notifications and join requests.

### Public Player Profile (`PlayerProfile.jsx`)

Tabs:

- `Posts`: public player feed.
- `Stats`: market value, stat panel, recent form, PvP record.
- `Career`: EAFC/FUT panel, FUT form chart, FUT match log.
- `Matches`: upcoming signed-club fixtures plus PvP history.
- `Trophies`: achievements and trophy cabinet.
- `Lifestyle`: lifestyle tab, hidden in tournament-limited mode.

Data loaded:

- Player identity by route id.
- Signed club derived from contracts.
- Presided club from `clubs.president_player_id`.
- Contract offers/actions for club viewers.
- Upcoming club fixtures if the player has a signed club.
- MatchPlayerStat rows, excluding friendly matches, used to derive club stats.
- Completed PvP matches.
- FUT matches and EAFC summary.
- Followers/following.

## What The Current Logic Is Trying To Achieve

The current design is trying to make the profile do many jobs at once:

1. Let players manage their own identity and posts.
2. Let presidents/founders appear as Players with management status.
3. Let scouts inspect public performance.
4. Let club presidents offer contracts from public profiles.
5. Let EAFC/FUT external form enrich the profile.
6. Let followers see personality and lifestyle signals.

Those are good goals. The problem is that the tabs are not separating these jobs cleanly.

## What Is Strong

- The President identity cleanup is moving in the right direction. President/Founder is now a Player management status, not a second public identity.
- `signedClub` versus `myClub` in `Profile.jsx` is a good distinction: football employment and club ownership are not the same thing.
- `PlayerProfile.jsx` correctly falls back to the presided club when there is no signed club, so Player + President does not look like a free agent.
- Contract action visibility is guarded by transfer-window and viewer-club logic.
- `GamerProfileHero` already supports separate football role badges and management badges, which is the right foundation.

## Risky Or Confusing Logic

### 1. `Stats` is not the same product surface in both profiles

Owner profile:
- Raw `player.matches_played`, `player.goals`, `player.assists`, `player.avg_match_rating`, etc.

Public profile:
- Market value from `calculatePlayerValue(player)`.
- `GamerProfileStatsPanel` with fallback values from derived `clubStats`.
- Recent form from `player.form_last10`.
- PvP W/D/L derived from `pvpMatches`.

Risk:
- The player sees one version of themselves, while everyone else sees a richer or different version.
- Scouts may trust public stats that the owner cannot easily audit.
- Developers have no single source for “profile stats”.

### 2. `Career` is mislabeled

Current `Career` mostly means:

- EAFC club link.
- FUT match log.
- FUT form chart on the public page.

That is not a StageLeagues career. A StageLeagues career should answer:

- Which clubs did this player represent?
- What contracts did they sign?
- Are they a founder/president?
- What trophies, seasons, divisions, rankings, and milestones define their history?

Risk:
- Players expect a career timeline, but get EAFC/FUT data.
- Presidents and scouts cannot inspect contract/career history from the obvious tab.
- Future career systems will collide with the current tab meaning.

### 3. `Matches` mixes different time concepts

Owner profile:
- Completed PvP solo matches only.

Public profile:
- Upcoming signed-club fixtures.
- Completed PvP history.

Risk:
- A tab named `Matches` contains future fixtures on one page and only completed history on the other.
- Club fixtures depend on signed club status, not president/founder status.
- Presidents without a signed player contract may not show fixtures even if they own a club, which may be correct mechanically but is not obvious.

### 4. `Showcase` and `Lifestyle` are inconsistent

Owner profile has `Showcase`, public profile has `Lifestyle`.

Risk:
- It is unclear whether Showcase is an edit/private owner tool or a public-facing presentation surface.
- It is unclear why Lifestyle is public-viewable but not part of the owner's normal profile tabs.

### 5. A stale club creation path remains in `Profile.jsx`

`_createClub()` still uses generic `stageClient.entities.Club.create(...)` and opens `PresidentContractDialog`.

This conflicts with the newer founder lifecycle rule:

- Player + President club creation should go through the founder lifecycle endpoint.
- The founder flow should create/activate the founder contract, set `clubs.president_player_id`, and attach the player in one backend-owned operation.

Even if `_createClub()` is currently unused, it is dangerous because it documents the old mental model inside the live profile page.

## Product Impact

### Players

Players need to understand:

- “What are my official stats?”
- “What is my career?”
- “Where are my matches?”
- “Why do others see something different?”

Right now, the owner view and public view do not answer those questions consistently.

### Clubs / Presidents

Presidents need profile tabs to support scouting and contracts.

Confusion:
- Public `Stats` is useful, but it mixes stored and derived data without explaining the source.
- Public `Career` does not show contract or club history.
- Founder/president status is visible in the hero, but not clearly represented in career history.

### Scouts

Scouts need verified, comparable player data.

Risk:
- They may treat EAFC/FUT form, StageLeagues stats, and PvP record as the same class of evidence.
- They need clear labels: verified Stage match stats, PvP stats, EAFC-linked form, market value.

### Admins

Admins need simple data rules.

Risk:
- If each profile page derives stats differently, support/debug becomes expensive.
- If dead old club creation code remains, someone can accidentally reactivate a broken path.

## Recommended Product Model

StageLeagues should define profile tabs by business domain, not by component convenience.

### Recommended Tabs

1. `Posts`
   - Social activity and feed posts.
   - Same meaning in owner and public views.

2. `Showcase`
   - Player identity, bio, positions, management badges, current club, media/showcase items.
   - Publicly visible.
   - Owner version may add edit controls, but the meaning stays the same.

3. `Stats`
   - Verified performance numbers only.
   - Split into clear stat groups:
     - StageLeagues club stats.
     - StageLeagues PvP stats.
     - Current rating/value/form.
   - Data source should be centralized so owner and public pages render the same numbers.

4. `Career`
   - StageLeagues career timeline.
   - Active contract.
   - Club history / memberships.
   - Founder/president status.
   - Major trophies and achievements summary.
   - Contract history when allowed by privacy rules.

5. `Matches`
   - Match history.
   - Completed matches only by default.
   - Filters: All, Club, PvP, FUT/EAFC if included.
   - Upcoming fixtures should not live here unless the tab is renamed to `Fixtures & Matches`.

6. `Trophies`
   - Trophy cabinet and achievements.
   - Same meaning in owner and public views.

7. `Lifestyle`
   - Cosmetic/personality layer.
   - Either include in both owner and public profile, or explicitly make it public-only with owner editing elsewhere.

### Where EAFC/FUT Belongs

Current `Career` should not remain EAFC/FUT-only.

Better options:

- Preferred: move EAFC/FUT into `Stats` as an “EAFC Form” section and into `Matches` as a filtered external match history.
- Acceptable: rename the tab from `Career` to `EAFC` or `Form`.
- Not recommended: keep calling EAFC/FUT data `Career`.

## Final Recommended Rules

1. A tab name must mean the same thing in `Profile.jsx` and `PlayerProfile.jsx`.
2. Owner profile and public profile may differ by permissions, not by domain meaning.
3. `Stats` must use one shared data adapter/model for owner and public profiles.
4. `Career` must represent StageLeagues career history, not only EAFC/FUT.
5. `Matches` should be match history. Upcoming fixtures should be moved to an overview/fixtures section, or the tab should be renamed.
6. President/Founder status belongs to Player identity and career history.
7. Football role badges and management badges must remain separate.
8. Contract offer/transfer actions stay on public `PlayerProfile.jsx`, behind existing permission and transfer-window guards.
9. Remove or quarantine stale generic club creation logic from `Profile.jsx`.
10. Transfer Room stays untouched.

## Developer Implementation Notes

Recommended next slice: `Slice 10 - Profile Tabs Business Logic Cleanup`.

Suggested scope:

1. Add a shared profile tab/domain helper, for example:
   - `src/lib/playerProfileTabs.js`
   - `src/lib/playerProfileData.js`

2. Define a canonical tab contract:
   - tabs available by context
   - tab label translation keys
   - domain meaning
   - owner/public visibility
   - tournament-limited visibility

3. Normalize stats input:
   - derive one `profileStats` object used by both pages.
   - include source fields for `stageClub`, `pvp`, `eafc`, and `storedPlayer`.
   - avoid silent fallback differences between owner and public views.

4. Rename or move EAFC/FUT:
   - either move current Career content into `Stats`/`Matches`, or rename current tab to `EAFC`.
   - then reserve `Career` for contracts, memberships, active club, founder/president status, and achievements summary.

5. Align owner/public tabs:
   - Add `Showcase` to public profile, or make it clearly owner-only and rename it to an owner editing concept.
   - Add `Lifestyle` to owner profile if it remains a public identity surface.

6. Move upcoming fixtures:
   - Preferred: show upcoming fixtures in a small overview/career card, not inside `Matches`.
   - Alternative: rename `Matches` to `Fixtures & Matches` and make both pages use that meaning.

7. Remove or quarantine `_createClub()`:
   - Verify it is unused.
   - Remove it if dead.
   - If still needed, route it through `stageClient.clubs.createFounder(...)`.

8. Add focused tests:
   - tab contract returns same meaning for owner/public contexts.
   - tournament-limited mode hides only allowed tabs.
   - Stats adapter returns consistent values for owner/public.
   - Career tab does not render as EAFC-only after cleanup.
   - stale generic founder club creation path is absent.

## Recommended Decision

Use this direction:

- Keep `Posts`, `Showcase`, `Stats`, `Career`, `Matches`, `Trophies`, `Lifestyle`.
- Make `Showcase`, `Stats`, `Career`, `Matches`, and `Trophies` mean the same thing publicly and privately.
- Move EAFC/FUT out of `Career` unless the tab is renamed.
- Make `Career` the serious football-manager-style player CV.
- Make `Stats` the scouting dashboard.
- Make `Matches` the match-history database.

This gives StageLeagues a clearer product language:

- `Stats` = how good you are.
- `Career` = what you have done.
- `Matches` = where the evidence comes from.
- `Showcase` = how you present yourself.
- `Trophies` = what you have won.
