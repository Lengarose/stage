# Slice 3 Analysis: Public President Identity Moves To Player Profiles

Date: 2026-08-11
Status: Analysis and developer handoff. Implementation delegated separately.
Label: slice3-public-president-player-profile
Source branch observed: `codex/president-player-slice1`

## Context

Slice 1 unified the identity foundation around `clubs.president_player_id`.
Slice 2 made `Create Player + President` contract-backed through a founder lifecycle service.

The next product problem is public identity drift:
- The app still has `/presidents-list`.
- The app still has `/presidents/:id`.
- Search still fetches `President` entities and links to `/presidents/:id`.
- Club detail still links the club president chip to a President profile when using legacy `president_id`.
- Layout still exposes President profile/menu routes.

This conflicts with the new product rule:
President is no longer a separate public identity for new flows. The Player profile is the public identity.

## What The Idea Is Trying To Achieve

Make every public "President" surface resolve to a Player profile:
- President directory should become a directory of Player presidents.
- Search President results should point to `/players/:player_id`.
- Club president chips should point to the canonical Player profile when `president_player_id` is available.
- Header/menu President identity should open the Club management/view path, not a standalone President profile.
- Old `/presidents/:id` URLs should not break; they should redirect to the mapped Player when possible or show a deprecated compatibility state.

## What Is Strong

- It makes the product easier to understand.
- It protects trust: one public identity, one reputation surface.
- It increases the value of Player profiles.
- It avoids confusing scouts and clubs with duplicate President/Player personas.
- It preserves legacy President records without continuing to promote them publicly.

## What Is Risky Or Confusing

- Admin tools may still need legacy President rows, especially `PresidentTransferDialog`.
- Legacy President rows may not safely map to Player rows.
- Some club/schedule systems still store president ids for historical messages or match arranging.
- Removing public President routes too aggressively can break old links.
- Layout has both desktop and mobile identity menu logic, so route cleanup must cover both.

## Logic That Could Break

- A President directory card links to `/players/undefined`.
- A legacy President URL redirects to the wrong Player by display name.
- Club detail hides the president if no `president_player_id` exists but a legacy `president_id` exists.
- Header identity menu points to a dead `/presidents/:id` route.
- Admin President transfer tools break because public cleanup accidentally removed legacy President admin flows.
- Search still returns old President entities, creating duplicate search results beside Player results.

## Effects By Actor

Players:
- Player profile becomes the single public reputation page.
- President/Owner badge makes role visible without creating a second profile.

Clubs:
- Club legitimacy improves because visitors can inspect the real Player behind the club.
- Clubs with legacy President data need graceful fallback instead of broken chips.

Presidents:
- President role becomes management authority plus public Player badge.
- President view remains a club dashboard/control mode, not a public profile.

Admins:
- Keep legacy President tools available.
- Need no destructive migration in this slice.

Scouts:
- Search and club pages should lead scouts to Player profiles.
- Duplicate President/Player results should be reduced.

## Effects On Rankings, Trophies, Economy, Notifications, And Trust

Rankings:
- Do not add President rankings.
- Do not let president status alter skill rating.

Trophies:
- Player profile can show President/Founder badge or club role history.
- Do not move club trophies into personal trophies in this slice.

Economy:
- No STC changes in Slice 3.
- Do not modify contracts or founder lifecycle.

Notifications:
- Notification links involving president identity should prefer Player profile or Club page where practical.
- Do not build the full feed/notification cleanup yet.

Trust:
- Public pages must stop implying there are two identities.
- Legacy links should degrade safely, not vanish.

## Better Version Of The Idea

Do not simply delete President pages.

Better approach:
- Keep legacy President routes as compatibility shells.
- Redirect `/presidents/:id` to `/players/:mapped_player_id` when mapping is strong.
- Show a deprecated compatibility state when mapping is unavailable.
- Rebuild Presidents directory/search around Players who are presidents via `clubs.president_player_id`.
- Keep admin President tools intact until a later admin migration.

## Final Recommended Rules

1. Public President identity is Player profile.
- New public links must target `/players/:player_id`.
- President badge/tag appears on Player profile for Players linked through `clubs.president_player_id`.

2. Presidents directory becomes Player-president directory.
- It lists Players who currently preside over Clubs.
- It should include club name/tag/logo, country, gamertag, avatar, and President/Founder status.
- It should not list standalone President rows unless used only as legacy fallback with clear handling.

3. Search President tab should use Player presidents.
- Results link to `/players/:id`.
- Avoid duplicate identity results where the same person appears in Players and Presidents.

4. Club president chip should prefer `president_player_id`.
- Primary link: `/players/:president_player_id`.
- Fallback: mapped legacy President -> Player.
- Last fallback: non-clickable/deprecated President label or old compatibility route if unavoidable.

5. `/presidents/:id` becomes compatibility behavior.
- If legacy President maps safely to Player by `user_id`, redirect to `/players/:player_id`.
- If not safe, show a small deprecated state explaining the public identity moved to Player profiles.

6. Header/menu President identity should not link to standalone President profile.
- President/account club mode should open the Club path or management view.
- Player profile remains the personal profile link.

7. Admin legacy President tools stay.
- Do not break `PresidentTransferDialog` or admin President transfer/history routes.
- Do not delete `PresidentProfileEdit` or legacy components unless all usages are safely removed.

8. Out of scope.
- Transfer Room.
- Feed/media/notifications cleanup.
- Contract lifecycle changes.
- STC economy changes.
- Trophy migration.

## Developer Implementation Notes

Likely files to review:
- `src/App.jsx`
- `src/pages/Presidents.jsx`
- `src/pages/PresidentProfile.jsx`
- `src/pages/Search.jsx`
- `src/pages/ClubDetail.jsx`
- `src/components/Layout.jsx`
- `src/lib/presidentDirectory.js`
- `src/lib/profileRouteLayout.js`
- `src/api/stageClient.js`
- `server/src/server/controllers/clubController.js`
- `server/src/server/controllers/playerController.js`
- `server/src/server/controllers/presidentController.js`

Recommended implementation shape:

1. Add or expose a backend/query helper for Player presidents.
- It can be a dedicated read endpoint, a controller filter, or an existing entity query if already sufficient.
- Data should be based on Clubs joined to Players through `clubs.president_player_id`.

2. Update Presidents page.
- Rename internally if useful, but keep `/presidents-list` route for now.
- Fetch Player presidents instead of public President rows.
- Link cards to `/players/:player_id`.

3. Update Search.
- President results should come from Player presidents.
- Links target `/players/:id`.

4. Update ClubDetail president chip.
- Prefer `club.president_player_id`.
- Display Player gamertag/avatar when available.
- Link to Player profile.

5. Update Layout identity menu.
- Remove public President profile route target.
- Club mode identity goes to `/clubs/:club_id` or relevant club management surface.
- Player mode identity goes to `/profile`.

6. Update PresidentProfile compatibility page.
- Try safe mapping from legacy President to Player by `user_id`.
- Redirect to Player profile when found.
- Otherwise show deprecated compatibility content.

7. Update tests.
- Presidents directory links to `/players/:id`.
- Search President results link to `/players/:id`.
- Club president chip prefers `president_player_id`.
- Layout no longer builds `/presidents/:id` as the main identity target.
- Legacy `/presidents/:id` compatibility remains.
- Admin President transfer dialog remains intact.

## Recommended Developer Task

Proceed with Slice 3:

> Implement public President identity cleanup so Player profiles are the public President identity. Presidents directory, Search, Club president chip, and Layout identity menu should point to Player/Club surfaces, not standalone President profiles. Keep legacy `/presidents/:id` as redirect/deprecated compatibility. Preserve admin President tooling. Do not touch Transfer Room, feed/media, contracts, STC, or trophies.

