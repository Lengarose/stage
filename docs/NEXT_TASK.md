# NEXT TASK — for Cursor

Two fixes. Both are small and in different files. **Do them in ONE run** — do not stop
and report between them. This is the last thing standing between club-vs-club Game Day
and production.

Everything you need is below. Do not re-audit, do not re-read the spec, do not explore
the codebase. The locations are exact.

Keep the report SHORT this time: the diff, the verification output, done. Your long
reports were right for the discovery phase; these two are known bugs with known fixes.

---

## FIX 1 — `server/src/server/migrations/startupMigrations.js:1140-1147`

Current:

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

The `.catch` invents a fake row, so `.length === 1`, so it throws on ANY SQL error —
and because it throws, every migration after it is skipped while the server still
boots and serves. One transient DB failure in production and the new `matches` columns
silently never get added.

Fix: distinguish "the query failed" from "there are real orphans".
- On SQL error: log it and skip the NOT NULL alter. Do not throw, do not fabricate a row.
- Only throw when the SELECT succeeded AND returned real club ids. Keep that hard stop.

## FIX 2 — `server/src/server/functions/legacyFunctions.js`, `processMatchCompletion` (~line 1280)

It writes the official result, `match_player_stats`, club standings and
`stats_processed = 1`, and THEN runs the My Club Career player UPDATE. If that UPDATE
throws, the handler returns 500 — for an operation that already succeeded and cannot
be undone. The away club sees an error, retries, gets 409 `NOT_AWAITING_CONFIRMATION`,
and is left confused while the result is official.

Fix the boundary:
- Once the result is official, a failure in the derived career/stat step must not make
  the request look failed. Return success for what succeeded.
- Log the failure with the match id so it is recoverable — an obvious place an admin
  or a later job can find it. Say in your report where you put it and why.
- Do NOT wrap it in a bare `catch {}` that swallows the error. That is the same class
  of bug as Fix 1 and it is not acceptable here.

---

## Verification (run once, after both fixes)

    npm run lint && npm run typecheck && node --check server/src/server.js
    node server/scripts/gameday-result-smoke.js

Scenario A and C must now return 2xx instead of 500. Paste the smoke summary line.

## When done

Replace `docs/CURSOR_STATUS.md` — short report. One commit is fine for both fixes.
**Commit only — do not push.** Leave `TournamentDetail.jsx` and `env.local.js` alone.

Out of scope, deliberately deferred: the `rank` reserved-word fix in `schema.sql`, the
missing-column audit, `src/api/stageClient.js:297`, and the GameDay duplicate state.
