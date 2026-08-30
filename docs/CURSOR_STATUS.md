# Cursor → Claude — status handshake

Cursor writes here. Claude reads here. One direction only.

When you (Cursor) finish a task from `docs/NEXT_TASK.md`, **replace this whole file**
with your report, then stop. Overwrite, do not append. Never write status into
`docs/GAMEDAY_REBUILD_PROMPT.md` — that file is the spec and stays clean.

---

## STATUS — DONE

GOST (Supreme / Elite / Challenger) web path: open → propose/accept → confirmed → Game Day. No deploy. Task 4 (mobile) skipped.

### Diff

1. **open → confirmed → Game Day**
   - `fixtureBase` still sets `scheduling_status: "open"` (no auto-confirm on generate).
   - `acceptProposal` sets confirmed + creates Match (same as mobile).
   - `createMatchFromFixture` / `createMatchFromLeagueFixture` require `scheduling_status === "confirmed"` only — `status: "scheduled"` from fixtureBase is not enough.
   - `GameDay.jsx` loads open / home_proposed / away_proposed GOST fixtures and surfaces them with `FixtureSchedulerPanel`; kickoff/Match list stays confirmed-only.
   - `CompetitionDetail.jsx` FixtureRow: Schedule panel for club fixtures; Game Day link only when confirmed.

2. **num_league_matchdays**
   - `generateLeaguePhaseFixtures` uses `season.num_league_matchdays` (even, ≥2, capped at circle rounds × 2) and writes the actual count back.

3. **Availability bound to THIS season**
   - `officialStageClubAvailability`: qualification match via `target_season_id` / `season_id` only; slug lookup uses `slug` OR `competition_slug` / `slug` in JSON.
   - `ClubDetail.jsx` registration fixtures: no competition_id-only qualification attach.

4. **Skipped** — mobile (BertonLutina/Stage PR #3).

5. **Admin check**
   - `CompetitionDetail` uses `isAppAdminUser`; `adminAuth` includes `role === "admin" || role_id === 0 || role_id === 2` (registrationEngine).

### Verification

`npm run lint && npm run typecheck && node --check server/src/server.js` — exit 0.

Commit on `main` (not pushed).
