# Automatic Competition Progression Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure every final match or fixture result enters one backend progression hook so competitions advance automatically without admin buttons.

**Architecture:** Add a small `advanceAfterFinalResult(...)` adapter in `competitionEngineService.js` that wraps existing sync, ready, official/regional advancement, and community tournament advancement. Update result finalization callers to invoke this hook instead of duplicating progression calls.

**Tech Stack:** Node.js, Express, MySQL-backed service mocks, `node:test`.

## Global Constraints

- Do not touch Transfer Room.
- Do not rewrite the tournament system.
- Preserve existing progression behavior and idempotency.
- Do not implement configurable UEFA/FIFA tiebreaker rebuild in this slice.
- If a tie cannot be resolved by current rules, return/report a safe reason instead of random selection.

---

### Task 1: Central Final-Result Hook

**Files:**
- Modify: `server/src/server/services/__tests__/competitionEngineService.test.js`
- Modify: `server/src/server/services/competitionEngineService.js`

**Interfaces:**
- Produces: `advanceAfterFinalResult(finalResult, options)` returning `{ triggered, sync, community, ready, advance }`.

- [ ] **Step 1: Write failing tests for agreed result progression trace**
- [ ] **Step 2: Implement `advanceAfterFinalResult` around existing sync/advance functions**
- [ ] **Step 3: Make agreed `submitResult` return progression details**

### Task 2: Controller Entry Points

**Files:**
- Modify: `server/src/server/controllers/__tests__/matchSnapshots.test.js`
- Modify: `server/src/server/controllers/__tests__/fixtureAdminActionController.test.js`
- Modify: `server/src/server/controllers/matchController.js`
- Modify: `server/src/server/controllers/fixtureAdminActionController.js`

**Interfaces:**
- Consumes: `advanceAfterFinalResult(finalResult, options)`.
- Produces: match patch and admin forfeit finalization paths using the central hook.

- [ ] **Step 1: Write failing controller tests**
- [ ] **Step 2: Replace duplicate match patch sync/community calls with the central hook**
- [ ] **Step 3: Trigger the hook after admin declare-forfeit updates a legacy fixture**

### Task 3: Verification

**Files:**
- No additional code files unless verification reveals a Slice 14 bug.

- [ ] **Step 1: Run focused service/controller tests**
- [ ] **Step 2: Run lint, typecheck, server syntax, full server/frontend tests, diff check, Transfer Room scan, and graphify update**
