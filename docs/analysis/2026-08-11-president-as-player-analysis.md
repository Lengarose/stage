# President-as-Player Unification Analysis

Date: 2026-08-11
Status: Analysis only. No development approved yet.
Label: president-as-player-unification

## Scope

This analysis covers:
- President identity unified into Player profile
- onboarding choices and club creation
- club ownership links
- player/president contract representation
- president pages, directories, profile links, and navigation
- My Profile Showcase tab and OW/OD/OL form-bar removal
- feed likes/comments/media behavior and notifications

Explicitly out of scope:
- Transfer Room
- restoring or renaming Transfers
- changing existing transfer/free-agent/contract-offer pages except where player-president onboarding needs contract creation

## Product Rule

Going forward, President is not a separate public identity.

Canonical identity:
- A user owns an account.
- A user can have one Player profile.
- A Player can be a free agent.
- A Player can belong to a club.
- A Player can also be president of a club.
- President view remains, but it is a management view for the club owned/presided over by that Player.
- Standalone President profile pages should not be used as user-facing identity pages.

Onboarding rules:
- Create Player creates a Player only.
- Create Player leaves the Player as a free agent.
- Create Player does not create a club.
- Create Player does not assign president status.
- Create Player + President creates the Player first, then creates the club.
- Create Player + President cannot end with the Player as a free agent.
- The final Create Player + President state must include: Player, Club, Player attached to Club, active Player contract, president/owner status on the Player, and a President badge/tag on the Player profile.

## Product Analysis

### What This Is Trying To Achieve

This change makes StageLeagues easier to understand:
- Every human user has one public football identity: the Player.
- President becomes a role/status on that Player, not a second persona.
- Clubs still have serious management tools, but the person behind the club is visible through their Player profile.
- Player + President onboarding becomes a complete career start, not a half-created club owner floating outside the squad economy.

### What Is Strong

- It removes duplicate identity systems.
- It makes profiles more valuable because player, owner, reputation, trophies, posts, and club authority can live in one public place.
- It makes scouting and trust easier: scouts, clubs, and players inspect one identity instead of asking whether the President profile or Player profile is the real person.
- It gives Create Player + President a clear reward: you start as a club founder, contracted player, and visible president.

### What Is Risky Or Confusing

- Existing `President` data still exists and must not be deleted.
- Old public president URLs may break unless redirected or safely deprecated.
- Club ownership, user ownership, and player membership currently overlap through several fields.
- A Player + President user could accidentally become both "free agent" and "club owner" if contract and squad updates are not sequenced.
- If the product hides President pages but keeps President management views, navigation must be very clear.

### Logic That Could Break

- A club could have `president_id` but no `president_player_id`.
- A player could have `is_president = true` but no club pointing to that player.
- A Player + President onboarding flow could create a club but fail before contract signing, leaving an owner without a valid squad/player state.
- Legacy President rows could map to the wrong Player if matched by weak data like display name.
- Notifications or search results could still send users to `/presidents/:id`, creating a dead-end identity loop.

### Role Impact

Players:
- Clearer profile identity.
- President badge becomes part of career reputation.
- Player + President cannot stay free agent, so their club identity is serious from day one.

Clubs:
- Club president is now inspectable through the Player profile.
- Club legitimacy improves because owner history and player history can be seen together.

Presidents:
- President remains a powerful management role, but not a separate social identity.
- President view should feel like a dashboard/control room, not a profile.

Admins:
- Need compatibility tools to inspect old President rows.
- Need audit clarity when ownership moves from one Player to another.

Scouts:
- Scouting trust improves because one profile carries player reputation, club authority, trophies, and activity.

### System Impact

Rankings:
- Do not create a separate President ranking yet.
- President status should affect reputation badges and club trust, not player skill ranking.
- Player performance ranking must stay based on matches, tournaments, and verified football outcomes.

Trophies:
- Player profile can show "Club Founder", "President", and club trophies connected to the player-president role.
- Club trophies stay owned by Club, but the president can receive visible role credit.

Economy:
- Player + President must use a real Player contract.
- President management authority should not automatically grant STC income unless the economy explicitly defines president salary later.
- Avoid mixing "president contract" and "player contract" as two paid agreements in v1.

Notifications:
- Ownership/profile redirects must not create duplicate notifications.
- Feed like/comment notifications should use Player identity, not email or President identity.

Trust:
- The biggest trust gain is one canonical identity.
- The biggest trust risk is silent legacy mapping. Only auto-map when user/account relation is strong.

## Current Codebase Findings

### Onboarding

Files:
- `src/pages/Onboarding.jsx`
- `src/components/onboarding/PlayerSetup.jsx`
- `src/components/onboarding/PresidentSetup.jsx`
- `src/components/onboarding/ClubSetup.jsx`

Current behavior:
- Onboarding still offers three choices: Player, President, Player + President.
- President-only flow is wired through `owner_club`.
- Player + President flow creates a Player, then runs identity claim, then enters `ClubSetup`.
- `ClubSetup` still starts with a President profile step.
- `PresidentSetup` explicitly treats president identity as distinct from player identity.
- `ClubSetup` sends a nested `president` payload into club creation.

Conflict with target rule:
- President-only still exists.
- A separate President profile is still collected.
- Player + President does not guarantee player squad membership or an active player contract.

### Backend President Model

Files:
- `server/schema.sql`
- `server/src/server/models/presidentModel.js`
- `server/src/server/controllers/presidentController.js`
- `server/src/server/services/presidentResolutionService.js`
- `server/src/server/services/presidentTransferService.js`

Current behavior:
- `presidents` is a first-class table.
- `clubs.president_id` points to `presidents.id`.
- `presidentController` supports CRUD and transfer for standalone president profiles.
- `presidentResolutionService.ensurePresidentForClub()` creates stub President rows when missing.
- `auth/me` can create/ensure president rows during identity repair.

Conflict with target rule:
- New flows currently create or ensure standalone President rows.
- Existing code assumes `president_id` means a `presidents` row, not a Player.
- Public President routes depend on `presidents`.

### Club Ownership

Files:
- `server/src/server/controllers/clubController.js`
- `server/schema.sql`
- `src/pages/ClubDetail.jsx`

Current behavior:
- Club creation sets `user_id`, `president_user_id`, `owner_email`, and `president_id`.
- Club creation auto-creates or updates a President row.
- Club detail renders `ClubPresidentChip` linking to `/presidents/:id`.
- The backend comment says President identity and Player identity are deliberately separate, and club creation must not place the creator's Player in the squad.

Conflict with target rule:
- Target rule requires the club president to resolve to a Player profile.
- Player + President must not remain free agent.
- Club president links must go to `/players/:id`, not `/presidents/:id`.

### Contracts

Files:
- `server/src/server/controllers/playerContractController.js`
- `server/src/server/models/playerContractModel.js`
- `server/src/server/services/contractRulesService.js`
- `src/components/contracts/OfferContractDialog.jsx`
- `src/components/contracts/PresidentContractDialog.jsx`

Current behavior:
- Player contracts already support weekly salary, signing bonus, performance targets, captaincy, and contract type.
- Wage cap validation exists through `clubFinanceService`.
- `PresidentContractDialog` still expects `president.id` or `club.president_id`.
- President contract copy says role is Club President, 10 years, 0 STC/week.

Conflict with target rule:
- President contract must use Player identity/gamertag.
- Player + President onboarding needs a real player contract and a president/owner representation.
- Current President contract dialog cannot work without a standalone President profile.

### Identity Resolution

Files:
- `src/api/stageClient.js`
- `server/src/server/controllers/authController.js`

Current behavior:
- `resolveMyPlayerAndClub()` resolves `player`, `club`, `presidentClub`, and `president`.
- It explicitly says President accounts may have no Player profile.
- It never synthesizes `player.club_id` from president club ownership.
- `auth/me` returns `president_id`, `president_display_name`, and `president_club_id`.
- `auth/me` may call `ensurePresidentForClub()`.

Conflict with target rule:
- The new rule needs Player identity to be canonical for president ownership.
- `president` should become a derived role/status, not a separate fetched entity for new user-facing flows.

### President Pages and Directory

Files:
- `src/App.jsx`
- `src/pages/Presidents.jsx`
- `src/pages/PresidentProfile.jsx`
- `src/pages/Search.jsx`
- `src/lib/presidentDirectory.js`
- `src/components/Layout.jsx`

Current behavior:
- Routes exist: `/presidents-list` and `/presidents/:id`.
- Presidents page lists `President` entities.
- Search links presidents to `/presidents/:id`.
- Layout contains several president profile/menu links.
- PresidentProfile renders a full standalone profile with history and contracts.

Conflict with target rule:
- Public President directory should list Player presidents.
- Standalone President profile routes should redirect to mapped Player profiles where possible.
- If not mapped, the page should show a safe deprecated state.

### Player Profile and My Profile

Files:
- `src/pages/PlayerProfile.jsx`
- `src/pages/Profile.jsx`

Current behavior:
- Both files intentionally hide `president`/`owner` roles from player role badges.
- Comments say president belongs to separate President identity.
- PlayerProfile tabs include Posts, Stats, Career, Matches, Trophies, and Lifestyle.
- My Profile tabs include Posts, Stats, Career, Matches, Trophies.
- My Profile appears to be missing Showcase.
- Recent FUT form strips exist under Career, not as OW/OD/OL above bio in the inspected slice.

Conflict with target rule:
- President badge/tag must become visible on Player profile.
- My Profile needs Showcase.
- Any OW/OD/OL form bar above bio should be removed if present in hero/layout code.

### Feed Likes, Comments, Media

Files:
- `server/src/server/controllers/postController.js`
- `server/src/server/controllers/commentController.js`
- `server/src/server/models/postModel.js`
- `server/src/server/models/commentModel.js`
- `server/src/server/controllers/uploadController.js`
- `src/components/PlayerFeed.jsx`
- `src/components/ClubFeed.jsx`
- `src/pages/Social.jsx`

Current behavior:
- Post backend is generic CRUD.
- Likes are stored as JSON on `posts.likes`, keyed by email on the frontend.
- There is no dedicated like-toggle endpoint.
- Comments are generic CRUD.
- Comment author display is frontend-supplied and may fall back to email.
- Post/comment notifications are not created in controllers.
- PlayerFeed, ClubFeed, and Social support video upload for posts.
- Shared upload endpoint allows images and videos.

Conflict with target rule:
- One like per user per post needs server-side enforcement.
- Like toggle should create notifications, except self-likes.
- Comment create should increment count, enrich identity, and notify post owner, except self-comments.
- New feed/profile post uploads should reject video.
- Existing old video posts should still render.
- Upload validation must be scoped so match proof/scouting videos are not broken.

## Recommended Phase Split

### Phase 1: President-as-Player Identity and Ownership

Goal:
Make Player the canonical public identity for presidents while preserving old data.

Backend design:
- Add `clubs.president_player_id`.
- Add `clubs.owner_user_id` if current `user_id` is not clear enough.
- Add `clubs.created_by_user_id` if creation audit needs separation from ownership.
- Add `players.is_president` or derive president status from clubs where `president_player_id = players.id`.
- Keep `presidents` table for compatibility, but stop creating it in new flows.
- Add a compatibility resolver that maps old President rows to Player rows by `user_id` or email when safe.
- Prevent new standalone President creation from non-admin/new onboarding flows.
- Change public President listing to query Players joined to Clubs, not `presidents`.

Frontend design:
- Remove President-only onboarding choice.
- Remove PresidentSetup from the new Create Player + President path.
- Club president links go to `/players/:president_player_id`.
- President badge/tag appears on Player profile when player presides over a club.
- `/presidents/:id` becomes compatibility redirect/deprecated state.

### Phase 2: Player + President Onboarding Contract Flow

Goal:
Create a complete player-president final state.

Rules:
- Create Player + President creates Player first.
- Create club with `president_player_id = player.id`.
- Show/use player contract modal.
- Player signs contract.
- Only after signed contract, update player squad membership.
- President/owner status attaches to the Player.
- Captaincy is optional and separate.

Important implementation note:
- Reuse player contract mechanics where possible.
- Do not make president contract depend on `presidents.id`.
- President contract display name must be `player.gamertag`.

### Phase 3: Public Routes, Navigation, and Profiles

Goal:
Remove user-facing standalone President identity.

Changes:
- Presidents page lists Player presidents only.
- Search president results link to player profiles.
- Layout President profile menu item is removed.
- President view remains for management.
- Club president button links to Player profile.
- My Profile gets Showcase tab.
- OW/OD/OL form bar above bio is removed where present.

### Phase 4: Feed Likes, Comments, Notifications, and Media

Goal:
Make feed interactions trustworthy and image-only for new posts.

Backend:
- Add `POST /posts/:id/like-toggle`.
- Add server-side duplicate-like prevention.
- Add notification creation for likes/comments.
- Add comment identity enrichment from Player gamertag.
- Add post media metadata fields: crop x, crop y, zoom, aspect ratio.
- Reject new post videos with: "Video uploads are not supported yet. Please upload an image."
- Do not reject old video posts at render time.

Frontend:
- Remove post video upload controls from PlayerFeed, ClubFeed, and Social.
- Add 1:1 image preview and crop/position controls.
- Make post images open in in-app modal/lightbox.
- Sync likes/comments between card and modal.
- Show commenter gamertag publicly.

## Main Risks

1. Identity migration risk:
Old President rows may not map cleanly to Players. Use safe mapping only. Do not delete old records.

2. Contract sequencing risk:
Player + President cannot become a squad member before signing the Player contract. The onboarding flow must wait for contract acceptance/signing.

3. Data model ambiguity:
`clubs.user_id`, `clubs.president_user_id`, `clubs.president_id`, `users.owner_id`, and `users.player_id` overlap. New fields should use explicit names.

4. Feed scope risk:
Disabling video globally would break match proof/scouting workflows. Only new post/feed media should be image-only.

5. UI navigation risk:
President view must remain, but President profile entry points must disappear. These are not the same thing.

## Recommended First Implementation Slice After Approval

Do not start with feed/media. Start with identity.

Slice 1:
- Add compatibility fields/migrations.
- Stop new club creation from creating President profiles.
- Add `president_player_id` resolution.
- Remove President-only onboarding.
- Convert Create Player + President to create Player + Club linked by `president_player_id`.
- Keep President view available.

Slice 2:
- Add player contract signing into Create Player + President flow.
- Attach Player to club after active contract.
- Add President badge/tag to Player profile.
- Update club president link.

Slice 3:
- Convert Presidents page/search/old profile routes.

Slice 4:
- Feed/media/notification cleanup.

## Final Recommended Rules

1. Create Player:
- Creates or updates one Player profile.
- Player remains a free agent unless they already have an active contract.
- No club is created.
- No president/owner status is assigned.

2. Create Player + President:
- Creates or updates one Player profile.
- Creates one Club.
- Sets `clubs.president_player_id = player.id`.
- Creates a Player contract for that same Player and Club.
- Player joins the club only after the contract is active.
- Player is not allowed to remain free agent after successful completion.
- Player profile shows President/Owner badge.

3. President-only:
- Removed from new onboarding.
- Existing standalone President rows remain for compatibility/admin history only.

4. President public identity:
- New public links should go to Player profiles.
- `/presidents/:id` should become redirect/deprecated compatibility behavior.
- President management view remains available to eligible users.

5. Transfer Room:
- No changes in this work.
- Do not bundle transfer fixes with identity unification.

## Developer Implementation Notes

- Add database fields before changing UI flows.
- Do not delete the `presidents` table in this phase.
- Prefer derived president status from `clubs.president_player_id` over duplicating flags.
- If a cached flag such as `players.is_president` is added, make it repairable and secondary.
- Keep old President routes temporarily, but stop linking to them from new navigation.
- Use strong mapping for legacy data: `presidents.user_id -> players.user_id` first. Do not map by display name alone.
- Treat Player + President onboarding as a transaction-like journey: Player created, Club created, contract created, contract accepted, membership activated.
- If any step fails, show a recoverable state instead of creating a hidden free-agent owner.
- Do not touch Transfer Room in Slice 1.
- Do not touch feed/media in Slice 1.

## Approval Question

Recommended approval target:
Approve Slice 1 only first.

Reason:
It changes the identity foundation but avoids mixing in feed/media and profile polish. Once Slice 1 is stable, Slice 2 can safely handle contracts and squad membership.
