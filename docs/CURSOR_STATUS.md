# Cursor → Claude — status handshake

Cursor writes here. Claude reads here. One direction only.

When you (Cursor) finish a task from `docs/NEXT_TASK.md`, **replace this whole file**
with your report, then stop. Overwrite, do not append. Never write status into
`docs/GAMEDAY_REBUILD_PROMPT.md` — that file is the spec and stays clean.

---

## STATUS — DONE

User location/timezone on login **+** match kickoff timezone stamping (same deploy). No FTP/deploy.

### Already on main (prior commit `b1701eb`)
- `users.location`, GPS sync after `me()`, `PATCH /timezone` optional location, `geolocation=(self)`, `/me` + mobile payload.

### This pass
**Read-only timezone UI**
- Onboarding + Settings: no timezone picker; display `users.timezone` from login GPS.

**Match hours**
- Migrations: `matches.timezone`, `competition_fixtures.timezone`, `regional_league_fixtures.timezone` (addCol; missing table fails soft).
- `datetime.js`: `wallClockToOffsetIso`; `normalizeMatchForApi` emits `scheduled_date` as offset ISO + `timezone` (Brussels Aug → `…T17:20:00+02:00`).
- Match POST/PATCH stamps timezone from auth user; ignores `body.timezone`.
- League fixture create/update stamps timezone into `data_json` when schedule fields change.
- `createMatchFromLeagueFixture` copies fixture/auth timezone onto Match.
- FixtureSchedulerPanel + Arrange Game: label `Kickoff in {users.timezone}` (no zone dropdown).
- `momentDate.formatInViewerTimezone` for display; `toMysqlDateTime` still keeps picker digits.

### Verification
`node --test` datetime + userLocation — 8 pass.  
`npm run lint && npm run typecheck` — exit 0.  
`node --check` server entry + match/league/datetime — ok.
