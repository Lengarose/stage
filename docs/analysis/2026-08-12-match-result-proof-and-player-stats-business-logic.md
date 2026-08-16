# Match Result Proof And Player Stats Business Logic

Date: 2026-08-12

Scope: Player-vs-player and club-vs-club match result submission, screenshot proof, admin review, and player stat application.

Out of scope: Transfer Room.

## 1. What The Idea Is Trying To Achieve

StageLeagues needs a trusted match-result lifecycle:

- Players or clubs submit the full-time score.
- Every result submission must include screenshot proof.
- Admins can review proof and submit the correct final score when needed.
- Player-vs-player results should be simple, fast, and trustworthy.
- Club-vs-club results must also capture individual player events: goals, assists, yellow cards, red cards, clean sheets, ratings, and man of the match.
- Player profile stats must increase only from final official results, never from unverified drafts.

The product goal is serious competition: no fake scores, no stat inflation, no confusing admin flow, and no double-counting.

## 2. What Is Strong Today

The current code already has important foundations:

- `GameDayMatchResult.jsx` requires a screenshot before submit in the UI.
- `matchKickoff.submit_result` also rejects missing proof server-side with `PROOF_REQUIRED`.
- Both sides submit independently.
- If scores disagree, the match becomes `disputed`.
- If scores agree, `scoreProofService.verifyScoreProofs(...)` checks proof consistency and can still send the match to review.
- Admin has a dispute dialog showing both submitted scores and proof links.
- Club match UI already collects per-goal events with scorer and optional assist.
- `processMatchCompletion(...)` writes `match_player_stats` and increments player aggregate goals, assists, records, ratings, and club stats.
- `stats_processed` exists as an idempotency guard so final stats are not meant to apply twice.
- Slice 14 added central automatic competition progression after final result.

This means we do not need to invent the whole system. We need to tighten the lifecycle and make the data contract clearer.

## 3. Risky Or Confusing Areas

### 3.1 Admin Is Not Always The Final Authority In The User's Mental Model

The current model can auto-complete when both submissions agree and proof is verified. That is good for speed, but the product must explain this clearly:

- normal case: auto-confirmed from matching scores + acceptable proof
- risk case: admin review
- final authority: admin can override disputed or suspicious results

If the product copy says "admin always submits the result", users may expect every match to wait for admin. That slows the platform and creates admin workload. Better: admin is final authority only when trust is not automatic.

### 3.2 Club Goal Events Are Only A Soft Validation

Current UI warns when goal events do not match the submitted score, but does not block submit.

Example bug:

- Club submits 8-2.
- They enter only 4 goal events.
- The match may still be submitted.
- Player stats become incomplete or inconsistent with the official score.

For club matches, this should become a hard validation:

- own team goals in event ledger must equal own submitted score
- every goal must have a selected scorer
- assists are optional
- penalty flag is optional

### 3.3 Away Goal Events Are Stored Incorrectly

Current `processMatchCompletion(...)` combines primary and secondary goal events into one `goalEvents` array and stores that in `home_goal_events`, while `away_goal_events` is stored as an empty array.

This makes the timeline and audit view confusing. The correct rule:

- home submission goal events go to `home_goal_events`
- away submission goal events go to `away_goal_events`
- admin resolution keeps or edits the same side separation

### 3.4 Yellow And Red Cards Are Missing From The Stat Schema

The user needs club players to be selectable for yellow cards and red cards. Today `match_player_stats` supports:

- goals
- assists
- clean sheet
- MOTM
- rating

It does not clearly support:

- yellow cards
- red cards

Without schema fields, the UI cannot reliably show card stats on profiles, rankings, discipline reports, or admin audit.

### 3.5 Aggregates Are Written From Final Stat Rows, Not From A True Event Ledger

The current flow writes aggregate stat rows and then updates players from those rows. That can work, but for trust-heavy club matches StageLeagues should treat events as the source of truth and aggregate rows as the derived summary.

Recommended source of truth:

- result submissions store raw event payloads
- finalization validates and approves events
- final approved events derive `match_player_stats`
- player profile totals update from final `match_player_stats`

This avoids manual stat inflation.

### 3.6 Admin Resolution Accepts One Side's Submission As The Base

Current admin resolution accepts the home or away submission, optionally overrides score, and passes the accepted submission twice into completion.

This is risky because club matches may need mixed truth:

- final score from the screenshot
- home player events from home submission
- away player events from away submission
- admin edits when one side's event list is incomplete

Admin should resolve the final match package, not only choose one side.

## 4. Better Business Logic

### 4.1 Match Result Lifecycle

Recommended statuses:

- `scheduled`: match exists, not started
- `in_progress`: kickoff has happened
- `result_pending`: one side submitted, waiting for the other side
- `disputed`: submissions disagree or proof verification is not strong enough
- `completed`: final official result; standings, rankings, economy, and stats may apply
- `forfeit`: non-played final result; progression can happen, but player stats should not be invented

Existing statuses can be preserved, but the business meaning must be enforced consistently.

### 4.2 Player-Vs-Player Result Rule

Player-vs-player result submission should stay lightweight:

1. Home player submits score + screenshot proof.
2. Away player submits score + screenshot proof.
3. If scores match and proof verification passes, match auto-completes.
4. If scores mismatch, proof is missing, proof OCR conflicts, or proof is suspicious, match goes to admin review.
5. Admin sees both submissions, both screenshots, OCR notes if available, and writes final score.
6. Finalization updates player match record, rankings, trophies/progression, notifications, and audit.

Player-vs-player does not need goal/assist event attribution unless StageLeagues later adds detailed solo player stats.

### 4.3 Club-Vs-Club Result Rule

Club-vs-club submission must include:

- final score
- screenshot proof
- selected squad players for all own-team goals
- optional assist for each goal
- optional yellow card events
- optional red card events
- optional ratings for seated players
- optional clean sheet/MOTM, if used by the competition rules

Hard validation:

- own goal event count must equal own submitted score
- every goal needs a scorer from that club's seated squad
- assist cannot be the same player as scorer
- yellow/red cards must reference seated squad players
- red card count can be 0 or more, but player cannot receive more than one red card in one match
- ratings must stay in allowed range
- a side can only submit events for its own club

### 4.4 Finalization Rule

No player stats should be applied at submission time. Stats apply only when the match becomes final official:

- auto-final when both sides agree and proof is accepted
- admin-final when disputed or suspicious
- forfeit-final does not create goal/assist/card stats unless a specific forfeit stat policy is later approved

Finalization must be one backend-owned operation:

1. Lock the match.
2. Verify it is not already processed.
3. Build the final score.
4. Build final home events and away events.
5. Validate score/event consistency.
6. Write `matches.home_score`, `matches.away_score`, `home_goal_events`, `away_goal_events`, status `completed`.
7. Recreate or upsert final `match_player_stats` rows for the match.
8. Update player aggregate stats exactly once.
9. Update club aggregate stats, ratings, revenue, shirt sales, and wagers.
10. Trigger automatic competition progression.
11. Write admin audit log when admin resolves or edits.
12. Notify both sides.

### 4.5 Event Ledger Shape

Recommended event types:

- `goal`
- `assist` as a property on goal, not a separate event at first
- `yellow_card`
- `red_card`
- `own_goal` later, if needed

Recommended goal event fields:

- `side`: `home` or `away`
- `club_id`
- `minute`
- `scorer_player_id`
- `scorer_gamertag`
- `assist_player_id`
- `assist_gamertag`
- `is_penalty`

Recommended card event fields:

- `side`: `home` or `away`
- `club_id`
- `minute`
- `player_id`
- `player_gamertag`
- `card_type`: `yellow` or `red`
- `reason`: optional short text

Keep the first implementation simple. Do not build a full event studio. The important thing is structured, selectable, auditable events.

## 5. Impact By Role

### Players

- Player-vs-player stays fast.
- Club players get accurate profile growth from real match actions.
- A player who scores 8 and assists 2 sees +8 goals and +2 assists after the result is official.
- Players cannot inflate stats through unconfirmed submissions.

### Clubs

- Clubs get trusted stats, rankings, and match history.
- Captains/presidents must submit structured events for their own players.
- Clubs cannot edit the opponent's player stats.

### Presidents

- Presidents have better control over club result reporting.
- The president/admin flow must make it clear who submitted and what proof was uploaded.

### Admins

- Admin sees a result review package:
  - home score and proof
  - away score and proof
  - OCR/proof status
  - home event ledger
  - away event ledger
  - final score inputs
  - final event correction controls
- Admin only needs to act when the system cannot safely auto-confirm.

### Scouts

- Scout trust improves because stats are proof-backed and final-only.
- Player profiles become more meaningful for scouting pipelines.

## 6. Impact On Rankings, Trophies, Economy, Notifications, Trust

### Rankings

Rankings should update only after final official result. Never from a draft submission.

### Trophies

Tournament trophies and progression should trigger only after `completed` or approved final status, consistent with Slice 14.

### Economy

Revenue, shirt sales, wagers, and STC rewards must be tied to the same finalization step. No economy event should run before final result.

### Notifications

Recommended notifications:

- home submitted: notify away side to submit
- both submitted and auto-final: notify both sides official result
- disputed/proof review: notify both sides and admins
- admin resolved: notify both sides final score
- stats applied: optional, shown in match detail/profile rather than noisy notification

### Trust

The trusted record is not "what one side typed". The trusted record is:

`final score + final proof decision + final event ledger + stats_processed guard + audit trail`.

## 7. Final Recommended Rules

1. Screenshot proof is required by backend for every played result submission.
2. Player-vs-player needs score + proof only.
3. Club-vs-club needs score + proof + own-team event ledger.
4. Club submitted goal events must equal that side's submitted score.
5. Every goal needs a scorer selected from the submitting club's seated squad.
6. Assist is optional, but cannot equal the scorer.
7. Yellow/red cards must be selectable by player and stored in final stats.
8. Each side can only submit events for its own club.
9. Auto-completion is allowed only when both sides submit matching scores and proof verification passes.
10. Admin review is required for mismatched scores, missing/suspicious proof, or invalid event ledgers.
11. Admin finalization must be able to edit both final score and final event ledger.
12. Player aggregate stats update only after final official result.
13. `stats_processed` must remain the idempotency guard.
14. Forfeit results do not invent player goals, assists, cards, or ratings unless a future forfeit policy is approved.
15. Competition progression runs only after the final result lifecycle completes.

## 8. Implementation Notes For Developers

Recommended Slice 15 implementation:

1. Add a backend `matchResultLifecycleService`.
   - Own `submitSideResult`.
   - Own `evaluateSubmissions`.
   - Own `adminFinalizeResult`.
   - Own `validateClubEventLedger`.
   - Own `applyFinalStatsOnce`.

2. Move or wrap `processMatchCompletion(...)` into this service.
   - Keep legacy function endpoint compatibility.
   - Do not leave completion logic hidden inside `legacyFunctions.js`.

3. Fix side-separated goal event storage.
   - `home_goal_events` must store home events.
   - `away_goal_events` must store away events.

4. Add card stat support.
   - Add `yellow_cards INT DEFAULT 0` and `red_cards INT DEFAULT 0` to `match_player_stats`.
   - Add matching fields to `players` only if player profile/ranking needs aggregate career card totals. If not, derive card history from `match_player_stats` first.
   - Keep `server/schema.sql` and `startupMigrations.js` in sync.

5. Harden club result submission validation.
   - Backend rejects club submissions where own goal events do not equal own submitted score.
   - Backend rejects opponent players in event payloads.
   - Backend rejects invalid card/player ids.
   - Frontend should block the same errors before submit for better UX.

6. Upgrade admin dispute modal into a result review package.
   - Show both proofs.
   - Show both submitted scores.
   - Show both event ledgers.
   - Let admin correct final score and final club player events.
   - Call one backend finalization action.

7. Tests required.
   - Player-vs-player matching proof auto-completes.
   - Player-vs-player mismatch goes to dispute.
   - Club score 8 requires exactly 8 own goal events.
   - Scorer receives +8 and assister receives +2 after finalization.
   - Yellow/red cards persist correctly.
   - Disputed admin finalization applies stats once.
   - Re-running finalize does not duplicate stats.
   - Forfeit finalization triggers progression but does not apply player stats.
   - Automatic competition progression still runs after completed result.

## 9. Recommended Product Copy

For players:

> Upload the final score screenshot. If both sides submit the same score and proof is accepted, the result becomes official automatically. If something does not match, admin will review it.

For clubs:

> Add your team's scorers, assists, and cards before submitting. These stats update player profiles only after the result becomes official.

For admins:

> Review the submitted scores, screenshots, and player events. Submit the final official result to update stats, rankings, economy, and competition progression.

## 10. Decision Needed Before Development

Recommended choice:

Use automatic confirmation for clean matching submissions, and admin confirmation only for disputes or suspicious proof.

This keeps StageLeagues competitive and scalable. Admins remain the final authority, but they do not become a bottleneck for every clean match.
