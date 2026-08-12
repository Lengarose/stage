# Dual Contract Founder Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Create Player + President founder onboarding create and return one active player-group founder contract plus one active ownership/president contract for the same Player and Club.

**Architecture:** Keep the lifecycle backend-owned in `founderContractLifecycleService.js`. Model founder as metadata on two contract documents: `founder_player` for the player group and `ownership` for president/management. Preserve legacy `founder` contracts as player-side compatibility rows.

**Tech Stack:** Node.js, Express, MySQL, React/Vite source guards, `node:test`.

## Global Constraints

- Do not touch Transfer Room.
- Do not implement tournament progression in Slice 13.
- Same person, same Player id, same Club id, two active long-term contracts in different contract groups.
- Player-only onboarding remains free agent and does not create ownership contracts.
- Retry/idempotency reuses both existing founder contracts and does not duplicate either one.
- Legacy single `founder` contracts remain readable as founder metadata.

---

### Task 1: Founder Lifecycle Dual Contracts

**Files:**
- Modify: `server/src/server/services/__tests__/founderContractLifecycleService.test.js`
- Modify: `server/src/server/services/founderContractLifecycleService.js`

**Interfaces:**
- Produces: `createFounderContractLifecycle(input)` returning `{ contract, playerContract, presidentContract, contracts, club, player, membership }`.
- Compatibility: `contract` remains the player-side contract for old callers.

- [ ] **Step 1: Write failing tests**

Add tests that assert successful founder onboarding creates `founder_player` and `ownership`, retry reuses both, and legacy `founder` rows are reused as player-side compatibility.

- [ ] **Step 2: Run focused tests to verify RED**

Run: `node --test server/src/server/services/__tests__/founderContractLifecycleService.test.js`

- [ ] **Step 3: Implement minimal service changes**

Replace single-contract creation with a helper that ensures one player-side founder contract and one ownership contract by type/idempotency note.

- [ ] **Step 4: Run focused tests to verify GREEN**

Run: `node --test server/src/server/services/__tests__/founderContractLifecycleService.test.js`

### Task 2: Controller Response Contract

**Files:**
- Modify: `server/src/server/controllers/__tests__/clubController.test.js`

**Interfaces:**
- Consumes: founder lifecycle result from Task 1.
- Produces: `/clubs/founder` response exposing both `playerContract` and `presidentContract`.

- [ ] **Step 1: Update controller test mock and assertions**

Assert the founder controller response preserves `contract` compatibility and includes both named contracts.

- [ ] **Step 2: Run focused controller tests**

Run: `node --test --test-name-pattern "founder" server/src/server/controllers/__tests__/clubController.test.js`

### Task 3: Frontend Display Compatibility

**Files:**
- Modify: `src/lib/__tests__/playerProfileStatus.test.mjs`
- Modify: `src/lib/__tests__/contractTypeLabels.test.mjs`
- Modify: `src/lib/playerProfileStatus.js`
- Modify: `src/lib/contractTypeLabels.js`
- Modify: `src/lib/contractTypes.js`

**Interfaces:**
- Consumes: `founder_player` and legacy `founder` contract types.
- Produces: readable contract labels and unchanged Founder profile badges.

- [ ] **Step 1: Write source/unit tests**

Assert `founder_player` labels as Founder Player and grants Founder badge alongside canonical president status.

- [ ] **Step 2: Implement minimal helper updates**

Add labels/metadata for `founder_player` and include both `founder` and `founder_player` in founder badge detection.

- [ ] **Step 3: Run focused frontend tests**

Run: `node --test src/lib/__tests__/playerProfileStatus.test.mjs src/lib/__tests__/contractTypeLabels.test.mjs`

### Task 4: Verification

**Files:**
- No additional code files unless checks reveal a Slice 13 bug.

- [ ] **Step 1: Run required gates**

Run lint, typecheck, server syntax, focused tests, full `npm run test:server`, full `npm test`, `git diff --check`, Transfer Room scan, and `graphify update .`.
