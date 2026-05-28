# Tournament Entrance Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build tokenized tournament entrance auth/onboarding with restricted access for new users and automatic unlock when tournament is completed or past end date.

**Architecture:** Add server-side entrance link management and access-mode evaluation, then introduce dedicated entrance routes and tournament-scoped page copies (`game-day`, `schedule`, `inbox`) behind a route allowlist guard. Preserve existing competition/regional/legacy match flows by relying on source fixture context and keeping restrictions as a shell-level concern.

**Tech Stack:** React 18 + react-router-dom, Express, MySQL (`league_entities`), `node:test`, ESLint, TypeScript check via `tsc -p ./jsconfig.json`.

---

## File Structure and Responsibilities

- Modify: `server/src/server/controllers/functionsController.js`
  - Add functions to create/revoke/regenerate/resolve entrance links.
  - Add functions to apply/release tournament-limited access mode.
- Modify: `server/src/server.js`
  - Add idempotent startup migration columns/indices for user access mode fields.
- Modify: `server/schema.sql`
  - Add schema-time columns/indices for user access mode fields.
- Add: `server/src/server/controllers/__tests__/tournamentEntranceController.test.js`
  - Server behavior tests for token lifecycle and unlock rule.
- Modify: `src/App.jsx`
  - Add entrance routes and tournament shell routes.
- Add: `src/components/TournamentEntranceRouteGuard.jsx`
  - Enforce allowlist for limited users and redirect logic.
- Add: `src/pages/tournament-entrance/EntranceTournamentSigninPage.jsx`
  - Signin page for token entry path.
- Add: `src/pages/tournament-entrance/EntranceTournamentSignupPage.jsx`
  - Signup + onboarding in single flow.
- Add: `src/pages/tournament-entrance/TournamentGameDayPage.jsx`
  - Scoped copy of `GameDay`.
- Add: `src/pages/tournament-entrance/TournamentSchedulePage.jsx`
  - Scoped copy of `Schedule`.
- Add: `src/pages/tournament-entrance/TournamentInboxPage.jsx`
  - Scoped copy of inbox page/panel flow.
- Add: `src/pages/admin/TournamentEntranceLinksPanel.jsx` (or integrate into existing tournaments admin section)
  - Admin controls for link generation and lifecycle.
- Modify: `src/api/stageClient.js`
  - Add function wrappers for entrance APIs.
- Add: `src/pages/tournament-entrance/__tests__/TournamentEntranceGuard.test.jsx` (if project has frontend tests enabled) or keep route-guard verification via integration smoke script.

---

### Task 1: Server Entrance Link Lifecycle (TDD)

**Files:**
- Modify: `server/src/server/controllers/functionsController.js`
- Test: `server/src/server/controllers/__tests__/tournamentEntranceController.test.js`

- [ ] **Step 1: Write failing tests for link create/resolve/revoke/regenerate**

```js
test('createTournamentEntranceLink stores active token expiring at tournament start', async () => {
  // assert token created, entity_type=tournament_entrance_link, expires_at=start_date
});

test('resolveTournamentEntranceToken rejects expired tokens', async () => {
  // assert success false with reason 'expired'
});

test('revokeTournamentEntranceLink invalidates token', async () => {
  // assert status transitions active -> revoked
});
```

- [ ] **Step 2: Run test to verify RED**

Run: `node --test server/src/server/controllers/__tests__/tournamentEntranceController.test.js`  
Expected: FAIL with unknown function names / missing handlers.

- [ ] **Step 3: Implement minimal server functions**

```js
async createTournamentEntranceLink({ tournament_id, _auth_user_id }) { /* generate token, save entity */ }
async resolveTournamentEntranceToken({ token }) { /* validate status + expires_at + tournament */ }
async revokeTournamentEntranceLink({ link_id, _auth_user_id }) { /* set status revoked */ }
async regenerateTournamentEntranceLink({ link_id, _auth_user_id }) { /* revoke old + create new */ }
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `node --test server/src/server/controllers/__tests__/tournamentEntranceController.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/server/controllers/functionsController.js server/src/server/controllers/__tests__/tournamentEntranceController.test.js
git commit -m "feat: add tournament entrance link lifecycle APIs"
```

---

### Task 2: Access Mode + Unlock Rule (TDD)

**Files:**
- Modify: `server/src/server/controllers/functionsController.js`
- Modify: `server/src/server.js`
- Modify: `server/schema.sql`
- Test: `server/src/server/controllers/__tests__/tournamentEntranceController.test.js`

- [ ] **Step 1: Write failing tests for limited access + unlock**

```js
test('applyTournamentEntranceAccessMode marks new users as tournament_limited', async () => {
  // assert users.access_mode='tournament_limited' and limited_tournament_id set
});

test('releaseTournamentLimitedAccessIfEligible unlocks when tournament completed', async () => {
  // status completed -> access_mode becomes standard
});

test('releaseTournamentLimitedAccessIfEligible unlocks when end_date passed', async () => {
  // now > end_date -> access_mode becomes standard
});
```

- [ ] **Step 2: Run test to verify RED**

Run: `node --test server/src/server/controllers/__tests__/tournamentEntranceController.test.js`  
Expected: FAIL for missing fields/functions.

- [ ] **Step 3: Add minimal migration + function logic**

```sql
-- users columns
access_mode VARCHAR(32) NULL
limited_tournament_id VARCHAR(36) NULL
limited_mode_expires_at DATETIME NULL
```

```js
// on resolve/login/guard checks:
// if user is tournament_limited and (t.status='completed' || NOW() > t.end_date) => reset to standard/full
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `node --test server/src/server/controllers/__tests__/tournamentEntranceController.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/schema.sql server/src/server.js server/src/server/controllers/functionsController.js server/src/server/controllers/__tests__/tournamentEntranceController.test.js
git commit -m "feat: add tournament-limited access mode with auto unlock"
```

---

### Task 3: Entrance Signin/Signup + Onboarding Flow (TDD)

**Files:**
- Add: `src/pages/tournament-entrance/EntranceTournamentSigninPage.jsx`
- Add: `src/pages/tournament-entrance/EntranceTournamentSignupPage.jsx`
- Modify: `src/App.jsx`
- Modify: `src/api/stageClient.js`
- Test: `src/pages/tournament-entrance/__tests__/TournamentEntranceGuard.test.jsx` (if enabled)

- [ ] **Step 1: Write failing route/flow tests**

```jsx
test('authenticated active-plan user entering token route redirects to /tournaments/:id', async () => {});
test('new signup flow completes onboarding then redirects to /tournaments/:id', async () => {});
```

- [ ] **Step 2: Run test to verify RED**

Run: `npm run test -- src/pages/tournament-entrance/__tests__/TournamentEntranceGuard.test.jsx`  
Expected: FAIL due to missing routes/components.

- [ ] **Step 3: Implement minimal pages and route wiring**

```jsx
<Route path="/tournaments/entrance/:token/signin" element={<EntranceTournamentSigninPage />} />
<Route path="/tournaments/entrance/:token/signup" element={<EntranceTournamentSignupPage />} />
```

```js
stageClient.functions.invoke('resolveTournamentEntranceToken', { token })
stageClient.functions.invoke('applyTournamentEntranceAccessMode', { tournament_id })
```

- [ ] **Step 4: Run tests/lint checks to verify GREEN**

Run:
- `npm run lint`
- `npm run typecheck`
- `npm run test -- src/pages/tournament-entrance/__tests__/TournamentEntranceGuard.test.jsx` (if available)

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/api/stageClient.js src/pages/tournament-entrance/EntranceTournamentSigninPage.jsx src/pages/tournament-entrance/EntranceTournamentSignupPage.jsx src/pages/tournament-entrance/__tests__/TournamentEntranceGuard.test.jsx
git commit -m "feat: add tournament entrance signin/signup onboarding routes"
```

---

### Task 4: Tournament-Limited Guard + Scoped Pages (TDD)

**Files:**
- Add: `src/components/TournamentEntranceRouteGuard.jsx`
- Add: `src/pages/tournament-entrance/TournamentGameDayPage.jsx`
- Add: `src/pages/tournament-entrance/TournamentSchedulePage.jsx`
- Add: `src/pages/tournament-entrance/TournamentInboxPage.jsx`
- Modify: `src/components/Layout.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Write failing tests/verification cases**

```js
// cases:
// limited user blocked from /clubs -> redirected to /tournaments/:id
// limited user can open /tournaments/game-day, /tournaments/schedule, /tournaments/inbox
// scoped pages only show tournament-context records
```

- [ ] **Step 2: Run checks to verify RED**

Run: route tests or scripted assertions; expected failure on missing guard + routes.

- [ ] **Step 3: Implement minimal allowlist guard + page copies**

```js
const ALLOWLIST = ['/tournaments/:id', '/tournaments/game-day', '/tournaments/schedule', '/tournaments/inbox'];
```

Use copied page logic with tournament-scoped filters using tournament context IDs.

- [ ] **Step 4: Run verification to GREEN**

Run:
- `npm run lint`
- `npm run typecheck`
- `node --check server/src/server.js`

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/TournamentEntranceRouteGuard.jsx src/pages/tournament-entrance/TournamentGameDayPage.jsx src/pages/tournament-entrance/TournamentSchedulePage.jsx src/pages/tournament-entrance/TournamentInboxPage.jsx src/components/Layout.jsx src/App.jsx
git commit -m "feat: enforce tournament-limited route guard with scoped pages"
```

---

### Task 5: Admin Controls + Final Verification (TDD + Integration)

**Files:**
- Add/Modify: `src/components/admin/sections/TournamentsTab.jsx` (or new `TournamentEntranceLinksPanel.jsx`)
- Modify: `src/api/stageClient.js`
- Test: `server/src/server/controllers/__tests__/tournamentEntranceController.test.js`

- [ ] **Step 1: Add failing server test for audit rows on create/revoke/regenerate**

```js
test('entrance link admin actions write admin_audit_log rows', async () => {});
```

- [ ] **Step 2: Run test to verify RED**

Run: `node --test server/src/server/controllers/__tests__/tournamentEntranceController.test.js`  
Expected: FAIL until audit writes are implemented.

- [ ] **Step 3: Implement admin UI actions**

```jsx
<Button onClick={createLink}>Create Entrance Link</Button>
<Button onClick={revokeLink}>Revoke</Button>
<Button onClick={regenerateLink}>Regenerate</Button>
```

- [ ] **Step 4: Full verification**

Run:
- `node --test server/src/server/controllers/__tests__/tournamentEntranceController.test.js`
- `npm run lint`
- `npm run typecheck`
- `node --check server/src/server.js`

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/sections/TournamentsTab.jsx src/api/stageClient.js server/src/server/controllers/functionsController.js server/src/server/controllers/__tests__/tournamentEntranceController.test.js
git commit -m "feat: add admin tournament entrance link controls and audit logs"
```

---

## Final Integration Checklist

- [ ] Existing active-plan users retain full access when using entrance links.
- [ ] New entrance users are restricted before tournament ends.
- [ ] Unlock works on both completion conditions:
  - [ ] `tournaments.status = completed`
  - [ ] `now > tournaments.end_date`
- [ ] Tournament pages in limited mode are only:
  - [ ] detail
  - [ ] `tournaments/game-day`
  - [ ] `tournaments/schedule`
  - [ ] `tournaments/inbox`
- [ ] Competition/league/tournament flow compatibility maintained.
