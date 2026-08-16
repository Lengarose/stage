# EAFC App Mobile Parity Plan

Date: 2026-08-12

Web/backend source repo: `/Users/creaafde/Documents/workbench stage/stage`

Mobile app repo: `/Users/creaafde/Documents/eafc/eafc-app`

Scope: Inspect the Expo mobile app, compare it with StageLeagues web/backend changes since 2026-08-11, and define a mobile parity plan before development.

Out of scope: Transfer Room, unless explicitly brought back into scope.

## 1. Current Mobile App Reality

The native mobile app exists at:

`/Users/creaafde/Documents/eafc/eafc-app`

It is an Expo app with:

- Expo SDK 54
- Expo Router
- React Native 0.81
- NativeWind
- Zustand
- Socket.IO client
- `src/api/stageClient.js` for `/api/stage`
- `src/utils/api.js` for older `/api/mobile` compatibility screens

The mobile worktree was clean during this inspection.

## 2. StageLeagues Web/Backend Changes Since 2026-08-11

Recent StageLeagues changes include:

- President identity unified into Player profile.
- President-only onboarding removed on web.
- Player + President founder onboarding moved to backend-owned `POST /api/stage/clubs/founder`.
- Founder lifecycle creates two active long-term contracts:
  - `founder_player`
  - `ownership`
- Public President identity now derives from `clubs.president_player_id` plus Player rows.
- Player profile has separate football badges and management badges.
- Profile tabs were clarified: Posts, Showcase, Stats, Career, Matches, Trophies, Lifestyle.
- Feed likes/comments became server-owned:
  - `POST /api/stage/posts/:id/like-toggle`
  - `POST /api/stage/comments`
- Feed media gained image framing metadata:
  - `media_position`
  - `media_zoom`
  - `media_aspect`
- Feed video uploads were disabled for new feed posts while legacy video rendering remains.
- `post_likes` normalized table exists.
- Competition progression now centralizes final-result advancement through `advanceAfterFinalResult(...)`.
- Admin identity repair now repairs canonical President-as-Player links.
- Gandi DB/OAuth config diagnostics were hardened.
- Match-result/player-stat lifecycle analysis recommends a future central result service, but that is not implemented yet.

## 3. Mobile Parity Gaps Found

### 3.1 Founder Onboarding Is Behind

Mobile file:

`/Users/creaafde/Documents/eafc/eafc-app/src/components/onboarding/ClubSetup.jsx`

Current mobile behavior:

- Has a separate President profile step.
- Calls `stageClient.entities.Club.create(...)`.
- Sends a nested `president` payload.
- Tries to accept a contract afterward through `contractManagement`.

Web/backend current behavior:

- Uses `stageClient.clubs.createFounder(...)`.
- Backend creates Player + Club + membership + `founder_player` contract + `ownership` contract in one lifecycle.
- Player + President should not remain a free agent after founder onboarding.

Risk:

- Mobile founder onboarding can create legacy/incomplete club-president state.
- Mobile may miss the dual founder contracts.
- Mobile can drift from the canonical President-as-Player identity model.

Priority:

Critical.

### 3.2 Mobile API Client Is Missing New Web Wrappers

Mobile file:

`/Users/creaafde/Documents/eafc/eafc-app/src/api/stageClient.js`

Missing or stale compared with web:

- No `stageClient.clubs.createFounder(...)`.
- No `stageClient.posts.likeToggle(...)`.
- No `stageClient.comments.createForPost(...)`.
- `resolveMyPlayerAndClub()` still treats President entity as first-class profile instead of legacy fallback only.

Risk:

- Mobile screens will keep using generic CRUD or `/api/mobile` endpoints for actions that should be backend-owned through `/api/stage`.

Priority:

Critical.

### 3.3 Profile Identity Surface Still Shows Separate President Profile

Mobile files:

- `/Users/creaafde/Documents/eafc/eafc-app/src/app/(tabs)/profile/index.jsx`
- `/Users/creaafde/Documents/eafc/eafc-app/src/app/(tabs)/profile/profilescreen.jsx`
- `/Users/creaafde/Documents/eafc/eafc-app/src/app/(tabs)/profile/presidentprofilescreen.jsx`

Current mobile behavior:

- Profile hub has Player, President, and Club surfaces.
- President screen reads `entities.President`.
- Club surface uses a President chip derived from legacy President profile.

Web current behavior:

- Public President is a management status on Player identity.
- Legacy President route/data remain compatibility only.
- President public links should resolve to Player profile where possible.

Risk:

- Mobile teaches users that President is still a separate public identity.
- Mobile may route to legacy President profiles instead of Player profiles.

Priority:

High.

### 3.4 Profile Tabs Are Not In Web Parity

Mobile file:

`/Users/creaafde/Documents/eafc/eafc-app/src/app/(tabs)/profile/profilescreen.jsx`

Current mobile tabs:

- Matches
- Feed
- Stats
- More

More contains:

- Career
- Showcase
- Trophies
- Lifestyle
- Availability

Web current canonical profile tabs:

- Posts
- Showcase
- Stats
- Career
- Matches
- Trophies
- Lifestyle

Risk:

- Mobile profile meanings differ from web profile meanings.
- Stats and Career remain lighter placeholders on mobile.
- Management badges are not clearly separated from football role badges.

Priority:

High.

### 3.5 Feed Trust/Media Is Behind

Mobile files:

- `/Users/creaafde/Documents/eafc/eafc-app/src/app/social/feedscreen.jsx`
- `/Users/creaafde/Documents/eafc/eafc-app/src/app/social/postdetailscreen.jsx`
- `/Users/creaafde/Documents/eafc/eafc-app/src/hooks/useFeed.js`

Current mobile behavior:

- Uses older `/api/mobile/social/feed`.
- Shows counts.
- Comments are created through `/api/mobile/social/comments`.
- No server-owned `likeToggle`.
- No `createForPost` wrapper.
- No image framing metadata handling.
- No explicit new-video-upload block aligned with web.

Web current behavior:

- Likes/comments are server-owned through `/api/stage`.
- Feed image metadata controls square framing.
- New feed video uploads are rejected.
- Old video rendering remains.

Risk:

- Like/comment trust diverges from web.
- Media rendering differs.
- Counts can drift if compatibility endpoints do not match the hardened backend path.

Priority:

High.

### 3.6 Match Result Proof + Player Stats Is Not Mobile-Ready

Mobile file:

`/Users/creaafde/Documents/eafc/eafc-app/src/app/(tabs)/matches/matchdetailscreen.jsx`

Current mobile behavior:

- Match detail is video-centric.
- It does not expose the Game Day score + screenshot proof submission lifecycle.
- It does not collect club player goal/assist/card events.

Web/backend current status:

- Proof-required score submission exists.
- Dispute/admin review exists.
- Future Slice 15 should centralize match result and player stat lifecycle.

Risk:

- Mobile cannot participate properly in official match result flow.
- If added too early, mobile could duplicate business rules before Slice 15 is finalized.

Priority:

High, but should follow backend Slice 15 or be built as UI over the Slice 15 service.

### 3.7 Competition Progression Visibility Is Basic

Mobile file:

`/Users/creaafde/Documents/eafc/eafc-app/src/app/(tabs)/tournaments/tournamentdetailscreen.jsx`

Current mobile behavior:

- Shows tournament status, teams, bracket/standings link, fixtures.
- Uses older mobile API compatibility path.

Web/backend current behavior:

- Final-result progression hook is hardened.
- Rulebook/tiebreaker hardening remains future work.

Risk:

- Mobile may not show when a group/phase has advanced.
- Mobile may rely on stale `/api/mobile` tournament shapes.

Priority:

Medium-high.

## 4. Recommended Mobile Parity Strategy

### Recommended Approach: Backend-Owned Parity, Mobile As Consumer

Mobile should not copy business logic from web. It should consume backend-owned actions and shared response shapes.

Use this rule:

> If an action affects contracts, identity, official results, player stats, rankings, STC, trophies, or progression, mobile calls a dedicated `/api/stage` action. It does not perform multi-step logic locally.

Why this is best:

- Safer than duplicating web business rules.
- Keeps mobile consistent with web.
- Reduces bugs when backend rules change.
- Works with existing Expo app.

## 5. Proposed Mobile Slices

### Mobile Slice M1: API Client Parity Foundation

Goal:

Bring mobile `stageClient` up to date with the web API client wrappers needed by recent backend changes.

Files:

- `/Users/creaafde/Documents/eafc/eafc-app/src/api/stageClient.js`

Tasks:

- Add `stageClient.clubs.createFounder(body)`.
- Add `stageClient.posts.likeToggle(postId)`.
- Add `stageClient.comments.createForPost(body)`.
- Update `resolveMyPlayerAndClub()` comments and behavior so legacy President entity is compatibility fallback only.
- Preserve `/api/mobile` compatibility for old screens, but do not use it for hardened lifecycle actions.

Acceptance:

- Mobile can call `/api/stage/clubs/founder`.
- Mobile can call `/api/stage/posts/:id/like-toggle`.
- Mobile can call `/api/stage/comments`.
- No mobile lifecycle action uses generic CRUD when a backend-owned action exists.

### Mobile Slice M2: Founder Onboarding Parity

Goal:

Make mobile Player + President onboarding use the backend founder lifecycle.

Files:

- `/Users/creaafde/Documents/eafc/eafc-app/src/components/onboarding/ClubSetup.jsx`
- `/Users/creaafde/Documents/eafc/eafc-app/src/app/auth/onboarding.jsx`
- related onboarding tests

Tasks:

- Remove President-only as a normal onboarding choice if mobile still allows it.
- Keep `Player`.
- Keep `Player + President`.
- For `Player + President`, require an existing Player id.
- Replace `stageClient.entities.Club.create(...)` with `stageClient.clubs.createFounder(...)`.
- Use returned `{ player, club, playerContract, presidentContract, membership }`.
- Store/refresh identity so user lands as a club-attached Player + President.
- Stop creating standalone President profiles in new mobile onboarding.

Acceptance:

- Mobile founder flow creates two contracts through backend lifecycle.
- Player + President is not left as free agent.
- Mobile does not attempt post-create contract acceptance.

### Mobile Slice M3: President-As-Player Profile Parity

Goal:

Make mobile profiles match the public identity model from web.

Files:

- `/Users/creaafde/Documents/eafc/eafc-app/src/app/(tabs)/profile/index.jsx`
- `/Users/creaafde/Documents/eafc/eafc-app/src/app/(tabs)/profile/profilescreen.jsx`
- `/Users/creaafde/Documents/eafc/eafc-app/src/app/(tabs)/profile/presidentprofilescreen.jsx`
- new helpers mirroring web:
  - `src/lib/playerProfileStatus.js`
  - `src/lib/playerProfileTabs.js`

Tasks:

- Treat President as management status on Player.
- Keep `presidentprofilescreen.jsx` only as legacy compatibility or internal detail.
- Show management badges separately from football role badges.
- Use `clubs.president_player_id` where available.
- When a user opens President identity, prefer Player profile with President/Founder badges.

Acceptance:

- Player + President does not look like a free agent.
- Mobile public identity does not push normal users to legacy President entity pages.

### Mobile Slice M4: Profile Tabs And Official Stats Parity

Goal:

Align mobile profile tabs with the canonical profile contract.

Tasks:

- Add canonical tab helper:
  - Posts
  - Showcase
  - Stats
  - Career
  - Matches
  - Trophies
  - Lifestyle
- Keep mobile ergonomics if needed, but preserve meanings.
- Stats tab uses official numbers only.
- Career tab is StageLeagues CV.
- Showcase remains self-authored.

Acceptance:

- Mobile tab meanings match web.
- Official stats and self-authored showcase are not mixed.

### Mobile Slice M5: Feed Trust And Media Parity

Goal:

Make mobile feed use hardened server-owned social actions.

Files:

- `/Users/creaafde/Documents/eafc/eafc-app/src/hooks/useFeed.js`
- `/Users/creaafde/Documents/eafc/eafc-app/src/app/social/feedscreen.jsx`
- `/Users/creaafde/Documents/eafc/eafc-app/src/app/social/postdetailscreen.jsx`
- possible new helper:
  - `src/lib/feedMedia.js`

Tasks:

- Use `/api/stage/posts` or compatible Stage entity reads where practical.
- Use `stageClient.posts.likeToggle`.
- Use `stageClient.comments.createForPost`.
- Render image framing metadata:
  - `media_position`
  - `media_zoom`
  - `media_aspect`
- Keep old video rendering branches if old posts have video.
- Do not add new feed video upload controls.

Acceptance:

- Mobile likes/comments use the same trust path as web.
- Mobile image cards render existing feed image metadata safely.

### Mobile Slice M6: Match Result Proof UX After Backend Slice 15

Goal:

Add mobile UI for official score submission and club event capture, after the backend result lifecycle is centralized.

Tasks:

- Add score input.
- Add screenshot proof upload.
- For club matches, add selected player events:
  - goals
  - assists
  - yellow cards
  - red cards
- Submit to backend-owned lifecycle action.
- Show result states:
  - waiting for other side
  - disputed/admin review
  - completed official

Acceptance:

- Mobile cannot submit official club stats unless the backend validates them.
- Player stats update only after final official result.

### Mobile Slice M7: Competition Progression Visibility

Goal:

Show automatic phase advancement clearly in mobile tournaments.

Tasks:

- Prefer `/api/stage/competition-engine` where available.
- Show phase state, current fixtures, completed groups, qualified teams, and next phase readiness.
- Do not add manual open-next-round actions unless admin-only and backend-owned.

Acceptance:

- Mobile reflects auto progression without inventing progression client-side.

## 6. Recommended Execution Order

1. M1 API Client Parity Foundation.
2. M2 Founder Onboarding Parity.
3. M3 President-As-Player Profile Parity.
4. M4 Profile Tabs And Official Stats Parity.
5. M5 Feed Trust And Media Parity.
6. Backend Slice 15 Match Result Lifecycle.
7. M6 Mobile Match Result Proof UX.
8. M7 Competition Progression Visibility.

Reason:

Mobile onboarding and identity must be fixed before adding more mobile screens. Match result UX should wait until the backend Slice 15 lifecycle is finalized, so mobile does not duplicate fragile result/stat logic.

## 7. Developer Notes

- Work in `/Users/creaafde/Documents/eafc/eafc-app`.
- Do not modify `/Users/creaafde/Documents/workbench stage/stage-app`; that path is obsolete and should be ignored.
- Do not touch Transfer Room.
- Do not create mobile-only business rules for contracts, STC, match finalization, tournament advancement, or stats.
- Prefer narrow source tests because Expo UI verification may need simulator availability.
- Keep `/api/mobile` compatibility for old read screens, but move high-trust actions to `/api/stage`.

## 8. Approval Gate

Recommended next approved development slice:

M1 + M2 together, because mobile founder onboarding cannot be correct without the API wrapper.

Do not start M3-M7 until M1/M2 are verified.
