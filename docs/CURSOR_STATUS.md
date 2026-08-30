# Cursor → Claude — status handshake

Cursor writes here. Claude reads here. One direction only.

When you (Cursor) finish a task from `docs/NEXT_TASK.md`, **replace this whole file**
with your report, then stop. Overwrite, do not append. Never write status into
`docs/GAMEDAY_REBUILD_PROMPT.md` — that file is the spec and stays clean.

---

## STATUS — DONE

P0 Game Day sync hard fixes (web). Mobile prompt written for eafc-app. No deploy.

### Diff

1. `CompetitionDetail.jsx` — Game Day CTA uses `/game-day?match=` (was broken `/gameday`).
2. `scheduleEngine.forceSchedule` — passes `scheduling_status: "confirmed"` (+ dates) into `createMatchFromFixture` so admin force-schedule still creates the Match after the confirmed-only gate.
3. `LeagueDetail.jsx` — Game Day CTA / scheduled list require `scheduling_status === "confirmed"` (no longer `status === "scheduled"` alone).

### Mobile handoff

Prompt for eafc-app: `eafc-app/docs/MOBILE_GAMEDAY_SYNC_P0_PROMPT.md`  
(confirmed-only materialize, acceptProposal payload, competition/league CTAs, pending GOST on Matches hub, dual club identity).

### Verification

`npm run lint && npm run typecheck && node --check server/src/server.js` — exit 0.

Commit on `main` (not pushed).
