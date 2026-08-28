# STAGE — Game Day Rebuild (Club vs Club) — Working Spec for Cursor

> Status: Phase 1 (audit) and Phase 2 (remove dressing-room gate) are **already done**.
> Start at **Phase 5**. Read this whole file before writing code.

---

## 0. How to work

1. **Read `AGENTS.md` first.** It is binding: MVC recipe (§2), when not to use CRUD (§3),
   frontend conventions (§4), DB dual-source rule (§6), audit logging (§7), verification (§9),
   files never to touch (§10).
2. **Work phase by phase.** After every phase: re-read that phase's requirements, re-check your
   implementation, test the affected existing flows, check for regressions, explain what changed.
   Only then continue.
3. **Do not re-do Phase 1 or Phase 2.** Section 2 and 3 below tell you exactly what is already true.
4. Never invent a second result engine. Regional League, Supreme / Elite / Challenger,
   STAGE tournaments, community tournaments and Arrange Game all use the **same** match-result path.
5. Read `graphify-out/GRAPH_REPORT.md` before answering architecture questions. Run `graphify update .`
   at the end. If graphify is unavailable, say so explicitly in the final report.

### Phase order (deliberately changed from the original plan)

```
Phase 2  (DONE)
Phase 5 → 6 → 7 → 8 → 9 → 10 → 11      the result engine   ← START HERE
Phase 3 → 4                            public lineups
Phase 12 → 13 → 14 → 15 → 16 → 17      processing, UX, admin, regression
```

Lineups (3-4) are the longest piece and unblock nothing. The result engine is what is broken.

---

## 1. Decisions already taken — do not re-open these

**D1 — Ownership of result and stats.**
The score is one object; player stats are two objects.
- Home owns the **score** and the stats of **its own** players.
- Away owns the stats of **its own** players, and enters them on the "Confirm Result" screen.
One round trip, no extra state. Neither club ever writes the other club's player stats.

**D2 — Deadlines without a scheduler.**
There is **no cron and no scheduled job anywhere in the backend**, and the hosting
(Gandi Web Hosting, FTP deploy, no pm2 — `AGENTS.md` §8) cannot host one.
Use **lazy evaluation**: deadline state is computed and persisted the moment anyone reads the match
(opening it, the admin list). Plus a **sweep on use**: every Game Day load also settles the expired
matches of that user's club. Accepted as an explicit interim solution.

**D3 — Two status columns.**
- `matches.status` stays coarse and stable — it is what the rest of the app already reads.
- New column `matches.result_state` carries the negotiation.

Reason: `matches.status` is a free VARCHAR and every consumer has its own hardcoded list.
Adding seven values means auditing all of these:
`src/components/KnockoutBracket.jsx`, `src/components/schedule/ScheduleList.jsx`,
`src/components/schedule/ScheduleCalendar.jsx`, `src/components/schedule/MatchDetail.jsx`,
`src/lib/gameDayPresentation.js`, `src/components/gameday/GameDayCard.jsx`,
plus the two `terminalStatus` arrays in `server/src/server/functions/legacyFunctions.js`
and `server/src/server/services/competitionEngineService.js`.

Note: `awaiting_confirmation` already exists as a status value and is already wired through the UI,
but is **never written by the server**. It is free to use.

**D4 — Penalty UI shape.**
Only show it when the entered score is a draw. Then three radio buttons:
`No penalties` · `Home won on penalties` · `Away won on penalties`.
The score is still stored as the draw (e.g. 2–2); the penalty outcome is stored separately.
No shootout detail at all — no takers, no shootout score, no timeline.

**D5 — Do not touch Availability.**
`club_fixture_availability` means "this player says they are available". Nothing more.
It is not permission and it is not a gate. It stays exactly as it is.

---

## 2. Phase 1 audit results — the facts you need

### 2.1 The three existing layers (they already model real football correctly)

| Table | Meaning | When | Who decides |
|---|---|---|---|
| `club_fixture_availability` | player declares availability | days before | the player |
| `club_fixture_lineups` | team sheet: formation, `starting_players`, `bench_players`, `captain_player_id`, `status` | before the match | the club |
| `dressing_rooms` | `seated_players` per match per club | at the match | was a gate, now historical |

`ClubFixtureLineup` is edited in `src/components/club/ClubOperations.jsx` and is **never read by Game Day**.
Phase 4 is mostly wiring this up, not new modelling.

### 2.2 Two separate seat systems (do not confuse them)

1. `dressing_rooms.seated_players` — per match, per club. This is the Game Day one. Now out of the flow.
2. `players.dressing_room_seat` + `players.is_ready` — a column on the player row, therefore **global,
   not per match**. Used by the older `src/components/DressingRoom.jsx` and by
   `src/components/TournamentResultDialog.jsx` (which filters stat rows by it, with a fallback to the
   whole squad). **Leave this second system alone** — it is a separate flow.

### 2.3 Columns that already exist on `matches`

`status`, `scheduling_status`, `home_submission`, `away_submission`, `result_home_submitted`,
`result_away_submitted`, `first_submission_at`, `stats_processed`, `winner_club_id`, `winner_club_name`,
`winner_player_id`, `winner_player_name`, `proof_url`, `forfeit_proof_url`, `forfeit_status`,
`cancel_status`, `cancel_requested_by`, `home_goal_events`, `away_goal_events`,
`home_ticket_revenue` / `_attendance` / `_pct` / `_capacity` / `_price`,
`wager_stc`, `wager_status`, `wager_home_locked`, `wager_away_locked`,
`source_fixture_id`, `source_fixture_type`, `competition_context`, `mode`, `type`, `round`.

### 2.4 What does NOT exist yet and must be added

- `result_state` and its deadline columns (Phase 15 / 11).
- Any penalty field (Phase 7).
- Any "hidden from my Game Day" concept (Phase 13) — nothing like it exists anywhere.
- Any scheduled job (see D2).

### 2.5 Where the result flow lives today

- Server: `matchKickoff` handler in `server/src/server/functions/legacyFunctions.js`
  (actions `kickoff`, `submit_result`, `admin_resolve`), plus `processMatchCompletion(...)`
  in the same file, plus `server/src/server/services/scoreProofService.js`.
- Client: `src/components/gameday/GameDayMatchResult.jsx`, `src/lib/gameDayResultFlow.js`,
  `src/components/gameday/GameDayDetail.jsx`, `src/pages/GameDay.jsx`.
- Admin: `src/components/admin/disputes/ExpiredFixtureRow.jsx` (thin — expired fixtures only).
- Archive: `server/src/server/controllers/matchArchiveController.js`, mounted at `/api/stage/match-archive`.

---

## 3. Phase 2 — already implemented, do not redo

Seven files changed. No schema change, no data migration, `club_fixture_availability` untouched,
`dressing_rooms` table and rows untouched.

| File | Change |
|---|---|
| `server/.../legacyFunctions.js` | removed the `DRESSING_ROOM_NOT_READY` 409 gate from `matchKickoff` action `kickoff` |
| `server/.../utils/matchStream.js` | added `firstStreamUrlForClub(clubId)`; stream auto-fill now falls back to any club player with a linked Twitch/Kick channel when no seats exist |
| `src/lib/gameDayResultFlow.js` | `getKickoffControls` no longer takes `bothClubsReady` into account; `dressingBlocked` is now always `false` (kept in the return shape for old callers) |
| `src/components/gameday/GameDayDetail.jsx` | removed the dressing-room panel, the seat counters, the two "not ready" warnings and the `DRESSING_ROOM_NOT_READY` error branch |
| `src/components/gameday/GameDayMatchResult.jsx` | the player list now comes from the **club squad** (`Player.filter({club_id})`) instead of the seated list. Without this, result submission was impossible for any arranged match |
| `src/lib/useGameDayMatchRealtime.js` | removed the `DressingRoom` subscription; **added the missing `if (!resolved) return` guard** so global-channel events for other people's matches no longer trigger a refetch |
| `src/pages/GameDay.jsx` | stopped passing `dressingRoomBackgroundConfig` |

`src/components/gameday/GameDayDressingRoom.jsx` still exists but is no longer imported anywhere.
Leave it — it may be reused later as a read-only view.

---

## 4. PHASE 5 — Home submits the result

Home is responsible for the initial submission. Do **not** require both clubs to submit blind.

Home submits, in one payload:
- `home_score`, `away_score`
- penalty outcome when applicable (Phase 7)
- the list of **home** players who actually played, with their stats (Phase 6)
- screenshot/evidence: see the evidence rule below

On success: `matches.result_state = 'AWAITING_AWAY_CONFIRMATION'`, `matches.status` unchanged
(the match is still `in_progress` until the result is official).

**Evidence rule (decide and apply consistently):** evidence is required at submission for league and
knockout matches; optional for Arrange Game. Reason: without it, two colluding clubs can agree any score,
which matters where rankings and STC wagers are involved.

Server must enforce that the caller really is the home side — reuse `requireMatchActorSide(match, userId, 'home', …)`.
Do not rely on the frontend hiding a button.

---

## 5. PHASE 6 — "Players Who Played"

Add a **Players Who Played** section to the result screen. The submitting club ticks which of **its own**
club members actually participated. This selection — not the old seats, not the pre-match lineup —
determines participation.

Per selected player: `goals`, `assists`, `match rating`.

Rules:
- The lineup means **expected to play**. The result participants mean **actually played**. Never copy one
  into the other automatically. Pre-filling the tick boxes from the lineup as a *suggestion* is fine.
- Per **D1**: home submits home players; away submits away players on its confirm screen. The server must
  reject any attempt by one club to write stats for the other club's players.
- The final confirmed result is the authoritative source for participation and stats.
- Club-event player data updates **My Club Career**, not the general Player Career.

---

## 6. PHASE 7 — Penalties

Add to `matches`:
- `decided_on_penalties` TINYINT(1) DEFAULT 0
- `penalty_winner_side` VARCHAR(10) NULL — `'home'` | `'away'` | NULL

Store the normal score as the draw. UI per **D4**: the three radio buttons appear only when the entered
score is level.

Eligibility: only offer it when the competition/match rules allow a winner from a draw. Derive from the
fixture phase (`knockout_r16`, `knockout_qf`, `knockout_sf`, `knockout_final` — see `buildMatchContext`
in `src/lib/gameDayIntegration.js`). For community tournaments and Arrange Game there is no such marker
today — add an explicit flag rather than guessing. Never offer it on a normal league fixture where a draw
is a valid outcome. Server must reject an ineligible penalty selection.

This must be respected by standings, knockout progression, match history, club stats and brackets.

---

## 7. PHASE 8 — Home → Away confirmation

After home submits, away gets an inbox message and a notification:

> Home Club submitted 4–2. Is this result correct?

Two actions: **Confirm Result** · **Result Is Incorrect**.

On the confirm screen the away club also fills in its own participating players and their stats (**D1**).

Confirm → result becomes official → `result_state = 'CONFIRMED'`, `status = 'completed'`,
downstream processing runs (Phase 12). No dispute, no admin.

---

## 8. PHASE 9 — Away correction

"Result Is Incorrect" → away enters the score it believes is correct. **No evidence required at this step.**

`result_state = 'AWAITING_HOME_REVIEW'`. Home sees:

> Away Club has proposed a correction: 3–2.

Home can **Accept Correction** (→ official, no admin) or **Dispute Result**.

Home may send at most **one** corrected counter-result before escalation. Enforce that limit server-side —
no endless ping-pong. The goal is that clubs fix simple mistakes themselves.

---

## 9. PHASE 10 — Dispute escalation

Only when the clubs cannot agree.

The club opening the dispute submits: claimed final score, screenshot/evidence, optional short explanation.
The other club then receives **Result Dispute — Evidence Required** and submits the same three things.

Once both sides have submitted: `result_state = 'ADMIN_REVIEW'`, `status = 'disputed'`, and the complete
case goes to **Admin → Game Day → Disputes & Forfeits**.

Admin sees both submissions side by side and can: approve home, approve away, set the final result manually,
reject invalid evidence, mark for replay where competition rules permit, or void the match.
Every admin action writes an audit row (`AGENTS.md` §7 — `admin_audit_log`, never trust `admin_user_id`
from the body).

**Critical:** a simple score disagreement must never go straight to admin.

---

## 10. PHASE 11 — Deadlines (lazy, per D2)

Add to `matches`: `result_due_at`, `confirmation_due_at`, `review_due_at` (DATETIME, nullable),
and record timeout outcomes in `result_state`.

All timestamps are **server-side**. Never trust a client clock.

| Window | Rule |
|---|---|
| Home initial submission | 48h after the scheduled/played time. Show a visible countdown. |
| Home misses it | The right to submit passes to **away**, who gets its own window. Home then gets the normal confirm/correct opportunity. **Never auto-award 3–0.** |
| Nobody submits | `result_state = 'RESULT_OVERDUE'` → Admin Game Day → Attention Required / forfeit review. Admin may then award an administrative 3–0. |
| Away confirmation | 48h. On silence, home's result auto-confirms as `AUTO_CONFIRMED_TIMEOUT`, visible in audit/history. |
| Home review of a correction | A defined window. On silence, apply a safe recorded rule — never leave the match blocked forever. |

Implementation per **D2**: a `settleMatchDeadlines(match)` helper that is pure-ish, computes the new state
from `NOW()` and the stored due dates, persists it, and is called (a) whenever a match is read in Game Day
or the admin list, and (b) as a sweep over the current user's club matches on every Game Day load.

No result state may remain unresolvable without appearing in Admin Attention Required.

---

## 11. PHASE 3 — Public fixture lineups

Move lineup declaration out of Game Day. Add a **Lineup** sub-tab on the competition fixture, next to the
existing fixture tabs (Schedule, Stats). Use the existing STAGE sub-tab visual language.

Required for: Regional Leagues · Supreme · Elite · Challenger · STAGE tournaments · community tournaments.
**Not** for Arrange Game.

## 12. PHASE 4 — Lineup functionality

Each club submits its own lineup. **No formation builder.** Per selected player store and display:
the player and an optional position (`Chris — CM`, `Kai — ST`, `Berre — CB`).

The fixture shows **Home Lineup** and **Away Lineup**, visible to anyone who can see the fixture —
deliberately unlike Game Day, which is private.

Reuse `club_fixture_lineups` (it already has `fixture_id`, `fixture_type`, `starting_players`,
`bench_players`, `captain_player_id`, `status`) and its controller at `/api/stage/club-fixture-lineups`.
Positions may need one added column or a JSON shape on the existing arrays — keep `schema.sql` and
`startupMigrations.js` in sync either way.

A submitted lineup is **not** proof that anyone played.

---

## 13. PHASE 12 — Final result processing

Only once the result is official. Then update: Regional League standings · tournament table/bracket ·
Supreme/Elite/Challenger progression · club rankings · player rankings where applicable ·
club profile statistics · **My Club Career** · player match stats (appearances, goals, assists, ratings) ·
match history/archive.

**Do not update general Player Career for club events.**

Processing must be **idempotent** — reuse and respect `matches.stats_processed`. Re-confirming or
reprocessing must never duplicate goals, assists, appearances, wins, points, ranking changes or career records.

While you are here, fix these three existing defects in `processMatchCompletion(...)`:
1. All goal events are written into `home_goal_events` while `away_goal_events` is forced to `[]`.
   Home events go to `home_goal_events`, away events to `away_goal_events`.
2. `admin_resolve` calls `processMatchCompletion(m, accepted, accepted)` — the same submission twice —
   so the `primary + secondary` concat doubles every stat row.
3. `syncPlayerCareerStats` in `src/lib/gameDayIntegration.js` writes `goals`/`assists` as **absolute**
   recomputed sums from the client, while the server **increments** the same columns. Two writers, two
   semantics. It also sends `avg_rating`, which is not a column (`players` has `avg_match_rating`).
   Pick one writer — the server — and remove or rewrite the client one.

Note: the new single-authored-sheet model removes the `primary + secondary` concat entirely, which deletes
defects 1 and 2 rather than patching them.

---

## 14. PHASE 13 — Remove a completed match from the Game Day view

Button label: **Remove from Game Day**. Never the word *Delete* in the UI.

This is a per-user/per-club hide, not a backend delete. Nothing exists for this today — add it
(a small table keyed by match + user, or a JSON column; follow the `AGENTS.md` §2 recipe if it is a table).

The canonical match must remain in the backend, Admin Game Day, Match Archive, competition history,
club history, stats, My Club Career and rankings. One user hiding it must not affect anyone else.
Optionally offer an Archived/Completed filter to bring it back.

---

## 15. PHASE 14 — Inbox and notifications

Generate messages for: result submitted · result corrected · dispute opened · result confirmed ·
auto-confirmed on timeout. Each links directly to the right match/result screen. No duplicates —
reuse the existing `idempotencyKey` pattern in `sendActionMessage`.

---

## 16. PHASE 15 — Match state model

Per **D3**, two columns.

`matches.status` (coarse, already read everywhere — reuse existing values):
`scheduled` · `in_progress` · `awaiting_confirmation` · `disputed` · `completed` · `forfeit` · `cancelled`

`matches.result_state` (the negotiation, new):
`AWAITING_RESULT` · `AWAITING_AWAY_CONFIRMATION` · `AWAITING_HOME_REVIEW` · `DISPUTED` ·
`ADMIN_REVIEW` · `CONFIRMED` · `AUTO_CONFIRMED_TIMEOUT` · `RESULT_OVERDUE` · `VOIDED`

There is exactly one canonical value per column. Do not create a third state system.
When you add values to `status`, audit every hardcoded list named in §1 / D3 above.

---

## 17. PHASE 16 — Admin Game Day integration

Admin must find matches by match ID, club, competition, date and status, and immediately see:
submitted result · corrections · full result history · who submitted what · submission timestamps ·
deadlines · penalty outcome · selected participating players · player stats · screenshots/evidence ·
dispute status · automatic timeout actions.

Disputes and forfeits belong **under Admin Game Day**. Do not build a second, disconnected dispute admin.

---

## 18. PHASE 17 — Regression

Test end to end:

| # | Scenario |
|---|---|
| A | Regional League normal result: home submits → away confirms → standings and stats update |
| B | Supreme knockout 2–2, home wins on penalties → away confirms → correct club progresses |
| C | Home submits 4–2 → away proposes 4–3 → home accepts → 4–3 official, no admin |
| D | Home submits 4–2 → away proposes 3–2 → home disputes + evidence → away evidence → admin resolves |
| E | Home submits → 48h pass → auto-confirmed, recorded as `AUTO_CONFIRMED_TIMEOUT` |
| F | Home never submits → away gets the right to submit → recovery flow works |
| G | Nobody submits → `RESULT_OVERDUE` → Admin Attention Required |
| H | Completed match removed from Game Day → canonical match, history and stats intact |
| I | Lineup has 7 players, only 5 actually play → only those 5 get appearances and stats |
| J | Arrange Game got no unnecessary competition-lineup feature |

Then run:

```bash
npm run lint
npm run typecheck
node --check server/src/server.js
graphify update .
```

---

## 19. Separate defects to fix along the way

These are confirmed, verified in the code, and are not part of any phase above.

1. **`PATCH /api/stage/players/:id` has no ownership check.**
   `server/src/server/controllers/playerController.js:311`. The narrow routes (`/card-background`,
   career tiles) all check `ownsPlayer` and return 403. The main route — which writes `goals`, `assists`,
   `overall_rating`, `position` — does not. Any authenticated account can modify any player.
   **Until this is closed, the whole result-trust engine is bypassable with one request.** Fix first.

2. **Solo matches never credit goals.** `applySoloPlayerRecord` only updates `matches_played`,
   `wins_count`, `losses_count`, `draws_count`. A solo player who scores five gets none recorded.
   Also, solo result submission writes a dummy stat row (0 goals, 0 assists, rating 6).

3. **Two invitation dead ends** in `legacyFunctions.js`:
   - accepting an invitation *after* a date renegotiation hits the `reschedule_request` branch, which
     returns success without ever creating the match (~line 7035);
   - `confirmed` creates the match with `homeSide: 'opponent'` instead of `'challenger'` (~line 7110),
     so renegotiating a date silently swaps which club controls the match.

4. **The `Match` socket channel is global.** `src/api/stageClient.js:297` subscribes to `CHANNELS.MATCH`
   with no recipient filter, so every client receives every match on the platform. Combined with two
   state owners (`GameDay.jsx` and `GameDayDetail.jsx`) that resync each other and a 10s `setInterval`,
   this is the cause of the intermittent behaviour. The missing `resolved === null` guard is already
   fixed (Phase 2); the channel scoping and the duplicate state ownership are not.

5. **Decide what happens to the solo flow.** `matchKickoff` serves both modes. If club moves to the
   negotiation model and solo stays on blind double submission, you have two result engines — which the
   constraints forbid. Either solo follows, or freeze it explicitly and document why.

---

## 20. Constraints (binding)

- Follow `AGENTS.md`. Audit before changing architecture.
- Prefer extending the existing match/result entities. No parallel result system per competition type.
- Arrange Game uses the same result engine, without the public lineup requirement.
- Do not touch `src/components/ui/*` (shadcn primitives) or `base44/*`.
- Keep `server/schema.sql` and `server/src/server/migrations/startupMigrations.js` in sync for every
  persisted field. Indexes in both, named `idx_<short_table>_<columns>`.
- Register any new entity in `ENTITY_NAMES` in `src/api/stageClient.js` — the model, controller and route
  alone are not enough.
- Every admin override writes an audit row.
- Never delete historical match data. Never reset a running competition.
- Preserve existing reward, standings and ranking behaviour.
- Result processing is idempotent. Guard against duplicate submissions and race conditions.
- Backend permissions enforce home/away/admin. Hidden frontend buttons are not a permission model.
- All 48h deadlines use server-side timestamps.
- Do not "fix" pre-existing lint/type warnings as a side effect (`AGENTS.md` §10). Two known ones live in
  `GameDayMatchResult.jsx` (`submitted` / `setSubmitted` unused) — leave them.
