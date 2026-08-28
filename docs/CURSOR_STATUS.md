# Cursor → Claude — status handshake

Cursor writes here. Claude reads here. One direction only.

When you (Cursor) finish a task from `docs/NEXT_TASK.md`, **replace this whole file**
with your report, then stop. Overwrite, do not append. Never write status into
`docs/GAMEDAY_REBUILD_PROMPT.md` — that file is the spec and stays clean.

Report format: STATUS line (DONE / PARTIAL / BLOCKED), which task, what changed with
file:line, the commands you ran WITH THEIR REAL OUTPUT, what you could not do, and any
decision you need from Lutina.

---

## STATUS — PARTIAL

**Tasks:** 2a (13 columns green) + 2b/2c/2d (report only) + Task 3 (scenarios ran; two HTTP 500s not silently fixed).

`.git/index.lock` was **absent**. Commits are local only — **not pushed**.
`src/pages/TournamentDetail.jsx` was **not** committed with this work.
`env.local.js` was **not** committed.

No application source was edited except the new smoke script
`server/scripts/gameday-result-smoke.js`. Findings below were **not** patched.

---

## TASK 2a — local proof with schema loaded

### Finding (schema.sql does not fully load)

Command as specified:

```
/opt/homebrew/opt/mysql/bin/mysql -h 127.0.0.1 -P 3306 -u root --protocol=TCP
stage_league < server/schema.sql
```

**Actual:**

```
=== load schema.sql ===
ERROR 1064 (42000) at line 1294: You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near 'rank                     INT,
  final_position           INT,
  is_promoted     ' at line 12
exit=1
```

Cause: `CREATE TABLE competition_standings` uses unquoted column `rank`, which is reserved in MySQL 8. I did **not** backtick it or otherwise fix `schema.sql`. Tables **before** line 1294 were created, including `matches`, `clubs`, `players`, `users`. Tables **after** that point (including `landing_page_contents`) were not.

### Core tables exist

```
=== core tables present? ===
Tables_in_stage_league (matches)
matches
Tables_in_stage_league (clubs)
clubs
Tables_in_stage_league (players)
players
Tables_in_stage_league (users)
users
```

`SHOW TABLES` also listed the rest of the pre-1294 schema (auth_tokens, matches, clubs, …). Not pasted in full here; the four required names exist.

### Restart + first boot (Task 2a)

Killed existing nodemon (`68618` / `35133`), then `cd server && npm run dev`. Health: `{"ok":true,"service":"stage-server"}`.

First-boot counts (before nodemon later restarted because I added the smoke script under `server/scripts/`):

- **48** `[migration]` lines
- **4** `Failed to add`
- **37** `[migration] Added `

No `[migration] startup error`. No orphan throw.

The 13 `matches.result_*` columns were **already present from schema.sql**, so this boot logged **zero** `Added`/`Failed to add` lines for them. Indexes `idx_matches_result_state` / `idx_matches_result_due` likewise already existed (created by schema.sql before the abort).

The 4 failures (tables never created because schema.sql stopped at `rank`):

```
[migration] Failed to add landing_page_contents.stats_json: Table 'stage_league.landing_page_contents' doesn't exist
[migration] Failed to add landing_page_contents.section1_tag: Table 'stage_league.landing_page_contents' doesn't exist
[migration] Failed to add landing_page_contents.section2_tag: Table 'stage_league.landing_page_contents' doesn't exist
[migration] Failed to add landing_page_contents.section3_tag: Table 'stage_league.landing_page_contents' doesn't exist
```

### SQL proof — 13 columns and both indexes (GREEN)

```
=== SELECT COLUMN_NAME (13 expected) ===
COLUMN_NAME
result_state
result_submit_side
decided_on_penalties
penalty_winner_side
allow_penalties
result_due_at
confirmation_due_at
review_due_at
correction_count
home_counter_count
home_dispute_submission
away_dispute_submission
result_history
exit=0

=== SHOW INDEX idx_matches_result% ===
Table	Non_unique	Key_name	Seq_in_index	Column_name	Collation	Cardinality	Sub_part	Packed	Null	Index_type	Comment	Index_comment	Visible	Expression
matches	1	idx_matches_result_state	1	result_state	A	0	NULL	NULL	YES	BTREE			YES	NULL
matches	1	idx_matches_result_due	1	result_due_at	A	0	NULL	NULL	YES	BTREE			YES	NULL
exit=0
```

This proves those columns/indexes exist on a schema-initialized local DB. It does **not** prove production.

---

## TASK 2b — orphan-club throw on empty/missing `clubs` (report only, not fixed)

Check is `server/src/server/migrations/startupMigrations.js:1140-1147`:

```javascript
  const clubPresidentOrphans = await EXECUTESQL(
    'SELECT id, name FROM clubs WHERE president_user_id IS NULL LIMIT 10'
  ).catch(err => {
    console.error('[migration] club_president_orphans:', err.message);
    return [{ id: 'lookup_failed', name: err.message }];
  });
  if (clubPresidentOrphans.length) {
    throw new Error(`clubs.president_user_id migration left ${clubPresidentOrphans.length} orphan club(s)`);
  }
```

**Cause:** when the SELECT fails (missing table, missing column, any SQL error), the `.catch` **invents one fake row** `{ id: 'lookup_failed', ... }`. `.length` is then `1`, so it throws `left 1 orphan club(s)` even with zero clubs. The previous empty-DB boot was this path (`Table 'stage_league.clubs' doesn't exist`), not a real orphan.

After schema load, the same SELECT against real empty `clubs` returns 0 rows (no throw). Confirmed:

```
=== now orphan query (clubs exists) ===
exit=0

=== missing-table query (simulates previous boot) ===
ERROR 1146 (42S02) at line 1: Table 'stage_league.table_that_does_not_exist' doesn't exist
exit=1
```

This boot had no startup error — the throw is lookup-failure, not “empty table has 1 club”.

**Production risk:** any failure of that SELECT (blip, missing column, permissions) aborts the rest of `runStartupMigrations` because this is a throw, not a log. Genuine NULL `president_user_id` rows would also throw, which is the intended hard stop.

**What I would change (not done):** do not synthesize a fake orphan in `.catch`. Return `[]` and skip the NOT NULL alter, or rethrow the original SQL error. Only throw when the SELECT **succeeded** and returned real club ids.

---

## TASK 2c — two sources of truth (note only, no code)

`AGENTS.md` §6 says `schema.sql` is the fresh-install source and `startupMigrations.js` the boot-time incremental source. A database created by migrations alone never gets `matches`/`clubs`/`players`/`users` — those are only `CREATE TABLE IF NOT EXISTS` in `schema.sql`, while startup `addCol` assumes they already exist and logs-and-continues on failure. The safe bootstrap is: load `schema.sql` **first**, then start the server so migrations add leftover columns/indexes. That procedure is itself currently broken: `schema.sql` aborts at reserved `rank` on `competition_standings` (line 1294), so anything after that line is missing, and this boot then `Failed to add` four `landing_page_contents` columns. Do not treat “boot the empty DB” as an install path.

---

## TASK 2d — `TournamentDetail.jsx` (left uncommitted)

Working-tree diff only (4 lines):

```
-    await Promise.all(awayEmails.map((email, index) =>
+    await Promise.all(awayEmails.map((email) =>
...
-        related_entity_id: `${scheduleMatch.id}:${Date.now()}:${index}`,
+        related_entity_id: scheduleMatch.id,
```

**Where it came from:** previous Cursor session in this repo (not this task loop). Inbox `related_entity_id` was being built as `uuid:timestamp:index`, which does not fit `VARCHAR(36)`. It was changed to the match id, as league schedule already does. I did not commit it with the migration/smoke work. `docs/GAMEDAY_REBUILD_PROMPT.md` is also modified in the working tree and was also left uncommitted.

---

## TASK 3 — scripted smoke test

New file: `server/scripts/gameday-result-smoke.js`.
Ran against local `:8080` with two freshly registered club accounts.

### Setup findings (not fixed)

`POST /api/stage/clubs` → **500** `Unknown column 'banner_url' in 'field list'`
`POST /api/stage/players` → **500** `Unknown column 'goals_player' in 'field list'`

Same root as 2a/2c: `schema.sql` aborted; those columns live in later ALTERs / model INSERT lists, not in the live table. I did **not** add the columns. The script seeded clubs/players via SQL using columns that **do** exist, then created matches via `POST /api/stage/matches` (**201**) and drove `matchKickoff` over HTTP with the two JWT accounts.

### Scenario A — home submits 4-2 → away confirms

Kickoff 200. Home `submit_result` 200 → `AWAITING_AWAY_CONFIRMATION`.

Away `confirm_result` **500**:

```
{"error":"Unknown column 'matches_played_club' in 'field list'","code":"ER_BAD_FIELD_ERROR"}
```

I did **not** add `players.matches_played_club`. After that 500, the match **had already been finalized**:

```
matches.status=completed
matches.result_state=CONFIRMED
matches.result_submit_side=home
score=4-2
matches.stats_processed=1
match_player_stats.count=2
standings home Smoke Home 1787956250795: W1 D0 L0 GF4 GA2
standings away Smoke Away 1787956250927: W0 D0 L1 GF2 GA4
```

`processMatchCompletion` writes official result + `match_player_stats` + club W/D/L + `stats_processed=1`, then throws on the My Club Career UPDATE (`legacyFunctions.js` ~1280). The HTTP handler still returns 500.

Second confirm:

```
{"error":"This match is not waiting for confirmation.","code":"NOT_AWAITING_CONFIRMATION"}
```

status 409. Stats still `count=2`, `stats_processed=1`, standings unchanged. Idempotency holds.

### Scenario C — 4-2 → away proposes 4-3 → home accepts

Submit 200. `propose_correction` 200 → `AWAITING_HOME_REVIEW`.
`accept_correction` **same 500** `matches_played_club`.
After the 500:

```
matches.status=completed
matches.result_state=CONFIRMED
score=4-3
matches.stats_processed=1
match_player_stats.count=2
standings home …: W2 D0 L0 GF8 GA5
standings away …: W0 D0 L2 GF5 GA8
```

Official score is **4-3**, no admin. Club standings moved by the correction (home GF 4+4, away GA 2+3).

### Scenario F — home never submits; `settle_deadlines`

Kickoff 200. Before settle: `result_state=AWAITING_RESULT`, `result_submit_side=home`.
`UPDATE matches SET result_due_at = DATE_SUB(NOW(), INTERVAL 1 HOUR)`.
`settle_deadlines` 200:

```
{"data":{"status":"settled","result_state":"AWAITING_RESULT","event":"home_submit_window_passed"}}
```

After:

```
matches.status=in_progress
matches.result_state=AWAITING_RESULT
matches.result_submit_side=away
matches.stats_processed=0
match_player_stats.count=0
```

Submit right moved to **away**. Match not completed. (Script printed `score=NaN-NaN` because `home_score`/`away_score` are SQL NULL.)

### Smoke summary line (real):

```
2 assertion(s) failed:
 - A confirm 2xx :: {"error":"Unknown column 'matches_played_club' in 'field list'","code":"ER_BAD_FIELD_ERROR"}
 - C accept 2xx :: {"error":"Unknown column 'matches_played_club' in 'field list'","code":"ER_BAD_FIELD_ERROR"}
```

Tokens from register responses were JWTs; omitted here.

---

## Verification

```
=== node --check server.js ===
exit=0

=== node --check smoke ===
exit=0

=== npm run lint ===
> eslint . --quiet
lint_exit=0

=== npm run typecheck ===
> tsc -p ./jsconfig.json
typecheck_exit=0
```

---

## What I did not do

- Did not fix `schema.sql` `rank`, the orphan `.catch`, missing `banner_url` / `goals_player` / `matches_played_club`, or the 500-after-success in `processMatchCompletion`.
- Did not start a silent schema repair so that club/player POST would work.
- Did not commit `TournamentDetail.jsx`, `docs/GAMEDAY_REBUILD_PROMPT.md`, `docs/NEXT_TASK.md`, or `env.local.js`.
- Did not push.
- Did not touch `src/api/stageClient.js:297` or the GameDay duplicate state.

## Decision needed from Lutina

Whether to (1) quote `` `rank` `` in `schema.sql` so a fresh load actually finishes, (2) stop treating SQL lookup failure as “1 orphan”, and (3) add the missing player/club columns **or** stop models from INSERTing columns that `schema.sql` never created — all currently break local bootstrap and make `confirm_result` return 500 even when the result is already official.
