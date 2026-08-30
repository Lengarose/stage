# Cursor → Claude — status handshake

Cursor writes here. Claude reads here. One direction only.

When you (Cursor) finish a task from `docs/NEXT_TASK.md`, **replace this whole file**
with your report, then stop. Overwrite, do not append. Never write status into
`docs/GAMEDAY_REBUILD_PROMPT.md` — that file is the spec and stays clean.

---

## STATUS — DONE

Game Day result-engine alignment with mobile (web only). No deploy.

### Diff

- `src/lib/gameDayResultFlow.js` — mobile control matrix (`canShowResultAction` during negotiation, `showAwaySubmit` not in confirm state, `canCounter` / overdue / admin / final flags); `fixtureScoreFromSubmission` + own/opponent mapping; `pickMyClubForMatch` / `uniqueIdentityClubs` with **no** first-club fallback.
- `src/components/gameday/GameDayMatchResult.jsx` — `isClubGameDayMatch` (club ids, not `mode === "club"` alone); confirm/review labels via `formatSideClaim`.
- `src/components/gameday/GameDayDetail.jsx` — dedicated Confirm Result button; dock includes `showConfirmResult`.
- `src/pages/GameDay.jsx` — load signed `club` + `presidentClub`; pick fixture club per match; hub Match socket ignores foreign fixtures.
- `server/.../legacyFunctions.js` — solo career credits goals from official score when `player_stats` omit goals (no silent 0-goal row).
- Tests updated for Phase 2 (no dressing-room subscribe) + new control/score helpers.

Out of scope left alone: deploy, ui/*, base44, availability, President profile, unused `submitted` lint.

### Verification

`npm run lint && npm run typecheck && node --check server/src/server.js` — exit 0.

Unit: `gameDayResultSubmissionFlow` + `gameDayRealtime` — 16 pass.

Smoke summary:

```
ALL ASSERTIONS PASSED
```

A (home submit → away confirm → completed) and C (away correction → home accept) both 2xx / `status=completed`.
