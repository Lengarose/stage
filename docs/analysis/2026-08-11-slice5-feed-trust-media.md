# Slice 5 Analysis: Feed Trust, Likes, Comments, Notifications, And Media Rules

Date: 2026-08-11
Status: Analysis and developer handoff. Implementation delegated separately.
Label: slice5-feed-trust-media
Source branch observed: `codex/president-player-slice1`

## Context

The President-as-Player identity work is now coherent through onboarding, contracts, public routes, and Player profile badges.

The next high-value product gap is feed trust:
- Likes are currently patched from the frontend by editing `posts.likes` and `likes_count`.
- Comments are created through generic CRUD, then the frontend patches `comments_count`.
- Notifications are not created for feed likes/comments.
- Comment author identity can be frontend-supplied and may fall back to email.
- PlayerFeed, ClubFeed, and Social still allow new video uploads for posts.
- The global upload endpoint allows video, and that must remain because match proof/scouting workflows may need video.

## What The Idea Is Trying To Achieve

Make social feed interactions trustworthy without adding bad complexity:
- One server-owned like toggle.
- One server-owned comment creation path.
- Server-maintained counts.
- Player identity enrichment for authors.
- Notifications for likes/comments where useful.
- Image-only new feed posts.
- Existing old video posts still render.
- Match proof/scouting video upload stays intact.

## What Is Strong

- Prevents like-count cheating and duplicate likes.
- Makes comments more reliable by keeping count updates server-side.
- Improves engagement with notifications.
- Protects platform trust because public interaction counts become authoritative.
- Keeps scope narrow by using existing post/comment structures first.

## What Is Risky Or Confusing

- Current likes are stored as JSON on `posts.likes`, not a normalized likes table.
- JSON likes can work for now, but concurrency/race conditions remain weaker than a dedicated table.
- Notifications may spam users if self-likes/self-comments are not excluded.
- Removing video globally would break non-feed features.
- Existing video posts must not disappear or crash.
- PlayerFeed, ClubFeed, and Social duplicate similar feed logic, so changes must be consistent.

## Logic That Could Break

- User clicks like twice quickly and count becomes wrong.
- Two tabs update likes and overwrite each other.
- Frontend still patches likes directly after server action is added.
- Comment create succeeds but count update fails.
- Comment owner receives a notification for their own comment.
- Post owner receives duplicate notifications on unlike/re-like loops.
- New feed video upload is blocked in UI but still accepted by API.
- API blocks all video uploads and breaks match proof/scouting.

## Effects By Actor

Players:
- Like/comment counts become more trustworthy.
- Notifications bring users back to profile/club posts.
- Gamertags should appear instead of email where possible.

Clubs:
- Club feed becomes more credible and less easy to manipulate.
- Club members can interact without count drift.

Presidents:
- Club presidents benefit from cleaner club-feed engagement.
- No President identity changes should be introduced here.

Admins:
- Less manual cleanup from broken counts.
- No admin workflow should be changed in this slice.

Scouts:
- Profile comments and engagement become more reliable signals.

## Effects On Rankings, Trophies, Economy, Notifications, And Trust

Rankings:
- Likes/comments must not affect competitive rankings.
- Do not add social popularity into player rating.

Trophies:
- No trophy changes.

Economy:
- No STC changes.
- Do not reward likes/comments with STC in this slice.

Notifications:
- Like notification: notify post owner when another user likes their post.
- Comment notification: notify post owner when another user comments.
- No self-notifications.
- Link should point to the relevant Player, Club, or Social post context where the app can handle it.

Trust:
- Server-owned actions are the trust improvement.
- Counts should be corrected by server responses, not optimistic-only frontend state.

## Better Version Of The Idea

Do not build a full social graph rewrite yet.

Better Slice 5:
- Keep `posts.likes` JSON for compatibility.
- Add `POST /api/stage/posts/:id/like-toggle`.
- Add comment creation action that enriches author identity and updates post count in one backend-owned path.
- Let existing old videos render.
- Reject new feed post creation with `media_type = 'video'` in post controller.
- Keep upload endpoint broad, or add an optional context guard later instead of removing video globally.

Future improvement:
- Normalize likes into `post_likes` if concurrency or scale becomes a real issue.

## Final Recommended Rules

1. Likes are server-owned.
- Frontend must call `POST /posts/:id/like-toggle`.
- Server determines liked/unliked state from authenticated user.
- Server updates `likes` and `likes_count`.
- Server returns the updated Post.

2. Comments are server-owned for feed UX.
- Frontend should not manually patch `comments_count`.
- Server enriches comment author from authenticated Player/user where possible.
- Server creates comment and increments `posts.comments_count`.
- Server returns created Comment and updated count/post if practical.

3. Notifications are server-created.
- Like notification only when actor is not the post owner.
- Comment notification only when actor is not the post owner.
- Use Player gamertag/display name when available.
- Keep notification payload/link simple and consistent.

4. New feed posts are image-only.
- `media_type = 'video'` should be rejected by post creation/update for feed posts.
- Error copy: "Video uploads are not supported yet. Please upload an image."
- Existing old video posts still render.

5. Upload endpoint must not globally block video.
- Match proof/scouting/video-specific workflows must keep working.
- If context-specific upload validation is added, it must distinguish feed post uploads from other upload types.

6. Do not expand scope.
- No ranking changes.
- No STC rewards.
- No trophy changes.
- No Transfer Room.
- No President identity changes.

## Developer Implementation Notes

Likely files to review:
- `server/src/server/controllers/postController.js`
- `server/src/server/controllers/commentController.js`
- `server/src/server/models/postModel.js`
- `server/src/server/models/commentModel.js`
- `server/src/server/models/notificationModel.js`
- `server/src/server/routes/registerStageRoutes.js`
- `src/components/PlayerFeed.jsx`
- `src/components/ClubFeed.jsx`
- `src/pages/Social.jsx`
- `src/api/stageClient.js`

Recommended implementation shape:

1. Add backend like action.
- `POST /api/stage/posts/:id/like-toggle`.
- Derive actor from `req.user`.
- Use email or user id consistently with existing `posts.likes` storage; prefer a stable authenticated identifier if compatibility allows.
- Return updated Post.

2. Add backend comment action or strengthen comment POST.
- Prefer strengthening `POST /comments` if that is the existing route.
- Require `post_id` and content.
- Derive `author_email`, `author_name`, `author_avatar` server-side where possible.
- Create comment and increment `posts.comments_count` together.
- Return created comment and/or updated post count.

3. Add notifications.
- Use `Notification` model.
- Avoid self-notifications.
- Use post owner email as recipient.
- Use links the frontend can handle now.

4. Add feed post media validation.
- Reject new `Post.create` and relevant `Post.update` attempts where `media_type === 'video'`.
- Do not break read/render of existing video posts.
- Do not restrict upload endpoint globally.

5. Update frontend.
- `PlayerFeed`, `ClubFeed`, and `Social` should call like-toggle, not `Post.update` for likes.
- They should call server-owned comment creation, not manually patch `comments_count`.
- Remove new video upload controls from feed composer UI.
- Keep old video rendering branches.

6. Tests to add/update.
- like-toggle likes once and unlikes on second toggle
- duplicate/rapid toggles do not corrupt count in basic server tests
- like notification created for non-owner, skipped for owner
- comment creation increments post count server-side
- comment notification created for non-owner, skipped for owner
- feed post creation rejects `media_type = 'video'`
- existing video post rendering remains in frontend source/tests
- upload endpoint still allows video generally
- Transfer Room untouched

## Recommended Developer Task

Proceed with Slice 5:

> Implement feed trust and media rules. Add server-owned post like toggle, server-owned comment creation/count update, post-owner notifications for likes/comments, and image-only new feed posts while preserving old video rendering and non-feed video uploads. Update PlayerFeed, ClubFeed, and Social to use the new server actions. Do not touch Transfer Room, rankings, STC, trophies, or President identity.

