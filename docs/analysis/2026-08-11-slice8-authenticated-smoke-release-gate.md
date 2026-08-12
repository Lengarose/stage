# Slice 8 Analysis: Authenticated Smoke And Final Release Gate

Date: 2026-08-11
Status: Analysis and developer handoff. Implementation delegated separately.
Label: slice8-authenticated-smoke-release-gate
Source branch observed: `codex/president-player-slice1`

## Context

Slice 7 integration QA found no release blockers.

Automated verification passed:
- targeted backend tests 30/30
- targeted frontend/source tests 33/33
- `npm run lint`
- `npm run typecheck`
- `node --check server/src/server.js`
- `npm run test:server` 212/212
- `npm test` 139/139
- `npm run build`
- `git diff --check`
- `graphify update .`

The only material residual risk is that interactive authenticated browser smoke was not completed because the QA environment did not have a seeded authenticated local app session.

## What The Task Is Trying To Achieve

Close the last release-readiness gap with one real authenticated click-through.

This is not a new feature slice.

The goal is to prove a human can move through the changed flows in a running app:
- onboarding intent
- Player + President founder flow
- Player profile President/Founder display
- public President-to-Player routing
- feed image post with framing metadata
- server-owned like/comment behavior
- legacy compatibility does not block navigation

## What Is Strong

- Automated coverage is already broad and clean.
- The branch has no known release blockers.
- A focused smoke pass gives product confidence without adding scope.

## What Is Risky Or Confusing

- If local DB/auth seed is unavailable, smoke may need staging credentials or a documented skip.
- Creating real test data in production would be risky; use local or staging only unless explicitly approved.
- Onboarding flows can be sensitive to localStorage/account-intent state.
- If smoke finds bugs, fixes should stay narrow.

## Logic That Could Break

- Frontend route after founder creation does not refresh auth/player/club state.
- Player + President shows correct DB state but wrong UI state until reload.
- President directory/search links work in source tests but fail with real API data shape.
- Feed image crop metadata saves but does not render after reload.
- Like/comment server actions work in backend tests but UI pending/error states misbehave.

## Final Recommended Rules

1. Use local or staging, not production.
- Do not create test users/data in production without explicit deployment/testing approval.

2. No new features.
- Fix only smoke-discovered bugs.
- If a bug is larger than a quick fix, document it as a release blocker or residual risk.

3. Smoke the highest-risk journey first.
- Create Player + President.
- Confirm founder contract-backed club state.
- Confirm Player profile badge and non-free-agent display.

4. Smoke the public identity journey.
- Presidents directory result opens Player profile.
- Search President result opens Player profile.
- Legacy `/presidents/:id` redirects or degrades safely.

5. Smoke feed/media.
- Create image post.
- Adjust image frame/zoom.
- Reload and verify framing persists.
- Like/comment from another authenticated user if available.
- Confirm owner self-notification is skipped and non-owner notification appears where feasible.

6. Confirm exclusions.
- Transfer Room remains untouched.
- Global video upload remains available where existing proof/scouting flows depend on it, or at least source-confirmed if not smokeable.

## Developer Implementation Notes

Recommended steps:

1. Prepare or identify test account/session.
- Prefer local seeded DB.
- Staging is acceptable if it is safe to create/delete test data.

2. Run app.
- Backend + frontend locally, or staging deployment if already available.

3. Execute smoke checklist:
- Player-only onboarding path.
- Player + President founder path.
- Player profile route/status.
- Presidents directory/search route.
- Feed image create/edit/reload.
- Like/comment server action from available account(s).

4. Run final commands after any fix:
- `npm run lint`
- `npm run typecheck`
- `node --check server/src/server.js`
- `npm run test:server`
- `npm test`
- `npm run build`
- `git diff --check`
- `graphify update .`

5. Produce result note:
- `docs/analysis/2026-08-11-slice8-authenticated-smoke-result.md`
- Include environment used.
- Include account/data setup.
- Include pass/fail smoke checklist.
- Include bugs fixed or blockers.
- Include final release recommendation.

## Recommended Developer Task

Proceed with Slice 8:

> Run one authenticated local or staging browser smoke pass for the completed President-as-Player branch. Do not add features. Fix only smoke-discovered bugs. Verify onboarding, founder contract state, public Player-president routing, profile badges, feed image metadata, server-owned likes/comments, legacy compatibility, and Transfer Room exclusion. Produce a result note with environment, checklist, bugs/blockers, and final release recommendation.

