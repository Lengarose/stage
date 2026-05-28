# Tournament Entrance Gating Design

Date: 2026-05-28  
Owner: Stage League  
Scope: Tournament entrance auth/onboarding, access gating, tournament-scoped pages, admin entrance links

## 1. Goal

Create a dynamic entrance-link flow for tournaments where:

- Visitors coming from an entrance link must sign in or sign up.
- Signup includes onboarding in the same flow.
- New users from this flow are restricted to tournament-only pages until the tournament finishes.
- Existing users with an active plan keep full access even when using entrance links.
- Entrance links expire when the tournament starts.

## 2. User Rules (Source of Truth)

### 2.1 New users from entrance links

- Must pass through:
  - `entrance tournaments signin`
  - `entrance tournaments signup` (with onboarding steps included)
- After account creation and onboarding:
  - access mode is `tournament_limited`
  - can access only:
    - `/tournaments/:id`
    - `/tournaments/game-day`
    - `/tournaments/schedule`
    - `/tournaments/inbox`

### 2.2 Existing users with active plan

- If authenticated and already on an active plan:
  - no restriction is applied
  - full app access remains available
  - entrance link simply acts as a deep link entry

### 2.3 Unlock to standard access

Limited users are automatically upgraded to standard access when either condition is true:

1. tournament status is `completed`
2. current time is after tournament `end_date`

## 3. URL Structure

### 3.1 Public entrance routes

- `/tournaments/entrance/:token/signin`
- `/tournaments/entrance/:token/signup`

### 3.2 Tournament private routes (limited allowlist)

- `/tournaments/:id`
- `/tournaments/game-day`
- `/tournaments/schedule`
- `/tournaments/inbox`

## 4. Admin Link Generation

Admin tournament management gets a new action:

- `Create Entrance Link`

Behavior:

- Server generates secure token.
- Link is tied to one `tournament_id`.
- `expires_at` is set to tournament `start_date`.
- Admin can `revoke` and `regenerate`.
- All actions are written to `admin_audit_log`.

## 5. Data Model

Preferred storage: `league_entities` with `entity_type = 'tournament_entrance_link'`.

Minimum fields in `data_json`:

- `id`
- `tournament_id`
- `token`
- `status` (`active`, `revoked`, `expired`)
- `expires_at`
- `created_by_user_id`
- `created_date`
- `updated_date`

Index/filter requirements:

- unique token lookup
- efficient by tournament lookup
- status and expiry checks

## 6. Validation Rules

Entrance token is valid only if all are true:

1. linked tournament exists
2. link status is `active`
3. now is before `expires_at`
4. tournament has not started (same effective rule as expiry)

Invalid/expired tokens must show a clear entry-denied state with link expiry reason.

## 7. Frontend Architecture

### 7.1 New pages/components

- `EntranceTournamentSigninPage`
- `EntranceTournamentSignupPage` (includes onboarding)
- `TournamentInboxPage` (copied/scoped from existing inbox)
- `TournamentGameDayPage` (copied/scoped from existing Game Day)
- `TournamentSchedulePage` (copied/scoped from existing Schedule)

### 7.2 Route guard behavior

Guard order:

1. active-plan users -> full access
2. limited users -> allow only tournament allowlist routes
3. unauthenticated users on entrance token routes -> allow signin/signup only
4. unauthenticated users elsewhere -> redirect to entrance signin (if token context exists) or normal auth

### 7.3 Navigation constraints for limited users

- Layout tabs and shortcuts must hide all non-allowed destinations.
- Direct URL navigation to blocked routes redirects to `/tournaments/:id`.

## 8. Backend/API Design

New function endpoints (via `functionsController` pattern):

1. `createTournamentEntranceLink`
2. `revokeTournamentEntranceLink`
3. `regenerateTournamentEntranceLink`
4. `resolveTournamentEntranceToken`
5. `applyTournamentEntranceAccessMode`
6. `releaseTournamentLimitedAccessIfEligible`

Access mode handling:

- Store a user-level access mode and source tournament relation for limited users.
- Evaluate release rule (`status=completed OR now>end_date`) on protected-route checks and on login/session refresh.

## 9. Alignment With Existing Competition/League/Tournament Flows

This feature is a gating/shell layer and must not fork core match logic.

It keeps:

- server-side match creation
- server-side result sync
- source linkage (`source_fixture_id`, `source_fixture_type`)
- participant snapshots (`home_*`, `away_*`, player snapshot fields)

Identity expectations:

- Official/regional flows must rely on fixture/source context, not `matches.tournament_id`.
- Legacy community tournaments keep their current `tournaments.id` behavior.

## 10. Error Handling

Required cases:

1. token expired
2. token revoked
3. tournament started
4. tournament not found
5. signup succeeded but onboarding incomplete
6. limited user attempts blocked route

Each case must return deterministic response payloads and user-facing messages.

## 11. Testing Strategy (TDD Required)

All implementation follows red-green-refactor.

Test groups:

1. token validity and expiry by tournament start
2. signin redirect behavior for existing active-plan users
3. signup + onboarding integrated flow
4. limited-route allowlist enforcement
5. unlock to standard access by:
   - `status = completed`
   - `now > end_date`
6. admin create/revoke/regenerate link actions + audit rows
7. tournament-scoped inbox/schedule/game-day filtering

## 12. Parallel Workstreams

Independent tracks:

1. Backend links + access mode APIs
2. Frontend entrance auth/onboarding routes
3. Tournament-scoped page copies (`game-day`, `schedule`, `inbox`)
4. Guard + layout/nav restriction integration

All tracks merge behind passing tests and full verification.

## 13. Out of Scope

- Payment/checkout plan purchase redesign
- Non-tournament campaign landing systems
- Tournament bracket engine rewrites
- Broad global navigation redesign beyond limited-mode requirements

## 14. Acceptance Criteria

1. Admin can generate entrance link that expires when tournament starts.
2. New users from entrance link must signin/signup + onboarding before access.
3. New users are restricted to tournament routes until tournament finishes.
4. Existing active-plan users keep full access.
5. Unlock occurs when tournament is completed or end date is passed.
6. Tournament copies for `game-day`, `schedule`, `inbox` are scoped and reachable.
7. Tests cover route guards, expiry, onboarding, and unlock logic.
