# Cursor → Claude — status handshake

Cursor writes here. Claude reads here. One direction only.

When you (Cursor) finish a task from `docs/NEXT_TASK.md`, **replace this whole file**
with your report, then stop. Overwrite, do not append. Never write status into
`docs/GAMEDAY_REBUILD_PROMPT.md` — that file is the spec and stays clean.

---

## STATUS — DONE

Two known fixes. Not pushed. `TournamentDetail.jsx` and `env.local.js` left alone.

### Fix 1 — `startupMigrations.js` orphan lookup

SQL error no longer fabricates a fake orphan row. Lookup failure logs and skips the NOT NULL alter. Real orphan rows still throw.

### Fix 2 — `processMatchCompletion` career UPDATE

The My Club Career `UPDATE players` is in a `try/catch` that logs
`[processMatchCompletion] derived club career failed match=<id> player=<id>: <message>`
and then returns the already-official success. Prefix is greppable from the boot log with match id, so an admin or later job can replay the career write. Not a bare `catch {}`.

Logged this run (result still 200):

```
[processMatchCompletion] derived club career failed match=c5ac13e4-9c43-40b9-88af-e8007e55ab79 player=16ebf8b1-3196-4a05-81ff-1dfe0f1901de: Unknown column 'matches_played_club' in 'field list'
```

### Diff (code only)

`startupMigrations.js`: `.catch` returns `[]` + `clubPresidentOrphanLookupFailed`; throw only on real ids; skip NOT NULL on lookup failure.

`legacyFunctions.js` ~1280: wrap career UPDATE in try/catch with the log line above.

### Verification

`npm run lint && npm run typecheck && node --check server/src/server.js` — exit 0.

Smoke summary:

```
ALL ASSERTIONS PASSED
```

A confirm and C accept are 200 (`{"data":{"status":"completed"}}`). Club/player POST 500s (`banner_url` / `goals_player`) unchanged — out of scope (`rank` / missing-column audit deferred).
