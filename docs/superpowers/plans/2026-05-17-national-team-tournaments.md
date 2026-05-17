# National Team Tournaments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first version of international tournaments: admin-created tournaments, per-country player voting, elected representatives, eligible-player rating views, and locked 26-player national squads.

**Architecture:** Add a dedicated international tournament backend because elections, one-vote rules, representative permissions, and squad locks are business workflows rather than plain CRUD. Keep the rules in a small service that is unit-testable with Node's built-in test runner, expose protected Express endpoints, then add focused admin/player/representative React views using `stageClient.http`.

**Tech Stack:** Express, MySQL via `EXECUTESQL`, React 18, Vite, Tailwind, lucide-react, existing `stageClient`.

---

## Scope And File Map

Create:

- `server/src/server/services/nationalTeamRules.js` — pure validation helpers for voting and squad rules.
- `server/src/server/services/__tests__/nationalTeamRules.test.js` — Node built-in tests for the pure helpers.
- `server/src/server/models/internationalTournamentModel.js` — SQL reads/writes for tournaments, elections, votes, representatives, squads, squad players, and eligible player lists.
- `server/src/server/controllers/internationalTournamentController.js` — protected business endpoints.
- `src/api/internationalTournaments.js` — frontend API wrapper around `stageClient.http`.
- `src/components/international/InternationalTournamentCard.jsx` — shared tournament summary card.
- `src/components/international/CountryElectionPanel.jsx` — voting UI.
- `src/components/international/NationalSquadBuilder.jsx` — representative squad builder.
- `src/pages/InternationalTournaments.jsx` — player-facing international hub.
- `src/components/admin/sections/InternationalTournamentsTab.jsx` — admin management panel.
- `src/pages/admin/AdminInternationalTournamentsPage.jsx` — admin route wrapper.

Modify:

- `server/schema.sql` — add six new tables and indexes.
- `server/src/server.js` — mount `/api/stage/international-tournaments`, add startup migrations.
- `src/App.jsx` — add `/international` and `/admin/international-tournaments` routes.
- `src/pages/Admin.jsx` — import and render the new admin section; load international tournament summary data.
- `src/components/Layout.jsx` or the existing nav component inside it — add an International navigation link if the nav is centralized there.
- `src/api/stageClient.js` — no new entity factory needed; only use `stageClient.http`.

Do not modify:

- `src/components/ui/*`
- `base44/*`
- Existing tournament CRUD behavior unless the new admin tab needs to link to classic tournaments.

---

### Task 1: Pure Rule Service And Tests

**Files:**

- Create: `server/src/server/services/nationalTeamRules.js`
- Create: `server/src/server/services/__tests__/nationalTeamRules.test.js`

- [ ] **Step 1: Write the failing tests**

Create `server/src/server/services/__tests__/nationalTeamRules.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeCountryCode,
  canVoteForCandidate,
  validateSquadSelection,
  chooseElectionWinner,
} = require('../nationalTeamRules');

test('normalizeCountryCode uppercases and trims codes', () => {
  assert.equal(normalizeCountryCode(' be '), 'BE');
  assert.equal(normalizeCountryCode(null), '');
});

test('canVoteForCandidate rejects self votes', () => {
  const result = canVoteForCandidate({
    voter: { id: 'p1', country_code: 'BE' },
    candidate: { id: 'p1', country_code: 'BE' },
    election: { country_code: 'BE', status: 'voting_open', voting_opens_at: '2026-05-01T00:00:00Z' },
    now: new Date('2026-05-02T00:00:00Z'),
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'self_vote');
});

test('canVoteForCandidate rejects country mismatch', () => {
  const result = canVoteForCandidate({
    voter: { id: 'p1', country_code: 'BE' },
    candidate: { id: 'p2', country_code: 'FR' },
    election: { country_code: 'BE', status: 'voting_open', voting_opens_at: '2026-05-01T00:00:00Z' },
    now: new Date('2026-05-02T00:00:00Z'),
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'candidate_country_mismatch');
});

test('canVoteForCandidate accepts valid same-country non-self vote', () => {
  const result = canVoteForCandidate({
    voter: { id: 'p1', country_code: 'BE', created_date: '2026-04-01T00:00:00Z' },
    candidate: { id: 'p2', country_code: 'BE' },
    election: { country_code: 'BE', status: 'voting_open', voting_opens_at: '2026-05-01T00:00:00Z' },
    now: new Date('2026-05-02T00:00:00Z'),
  });
  assert.equal(result.ok, true);
});

test('canVoteForCandidate rejects voters created after voting opened', () => {
  const result = canVoteForCandidate({
    voter: { id: 'p1', country_code: 'BE', created_date: '2026-05-02T00:00:00Z' },
    candidate: { id: 'p2', country_code: 'BE' },
    election: { country_code: 'BE', status: 'voting_open', voting_opens_at: '2026-05-01T00:00:00Z' },
    now: new Date('2026-05-03T00:00:00Z'),
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'voter_created_after_open');
});

test('validateSquadSelection rejects more than 26 unique players', () => {
  const playerIds = Array.from({ length: 27 }, (_, index) => `p${index + 1}`);
  const result = validateSquadSelection({ playerIds, maxSquadSize: 26 });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'too_many_players');
});

test('validateSquadSelection rejects duplicate player ids', () => {
  const result = validateSquadSelection({ playerIds: ['p1', 'p1'], maxSquadSize: 26 });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'duplicate_players');
});

test('chooseElectionWinner uses votes then rating as tiebreaker', () => {
  const winner = chooseElectionWinner([
    { player_id: 'p1', vote_count: 3, overall_rating: 88 },
    { player_id: 'p2', vote_count: 3, overall_rating: 91 },
    { player_id: 'p3', vote_count: 2, overall_rating: 99 },
  ]);
  assert.equal(winner.player_id, 'p2');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
node --test server/src/server/services/__tests__/nationalTeamRules.test.js
```

Expected: FAIL with `Cannot find module '../nationalTeamRules'`.

- [ ] **Step 3: Implement the rule service**

Create `server/src/server/services/nationalTeamRules.js`:

```js
function normalizeCountryCode(value) {
  return String(value || '').trim().toUpperCase();
}

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function canVoteForCandidate({ voter, candidate, election, now = new Date() }) {
  if (!voter?.id) return { ok: false, reason: 'missing_voter' };
  if (!candidate?.id) return { ok: false, reason: 'missing_candidate' };
  if (!election?.id && !election?.country_code) return { ok: false, reason: 'missing_election' };
  if (election.status !== 'voting_open') return { ok: false, reason: 'voting_not_open' };

  const electionCountry = normalizeCountryCode(election.country_code);
  const voterCountry = normalizeCountryCode(voter.country_code);
  const candidateCountry = normalizeCountryCode(candidate.country_code);

  if (!electionCountry) return { ok: false, reason: 'missing_election_country' };
  if (voter.id === candidate.id) return { ok: false, reason: 'self_vote' };
  if (voterCountry !== electionCountry) return { ok: false, reason: 'voter_country_mismatch' };
  if (candidateCountry !== electionCountry) return { ok: false, reason: 'candidate_country_mismatch' };

  const openedAt = toDate(election.voting_opens_at);
  const voterCreatedAt = toDate(voter.created_date);
  if (openedAt && voterCreatedAt && voterCreatedAt > openedAt) {
    return { ok: false, reason: 'voter_created_after_open' };
  }

  const closesAt = toDate(election.voting_closes_at);
  const nowDate = toDate(now) || new Date();
  if (closesAt && nowDate > closesAt) return { ok: false, reason: 'voting_closed' };

  return { ok: true };
}

function validateSquadSelection({ playerIds, maxSquadSize = 26 }) {
  if (!Array.isArray(playerIds)) return { ok: false, reason: 'invalid_player_ids' };
  const cleanIds = playerIds.map((id) => String(id || '').trim()).filter(Boolean);
  if (cleanIds.length !== playerIds.length) return { ok: false, reason: 'invalid_player_ids' };
  if (cleanIds.length > maxSquadSize) return { ok: false, reason: 'too_many_players' };
  if (new Set(cleanIds).size !== cleanIds.length) return { ok: false, reason: 'duplicate_players' };
  return { ok: true, playerIds: cleanIds };
}

function chooseElectionWinner(rows = []) {
  const sorted = [...rows].sort((a, b) => {
    const voteDiff = Number(b.vote_count || 0) - Number(a.vote_count || 0);
    if (voteDiff !== 0) return voteDiff;
    const ratingDiff = Number(b.overall_rating || 0) - Number(a.overall_rating || 0);
    if (ratingDiff !== 0) return ratingDiff;
    return String(a.player_id || '').localeCompare(String(b.player_id || ''));
  });
  return sorted[0] || null;
}

module.exports = {
  normalizeCountryCode,
  canVoteForCandidate,
  validateSquadSelection,
  chooseElectionWinner,
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
node --test server/src/server/services/__tests__/nationalTeamRules.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/server/services/nationalTeamRules.js server/src/server/services/__tests__/nationalTeamRules.test.js
git commit -m "test: add national team rule validations"
```

---

### Task 2: Database Schema And Startup Migrations

**Files:**

- Modify: `server/schema.sql`
- Modify: `server/src/server.js`

- [ ] **Step 1: Add fresh-install schema**

Add these tables in `server/schema.sql` near the existing `tournaments` table:

```sql
CREATE TABLE IF NOT EXISTS international_tournaments (
  id                  VARCHAR(36) PRIMARY KEY,
  name                VARCHAR(200) NOT NULL,
  tournament_type     VARCHAR(50)  NOT NULL,
  region              VARCHAR(100) NULL,
  status              VARCHAR(40)  NOT NULL DEFAULT 'draft',
  voting_opens_at     DATETIME     NULL,
  voting_closes_at    DATETIME     NULL,
  squad_locks_at      DATETIME     NULL,
  starts_at           DATETIME     NULL,
  max_squad_size      INT          NOT NULL DEFAULT 26,
  matchday_squad_size INT          NOT NULL DEFAULT 18,
  starters_size       INT          NOT NULL DEFAULT 11,
  bench_size          INT          NOT NULL DEFAULT 7,
  eligible_countries  JSON         NULL,
  created_by_user_id  VARCHAR(36)  NULL,
  created_by_email    VARCHAR(255) NULL,
  created_date        DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_date        DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_it_status (status),
  INDEX idx_it_type_region (tournament_type, region),
  INDEX idx_it_dates (voting_opens_at, voting_closes_at, starts_at)
);

CREATE TABLE IF NOT EXISTS national_team_elections (
  id                         VARCHAR(36) PRIMARY KEY,
  international_tournament_id VARCHAR(36) NOT NULL,
  country_code                VARCHAR(10) NOT NULL,
  country_name                VARCHAR(100) NULL,
  status                      VARCHAR(40) NOT NULL DEFAULT 'draft',
  voting_opens_at             DATETIME NULL,
  voting_closes_at            DATETIME NULL,
  winner_player_id            VARCHAR(36) NULL,
  winner_vote_count           INT DEFAULT 0,
  created_date                DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_date                DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_nte_tournament_country (international_tournament_id, country_code),
  INDEX idx_nte_tournament (international_tournament_id),
  INDEX idx_nte_country_status (country_code, status)
);

CREATE TABLE IF NOT EXISTS national_team_votes (
  id                  VARCHAR(36) PRIMARY KEY,
  election_id          VARCHAR(36) NOT NULL,
  tournament_id        VARCHAR(36) NOT NULL,
  country_code         VARCHAR(10) NOT NULL,
  voter_player_id      VARCHAR(36) NOT NULL,
  candidate_player_id  VARCHAR(36) NOT NULL,
  created_date         DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_ntv_election_voter (election_id, voter_player_id),
  INDEX idx_ntv_election_candidate (election_id, candidate_player_id),
  INDEX idx_ntv_tournament_country (tournament_id, country_code)
);

CREATE TABLE IF NOT EXISTS national_team_representatives (
  id                  VARCHAR(36) PRIMARY KEY,
  tournament_id        VARCHAR(36) NOT NULL,
  election_id          VARCHAR(36) NOT NULL,
  country_code         VARCHAR(10) NOT NULL,
  player_id            VARCHAR(36) NOT NULL,
  vote_count           INT DEFAULT 0,
  status               VARCHAR(40) DEFAULT 'active',
  created_date         DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_ntr_tournament_country (tournament_id, country_code),
  INDEX idx_ntr_player (player_id),
  INDEX idx_ntr_election (election_id)
);

CREATE TABLE IF NOT EXISTS national_team_squads (
  id                  VARCHAR(36) PRIMARY KEY,
  tournament_id        VARCHAR(36) NOT NULL,
  country_code         VARCHAR(10) NOT NULL,
  representative_id    VARCHAR(36) NULL,
  status               VARCHAR(40) DEFAULT 'draft',
  locked_at            DATETIME NULL,
  submitted_by_player_id VARCHAR(36) NULL,
  created_date         DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_date         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_nts_tournament_country (tournament_id, country_code),
  INDEX idx_nts_rep (representative_id),
  INDEX idx_nts_status (status)
);

CREATE TABLE IF NOT EXISTS national_team_squad_players (
  id                  VARCHAR(36) PRIMARY KEY,
  squad_id             VARCHAR(36) NOT NULL,
  tournament_id        VARCHAR(36) NOT NULL,
  country_code         VARCHAR(10) NOT NULL,
  player_id            VARCHAR(36) NOT NULL,
  position             VARCHAR(50) NULL,
  overall_rating       DECIMAL(4,1) DEFAULT 0,
  created_date         DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_ntsp_squad_player (squad_id, player_id),
  INDEX idx_ntsp_tournament_country (tournament_id, country_code),
  INDEX idx_ntsp_player (player_id)
);
```

- [ ] **Step 2: Add startup migrations**

In `server/src/server.js`, inside `runStartupMigrations`, add matching `CREATE TABLE IF NOT EXISTS` statements for the six tables above. Use `EXECUTESQL(\`...\`).catch(err => console.error('[migration] <table>:', err.message));` exactly like existing startup tables.

- [ ] **Step 3: Syntax check the server**

Run:

```bash
node --check server/src/server.js
```

Expected: no output and exit code 0.

- [ ] **Step 4: Commit**

```bash
git add server/schema.sql server/src/server.js
git commit -m "feat: add national team tournament schema"
```

---

### Task 3: Backend Model

**Files:**

- Create: `server/src/server/models/internationalTournamentModel.js`

- [ ] **Step 1: Create the SQL model**

Create `server/src/server/models/internationalTournamentModel.js`:

```js
const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class InternationalTournamentModel {
  listTournaments(limit = 100) {
    return EXECUTESQL(
      'SELECT * FROM international_tournaments ORDER BY created_date DESC LIMIT ?',
      [Math.min(Number(limit) || 100, 200)]
    );
  }

  getTournament(id) {
    return EXECUTESQL('SELECT * FROM international_tournaments WHERE id = ? LIMIT 1', [id]);
  }

  async createTournament(body, user) {
    const id = body.id || uuidv4();
    await EXECUTESQL(
      `INSERT INTO international_tournaments
       (id, name, tournament_type, region, status, voting_opens_at, voting_closes_at,
        squad_locks_at, starts_at, eligible_countries, created_by_user_id, created_by_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        body.name,
        body.tournament_type,
        body.region || null,
        body.status || 'draft',
        body.voting_opens_at || null,
        body.voting_closes_at || null,
        body.squad_locks_at || null,
        body.starts_at || null,
        body.eligible_countries ? JSON.stringify(body.eligible_countries) : null,
        user?.id || null,
        user?.email || null,
      ]
    );
    return this.getTournament(id);
  }

  listElections(tournamentId) {
    return EXECUTESQL(
      `SELECT e.*,
              p.gamertag AS winner_gamertag,
              p.overall_rating AS winner_overall_rating
       FROM national_team_elections e
       LEFT JOIN players p ON p.id = e.winner_player_id
       WHERE e.international_tournament_id = ?
       ORDER BY e.country_name ASC, e.country_code ASC`,
      [tournamentId]
    );
  }

  getElection(id) {
    return EXECUTESQL('SELECT * FROM national_team_elections WHERE id = ? LIMIT 1', [id]);
  }

  getPlayer(id) {
    return EXECUTESQL('SELECT * FROM players WHERE id = ? LIMIT 1', [id]);
  }

  getPlayerForUser(user) {
    return EXECUTESQL(
      'SELECT * FROM players WHERE user_id = ? OR LOWER(email) = LOWER(?) LIMIT 1',
      [user?.id || '', user?.email || '']
    );
  }

  listCountriesFromPlayers() {
    return EXECUTESQL(
      `SELECT UPPER(country_code) AS country_code,
              MAX(country) AS country_name,
              COUNT(*) AS player_count
       FROM players
       WHERE country_code IS NOT NULL AND country_code <> ''
       GROUP BY UPPER(country_code)
       ORDER BY country_name ASC, country_code ASC`
    );
  }

  async openVoting(tournament, countries) {
    await EXECUTESQL(
      'UPDATE international_tournaments SET status = ?, updated_date = CURRENT_TIMESTAMP WHERE id = ?',
      ['voting_open', tournament.id]
    );
    for (const country of countries) {
      await EXECUTESQL(
        `INSERT INTO national_team_elections
         (id, international_tournament_id, country_code, country_name, status, voting_opens_at, voting_closes_at)
         VALUES (?, ?, ?, ?, 'voting_open', ?, ?)
         ON DUPLICATE KEY UPDATE
           country_name = VALUES(country_name),
           status = 'voting_open',
           voting_opens_at = VALUES(voting_opens_at),
           voting_closes_at = VALUES(voting_closes_at)`,
        [
          uuidv4(),
          tournament.id,
          country.country_code,
          country.country_name || country.country_code,
          tournament.voting_opens_at,
          tournament.voting_closes_at,
        ]
      );
    }
    return this.listElections(tournament.id);
  }

  findVote(electionId, voterPlayerId) {
    return EXECUTESQL(
      'SELECT * FROM national_team_votes WHERE election_id = ? AND voter_player_id = ? LIMIT 1',
      [electionId, voterPlayerId]
    );
  }

  async createVote({ election, voter, candidate }) {
    const id = uuidv4();
    await EXECUTESQL(
      `INSERT INTO national_team_votes
       (id, election_id, tournament_id, country_code, voter_player_id, candidate_player_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        election.id,
        election.international_tournament_id,
        election.country_code,
        voter.id,
        candidate.id,
      ]
    );
    return EXECUTESQL('SELECT * FROM national_team_votes WHERE id = ? LIMIT 1', [id]);
  }

  voteTotals(electionId) {
    return EXECUTESQL(
      `SELECT v.candidate_player_id AS player_id,
              COUNT(*) AS vote_count,
              p.gamertag,
              p.overall_rating
       FROM national_team_votes v
       JOIN players p ON p.id = v.candidate_player_id
       WHERE v.election_id = ?
       GROUP BY v.candidate_player_id, p.gamertag, p.overall_rating`,
      [electionId]
    );
  }

  async closeElection(election, winner) {
    await EXECUTESQL(
      `UPDATE national_team_elections
       SET status = 'closed', winner_player_id = ?, winner_vote_count = ?, updated_date = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [winner?.player_id || null, winner?.vote_count || 0, election.id]
    );
    if (winner?.player_id) {
      await EXECUTESQL(
        `INSERT INTO national_team_representatives
         (id, tournament_id, election_id, country_code, player_id, vote_count, status)
         VALUES (?, ?, ?, ?, ?, ?, 'active')
         ON DUPLICATE KEY UPDATE
           election_id = VALUES(election_id),
           player_id = VALUES(player_id),
           vote_count = VALUES(vote_count),
           status = 'active'`,
        [uuidv4(), election.international_tournament_id, election.id, election.country_code, winner.player_id, winner.vote_count || 0]
      );
    }
  }

  listEligiblePlayers(tournamentId, countryCode) {
    return EXECUTESQL(
      `SELECT p.id, p.gamertag, p.email, p.position, p.secondary_position, p.platform,
              p.country, UPPER(p.country_code) AS country_code, p.club_id,
              p.overall_rating, p.avg_match_rating, p.matches_played, p.goals, p.assists,
              c.name AS club_name, c.tag AS club_tag
       FROM players p
       LEFT JOIN clubs c ON c.id = p.club_id
       WHERE UPPER(p.country_code) = UPPER(?)
       ORDER BY p.overall_rating DESC, p.gamertag ASC`,
      [countryCode]
    );
  }

  getRepresentative(tournamentId, countryCode, playerId) {
    return EXECUTESQL(
      `SELECT * FROM national_team_representatives
       WHERE tournament_id = ? AND UPPER(country_code) = UPPER(?) AND player_id = ? AND status = 'active'
       LIMIT 1`,
      [tournamentId, countryCode, playerId]
    );
  }

  getSquad(tournamentId, countryCode) {
    return EXECUTESQL(
      'SELECT * FROM national_team_squads WHERE tournament_id = ? AND UPPER(country_code) = UPPER(?) LIMIT 1',
      [tournamentId, countryCode]
    );
  }

  listSquadPlayers(squadId) {
    return EXECUTESQL(
      `SELECT sp.*, p.gamertag, p.email, p.secondary_position, p.platform, c.name AS club_name
       FROM national_team_squad_players sp
       JOIN players p ON p.id = sp.player_id
       LEFT JOIN clubs c ON c.id = p.club_id
       WHERE sp.squad_id = ?
       ORDER BY sp.overall_rating DESC, p.gamertag ASC`,
      [squadId]
    );
  }

  async saveSquad({ tournamentId, countryCode, representativeId, submitterPlayerId, players }) {
    const existing = await this.getSquad(tournamentId, countryCode);
    const squadId = existing[0]?.id || uuidv4();
    if (existing[0]?.status === 'locked') {
      const error = new Error('Squad is locked');
      error.status = 409;
      throw error;
    }
    await EXECUTESQL(
      `INSERT INTO national_team_squads
       (id, tournament_id, country_code, representative_id, status, submitted_by_player_id)
       VALUES (?, ?, ?, ?, 'draft', ?)
       ON DUPLICATE KEY UPDATE
         representative_id = VALUES(representative_id),
         submitted_by_player_id = VALUES(submitted_by_player_id),
         updated_date = CURRENT_TIMESTAMP`,
      [squadId, tournamentId, countryCode, representativeId, submitterPlayerId]
    );
    await EXECUTESQL('DELETE FROM national_team_squad_players WHERE squad_id = ?', [squadId]);
    for (const player of players) {
      await EXECUTESQL(
        `INSERT INTO national_team_squad_players
         (id, squad_id, tournament_id, country_code, player_id, position, overall_rating)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), squadId, tournamentId, countryCode, player.id, player.position || null, player.overall_rating || 0]
      );
    }
    return this.getSquad(tournamentId, countryCode);
  }

  lockSquad(squadId) {
    return EXECUTESQL(
      "UPDATE national_team_squads SET status = 'locked', locked_at = CURRENT_TIMESTAMP WHERE id = ?",
      [squadId]
    );
  }
}

module.exports = InternationalTournamentModel;
```

- [ ] **Step 2: Syntax check**

Run:

```bash
node --check server/src/server/models/internationalTournamentModel.js
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add server/src/server/models/internationalTournamentModel.js
git commit -m "feat: add international tournament model"
```

---

### Task 4: Backend Controller, Routes, And Audit Logs

**Files:**

- Create: `server/src/server/controllers/internationalTournamentController.js`
- Modify: `server/src/server.js`

- [ ] **Step 1: Create the controller**

Create `server/src/server/controllers/internationalTournamentController.js`. Use this structure and keep response shapes consistent:

```js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const InternationalTournamentModel = require('../models/internationalTournamentModel');
const { EXECUTESQL } = require('../db/database');
const {
  canVoteForCandidate,
  chooseElectionWinner,
  normalizeCountryCode,
  validateSquadSelection,
} = require('../services/nationalTeamRules');

const router = express.Router();
const model = new InternationalTournamentModel();

function sendError(res, err) {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message, code: err.code || err.reason || 'error' });
}

async function writeAdminAudit(req, { action, entityType, entityId, oldValue = null, newValue = null, reason = null }) {
  await EXECUTESQL(
    `INSERT INTO admin_audit_log
     (id, admin_user_id, admin_email, action, entity_type, entity_id, old_value, new_value, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      req.user?.id || null,
      req.user?.email || null,
      action,
      entityType,
      entityId,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      reason,
    ]
  ).catch((err) => console.error('[audit] international tournament:', err.message));
}

router.get('/', async (req, res) => {
  try {
    const rows = await model.listTournaments(req.query.limit || 100);
    res.json(rows);
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/', async (req, res) => {
  try {
    if (!req.body?.name) return res.status(400).json({ error: 'name is required', code: 'missing_name' });
    if (!req.body?.tournament_type) return res.status(400).json({ error: 'tournament_type is required', code: 'missing_tournament_type' });
    const rows = await model.createTournament(req.body, req.user);
    await writeAdminAudit(req, {
      action: 'create_international_tournament',
      entityType: 'international_tournament',
      entityId: rows[0].id,
      newValue: rows[0],
    });
    res.status(201).json(rows[0]);
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/:id/elections', async (req, res) => {
  try {
    const elections = await model.listElections(req.params.id);
    res.json(elections);
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/:id/open-voting', async (req, res) => {
  try {
    const tournament = (await model.getTournament(req.params.id))[0];
    if (!tournament) return res.status(404).json({ error: 'Tournament not found', code: 'not_found' });
    const countries = Array.isArray(req.body?.countries) && req.body.countries.length
      ? req.body.countries
      : await model.listCountriesFromPlayers();
    const elections = await model.openVoting(tournament, countries.map((c) => ({
      country_code: normalizeCountryCode(c.country_code),
      country_name: c.country_name || c.country || c.country_code,
    })).filter((c) => c.country_code));
    await writeAdminAudit(req, {
      action: 'open_international_voting',
      entityType: 'international_tournament',
      entityId: tournament.id,
      newValue: { countries: elections.map((e) => e.country_code) },
    });
    res.json({ tournament_id: tournament.id, elections });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/elections/:electionId/vote', async (req, res) => {
  try {
    const election = (await model.getElection(req.params.electionId))[0];
    if (!election) return res.status(404).json({ error: 'Election not found', code: 'not_found' });
    const voter = (await model.getPlayerForUser(req.user))[0];
    const candidate = (await model.getPlayer(req.body?.candidate_player_id))[0];
    const validation = canVoteForCandidate({ voter, candidate, election });
    if (!validation.ok) return res.status(400).json({ error: validation.reason, code: validation.reason });
    const existing = await model.findVote(election.id, voter.id);
    if (existing.length) return res.status(409).json({ error: 'duplicate_vote', code: 'duplicate_vote' });
    const vote = (await model.createVote({ election, voter, candidate }))[0];
    res.status(201).json(vote);
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/:id/close-voting', async (req, res) => {
  try {
    const elections = await model.listElections(req.params.id);
    for (const election of elections) {
      const totals = await model.voteTotals(election.id);
      await model.closeElection(election, chooseElectionWinner(totals));
    }
    const updated = await model.listElections(req.params.id);
    await writeAdminAudit(req, {
      action: 'close_international_voting',
      entityType: 'international_tournament',
      entityId: req.params.id,
      newValue: updated,
    });
    res.json(updated);
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/:id/eligible-players', async (req, res) => {
  try {
    const countryCode = normalizeCountryCode(req.query.country_code);
    if (!countryCode) return res.status(400).json({ error: 'country_code is required', code: 'missing_country_code' });
    const rows = await model.listEligiblePlayers(req.params.id, countryCode);
    res.json(rows);
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/:id/squads/:countryCode', async (req, res) => {
  try {
    const squad = (await model.getSquad(req.params.id, req.params.countryCode))[0] || null;
    const players = squad ? await model.listSquadPlayers(squad.id) : [];
    res.json({ squad, players });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/:id/squads', async (req, res) => {
  try {
    const countryCode = normalizeCountryCode(req.body?.country_code);
    const playerIds = req.body?.player_ids || [];
    const selection = validateSquadSelection({ playerIds, maxSquadSize: 26 });
    if (!selection.ok) return res.status(400).json({ error: selection.reason, code: selection.reason });

    const submitter = (await model.getPlayerForUser(req.user))[0];
    const rep = (await model.getRepresentative(req.params.id, countryCode, submitter?.id))[0];
    if (!rep) return res.status(403).json({ error: 'representative_required', code: 'representative_required' });

    const eligiblePlayers = await model.listEligiblePlayers(req.params.id, countryCode);
    const byId = new Map(eligiblePlayers.map((player) => [player.id, player]));
    const selectedPlayers = selection.playerIds.map((id) => byId.get(id));
    if (selectedPlayers.some((player) => !player)) {
      return res.status(400).json({ error: 'player_not_eligible', code: 'player_not_eligible' });
    }

    const squad = (await model.saveSquad({
      tournamentId: req.params.id,
      countryCode,
      representativeId: rep.id,
      submitterPlayerId: submitter.id,
      players: selectedPlayers,
    }))[0];
    const players = await model.listSquadPlayers(squad.id);
    res.status(201).json({ squad, players });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/:id/squads/:squadId/lock', async (req, res) => {
  try {
    await model.lockSquad(req.params.squadId);
    await writeAdminAudit(req, {
      action: 'lock_national_squad',
      entityType: 'national_team_squad',
      entityId: req.params.squadId,
      newValue: { tournament_id: req.params.id, status: 'locked' },
    });
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
```

- [ ] **Step 2: Mount the route**

In `server/src/server.js`, near existing protected routes, add:

```js
app.use('/api/stage/international-tournaments', verifyToken, require('./server/controllers/internationalTournamentController'));
```

- [ ] **Step 3: Syntax check**

Run:

```bash
node --check server/src/server/controllers/internationalTournamentController.js
node --check server/src/server.js
```

Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add server/src/server/controllers/internationalTournamentController.js server/src/server.js
git commit -m "feat: add international tournament API"
```

---

### Task 5: Frontend API Wrapper

**Files:**

- Create: `src/api/internationalTournaments.js`

- [ ] **Step 1: Add the frontend wrapper**

Create `src/api/internationalTournaments.js`:

```js
import { stageClient } from '@/api/stageClient';

const base = '/international-tournaments';

export const internationalTournamentsApi = {
  list(limit = 100) {
    return stageClient.http.get(`${base}?limit=${encodeURIComponent(limit)}`);
  },

  create(body) {
    return stageClient.http.post(base, body);
  },

  openVoting(id, countries = []) {
    return stageClient.http.post(`${base}/${id}/open-voting`, { countries });
  },

  closeVoting(id) {
    return stageClient.http.post(`${base}/${id}/close-voting`, {});
  },

  elections(id) {
    return stageClient.http.get(`${base}/${id}/elections`);
  },

  vote(electionId, candidatePlayerId) {
    return stageClient.http.post(`${base}/elections/${electionId}/vote`, {
      candidate_player_id: candidatePlayerId,
    });
  },

  eligiblePlayers(id, countryCode) {
    return stageClient.http.get(`${base}/${id}/eligible-players?country_code=${encodeURIComponent(countryCode)}`);
  },

  squad(id, countryCode) {
    return stageClient.http.get(`${base}/${id}/squads/${encodeURIComponent(countryCode)}`);
  },

  saveSquad(id, countryCode, playerIds) {
    return stageClient.http.post(`${base}/${id}/squads`, {
      country_code: countryCode,
      player_ids: playerIds,
    });
  },

  lockSquad(id, squadId) {
    return stageClient.http.post(`${base}/${id}/squads/${squadId}/lock`, {});
  },
};
```

- [ ] **Step 2: Typecheck the frontend**

Run:

```bash
npm run typecheck
```

Expected: clean or only existing unrelated warnings if the repo already has them. Do not claim clean if it is not clean.

- [ ] **Step 3: Commit**

```bash
git add src/api/internationalTournaments.js
git commit -m "feat: add international tournament client"
```

---

### Task 6: Admin International Tournament Panel

**Files:**

- Create: `src/components/admin/sections/InternationalTournamentsTab.jsx`
- Create: `src/pages/admin/AdminInternationalTournamentsPage.jsx`
- Modify: `src/pages/Admin.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create the admin tab component**

Create `src/components/admin/sections/InternationalTournamentsTab.jsx` with create/open/close controls:

```jsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/admin/shared/EmptyState';
import { Globe2, Plus, Vote, Lock } from 'lucide-react';

export default function InternationalTournamentsTab({
  tournaments,
  electionsByTournament,
  onCreate,
  onOpenVoting,
  onCloseVoting,
  saving,
}) {
  const [form, setForm] = useState({
    name: '',
    tournament_type: 'world_cup',
    region: 'Global',
    voting_opens_at: '',
    voting_closes_at: '',
    squad_locks_at: '',
    starts_at: '',
  });

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event) {
    event.preventDefault();
    await onCreate(form);
    setForm({
      name: '',
      tournament_type: 'world_cup',
      region: 'Global',
      voting_opens_at: '',
      voting_closes_at: '',
      squad_locks_at: '',
      starts_at: '',
    });
  }

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="bg-card border border-border rounded p-4 grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2 flex items-center gap-2">
          <Globe2 className="w-4 h-4 text-primary" />
          <h3 className="font-heading uppercase text-sm tracking-wide text-foreground">Create International Tournament</h3>
        </div>
        <input className="bg-secondary border border-border rounded px-3 py-2 text-sm" placeholder="Tournament name" value={form.name} onChange={(event) => set('name', event.target.value)} />
        <select className="bg-secondary border border-border rounded px-3 py-2 text-sm" value={form.tournament_type} onChange={(event) => set('tournament_type', event.target.value)}>
          <option value="world_cup">World Cup</option>
          <option value="euro">Euro</option>
          <option value="afcon">AFCON</option>
          <option value="copa_america">Copa America</option>
          <option value="asian_cup">Asian Cup</option>
          <option value="custom">Custom</option>
        </select>
        <input className="bg-secondary border border-border rounded px-3 py-2 text-sm" placeholder="Region" value={form.region} onChange={(event) => set('region', event.target.value)} />
        <input className="bg-secondary border border-border rounded px-3 py-2 text-sm" type="datetime-local" value={form.voting_opens_at} onChange={(event) => set('voting_opens_at', event.target.value)} />
        <input className="bg-secondary border border-border rounded px-3 py-2 text-sm" type="datetime-local" value={form.voting_closes_at} onChange={(event) => set('voting_closes_at', event.target.value)} />
        <input className="bg-secondary border border-border rounded px-3 py-2 text-sm" type="datetime-local" value={form.starts_at} onChange={(event) => set('starts_at', event.target.value)} />
        <Button type="submit" disabled={saving || !form.name} className="md:col-span-2 rounded gap-2">
          <Plus className="w-4 h-4" /> Create
        </Button>
      </form>

      {!tournaments.length ? (
        <EmptyState icon={Globe2} text="No international tournaments yet." />
      ) : (
        <div className="space-y-3">
          {tournaments.map((tournament) => {
            const elections = electionsByTournament[tournament.id] || [];
            return (
              <div key={tournament.id} className="bg-card border border-border rounded p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-foreground">{tournament.name}</p>
                    <p className="text-xs text-muted-foreground">{tournament.tournament_type} · {tournament.region || 'Global'} · {tournament.status}</p>
                    <p className="text-xs text-muted-foreground mt-1">{elections.length} country elections</p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => onOpenVoting(tournament.id)} className="rounded gap-1.5">
                      <Vote className="w-3.5 h-3.5" /> Open Voting
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => onCloseVoting(tournament.id)} className="rounded gap-1.5">
                      <Lock className="w-3.5 h-3.5" /> Close Voting
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create admin route wrapper**

Create `src/pages/admin/AdminInternationalTournamentsPage.jsx`:

```jsx
import Admin from '@/pages/Admin';

export default function AdminInternationalTournamentsPage() {
  return <Admin forcedSection="international-tournaments" />;
}
```

- [ ] **Step 3: Wire `Admin.jsx` state and handlers**

In `src/pages/Admin.jsx`:

```jsx
import InternationalTournamentsTab from '@/components/admin/sections/InternationalTournamentsTab';
import { internationalTournamentsApi } from '@/api/internationalTournaments';
```

Add state:

```jsx
const [internationalTournaments, setInternationalTournaments] = useState([]);
const [internationalElections, setInternationalElections] = useState({});
const [savingInternationalTournament, setSavingInternationalTournament] = useState(false);
```

Add loader/handlers near other admin handlers:

```jsx
async function loadInternationalTournaments() {
  const rows = await internationalTournamentsApi.list(100).catch(() => []);
  setInternationalTournaments(rows);
  const pairs = await Promise.all(rows.map(async (row) => [
    row.id,
    await internationalTournamentsApi.elections(row.id).catch(() => []),
  ]));
  setInternationalElections(Object.fromEntries(pairs));
}

async function createInternationalTournament(form) {
  setSavingInternationalTournament(true);
  try {
    await internationalTournamentsApi.create(form);
    await loadInternationalTournaments();
  } finally {
    setSavingInternationalTournament(false);
  }
}

async function openInternationalVoting(id) {
  await internationalTournamentsApi.openVoting(id);
  await loadInternationalTournaments();
}

async function closeInternationalVoting(id) {
  await internationalTournamentsApi.closeVoting(id);
  await loadInternationalTournaments();
}
```

Call `loadInternationalTournaments()` from `loadAll()` after the existing `Promise.all` settles, or in a separate `useEffect` that runs on admin load.

Render the tab:

```jsx
{adminTab === 'international-tournaments' && (
  <InternationalTournamentsTab
    tournaments={internationalTournaments}
    electionsByTournament={internationalElections}
    onCreate={createInternationalTournament}
    onOpenVoting={openInternationalVoting}
    onCloseVoting={closeInternationalVoting}
    saving={savingInternationalTournament}
  />
)}
```

- [ ] **Step 4: Wire `App.jsx` route**

In `src/App.jsx`, import:

```jsx
import AdminInternationalTournamentsPage from './pages/admin/AdminInternationalTournamentsPage';
```

Add the route before `/admin/:section`:

```jsx
<Route path="/admin/international-tournaments" element={<AdminInternationalTournamentsPage />} />
```

- [ ] **Step 5: Typecheck**

Run:

```bash
npm run typecheck
```

Expected: pass or known unrelated failures only.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/sections/InternationalTournamentsTab.jsx src/pages/admin/AdminInternationalTournamentsPage.jsx src/pages/Admin.jsx src/App.jsx
git commit -m "feat: add admin international tournament panel"
```

---

### Task 7: Player Voting And Representative Squad UI

**Files:**

- Create: `src/components/international/InternationalTournamentCard.jsx`
- Create: `src/components/international/CountryElectionPanel.jsx`
- Create: `src/components/international/NationalSquadBuilder.jsx`
- Create: `src/pages/InternationalTournaments.jsx`
- Modify: `src/App.jsx`
- Modify: `src/components/Layout.jsx` or the repo's central nav component.

- [ ] **Step 1: Create shared tournament card**

Create `src/components/international/InternationalTournamentCard.jsx`:

```jsx
import { Globe2 } from 'lucide-react';

export default function InternationalTournamentCard({ tournament, children }) {
  return (
    <section className="bg-card border border-border rounded p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Globe2 className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-heading text-lg uppercase text-foreground">{tournament.name}</h2>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            {tournament.tournament_type} · {tournament.region || 'Global'} · {tournament.status}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}
```

- [ ] **Step 2: Create election voting panel**

Create `src/components/international/CountryElectionPanel.jsx`:

```jsx
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Vote } from 'lucide-react';

export default function CountryElectionPanel({ election, players, myPlayer, onVote }) {
  const [candidateId, setCandidateId] = useState('');
  const candidates = useMemo(
    () => players.filter((player) => player.id !== myPlayer?.id),
    [players, myPlayer?.id]
  );

  if (!election) {
    return <p className="text-sm text-muted-foreground">No election is open for your country yet.</p>;
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-bold text-foreground">{election.country_name || election.country_code} Representative Vote</p>
        <p className="text-xs text-muted-foreground">Choose one player. You cannot vote for yourself.</p>
      </div>
      <select className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm" value={candidateId} onChange={(event) => setCandidateId(event.target.value)}>
        <option value="">Select candidate</option>
        {candidates.map((player) => (
          <option key={player.id} value={player.id}>
            {player.gamertag || player.email} · {player.position || 'Any'} · OVR {player.overall_rating || 0}
          </option>
        ))}
      </select>
      <Button type="button" disabled={!candidateId} onClick={() => onVote(election.id, candidateId)} className="rounded gap-2">
        <Vote className="w-4 h-4" /> Vote
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Create squad builder**

Create `src/components/international/NationalSquadBuilder.jsx`:

```jsx
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';

export default function NationalSquadBuilder({ players, squad, squadPlayers, onSave }) {
  const initialSelected = useMemo(() => new Set((squadPlayers || []).map((player) => player.player_id)), [squadPlayers]);
  const [selected, setSelected] = useState(initialSelected);
  const locked = squad?.status === 'locked';

  function toggle(playerId) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(playerId)) next.delete(playerId);
      else if (next.size < 26) next.add(playerId);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-bold text-foreground">National Squad</p>
          <p className="text-xs text-muted-foreground">{selected.size}/26 selected · matchday rule: 11 starters + 7 bench</p>
        </div>
        <Button type="button" disabled={locked} onClick={() => onSave([...selected])} className="rounded gap-2">
          <Save className="w-4 h-4" /> Save Squad
        </Button>
      </div>
      <div className="overflow-x-auto border border-border rounded">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Pick</th>
              <th className="text-left px-3 py-2">Player</th>
              <th className="text-left px-3 py-2">Position</th>
              <th className="text-left px-3 py-2">Club</th>
              <th className="text-right px-3 py-2">OVR</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <input type="checkbox" disabled={locked} checked={selected.has(player.id)} onChange={() => toggle(player.id)} />
                </td>
                <td className="px-3 py-2 font-medium">{player.gamertag || player.email}</td>
                <td className="px-3 py-2 text-muted-foreground">{player.position || '-'}</td>
                <td className="px-3 py-2 text-muted-foreground">{player.club_name || '-'}</td>
                <td className="px-3 py-2 text-right font-bold">{player.overall_rating || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create the page**

Create `src/pages/InternationalTournaments.jsx` with this flow:

```jsx
import { useEffect, useMemo, useState } from 'react';
import { stageClient } from '@/api/stageClient';
import { internationalTournamentsApi } from '@/api/internationalTournaments';
import InternationalTournamentCard from '@/components/international/InternationalTournamentCard';
import CountryElectionPanel from '@/components/international/CountryElectionPanel';
import NationalSquadBuilder from '@/components/international/NationalSquadBuilder';

export default function InternationalTournaments() {
  const [myPlayer, setMyPlayer] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [electionsByTournament, setElectionsByTournament] = useState({});
  const [playersByTournament, setPlayersByTournament] = useState({});
  const [squadsByTournament, setSquadsByTournament] = useState({});

  async function load() {
    const user = await stageClient.auth.me().catch(() => null);
    const players = user?.email ? await stageClient.entities.Player.filter({ email: user.email }).catch(() => []) : [];
    const player = players[0] || null;
    setMyPlayer(player);
    const rows = await internationalTournamentsApi.list(100).catch(() => []);
    setTournaments(rows);
    if (!player?.country_code) return;

    const electionPairs = await Promise.all(rows.map(async (tournament) => [
      tournament.id,
      await internationalTournamentsApi.elections(tournament.id).catch(() => []),
    ]));
    setElectionsByTournament(Object.fromEntries(electionPairs));

    const playerPairs = await Promise.all(rows.map(async (tournament) => [
      tournament.id,
      await internationalTournamentsApi.eligiblePlayers(tournament.id, player.country_code).catch(() => []),
    ]));
    setPlayersByTournament(Object.fromEntries(playerPairs));

    const squadPairs = await Promise.all(rows.map(async (tournament) => [
      tournament.id,
      await internationalTournamentsApi.squad(tournament.id, player.country_code).catch(() => ({ squad: null, players: [] })),
    ]));
    setSquadsByTournament(Object.fromEntries(squadPairs));
  }

  useEffect(() => {
    load();
  }, []);

  const myCountryCode = String(myPlayer?.country_code || '').toUpperCase();

  async function vote(electionId, candidatePlayerId) {
    await internationalTournamentsApi.vote(electionId, candidatePlayerId);
    await load();
  }

  async function saveSquad(tournamentId, playerIds) {
    await internationalTournamentsApi.saveSquad(tournamentId, myCountryCode, playerIds);
    await load();
  }

  const visibleTournaments = useMemo(
    () => tournaments.filter((tournament) => tournament.status !== 'draft'),
    [tournaments]
  );

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-5">
      <div>
        <h1 className="font-heading text-3xl uppercase text-foreground">International</h1>
        <p className="text-sm text-muted-foreground">Vote for your country representative and follow national squad selection.</p>
      </div>
      {visibleTournaments.map((tournament) => {
        const elections = electionsByTournament[tournament.id] || [];
        const election = elections.find((row) => String(row.country_code).toUpperCase() === myCountryCode);
        const eligiblePlayers = playersByTournament[tournament.id] || [];
        const squadState = squadsByTournament[tournament.id] || { squad: null, players: [] };
        const isRepresentative = election?.winner_player_id && election.winner_player_id === myPlayer?.id;

        return (
          <InternationalTournamentCard key={tournament.id} tournament={tournament}>
            {tournament.status === 'voting_open' && (
              <CountryElectionPanel election={election} players={eligiblePlayers} myPlayer={myPlayer} onVote={vote} />
            )}
            {isRepresentative && (
              <NationalSquadBuilder
                players={eligiblePlayers}
                squad={squadState.squad}
                squadPlayers={squadState.players}
                onSave={(playerIds) => saveSquad(tournament.id, playerIds)}
              />
            )}
          </InternationalTournamentCard>
        );
      })}
    </main>
  );
}
```

- [ ] **Step 5: Wire `App.jsx`**

In `src/App.jsx`, import:

```jsx
import InternationalTournaments from './pages/InternationalTournaments';
```

Add route:

```jsx
<Route path="/international" element={<InternationalTournaments />} />
```

- [ ] **Step 6: Add navigation link**

In `src/components/Layout.jsx` or the central nav file, add an International link near Tournaments or Competitions:

```jsx
{ label: 'International', to: '/international' }
```

Use the existing nav array/style in that file; do not add a second nav system.

- [ ] **Step 7: Typecheck**

Run:

```bash
npm run typecheck
```

Expected: pass or known unrelated failures only.

- [ ] **Step 8: Commit**

```bash
git add src/components/international src/pages/InternationalTournaments.jsx src/App.jsx src/components/Layout.jsx
git commit -m "feat: add national team voting and squad UI"
```

---

### Task 8: End-To-End Verification

**Files:**

- No planned code changes unless verification finds a bug.

- [ ] **Step 1: Run required checks**

Run:

```bash
npm run lint
npm run typecheck
node --check server/src/server.js
node --check server/src/server/controllers/internationalTournamentController.js
node --check server/src/server/models/internationalTournamentModel.js
node --test server/src/server/services/__tests__/nationalTeamRules.test.js
```

Expected: all pass. If `npm run lint` or `npm run typecheck` reports pre-existing unrelated failures, capture the exact output and fix only failures caused by this feature.

- [ ] **Step 2: Start local backend and frontend if env is available**

Run backend with local env, then frontend:

```bash
cd server && npm run dev
npm run dev
```

If local DB credentials are not available, do not claim API endpoint verification. Report that endpoint verification is blocked by local env.

- [ ] **Step 3: Hit the API once**

With a valid token:

```bash
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/stage/international-tournaments?limit=1" | jq .
```

Expected: JSON array.

- [ ] **Step 4: Browser smoke test**

Open:

```text
http://localhost:5173/admin/international-tournaments
http://localhost:5173/international
```

Verify:

- Admin can see the create form.
- A player can see international tournaments.
- Voting UI excludes the current player.
- Representative squad table shows OVR and selected count.

- [ ] **Step 5: Final commit if fixes were needed**

If verification required fixes, run `git status --short`, stage only the files that belong to this feature, and commit. The expected feature files are listed below; omit any that did not change.

```bash
git add server/src/server/services/nationalTeamRules.js server/src/server/services/__tests__/nationalTeamRules.test.js server/src/server/models/internationalTournamentModel.js server/src/server/controllers/internationalTournamentController.js server/src/server.js server/schema.sql src/api/internationalTournaments.js src/components/admin/sections/InternationalTournamentsTab.jsx src/pages/admin/AdminInternationalTournamentsPage.jsx src/pages/Admin.jsx src/components/international src/pages/InternationalTournaments.jsx src/App.jsx src/components/Layout.jsx
git commit -m "fix: verify national team tournament flow"
```

---

## Self-Review Notes

- Spec coverage: the plan covers admin-created international tournaments, country elections, no self-votes, one vote per player, player-created-after-open rejection, representative election, visible player ratings, 26-player squads, squad locks, and admin audit logs.
- Intentional first-release limit: per-match 18-player lineup selection is displayed as guidance only and remains deferred until international fixtures exist.
- API choice: no `ENTITY_NAMES` additions because sensitive workflows use dedicated `stageClient.http` calls, matching the repo rule for business actions.
