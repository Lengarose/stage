# President-as-Player / Feed / Profile Final Coverage Audit

Date: 2026-08-12

Original prompt:
- Unify President identity into Player profile.
- Keep President as a management view, not a standalone public profile.
- Fix onboarding, club ownership, contracts, Presidents page/profile links, profile tabs, feed likes/comments/media, notifications, admin repair, and Transfer Room naming/restoration.

## Overall Status

The approved development work is substantially complete and automated verification is green after the latest slices.

Remaining items are not normal implementation gaps, except for Transfer Room naming if it is brought back into scope. The main remaining release gate is authenticated browser smoke in a real environment.

## Completed

### President Identity

Status: Done.

- President-only onboarding was removed.
- New onboarding choices are `Create Player` and `Create Player + President`.
- New President flow uses the same Player identity.
- New flows do not create standalone President profiles.
- `clubs.president_player_id` is the canonical public ownership link.
- Legacy President table/routes remain for compatibility.
- `/presidents/:id` redirects to `/players/:id` when safely mapped, otherwise shows a deprecated compatibility state.
- Presidents directory/search derives public presidents from Players + clubs.
- Club president chips/buttons link to Player profiles.
- Header/mobile identity navigation avoids normal `/presidents/:id` identity links.

### Founder / Player + President Lifecycle

Status: Done for approved scope.

- `Create Player + President` goes through a backend-owned founder lifecycle.
- Founder flow creates club, active founder contract, active membership, and canonical `president_player_id`.
- Player + President is not left as a free agent after club creation.
- Retry behavior is idempotent.
- Transaction rollback is used for the founder operation.

Known design boundary:
- Generic ownership contract acceptance remains generic and does not rewrite `clubs.president_player_id` for every ownership contract. Founder ownership is isolated in the founder lifecycle service.

### Profile Identity / Tabs

Status: Done.

- Player profile management badges are separate from football role badges.
- Player + President profiles show President/Founder status on the shared hero.
- Public profile falls back to presided club when no signed football club exists.
- My Profile has `Showcase`.
- The old above-bio OW/OD/OL-style record strip was removed from shared profile hero.
- `Profile.jsx` and `PlayerProfile.jsx` now use canonical tab business rules.
- `Stats`, `Career`, and `Matches` have clearer shared meanings.
- `Career` is now StageLeagues CV-oriented rather than EAFC/FUT-only.
- `Matches` is completed match history; upcoming fixtures moved out of the confusing match-history meaning.

### Feed Likes / Comments / Notifications

Status: Done.

- Likes are server-owned through `stageClient.posts.likeToggle`.
- One like per user per post, with toggle on/off behavior.
- Comment creation is server-owned through `stageClient.comments.createForPost`.
- Comment author identity is derived server-side and returns display name/gamertag-style identity.
- Post like/comment counts are server-owned.
- Notifications are created for non-owner likes/comments.
- Self-like/self-comment notifications are avoided.
- Direct client PATCH of server-owned counters is rejected/preserved.

### Feed Media

Status: Done.

- New feed video uploads are rejected for posts.
- Error copy: `Video uploads are not supported yet. Please upload an image.`
- Old video posts can still render for compatibility.
- Feed images use 1:1 square framing.
- Media metadata is stored/preserved: position, zoom, aspect.
- Composers allow square preview and reposition/zoom for images.
- Global upload endpoint still supports video for non-feed proof/scouting workflows.

### Feed Post Modal

Status: Done.

- Main Social feed media opens an in-app modal.
- PlayerFeed and ClubFeed reuse the shared modal.
- Modal shows large media, owner identity, caption/body, likes, comments, and comment input.
- Modal likes/comments sync returned post state back to the card/modal.
- Existing inline comments remain.

### Admin Identity Repair

Status: Done.

- Admin Identity Repair now repairs toward canonical `clubs.president_player_id`.
- Dry run groups rows as `repairable`, `ambiguous`, `invalid`, and `already_ok`.
- Repair updates only safe, unambiguous club links.
- Repair writes `admin_audit_log`.
- Repair no longer detaches Player-presidents, makes them free agents, cancels founder/ownership contracts, or deletes memberships/staff roles.

Known design boundary:
- Repair does not auto-create missing founder memberships/contracts. Ambiguous or invalid cases are reported for manual/admin follow-up.

### Automated Verification

Status: Done.

Latest developer-reported gates passed:

- `npm run lint`
- `npm run typecheck`
- `node --check server/src/server.js`
- `npm run test:server`
- `npm test`
- `git diff --check`
- `graphify update .`

Recent test counts reported:

- server tests: 289 passing
- frontend/source tests: 149 passing

## Intentionally Not Done

### Transfer Room Naming / Restoration

Status: Intentionally out of scope for these slices.

The original prompt asked for user-facing `Transfers` to become `Transfer Room` and to restore Transfer Room route/navigation if missing.

However, the later instruction was:

> Transfer room doesn't need to be touched

All slices preserved that constraint. Transfer Room scans repeatedly showed no touched Transfer Room files.

Decision needed:
- If Transfer Room is back in scope, create a separate small slice for naming/route/nav verification.
- If Transfer Room remains out of scope, no work is needed there.

## Still Required Before Release

### Authenticated Browser Smoke

Status: Not complete. Environment-blocked.

The code has automated/source verification, but not a true authenticated click-through.

Blocked because:
- local MySQL was not available in this environment.
- no staging URL/credentials were provided.
- production smoke was not approved.

To close this gate, provide one of:

- seeded local MySQL/database config,
- staging URL + disposable test credentials,
- explicit production smoke approval.

Smoke should verify:

- new user -> Create Player,
- new user -> Create Player + President,
- existing player -> create club later,
- President/Founder badge on Player profile,
- Presidents page opens Player profiles,
- club President button opens Player profile,
- My Profile tabs,
- public PlayerProfile tabs,
- Social feed modal likes/comments,
- PlayerFeed/ClubFeed modal likes/comments,
- feed image upload/reposition,
- feed video rejection,
- notifications for likes/comments,
- admin identity repair dry run.

## Final Product Readiness Judgment

Development: mostly complete for approved scope.

Release readiness: not fully closed until authenticated smoke is completed.

Only clear optional development gap: Transfer Room naming/restoration, but that remains excluded unless explicitly re-approved.
