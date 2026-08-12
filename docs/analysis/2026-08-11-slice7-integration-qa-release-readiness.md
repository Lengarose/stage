# Slice 7 Analysis: Integration QA And Release Readiness For President-as-Player Work

Date: 2026-08-11
Status: Analysis and developer handoff. Implementation delegated separately.
Label: slice7-integration-qa-release-readiness
Source branch observed: `codex/president-player-slice1`

## Context

Slices 1-6 are developer-reported complete and individually verified.

The branch now includes changes across:
- onboarding intent
- club creation
- founder contract lifecycle
- President-as-Player identity
- legacy President compatibility
- public routes/search/directory
- Player profile badges and Showcase
- posts, comments, likes, notifications
- feed image metadata and rendering
- schema and startup migrations

This is too much surface area to continue adding features without an integration pass.

## What The Task Is Trying To Achieve

Prove that the full product journey is coherent end to end:
- A new user can choose `Create Player`.
- A new user can choose `Create Player + President`.
- Player + President completes with Player, Club, active founder contract, active membership, and president status.
- Public pages route to Player identity.
- Player profile displays President/Founder correctly.
- Feed posts, likes, comments, notifications, and media metadata work together.
- Legacy President compatibility still degrades safely.
- Transfer Room remains untouched.

## What Is Strong

- Individual slices are passing focused and full automated checks.
- Architecture has stayed scoped: legacy President preserved, founder lifecycle isolated, feed trust centralized.
- The work now has enough shape for a serious release-readiness audit.

## What Is Risky Or Confusing

- Tests passing does not prove the full onboarding-to-profile journey works in the browser.
- Local storage/account intent transitions may behave differently across new users, old users, and upgraded users.
- Schema and startup migrations changed multiple times and need a fresh-install/upgrade sanity check.
- Legacy President compatibility may work in tests but still feel confusing in UI copy.
- Feed media metadata can render correctly in components but still look awkward at actual viewport sizes.

## Logic That Could Break

- Player-only onboarding accidentally prompts club creation.
- Player + President creates a club but does not show the right club/profile state after redirect.
- Founder contract exists but membership/profile badge display lags.
- `/presidents/:id` redirect loops or lands on missing Player.
- Search/directory points to Player profiles but data shape differs in production.
- Feed like/comment counts update in modal but not list.
- Video upload remains globally allowed but feed API correctly rejects video posts.
- Startup migration misses a column added to `schema.sql`, or the reverse.

## Effects By Actor

Players:
- Need clean onboarding and profile identity.

Clubs:
- Need founder club state to be stable and inspectable.

Presidents:
- Need management authority without a second public identity.

Admins:
- Need legacy President tools and audits to remain usable.

Scouts:
- Need search/profile routes to be reliable.

## Effects On Rankings, Trophies, Economy, Notifications, And Trust

Rankings:
- Confirm no social/president status changes affect rankings.

Trophies:
- Confirm no trophy regressions from profile changes.

Economy:
- Confirm founder contract defaults do not create unexpected STC movement.

Notifications:
- Confirm likes/comments notify only non-owner post owners.

Trust:
- Integration QA is a trust gate before deployment or new feature work.

## Better Version Of The Task

Do not add a new feature.

Better Slice 7:
- Run a targeted code review/diff review.
- Run full automated verification.
- Add missing tests only for real integration gaps.
- Do a browser/manual smoke plan if local app can run.
- Produce a release-readiness report with pass/fail items and any blockers.

## Final Recommended Rules

1. No feature expansion.
- Fix bugs found by QA.
- Do not add new product systems.

2. Protect scope.
- Transfer Room remains out of scope except confirming it was untouched.
- Do not reopen `weakest/highest-risk` unless the user asks with that label.

3. Verify DB consistency.
- Any columns in `server/schema.sql` must exist in startup migrations.
- Any startup migration columns must exist in `server/schema.sql`.

4. Verify identity journeys.
- Player-only remains free agent.
- Player + President becomes club-attached via founder contract.
- President public identity resolves to Player profile.

5. Verify feed journeys.
- New image post with metadata renders correctly.
- Old image post without metadata renders safely.
- Old video post renders.
- New video feed post is rejected.
- Like/comment counts and notifications behave as intended.

6. Produce a report.
- The developer should create a concise result note in `docs/analysis/`.
- Include any blockers, fixes, test results, and residual risks.

## Developer Implementation Notes

Recommended QA checklist:

1. Diff review:
- identity/auth/onboarding
- club/founder lifecycle
- player profile/status
- president compatibility
- post/comment/feed trust
- media metadata/schema/migration

2. Automated verification:
- `npm run lint`
- `npm run typecheck`
- `node --check server/src/server.js`
- `npm run test:server`
- `npm test`
- `git diff --check`
- `graphify update .`

3. Targeted integration tests if missing:
- Player + President lifecycle response feeds profile status helper.
- `Club.filter({ president_player_id })` supports profile lookup.
- post media metadata survives create/read/update.
- old video render branch stays.

4. Browser/manual smoke if feasible:
- Create Player path.
- Create Player + President path.
- open Player profile after founder flow.
- open Presidents directory/search result to Player profile.
- create image feed post, adjust crop, like/comment from another account if seeded users support it.

5. Report:
- Create `docs/analysis/2026-08-11-slice7-integration-qa-result.md`.
- Include exact commands run and outcomes.
- Include manual smoke results or why manual smoke was not possible.
- Include release blockers or state "No release blockers found."

## Recommended Developer Task

Proceed with Slice 7:

> Run an integration QA and release-readiness pass for Slices 1-6. Do not add features. Fix only bugs found by QA. Verify identity, founder contract, public profile routing, profile badges, feed trust, media metadata, notifications, schema/migration consistency, and untouched Transfer Room scope. Produce a concise result note with commands, smoke coverage, blockers, and residual risks.

