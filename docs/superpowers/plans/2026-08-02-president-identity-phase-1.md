# President Identity Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a canonical President role so a user can manage a club without needing to be a player, while keeping legacy owner data working.

**Architecture:** Add canonical president fields and identity outputs at the backend boundary, then update frontend identity resolution, onboarding, navigation labels, and contract offer actors to consume that boundary. Legacy `owner_id` and `owner_email` remain as fallbacks during phase 1.

**Tech Stack:** Express, MySQL startup migrations, React 18, Vite, existing stageClient identity helpers.

## Global Constraints

- Do not remove legacy owner fallbacks in phase 1.
- Public UI copy should say `President`, not `Owner`, for club management identity.
- Contract offers are created by a president/user acting for a club; target player identity remains `target_player_id` / legacy `player_contracts.user_id`.
- Tournament entrance signup must still support player tournaments, club tournaments, and tournament-limited users.
- Do not overwrite unrelated user changes in the dirty worktree.

---

### Task 1: Canonical President Identity

**Files:**
- Modify: `server/schema.sql`
- Modify: `server/src/server/migrations/startupMigrations.js`
- Modify: `server/src/server/services/identityService.js`
- Modify: `server/src/server/services/clubOperationsService.js`
- Test: `server/src/server/services/__tests__/identityService.test.js`
- Test: `server/src/server/services/__tests__/clubOperationsService.test.js`

**Interfaces:**
- Produces: `identity.presidentClub`, `identity.presidentClubId`, `identity.roles` including `president`.
- Produces: club access roles exposing `president` for canonical club presidents.

- [ ] Write failing tests for user-only president identity and club permission access.
- [ ] Add nullable `clubs.president_user_id` to schema and startup migrations.
- [ ] Backfill `clubs.president_user_id` from `clubs.user_id`, owner-email matched users, or `users.owner_id`.
- [ ] Resolve president club from `president_user_id` first, then legacy fallbacks.
- [ ] Treat canonical president as full club permissions.

### Task 2: Auth And Frontend Identity Boundary

**Files:**
- Modify: `server/src/server/controllers/authController.js`
- Modify: `src/api/stageClient.js`
- Modify: `src/lib/userIdentityFields.js`
- Test: existing auth identity tests where available.

**Interfaces:**
- Produces `/auth/me` fields: `president_club_id`, `president_club_name`, `owned_club_id` legacy alias.
- Produces frontend `resolveMyPlayerAndClub()` result with `{ user, player, club, presidentClub, activeRoles }`.

- [ ] Write/update tests for `/auth/me` aliases.
- [ ] Include president fields in `/auth/me`.
- [ ] Sync `stage_president_club_id` and legacy `stage_owner_id`.
- [ ] Resolve president club before owner-email fallback.

### Task 3: Onboarding And Role Mode

**Files:**
- Modify: `src/pages/Onboarding.jsx`
- Modify: `src/components/onboarding/ClubSetup.jsx`
- Modify: `src/App.jsx`
- Modify: `src/components/Layout.jsx`
- Modify: relevant translation strings.

**Interfaces:**
- Consumes: `president_club_id`, `activeRoles`.
- Produces: role mode values remain stored compatibly, with display copy changed to President.

- [ ] Add Player + President choice to onboarding.
- [ ] Preserve President-only onboarding path without requiring player setup.
- [ ] Ensure Player + President runs player setup then club setup.
- [ ] Update app completion logic for president-only accounts.
- [ ] Change visible Owner labels in navigation/onboarding to President.

### Task 4: Contract Actor Semantics

**Files:**
- Modify: `server/schema.sql`
- Modify: `server/src/server/migrations/startupMigrations.js`
- Modify: `server/src/server/models/playerContractModel.js`
- Modify: `server/src/server/controllers/playerContractController.js`
- Modify: `server/src/server/functions/legacyFunctions.js`
- Modify: `src/pages/CreateContract.jsx`
- Modify: `src/pages/TransferMarket.jsx`
- Modify: `src/components/contracts/ContractsTab.jsx`

**Interfaces:**
- Produces: `player_contracts.offered_by_user_id` and `offered_by_club_id` for new offers.
- Keeps: `offered_by` legacy string for backward compatibility.

- [ ] Write failing model/controller tests for target player vs president actor separation.
- [ ] Add columns and migrations.
- [ ] Populate actor fields from authenticated user and club permission checks.
- [ ] Update frontend payloads to send `target_player_id` and club context; avoid using player id as actor.
- [ ] Keep inbox delivery working.

### Task 5: Tournament Entrance Check

**Files:**
- Modify: tournament entrance pages as needed.
- Modify: `src/App.jsx` if needed.
- Modify: `src/components/Layout.jsx` if needed.

**Interfaces:**
- Consumes: tournament participant type and identity role fields.

- [ ] Ensure club tournament limited users with president identity land in President layout.
- [ ] Ensure player tournament limited users still complete player onboarding.
- [ ] Ensure signup links do not bypass required identity for participant type.

### Task 6: Verification

**Files:**
- Run only.

- [ ] Run focused backend tests touched by identity/club operations/contracts.
- [ ] Run `npm run lint`.
- [ ] Run `npm run typecheck`.
- [ ] Run `node --check server/src/server.js`.
- [ ] Run `graphify update .`.
