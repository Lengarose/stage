# Slice 6 Analysis: Feed Media UX Polish And Interaction Consistency

Date: 2026-08-11
Status: Analysis and developer handoff. Implementation delegated separately.
Label: slice6-feed-media-ux-polish
Source branch observed: `codex/president-player-slice1`

## Context

Slice 5 made feed interactions trustworthy:
- Likes are server-owned.
- Comments/counts are server-owned.
- Notifications exist for non-owner likes/comments.
- New feed posts reject video.
- Old video posts still render.
- Global video upload remains available for proof/scouting workflows.

The remaining feed gap is UX consistency:
- PlayerFeed, ClubFeed, and Social still duplicate feed behavior.
- Uploaded image previews are basic and do not store crop/position metadata.
- Grid thumbnails use `object-cover`, while modals use `object-contain`, so images can feel inconsistent.
- Likes/comments are server-owned, but UI should handle loading/error/retry states cleanly.
- Existing video rendering branches should remain, but new image posts should feel intentionally framed.

## What The Idea Is Trying To Achieve

Make feed posts feel polished and serious:
- New image posts have predictable 1:1 framing.
- Users can adjust image position/zoom before posting.
- Stored crop/position metadata is reused in grids/cards.
- Opening a post shows a reliable in-app modal/lightbox.
- Likes and comments stay synced between grid/card and modal after server actions.
- Duplicate feed components move toward shared behavior without a risky rewrite.

## What Is Strong

- Improves the feel of profiles and club pages immediately.
- Makes posts look more like intentional player/club moments instead of random uploads.
- Builds on Slice 5 trust work instead of changing backend rules again.
- Helps future Showcase/profile media because image-position metadata can be reused.

## What Is Risky Or Confusing

- Full component unification across PlayerFeed, ClubFeed, and Social could become too large.
- Adding crop metadata requires schema/migration if not already present.
- Old posts will not have crop metadata and need safe defaults.
- Overbuilding a full media editor would slow the product down.
- If the modal owns separate post state, counts can drift from the grid/card state.

## Logic That Could Break

- New crop fields are added to model but not schema/startup migrations.
- Old posts without metadata render incorrectly.
- Likes/comments update in modal but not grid/card.
- Image preview uses object position but post render ignores it.
- Social feed handles post cards differently from PlayerFeed/ClubFeed.
- Video legacy rendering breaks while changing image handling.

## Effects By Actor

Players:
- Profile posts look cleaner and more intentional.
- Likes/comments feel responsive but still server-authoritative.

Clubs:
- Club feed becomes a better public presentation surface.
- Club posts can maintain consistent square thumbnails.

Presidents:
- Club presidents get a more polished club communication surface.
- No President identity rules change in this slice.

Admins:
- No admin workflow changes.

Scouts:
- Feed media becomes easier to scan and inspect from Player profiles.

## Effects On Rankings, Trophies, Economy, Notifications, And Trust

Rankings:
- No ranking changes.

Trophies:
- No trophy changes.

Economy:
- No STC changes.

Notifications:
- No notification rule changes beyond preserving Slice 5 behavior.

Trust:
- Trust comes from keeping server-owned interactions intact while improving UI consistency.

## Better Version Of The Idea

Do not build a full media studio.

Better Slice 6:
- Add minimal image framing metadata for posts.
- Reuse an existing image-position editor if one exists in profile/onboarding.
- Apply metadata to thumbnails and modal/image display.
- Add lightweight loading/error states for like/comment actions.
- Extract small shared helpers/components only where duplication is obvious.

## Final Recommended Rules

1. New image posts use 1:1 framing.
- Composer preview should be square or clearly show square crop result.
- User can adjust position/zoom before posting if existing editor can be reused.

2. Store minimal image metadata.
- Suggested fields: `media_position`, `media_zoom`, `media_aspect`.
- If fields are added, update both `server/schema.sql` and startup migrations.
- Old posts default to center position, zoom 1, square/grid-safe aspect.

3. Render consistently.
- Grid/card thumbnails use stored position/zoom.
- Modal/lightbox should show the image cleanly and respect the framing where appropriate.
- Existing old video posts still render.

4. Keep server-owned interaction state.
- Likes call like-toggle.
- Comments call server-owned comment creation.
- Modal and grid/card state update from returned server post.
- Add basic disabled/loading/error handling for actions.

5. Avoid big rewrites.
- Do not merge all feed systems into one large component unless it is small and low risk.
- Small shared helpers/components are okay.

6. Out of scope.
- Transfer Room.
- New video feed uploads.
- Normalized likes table.
- Ranking, STC, trophies.
- Contract lifecycle.
- President identity changes.
- Full Showcase/media backend.

## Developer Implementation Notes

Likely files to review:
- `src/components/PlayerFeed.jsx`
- `src/components/ClubFeed.jsx`
- `src/pages/Social.jsx`
- `src/components/profile/ImagePositionEditor.jsx` or existing image-position components
- `server/src/server/models/postModel.js`
- `server/src/server/controllers/postController.js`
- `server/schema.sql`
- `server/src/server/migrations/startupMigrations.js`
- `src/lib/__tests__/feedTrustMedia.test.mjs`

Recommended implementation shape:

1. Reuse existing image-position UI.
- If `ImagePositionEditor` can be reused cleanly, use it for feed image preview.
- Keep controls simple: drag/position and zoom.

2. Add post media metadata if needed.
- Prefer one JSON/string position field plus numeric zoom if that matches existing profile avatar/banner patterns.
- Keep defaults backward-compatible.

3. Update composers.
- PlayerFeed, ClubFeed, and Social should show square preview with edit/remove.
- Upload still goes through existing upload endpoint.
- Post create includes image metadata.

4. Update renderers.
- Thumbnail/grid rendering respects metadata.
- Modal/lightbox displays image without awkward cropping.
- Video legacy branch stays.

5. Improve interaction UX.
- Disable like while request is in flight for that post.
- Disable comment submit while pending.
- Show small error state/toast if action fails, following existing project patterns.
- Keep state synced from returned server post.

6. Tests to add/update.
- feed post model/controller preserves media metadata
- old posts without metadata use safe defaults in UI helpers
- PlayerFeed/ClubFeed/Social no new video controls
- image metadata is passed on create
- old video rendering branch remains
- like/comment actions still use server actions
- modal/grid state sync expectations remain covered
- Transfer Room untouched

## Recommended Developer Task

Proceed with Slice 6:

> Implement feed media UX polish. Add lightweight image position/zoom metadata for feed posts if needed, reuse existing image-position controls for 1:1 composer previews, render thumbnails/modals consistently, and add basic loading/error handling around server-owned likes/comments. Preserve old video rendering and global video uploads. Do not touch Transfer Room, rankings, STC, trophies, contracts, President identity, or the normalized likes-table future work.

