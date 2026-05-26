# Unified Competition Engine Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared backend foundation for the unified competition engine without breaking the existing Official Competition, Regional League, or Community Tournament pages.

**Architecture:** Phase 1 adds typed operational tables, match identity/contact snapshots, and a small server-owned competition engine API. Existing product tables stay in place: `league_entities` keeps current official/regional records, `tournaments` keeps community metadata, and `matches` remains the Game Day surface. This phase gives later migration work stable tables, indexes, services, and tests.

**Tech Stack:** Express, MySQL 8 through `EXECUTESQL`, CommonJS backend modules, `node:test`, Vite/React frontend clients through `src/api/stageClient.js`.

---

## Scope

This plan intentionally handles the first stable slice only:

- add missing match snapshot fields and make match create/update persist names/emails from IDs
- add typed competition engine tables to `server/schema.sql` and startup migrations
- add backend models and services for instances, participants, fixtures, proposals, submissions, standings, phase states, and payouts
- add `/api/stage/competition-engine` command/read surface
- add idempotent match creation from a typed fixture
- add server-side result submission/finalization for typed fixtures
- register frontend entity names and a thin function wrapper for the new API

This plan does not migrate every existing Official/Regional/Community page to the new engine. That becomes Phase 2 after the foundation is testable.

## File Structure

- Modify `server/schema.sql`: add owner email snapshots to `matches`; add new competition engine tables and indexes.
- Modify `server/src/server.js`: mount `/api/stage/competition-engine`; add startup migrations for all new columns/tables/indexes.
- Modify `server/src/server/models/matchModel.js`: add `home_owner_email`, `away_owner_email`, `home_player_email`, `away_player_email` to constructor, create, and update.
- Modify `server/src/server/controllers/matchController.js`: resolve club owner emails and player emails in `attachMatchNames()` / `enrichMatchRows()`.
- Create `server/src/server/models/competitionEngineModel.js`: focused SQL helpers for the new engine tables.
- Create `server/src/server/services/competitionEngineService.js`: business commands with validation and idempotency.
- Create `server/src/server/controllers/competitionEngineController.js`: Express router for commands and reads.
- Create `server/src/server/controllers/__tests__/matchSnapshots.test.js`: unit tests for match snapshot enrichment.
- Create `server/src/server/services/__tests__/competitionEngineService.test.js`: unit tests for fixture-to-match and result finalization logic.
- Create `server/src/server/controllers/__tests__/competitionEngineController.test.js`: router-level validation tests.
- Modify `src/api/stageClient.js`: add new entity names and `competitionEngine` helper methods.

---

### Task 1: Match Snapshot Columns And Persistence

**Files:**
- Modify: `server/schema.sql`
- Modify: `server/src/server.js`
- Modify: `server/src/server/models/matchModel.js`
- Modify: `server/src/server/controllers/matchController.js`
- Test: `server/src/server/controllers/__tests__/matchSnapshots.test.js`

- [ ] **Step 1: Write the failing match snapshot test**

Create `server/src/server/controllers/__tests__/matchSnapshots.test.js`:

```js
const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadMatchRouterWithDbMock(executesql) {
  const controllerPath = path.resolve(__dirname, '../matchController.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  const socketPath = path.resolve(__dirname, '../../utils/socketBroadcast.js');

  delete require.cache[controllerPath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql, pool: {} },
  };
  require.cache[socketPath] = {
    id: socketPath,
    filename: socketPath,
    loaded: true,
    exports: { broadcastMatch() {}, broadcastMatchDeleted() {} },
  };

  return require(controllerPath);
}

function postMatchesHandler(router) {
  const layer = router.stack.find((entry) => entry.route?.path === '/' && entry.route.methods.post);
  return layer.route.stack[0].handle;
}

test('POST / snapshots club owner emails and player emails from ids', async () => {
  const inserted = [];
  const executesql = async (sql, params = []) => {
    if (/FROM users WHERE id = \?/.test(sql)) {
      return [{ id: 'user-1', email: 'captain@example.test', role_id: 1 }];
    }
    if (/FROM players WHERE user_id/.test(sql)) {
      return [{ id: 'player-home', club_id: 'club-home' }];
    }
    if (/FROM clubs\s+WHERE user_id/.test(sql)) {
      return [];
    }
    if (/SELECT id, name, owner_email FROM clubs WHERE id IN/.test(sql)) {
      return [
        { id: 'club-home', name: 'Home FC', owner_email: 'home-owner@example.test' },
        { id: 'club-away', name: 'Away FC', owner_email: 'away-owner@example.test' },
      ];
    }
    if (/SELECT id, gamertag, email FROM players WHERE id IN/.test(sql)) {
      return [
        { id: 'player-home', gamertag: 'HomeTag', email: 'home-player@example.test' },
        { id: 'player-away', gamertag: 'AwayTag', email: 'away-player@example.test' },
      ];
    }
    if (/INSERT INTO matches/.test(sql)) {
      inserted.push(params);
      return { insertId: 'match-1', affectedRows: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadMatchRouterWithDbMock(executesql);
  const handle = postMatchesHandler(router);
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };

  await handle({
    user: { id: 'user-1' },
    body: {
      home_club_id: 'club-home',
      away_club_id: 'club-away',
      home_player_id: 'player-home',
      away_player_id: 'player-away',
      status: 'scheduled',
      mode: 'club',
    },
  }, response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.home_club_name, 'Home FC');
  assert.equal(response.body.away_club_name, 'Away FC');
  assert.equal(response.body.home_owner_email, 'home-owner@example.test');
  assert.equal(response.body.away_owner_email, 'away-owner@example.test');
  assert.equal(response.body.home_player_name, 'HomeTag');
  assert.equal(response.body.away_player_name, 'AwayTag');
  assert.equal(response.body.home_player_email, 'home-player@example.test');
  assert.equal(response.body.away_player_email, 'away-player@example.test');
  assert.equal(inserted.length, 1);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
node --test server/src/server/controllers/__tests__/matchSnapshots.test.js
```

Expected: FAIL because the controller still selects only `clubs.id,name` and `players.id,gamertag`, and the match model does not persist owner/player email values.

- [ ] **Step 3: Add `matches` owner email columns to schema**

In `server/schema.sql`, inside `CREATE TABLE IF NOT EXISTS matches`, after `away_club_name VARCHAR(150),` add:

```sql
  home_owner_email      VARCHAR(255),
  away_owner_email      VARCHAR(255),
```

Add indexes near the existing `matches` indexes:

```sql
CREATE INDEX idx_matches_home_owner_email ON matches(home_owner_email);
CREATE INDEX idx_matches_away_owner_email ON matches(away_owner_email);
```

- [ ] **Step 4: Add startup migrations for the new match columns and indexes**

In `server/src/server.js`, inside `runStartupMigrations()` after the existing `matches.home_player_email` / `matches.away_player_email` additions, add:

```js
  await addCol('matches', 'home_owner_email', 'VARCHAR(255) NULL');
  await addCol('matches', 'away_owner_email', 'VARCHAR(255) NULL');
  await EXECUTESQL('CREATE INDEX idx_matches_home_owner_email ON matches(home_owner_email)')
    .catch((err) => console.error('[migration] idx_matches_home_owner_email:', err.message));
  await EXECUTESQL('CREATE INDEX idx_matches_away_owner_email ON matches(away_owner_email)')
    .catch((err) => console.error('[migration] idx_matches_away_owner_email:', err.message));
```

- [ ] **Step 5: Update `matchModel.js` constructor and SQL fields**

In `server/src/server/models/matchModel.js`, add constructor fields:

```js
    this.home_owner_email      = body.home_owner_email;
    this.away_owner_email      = body.away_owner_email;
    this.home_player_email     = body.home_player_email;
    this.away_player_email     = body.away_player_email;
```

Update the `INSERT INTO matches` column list so the side identity block becomes:

```sql
       home_club_id, away_club_id, home_club_name, away_club_name,
       home_owner_email, away_owner_email,
       home_player_id, home_player_name, home_player_email,
       away_player_id, away_player_name, away_player_email,
```

Update the matching `VALUES` array segment:

```js
      this.home_club_id, this.away_club_id, this.home_club_name, this.away_club_name,
      this.home_owner_email, this.away_owner_email,
      this.home_player_id, this.home_player_name, this.home_player_email,
      this.away_player_id, this.away_player_name, this.away_player_email,
```

Update the `UPDATE matches SET` side identity block:

```sql
      home_club_id=?, away_club_id=?, home_club_name=?, away_club_name=?,
      home_owner_email=?, away_owner_email=?,
      home_player_id=?, home_player_name=?, home_player_email=?,
      away_player_id=?, away_player_name=?, away_player_email=?,
```

Update the matching update values in the same order.

- [ ] **Step 6: Update match controller snapshot enrichment**

In `server/src/server/controllers/matchController.js`, update `enrichMatchRows()` club query:

```js
          `SELECT id, name, owner_email FROM clubs WHERE id IN (${clubIds.map(() => '?').join(',')})`,
```

Update player query:

```js
          `SELECT id, gamertag, email FROM players WHERE id IN (${playerIds.map(() => '?').join(',')})`,
```

Build maps:

```js
  const clubById = new Map(clubs.map((c) => [c.id, c]));
  const playerById = new Map(players.map((p) => [p.id, p]));
```

Return rows with snapshot fallbacks:

```js
    home_club_name: r.home_club_name || (r.home_club_id ? (clubById.get(r.home_club_id)?.name || null) : null),
    away_club_name: r.away_club_name || (r.away_club_id ? (clubById.get(r.away_club_id)?.name || null) : null),
    home_owner_email: r.home_owner_email || (r.home_club_id ? (clubById.get(r.home_club_id)?.owner_email || null) : null),
    away_owner_email: r.away_owner_email || (r.away_club_id ? (clubById.get(r.away_club_id)?.owner_email || null) : null),
    home_player_name: r.home_player_name || (r.home_player_id ? (playerById.get(r.home_player_id)?.gamertag || null) : null),
    away_player_name: r.away_player_name || (r.away_player_id ? (playerById.get(r.away_player_id)?.gamertag || null) : null),
    home_player_email: r.home_player_email || (r.home_player_id ? (playerById.get(r.home_player_id)?.email || null) : null),
    away_player_email: r.away_player_email || (r.away_player_id ? (playerById.get(r.away_player_id)?.email || null) : null),
```

In `attachMatchNames()`, query `clubs.id,name,owner_email` and `players.id,gamertag,email`, then assign:

```js
    if (next.home_club_id) {
      const club = byId.get(next.home_club_id);
      next.home_club_name = club?.name || next.home_club_name || null;
      next.home_owner_email = club?.owner_email || next.home_owner_email || null;
    }
    if (next.away_club_id) {
      const club = byId.get(next.away_club_id);
      next.away_club_name = club?.name || next.away_club_name || null;
      next.away_owner_email = club?.owner_email || next.away_owner_email || null;
    }
```

And:

```js
    if (next.home_player_id) {
      const player = byId.get(next.home_player_id);
      next.home_player_name = player?.gamertag || next.home_player_name || null;
      next.home_player_email = player?.email || next.home_player_email || null;
    }
    if (next.away_player_id) {
      const player = byId.get(next.away_player_id);
      next.away_player_name = player?.gamertag || next.away_player_name || null;
      next.away_player_email = player?.email || next.away_player_email || null;
    }
```

- [ ] **Step 7: Run focused verification**

Run:

```bash
node --test server/src/server/controllers/__tests__/matchSnapshots.test.js
node --test server/src/server/controllers/__tests__/matchController.test.js
node --check server/src/server.js
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add server/schema.sql server/src/server.js server/src/server/models/matchModel.js server/src/server/controllers/matchController.js server/src/server/controllers/__tests__/matchSnapshots.test.js
git commit -m "feat: persist match identity snapshots"
```

---

### Task 2: Competition Engine Tables And Migrations

**Files:**
- Modify: `server/schema.sql`
- Modify: `server/src/server.js`
- Test: `server/src/server/controllers/__tests__/competitionEngineSchema.test.js`

- [ ] **Step 1: Write schema smoke test**

Create `server/src/server/controllers/__tests__/competitionEngineSchema.test.js`:

```js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../../..');
const schema = fs.readFileSync(path.join(root, 'schema.sql'), 'utf8');
const server = fs.readFileSync(path.join(root, 'src/server.js'), 'utf8');

const requiredTables = [
  'competition_instances',
  'competition_participants',
  'competition_fixtures',
  'competition_schedule_proposals',
  'competition_result_submissions',
  'competition_standings',
  'competition_phase_states',
  'competition_payouts',
];

test('competition engine tables are present in schema and startup migrations', () => {
  for (const table of requiredTables) {
    assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
    assert.match(server, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
});

test('competition fixtures enforce typed participant snapshots', () => {
  for (const column of [
    'participant_type',
    'home_participant_id',
    'away_participant_id',
    'home_owner_email',
    'away_owner_email',
    'player_home_gamertag',
    'player_away_gamertag',
  ]) {
    assert.match(schema, new RegExp(column));
  }
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
node --test server/src/server/controllers/__tests__/competitionEngineSchema.test.js
```

Expected: FAIL because the new tables are not defined.

- [ ] **Step 3: Add tables to `server/schema.sql`**

Append this block before the index section:

```sql
-- ── unified competition engine ───────────────────────────────
CREATE TABLE IF NOT EXISTS competition_instances (
  id                  VARCHAR(36) PRIMARY KEY,
  product_type        VARCHAR(50) NOT NULL,
  legacy_source_type  VARCHAR(50) NOT NULL,
  legacy_source_id    VARCHAR(36) NOT NULL,
  name                VARCHAR(150) NOT NULL,
  slug                VARCHAR(180),
  region              VARCHAR(80),
  platform            VARCHAR(50),
  status              VARCHAR(50) DEFAULT 'draft',
  starts_at           DATETIME,
  ends_at             DATETIME,
  created_by_user_id  VARCHAR(36),
  created_date        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_date        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_comp_instances_source (product_type, legacy_source_type, legacy_source_id),
  INDEX idx_comp_instances_status (product_type, status, starts_at),
  INDEX idx_comp_instances_region (region, platform, status)
);

CREATE TABLE IF NOT EXISTS competition_participants (
  id                       VARCHAR(36) PRIMARY KEY,
  competition_instance_id  VARCHAR(36) NOT NULL,
  participant_type         VARCHAR(20) NOT NULL,
  club_id                  VARCHAR(36),
  player_id                VARCHAR(36),
  user_id                  VARCHAR(36),
  status                   VARCHAR(50) DEFAULT 'pending',
  seed                     INT,
  registered_at            DATETIME,
  approved_at              DATETIME,
  created_date             DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_date             DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_comp_participant_club (competition_instance_id, participant_type, club_id),
  UNIQUE KEY uq_comp_participant_player (competition_instance_id, participant_type, player_id),
  INDEX idx_comp_participants_club (club_id, status),
  INDEX idx_comp_participants_player (player_id, status),
  INDEX idx_comp_participants_instance (competition_instance_id, status, seed)
);

CREATE TABLE IF NOT EXISTS competition_fixtures (
  id                       VARCHAR(36) PRIMARY KEY,
  competition_instance_id  VARCHAR(36) NOT NULL,
  legacy_fixture_type      VARCHAR(50),
  legacy_fixture_id        VARCHAR(36),
  match_id                 VARCHAR(36),
  participant_type         VARCHAR(20) NOT NULL,
  format                   VARCHAR(50),
  phase                    VARCHAR(50),
  round                    INT,
  matchday                 INT,
  group_number             INT,
  tie_id                   VARCHAR(36),
  leg                      INT,
  bracket_side             VARCHAR(20),
  home_participant_id      VARCHAR(36),
  away_participant_id      VARCHAR(36),
  home_club_id             VARCHAR(36),
  home_club_name           VARCHAR(150),
  home_owner_email         VARCHAR(255),
  away_club_id             VARCHAR(36),
  away_club_name           VARCHAR(150),
  away_owner_email         VARCHAR(255),
  player_home_id           VARCHAR(36),
  player_home_gamertag     VARCHAR(150),
  player_home_email        VARCHAR(255),
  player_away_id           VARCHAR(36),
  player_away_gamertag     VARCHAR(150),
  player_away_email        VARCHAR(255),
  status                   VARCHAR(50) DEFAULT 'unscheduled',
  scheduling_status        VARCHAR(50) DEFAULT 'open',
  window_start             DATETIME,
  window_end               DATETIME,
  scheduled_at             DATETIME,
  confirmed_at             DATETIME,
  home_score               INT,
  away_score               INT,
  winner_participant_id    VARCHAR(36),
  stats_processed          TINYINT(1) DEFAULT 0,
  idempotency_key          VARCHAR(190),
  created_date             DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_date             DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_comp_fixture_legacy (legacy_fixture_type, legacy_fixture_id),
  UNIQUE KEY uq_comp_fixture_match (match_id),
  UNIQUE KEY uq_comp_fixture_idempotency (idempotency_key),
  INDEX idx_comp_fixtures_schedule (competition_instance_id, status, scheduled_at),
  INDEX idx_comp_fixtures_round (competition_instance_id, phase, round, group_number),
  INDEX idx_comp_fixtures_home (home_participant_id, status),
  INDEX idx_comp_fixtures_away (away_participant_id, status),
  INDEX idx_comp_fixtures_window (scheduling_status, window_end)
);

CREATE TABLE IF NOT EXISTS competition_schedule_proposals (
  id                         VARCHAR(36) PRIMARY KEY,
  fixture_id                 VARCHAR(36) NOT NULL,
  proposer_participant_id    VARCHAR(36),
  recipient_participant_id   VARCHAR(36),
  proposed_at                DATETIME DEFAULT CURRENT_TIMESTAMP,
  proposed_for               DATETIME NOT NULL,
  status                     VARCHAR(50) DEFAULT 'pending',
  message_id                 VARCHAR(36),
  notification_id            VARCHAR(36),
  idempotency_key            VARCHAR(190),
  created_date               DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_comp_schedule_idempotency (idempotency_key),
  INDEX idx_comp_schedule_fixture (fixture_id, status, created_date),
  INDEX idx_comp_schedule_recipient (recipient_participant_id, status)
);

CREATE TABLE IF NOT EXISTS competition_result_submissions (
  id                    VARCHAR(36) PRIMARY KEY,
  fixture_id            VARCHAR(36) NOT NULL,
  match_id              VARCHAR(36),
  side                  VARCHAR(10) NOT NULL,
  submitted_by_user_id  VARCHAR(36),
  score_home            INT NOT NULL,
  score_away            INT NOT NULL,
  payload_json          JSON,
  proof_url             VARCHAR(500),
  idempotency_key       VARCHAR(190),
  created_date          DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_comp_result_match_side (match_id, side),
  UNIQUE KEY uq_comp_result_fixture_side (fixture_id, side),
  UNIQUE KEY uq_comp_result_idempotency (idempotency_key),
  INDEX idx_comp_result_fixture (fixture_id, created_date)
);

CREATE TABLE IF NOT EXISTS competition_standings (
  competition_instance_id  VARCHAR(36) NOT NULL,
  participant_id           VARCHAR(36) NOT NULL,
  played                   INT DEFAULT 0,
  wins                     INT DEFAULT 0,
  draws                    INT DEFAULT 0,
  losses                   INT DEFAULT 0,
  goals_for                INT DEFAULT 0,
  goals_against            INT DEFAULT 0,
  goal_difference          INT DEFAULT 0,
  points                   INT DEFAULT 0,
  rank                     INT,
  final_position           INT,
  is_promoted              TINYINT(1) DEFAULT 0,
  is_relegated             TINYINT(1) DEFAULT 0,
  is_eliminated            TINYINT(1) DEFAULT 0,
  updated_date             DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (competition_instance_id, participant_id),
  INDEX idx_comp_standings_rank (competition_instance_id, rank),
  INDEX idx_comp_standings_participant (participant_id)
);

CREATE TABLE IF NOT EXISTS competition_phase_states (
  id                       VARCHAR(36) PRIMARY KEY,
  competition_instance_id  VARCHAR(36) NOT NULL,
  format                   VARCHAR(50),
  phase                    VARCHAR(50) NOT NULL,
  round                    INT DEFAULT 1,
  status                   VARCHAR(50) DEFAULT 'pending',
  ready_to_advance         TINYINT(1) DEFAULT 0,
  generated_at             DATETIME,
  generated_by_user_id     VARCHAR(36),
  idempotency_key          VARCHAR(190),
  created_date             DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_date             DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_comp_phase_round (competition_instance_id, phase, round),
  UNIQUE KEY uq_comp_phase_idempotency (idempotency_key),
  INDEX idx_comp_phase_status (competition_instance_id, status)
);

CREATE TABLE IF NOT EXISTS competition_payouts (
  id                       VARCHAR(36) PRIMARY KEY,
  competition_instance_id  VARCHAR(36) NOT NULL,
  fixture_id               VARCHAR(36),
  match_id                 VARCHAR(36),
  recipient_type           VARCHAR(20) NOT NULL,
  club_id                  VARCHAR(36),
  player_id                VARCHAR(36),
  amount_stc               DECIMAL(12,2) DEFAULT 0,
  category                 VARCHAR(80),
  status                   VARCHAR(50) DEFAULT 'pending',
  idempotency_key          VARCHAR(190),
  ledger_transaction_id    VARCHAR(36),
  created_date             DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_date             DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_comp_payout_idempotency (idempotency_key),
  INDEX idx_comp_payout_instance (competition_instance_id, status),
  INDEX idx_comp_payout_club (club_id, created_date),
  INDEX idx_comp_payout_player (player_id, created_date)
);
```

- [ ] **Step 4: Add startup migrations**

In `server/src/server.js`, inside `runStartupMigrations()`, add `EXECUTESQL(...).catch(...)` blocks for each table using the same SQL as Step 3. Use one block per table:

```js
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS competition_instances (
    id VARCHAR(36) PRIMARY KEY,
    product_type VARCHAR(50) NOT NULL,
    legacy_source_type VARCHAR(50) NOT NULL,
    legacy_source_id VARCHAR(36) NOT NULL,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(180),
    region VARCHAR(80),
    platform VARCHAR(50),
    status VARCHAR(50) DEFAULT 'draft',
    starts_at DATETIME,
    ends_at DATETIME,
    created_by_user_id VARCHAR(36),
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_date DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_comp_instances_source (product_type, legacy_source_type, legacy_source_id),
    INDEX idx_comp_instances_status (product_type, status, starts_at),
    INDEX idx_comp_instances_region (region, platform, status)
  )`).catch((err) => console.error('[migration] competition_instances:', err.message));
```

Repeat with the exact table definitions from Step 3 for the remaining seven tables.

- [ ] **Step 5: Run schema test and server syntax**

Run:

```bash
node --test server/src/server/controllers/__tests__/competitionEngineSchema.test.js
node --check server/src/server.js
```

Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add server/schema.sql server/src/server.js server/src/server/controllers/__tests__/competitionEngineSchema.test.js
git commit -m "feat: add competition engine schema"
```

---

### Task 3: Competition Engine Model

**Files:**
- Create: `server/src/server/models/competitionEngineModel.js`
- Test: `server/src/server/services/__tests__/competitionEngineModel.test.js`

- [ ] **Step 1: Write model test**

Create `server/src/server/services/__tests__/competitionEngineModel.test.js`:

```js
const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadModel(executesql) {
  const modelPath = path.resolve(__dirname, '../../models/competitionEngineModel.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  delete require.cache[modelPath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql, pool: {} },
  };
  return require(modelPath);
}

test('upsertInstance writes source identity idempotently', async () => {
  const calls = [];
  const CompetitionEngineModel = loadModel(async (sql, params) => {
    calls.push({ sql, params });
    return { affectedRows: 1 };
  });
  const model = new CompetitionEngineModel();
  await model.upsertInstance({
    id: 'instance-1',
    product_type: 'community_tournament',
    legacy_source_type: 'tournament',
    legacy_source_id: 'tournament-1',
    name: 'Weekend Cup',
    slug: 'weekend-cup',
    status: 'active',
  });
  assert.match(calls[0].sql, /INSERT INTO competition_instances/);
  assert.match(calls[0].sql, /ON DUPLICATE KEY UPDATE/);
  assert.deepEqual(calls[0].params.slice(0, 6), [
    'instance-1',
    'community_tournament',
    'tournament',
    'tournament-1',
    'Weekend Cup',
    'weekend-cup',
  ]);
});
```

- [ ] **Step 2: Run and verify failure**

Run:

```bash
node --test server/src/server/services/__tests__/competitionEngineModel.test.js
```

Expected: FAIL because `competitionEngineModel.js` does not exist.

- [ ] **Step 3: Create model**

Create `server/src/server/models/competitionEngineModel.js`:

```js
const { EXECUTESQL } = require('../db/database');

class CompetitionEngineModel {
  upsertInstance(row) {
    return EXECUTESQL(
      `INSERT INTO competition_instances
       (id, product_type, legacy_source_type, legacy_source_id, name, slug, region, platform, status, starts_at, ends_at, created_by_user_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         name=VALUES(name),
         slug=VALUES(slug),
         region=VALUES(region),
         platform=VALUES(platform),
         status=VALUES(status),
         starts_at=VALUES(starts_at),
         ends_at=VALUES(ends_at),
         updated_date=CURRENT_TIMESTAMP`,
      [
        row.id,
        row.product_type,
        row.legacy_source_type,
        row.legacy_source_id,
        row.name,
        row.slug || null,
        row.region || null,
        row.platform || null,
        row.status || 'draft',
        row.starts_at || null,
        row.ends_at || null,
        row.created_by_user_id || null,
      ],
    );
  }

  selectInstance(id) {
    return EXECUTESQL('SELECT * FROM competition_instances WHERE id = ?', [id]);
  }

  selectInstanceBySource(productType, legacySourceType, legacySourceId) {
    return EXECUTESQL(
      'SELECT * FROM competition_instances WHERE product_type = ? AND legacy_source_type = ? AND legacy_source_id = ? LIMIT 1',
      [productType, legacySourceType, legacySourceId],
    );
  }

  listInstances(filters = {}) {
    const where = [];
    const values = [];
    for (const [column, value] of Object.entries(filters)) {
      if (value === undefined || value === null || value === '') continue;
      where.push(`${column} = ?`);
      values.push(value);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return EXECUTESQL(`SELECT * FROM competition_instances ${clause} ORDER BY created_date DESC LIMIT 100`, values);
  }

  upsertParticipant(row) {
    return EXECUTESQL(
      `INSERT INTO competition_participants
       (id, competition_instance_id, participant_type, club_id, player_id, user_id, status, seed, registered_at, approved_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         user_id=VALUES(user_id),
         status=VALUES(status),
         seed=VALUES(seed),
         approved_at=VALUES(approved_at),
         updated_date=CURRENT_TIMESTAMP`,
      [
        row.id,
        row.competition_instance_id,
        row.participant_type,
        row.club_id || null,
        row.player_id || null,
        row.user_id || null,
        row.status || 'pending',
        row.seed ?? null,
        row.registered_at || null,
        row.approved_at || null,
      ],
    );
  }

  listParticipants(instanceId) {
    return EXECUTESQL(
      'SELECT * FROM competition_participants WHERE competition_instance_id = ? ORDER BY seed IS NULL, seed, created_date',
      [instanceId],
    );
  }

  upsertFixture(row) {
    return EXECUTESQL(
      `INSERT INTO competition_fixtures
       (id, competition_instance_id, legacy_fixture_type, legacy_fixture_id, match_id, participant_type,
        format, phase, round, matchday, group_number, tie_id, leg, bracket_side,
        home_participant_id, away_participant_id,
        home_club_id, home_club_name, home_owner_email, away_club_id, away_club_name, away_owner_email,
        player_home_id, player_home_gamertag, player_home_email, player_away_id, player_away_gamertag, player_away_email,
        status, scheduling_status, window_start, window_end, scheduled_at, confirmed_at,
        home_score, away_score, winner_participant_id, stats_processed, idempotency_key)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
        match_id=VALUES(match_id),
        status=VALUES(status),
        scheduling_status=VALUES(scheduling_status),
        scheduled_at=VALUES(scheduled_at),
        confirmed_at=VALUES(confirmed_at),
        home_score=VALUES(home_score),
        away_score=VALUES(away_score),
        winner_participant_id=VALUES(winner_participant_id),
        stats_processed=VALUES(stats_processed),
        updated_date=CURRENT_TIMESTAMP`,
      [
        row.id,
        row.competition_instance_id,
        row.legacy_fixture_type || null,
        row.legacy_fixture_id || null,
        row.match_id || null,
        row.participant_type,
        row.format || null,
        row.phase || null,
        row.round ?? null,
        row.matchday ?? null,
        row.group_number ?? null,
        row.tie_id || null,
        row.leg ?? null,
        row.bracket_side || null,
        row.home_participant_id || null,
        row.away_participant_id || null,
        row.home_club_id || null,
        row.home_club_name || null,
        row.home_owner_email || null,
        row.away_club_id || null,
        row.away_club_name || null,
        row.away_owner_email || null,
        row.player_home_id || null,
        row.player_home_gamertag || null,
        row.player_home_email || null,
        row.player_away_id || null,
        row.player_away_gamertag || null,
        row.player_away_email || null,
        row.status || 'unscheduled',
        row.scheduling_status || 'open',
        row.window_start || null,
        row.window_end || null,
        row.scheduled_at || null,
        row.confirmed_at || null,
        row.home_score ?? null,
        row.away_score ?? null,
        row.winner_participant_id || null,
        row.stats_processed ? 1 : 0,
        row.idempotency_key || null,
      ],
    );
  }

  selectFixture(id) {
    return EXECUTESQL('SELECT * FROM competition_fixtures WHERE id = ?', [id]);
  }

  selectFixtureByMatch(matchId) {
    return EXECUTESQL('SELECT * FROM competition_fixtures WHERE match_id = ? LIMIT 1', [matchId]);
  }

  listFixtures(instanceId, filters = {}) {
    const where = ['competition_instance_id = ?'];
    const values = [instanceId];
    for (const key of ['status', 'phase', 'round', 'participant_type']) {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        where.push(`${key} = ?`);
        values.push(filters[key]);
      }
    }
    return EXECUTESQL(
      `SELECT * FROM competition_fixtures WHERE ${where.join(' AND ')} ORDER BY scheduled_at IS NULL, scheduled_at, round, matchday, created_date`,
      values,
    );
  }

  insertResultSubmission(row) {
    return EXECUTESQL(
      `INSERT INTO competition_result_submissions
       (id, fixture_id, match_id, side, submitted_by_user_id, score_home, score_away, payload_json, proof_url, idempotency_key)
       VALUES (?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         submitted_by_user_id=VALUES(submitted_by_user_id),
         score_home=VALUES(score_home),
         score_away=VALUES(score_away),
         payload_json=VALUES(payload_json),
         proof_url=VALUES(proof_url)`,
      [
        row.id,
        row.fixture_id,
        row.match_id || null,
        row.side,
        row.submitted_by_user_id || null,
        row.score_home,
        row.score_away,
        row.payload_json ? JSON.stringify(row.payload_json) : null,
        row.proof_url || null,
        row.idempotency_key || null,
      ],
    );
  }

  listResultSubmissionsByMatch(matchId) {
    return EXECUTESQL('SELECT * FROM competition_result_submissions WHERE match_id = ? ORDER BY created_date', [matchId]);
  }
}

module.exports = CompetitionEngineModel;
```

- [ ] **Step 4: Run model test**

Run:

```bash
node --test server/src/server/services/__tests__/competitionEngineModel.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/server/models/competitionEngineModel.js server/src/server/services/__tests__/competitionEngineModel.test.js
git commit -m "feat: add competition engine model"
```

---

### Task 4: Competition Engine Service

**Files:**
- Create: `server/src/server/services/competitionEngineService.js`
- Test: `server/src/server/services/__tests__/competitionEngineService.test.js`

- [ ] **Step 1: Write service tests**

Create `server/src/server/services/__tests__/competitionEngineService.test.js`:

```js
const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadService(executesql) {
  const servicePath = path.resolve(__dirname, '../competitionEngineService.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  const socketPath = path.resolve(__dirname, '../../utils/socketBroadcast.js');
  delete require.cache[servicePath];
  delete require.cache[path.resolve(__dirname, '../../models/competitionEngineModel.js')];
  delete require.cache[path.resolve(__dirname, '../../models/matchModel.js')];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql, pool: {} },
  };
  require.cache[socketPath] = {
    id: socketPath,
    filename: socketPath,
    loaded: true,
    exports: { broadcastMatch() {}, broadcastMatchDeleted() {} },
  };
  return require(servicePath);
}

test('createMatchFromFixture creates a match with club and owner snapshots', async () => {
  const calls = [];
  const fixture = {
    id: 'fixture-1',
    competition_instance_id: 'instance-1',
    participant_type: 'club',
    home_club_id: 'club-home',
    home_club_name: 'Home FC',
    home_owner_email: 'home-owner@example.test',
    away_club_id: 'club-away',
    away_club_name: 'Away FC',
    away_owner_email: 'away-owner@example.test',
    scheduled_at: '2026-06-01 19:00:00',
  };
  const service = loadService(async (sql, params = []) => {
    calls.push({ sql, params });
    if (/SELECT \* FROM competition_fixtures WHERE id = \?/.test(sql)) return [fixture];
    if (/INSERT INTO matches/.test(sql)) return { affectedRows: 1 };
    if (/INSERT INTO competition_fixtures/.test(sql)) return { affectedRows: 1 };
    if (/UPDATE competition_fixtures SET match_id/.test(sql)) return { affectedRows: 1 };
    return [];
  });

  const match = await service.createMatchFromFixture('fixture-1');

  assert.equal(match.home_club_name, 'Home FC');
  assert.equal(match.home_owner_email, 'home-owner@example.test');
  assert.equal(match.away_owner_email, 'away-owner@example.test');
  assert.equal(match.source_fixture_type, 'competition_engine');
  assert.ok(calls.some((call) => /INSERT INTO matches/.test(call.sql)));
});

test('submitResult marks fixture disputed when scores disagree', async () => {
  const fixture = { id: 'fixture-1', match_id: 'match-1', status: 'scheduled' };
  const submissions = [
    { side: 'home', score_home: 2, score_away: 1 },
    { side: 'away', score_home: 1, score_away: 2 },
  ];
  const service = loadService(async (sql, params = []) => {
    if (/SELECT \* FROM competition_fixtures WHERE match_id = \?/.test(sql)) return [fixture];
    if (/INSERT INTO competition_result_submissions/.test(sql)) return { affectedRows: 1 };
    if (/SELECT \* FROM competition_result_submissions WHERE match_id = \?/.test(sql)) return submissions;
    if (/UPDATE matches SET status = 'disputed'/.test(sql)) return { affectedRows: 1 };
    if (/UPDATE competition_fixtures SET status = 'disputed'/.test(sql)) return { affectedRows: 1 };
    return [];
  });

  const result = await service.submitResult({
    matchId: 'match-1',
    side: 'away',
    submittedByUserId: 'user-1',
    scoreHome: 1,
    scoreAway: 2,
  });

  assert.equal(result.status, 'disputed');
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
node --test server/src/server/services/__tests__/competitionEngineService.test.js
```

Expected: FAIL because `competitionEngineService.js` does not exist.

- [ ] **Step 3: Implement service**

Create `server/src/server/services/competitionEngineService.js`:

```js
const { v4: uuidv4 } = require('uuid');
const { EXECUTESQL } = require('../db/database');
const CompetitionEngineModel = require('../models/competitionEngineModel');
const Match = require('../models/matchModel');

const model = new CompetitionEngineModel();

function assertSide(side) {
  if (!['home', 'away'].includes(side)) {
    const err = new Error('side must be home or away');
    err.status = 400;
    throw err;
  }
}

function mapFixtureToMatch(fixture) {
  return {
    id: uuidv4(),
    tournament_id: fixture.competition_instance_id,
    home_club_id: fixture.home_club_id,
    away_club_id: fixture.away_club_id,
    home_club_name: fixture.home_club_name,
    away_club_name: fixture.away_club_name,
    home_owner_email: fixture.home_owner_email,
    away_owner_email: fixture.away_owner_email,
    home_player_id: fixture.player_home_id,
    home_player_name: fixture.player_home_gamertag,
    home_player_email: fixture.player_home_email,
    away_player_id: fixture.player_away_id,
    away_player_name: fixture.player_away_gamertag,
    away_player_email: fixture.player_away_email,
    status: fixture.scheduled_at ? 'scheduled' : 'pending_schedule',
    mode: fixture.participant_type === 'player' ? 'player' : 'club',
    type: fixture.format || 'competition_engine',
    round: fixture.round,
    group_number: fixture.group_number,
    bracket_side: fixture.bracket_side,
    scheduled_date: fixture.scheduled_at,
    source_fixture_id: fixture.id,
    source_fixture_type: 'competition_engine',
    competition_context: fixture.competition_instance_id,
  };
}

async function createMatchFromFixture(fixtureId) {
  const rows = await model.selectFixture(fixtureId);
  if (!rows.length) {
    const err = new Error('Fixture not found');
    err.status = 404;
    throw err;
  }
  const fixture = rows[0];
  if (fixture.match_id) {
    const existing = await EXECUTESQL('SELECT * FROM matches WHERE id = ?', [fixture.match_id]);
    if (existing.length) return existing[0];
  }

  const payload = mapFixtureToMatch(fixture);
  const match = new Match(payload);
  await match.create();
  await EXECUTESQL(
    `UPDATE competition_fixtures
     SET match_id = ?, status = ?, scheduling_status = ?, updated_date = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [payload.id, payload.status === 'scheduled' ? 'scheduled' : fixture.status, fixture.scheduling_status || 'confirmed', fixture.id],
  );
  return payload;
}

function submissionsAgree(home, away) {
  return Number(home.score_home) === Number(away.score_home) &&
    Number(home.score_away) === Number(away.score_away);
}

async function finalizeAgreedResult(fixture, home, away) {
  const homeScore = Number(home.score_home);
  const awayScore = Number(home.score_away);
  const winnerParticipantId = homeScore > awayScore
    ? fixture.home_participant_id
    : awayScore > homeScore
      ? fixture.away_participant_id
      : null;
  await EXECUTESQL(
    `UPDATE matches
     SET status = 'completed', home_score = ?, away_score = ?, stats_processed = 1
     WHERE id = ?`,
    [homeScore, awayScore, fixture.match_id],
  );
  await EXECUTESQL(
    `UPDATE competition_fixtures
     SET status = 'completed', home_score = ?, away_score = ?, winner_participant_id = ?, stats_processed = 1, updated_date = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [homeScore, awayScore, winnerParticipantId, fixture.id],
  );
  return { status: 'completed', home_score: homeScore, away_score: awayScore, winner_participant_id: winnerParticipantId };
}

async function submitResult({ matchId, side, submittedByUserId, scoreHome, scoreAway, payloadJson, proofUrl }) {
  assertSide(side);
  const fixtureRows = await model.selectFixtureByMatch(matchId);
  if (!fixtureRows.length) {
    const err = new Error('Competition fixture not found for match');
    err.status = 404;
    throw err;
  }
  const fixture = fixtureRows[0];
  await model.insertResultSubmission({
    id: uuidv4(),
    fixture_id: fixture.id,
    match_id: matchId,
    side,
    submitted_by_user_id: submittedByUserId,
    score_home: Number(scoreHome),
    score_away: Number(scoreAway),
    payload_json: payloadJson || null,
    proof_url: proofUrl || null,
    idempotency_key: `match_submission:${matchId}:${side}`,
  });
  const submissions = await model.listResultSubmissionsByMatch(matchId);
  const home = submissions.find((entry) => entry.side === 'home');
  const away = submissions.find((entry) => entry.side === 'away');
  if (!home || !away) return { status: 'pending_confirmation' };
  if (!submissionsAgree(home, away)) {
    await EXECUTESQL("UPDATE matches SET status = 'disputed' WHERE id = ?", [matchId]);
    await EXECUTESQL("UPDATE competition_fixtures SET status = 'disputed', updated_date = CURRENT_TIMESTAMP WHERE id = ?", [fixture.id]);
    return { status: 'disputed' };
  }
  return finalizeAgreedResult(fixture, home, away);
}

module.exports = {
  createMatchFromFixture,
  submitResult,
  mapFixtureToMatch,
};
```

- [ ] **Step 4: Run service tests**

Run:

```bash
node --test server/src/server/services/__tests__/competitionEngineService.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/server/services/competitionEngineService.js server/src/server/services/__tests__/competitionEngineService.test.js
git commit -m "feat: add competition engine service"
```

---

### Task 5: Competition Engine API Router

**Files:**
- Create: `server/src/server/controllers/competitionEngineController.js`
- Modify: `server/src/server.js`
- Test: `server/src/server/controllers/__tests__/competitionEngineController.test.js`

- [ ] **Step 1: Write router tests**

Create `server/src/server/controllers/__tests__/competitionEngineController.test.js`:

```js
const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadRouter(serviceMock = {}) {
  const routerPath = path.resolve(__dirname, '../competitionEngineController.js');
  const servicePath = path.resolve(__dirname, '../../services/competitionEngineService.js');
  delete require.cache[routerPath];
  require.cache[servicePath] = {
    id: servicePath,
    filename: servicePath,
    loaded: true,
    exports: serviceMock,
  };
  return require(routerPath);
}

function findHandler(router, routePath, method) {
  const layer = router.stack.find((entry) => entry.route?.path === routePath && entry.route.methods[method]);
  return layer.route.stack[0].handle;
}

test('POST /fixtures/:id/match/create delegates to service', async () => {
  const router = loadRouter({
    createMatchFromFixture: async (id) => ({ id: 'match-1', source_fixture_id: id }),
  });
  const handle = findHandler(router, '/fixtures/:id/match/create', 'post');
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };
  await handle({ params: { id: 'fixture-1' }, user: { id: 'user-1' } }, response);
  assert.equal(response.statusCode, 201);
  assert.equal(response.body.source_fixture_id, 'fixture-1');
});

test('POST /matches/:id/results/submit validates side', async () => {
  const router = loadRouter({
    submitResult: async () => ({ status: 'pending_confirmation' }),
  });
  const handle = findHandler(router, '/matches/:id/results/submit', 'post');
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };
  await handle({
    params: { id: 'match-1' },
    body: { side: 'middle', score_home: 1, score_away: 0 },
    user: { id: 'user-1' },
  }, response);
  assert.equal(response.statusCode, 400);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
node --test server/src/server/controllers/__tests__/competitionEngineController.test.js
```

Expected: FAIL because the controller does not exist.

- [ ] **Step 3: Create controller**

Create `server/src/server/controllers/competitionEngineController.js`:

```js
const express = require('express');
const CompetitionEngineModel = require('../models/competitionEngineModel');
const service = require('../services/competitionEngineService');

const router = express.Router();
const model = new CompetitionEngineModel();

function sendError(res, err) {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Competition engine error' });
}

router.get('/instances', async (req, res) => {
  try {
    const rows = await model.listInstances({
      product_type: req.query.product_type,
      status: req.query.status,
      region: req.query.region,
      platform: req.query.platform,
    });
    res.json(rows);
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/instances/:id', async (req, res) => {
  try {
    const rows = await model.selectInstance(req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Instance not found' });
    res.json(rows[0]);
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/instances/:id/participants', async (req, res) => {
  try {
    res.json(await model.listParticipants(req.params.id));
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/instances/:id/fixtures', async (req, res) => {
  try {
    res.json(await model.listFixtures(req.params.id, req.query));
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/fixtures/:id/match/create', async (req, res) => {
  try {
    const match = await service.createMatchFromFixture(req.params.id);
    res.status(201).json(match);
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/matches/:id/results/submit', async (req, res) => {
  try {
    if (!['home', 'away'].includes(req.body?.side)) {
      return res.status(400).json({ error: 'side must be home or away' });
    }
    const result = await service.submitResult({
      matchId: req.params.id,
      side: req.body.side,
      submittedByUserId: req.user?.id,
      scoreHome: req.body.score_home,
      scoreAway: req.body.score_away,
      payloadJson: req.body.payload_json || null,
      proofUrl: req.body.proof_url || null,
    });
    res.json(result);
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
```

- [ ] **Step 4: Mount route**

In `server/src/server.js`, near the existing route mounts, add:

```js
app.use('/api/stage/competition-engine', verifyToken, require('./server/controllers/competitionEngineController'));
```

- [ ] **Step 5: Run router and server checks**

Run:

```bash
node --test server/src/server/controllers/__tests__/competitionEngineController.test.js
node --check server/src/server.js
```

Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add server/src/server/controllers/competitionEngineController.js server/src/server.js server/src/server/controllers/__tests__/competitionEngineController.test.js
git commit -m "feat: expose competition engine api"
```

---

### Task 6: Frontend API Registration

**Files:**
- Modify: `src/api/stageClient.js`
- Test: `server/src/server/controllers/__tests__/stageClientCompetitionEngine.test.js`

- [ ] **Step 1: Write stage client text test**

Create `server/src/server/controllers/__tests__/stageClientCompetitionEngine.test.js`:

```js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const client = fs.readFileSync(path.resolve(__dirname, '../../../../src/api/stageClient.js'), 'utf8');

test('stageClient registers competition engine entities and command wrapper', () => {
  for (const entity of [
    'CompetitionInstance',
    'CompetitionParticipant',
    'CompetitionFixture',
    'CompetitionScheduleProposal',
    'CompetitionResultSubmission',
    'CompetitionStanding',
    'CompetitionPhaseState',
    'CompetitionPayout',
  ]) {
    assert.match(client, new RegExp(`["']${entity}["']`));
  }
  assert.match(client, /competitionEngine/);
  assert.match(client, /createMatchFromFixture/);
  assert.match(client, /submitResult/);
});
```

- [ ] **Step 2: Run and verify failure**

Run:

```bash
node --test server/src/server/controllers/__tests__/stageClientCompetitionEngine.test.js
```

Expected: FAIL because the new entities and wrapper are not registered.

- [ ] **Step 3: Add entity names**

In `src/api/stageClient.js`, add these names to `ENTITY_NAMES`:

```js
  'CompetitionInstance',
  'CompetitionParticipant',
  'CompetitionFixture',
  'CompetitionScheduleProposal',
  'CompetitionResultSubmission',
  'CompetitionStanding',
  'CompetitionPhaseState',
  'CompetitionPayout',
```

- [ ] **Step 4: Add competition engine wrapper**

Near the existing exported helpers in `src/api/stageClient.js`, add:

```js
const competitionEngine = {
  listInstances(params = {}) {
    return http.get('/competition-engine/instances', { params });
  },
  getInstance(id) {
    return http.get(`/competition-engine/instances/${encodeURIComponent(id)}`);
  },
  listParticipants(instanceId) {
    return http.get(`/competition-engine/instances/${encodeURIComponent(instanceId)}/participants`);
  },
  listFixtures(instanceId, params = {}) {
    return http.get(`/competition-engine/instances/${encodeURIComponent(instanceId)}/fixtures`, { params });
  },
  createMatchFromFixture(fixtureId) {
    return http.post(`/competition-engine/fixtures/${encodeURIComponent(fixtureId)}/match/create`, {});
  },
  submitResult(matchId, payload) {
    return http.post(`/competition-engine/matches/${encodeURIComponent(matchId)}/results/submit`, payload);
  },
};
```

Add `competitionEngine` to the default exported client object.

- [ ] **Step 5: Run text test**

Run:

```bash
node --test server/src/server/controllers/__tests__/stageClientCompetitionEngine.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/api/stageClient.js server/src/server/controllers/__tests__/stageClientCompetitionEngine.test.js
git commit -m "feat: add competition engine client"
```

---

### Task 7: Final Phase 1 Verification

**Files:**
- No new files.

- [ ] **Step 1: Run focused backend tests**

Run:

```bash
node --test server/src/server/controllers/__tests__/matchController.test.js
node --test server/src/server/controllers/__tests__/matchSnapshots.test.js
node --test server/src/server/controllers/__tests__/competitionEngineSchema.test.js
node --test server/src/server/services/__tests__/competitionEngineModel.test.js
node --test server/src/server/services/__tests__/competitionEngineService.test.js
node --test server/src/server/controllers/__tests__/competitionEngineController.test.js
node --test server/src/server/controllers/__tests__/stageClientCompetitionEngine.test.js
node --check server/src/server.js
```

Expected: all focused checks pass.

- [ ] **Step 2: Run repo-wide checks and record existing failures**

Run:

```bash
npm run lint
npm run typecheck
```

Expected current repo state: these may fail from existing unrelated frontend lint/type issues. If they fail only in files outside this Phase 1 scope, record the first 10 filenames in the final response and do not modify unrelated files.

- [ ] **Step 3: Check git status**

Run:

```bash
git status --short --branch
```

Expected: only `.superpowers/` may remain untracked from the brainstorming visual companion. No Phase 1 source files should be uncommitted.

---

## Self-Review

- Spec coverage: This plan covers Phase 1 of the approved spec: typed tables, match snapshots, backend service/controller foundation, API client registration, and server-owned fixture-to-match/result submission for typed fixtures.
- Out-of-scope coverage: full Official Competition migration, Regional League migration, Community Tournament format migration, standings recalculation, payouts, reward distribution, and admin advance buttons require separate implementation plans after Phase 1.
- Placeholder scan: no placeholder tokens are present.
- Type consistency: `home_player_*` remains the compatibility naming in `matches`; `player_home_*` is used in typed competition fixtures, matching the approved design.
