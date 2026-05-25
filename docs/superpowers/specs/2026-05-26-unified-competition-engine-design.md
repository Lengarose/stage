# Unified Competition Engine Design

## Goal

Keep the three visible competition products while replacing their fragmented operational flows with one typed, server-owned competition engine that can support about 500,000 users.

The visible products remain:

- Official Competitions: STAGE Supreme, Elite, and Challenger.
- Regional Leagues: region and division based leagues.
- Community Tournaments: user/admin-created tournaments backed by the existing `tournaments` table.

Community Tournaments must keep the old `tournaments` table, existing IDs, URLs, and compatibility fields.

## Current Problem

Competition behavior is split across several systems:

- Official Competitions and Regional Leagues store most operational state in `league_entities.data_json`.
- Community Tournaments store metadata and participant arrays in `tournaments`, then create `matches` directly.
- Scheduling for Official/Regional fixtures uses inbox proposals, but Community Tournaments schedule by directly setting `matches.scheduled_date`.
- Game Day result completion updates the `matches` row server-side, then relies on frontend `syncFixtureAfterMatch()` to sync Official/Regional fixtures and standings.
- Community Tournament result handling and advancement are mostly frontend-driven.
- Some Community Tournament formats are incomplete: double elimination is simple knockout, plain swiss is stale, league/group completion is not authoritative, and player tournament draw generation is not structurally complete.

At 500,000 users, these flows need typed indexes, idempotent server commands, transaction boundaries, and a single source of truth for fixture and result lifecycle.

## Core Architecture

Add a typed operational engine beside the existing product tables.

Existing product tables remain the product-facing source records:

- `league_entities` remains for existing Official Competition and Regional League metadata during migration.
- `tournaments` remains for Community Tournament metadata.
- `matches` remains the Game Day live-play surface.

The new engine owns:

- participants
- fixtures
- scheduling proposals
- Game Day match linkage
- result submissions
- standings
- phase readiness
- advancement generation
- payouts
- operational audit/idempotency

The shared lifecycle becomes:

```text
source metadata
-> participants
-> fixtures
-> scheduling proposal
-> Game Day match
-> server result submission
-> fixture result and standings
-> ready-to-advance notification
-> admin/organizer generates next phase
```

Participant type is first-class:

- `participant_type = club` means club vs club only.
- `participant_type = player` means player vs player only.
- Mixed club vs player fixtures are invalid.

The browser submits commands and renders state. The server is the source of truth for critical writes.

## Product-Specific Behavior

### Official Competitions

Official Competitions preserve:

- Supreme / Elite / Challenger identity and pages.
- Qualification-only season entry.
- Season lifecycle: draft, qualification/registration, league phase, playoff, knockout, archive.
- 36-club default season shape.
- 8-matchday league phase with balanced home/away.
- Top 8 direct knockout qualification.
- 9-24 playoff round.
- 25+ eliminated.
- Two-legged playoff, R16, QF, and SF.
- Single-match final.
- Aggregate winner override when a two-leg tie is level.
- Cross-competition qualification, such as Elite winner qualifying upward.
- Competition rewards, achievements, trophies, rankings, and audit.

Generation, scheduling, result sync, standings, phase readiness, and rewards move to server-owned commands.

### Regional Leagues

Regional Leagues preserve:

- region/division identity
- club applications
- admin approval, waitlist, and rejection
- promotion, relegation, and qualification rules
- double round-robin fixtures
- regional rewards, trophies, ranking effects
- public `/leagues/:slug` behavior

Registration approval, fixture generation, scheduling, result sync, standings, qualification, archive, and reward distribution move to server-owned commands.

### Community Tournaments

Community Tournaments preserve:

- existing `tournaments` table and IDs
- `/api/stage/tournaments`
- `stageClient.entities.Tournament`
- `/tournaments` and `/tournaments/:id`
- `registered_clubs` and `registered_players` compatibility fields
- `creator_email`, `creator_id`, `creator_gamertag`, and `organizer_email`
- subscription creation limits
- custom rules, rules file, banner, trophy, country/platform/region filters
- entry fee/refund behavior
- club tournaments and solo/player tournaments
- formats: `knockout`, `league`, `group_stage`, `double_elimination`, `swiss`, `swiss_ucl`

The `tournaments` row becomes metadata/source identity. Participants, fixtures, scheduling, submissions, standings, advancement readiness, payouts, and audits move into the typed engine. Existing active tournaments are migrated.

## New Operational Tables

### `competition_instances`

One playable competition instance, season, league season, or community tournament.

Important fields:

- `id`
- `product_type`: `official_competition`, `regional_league`, `community_tournament`
- `legacy_source_type`: `competition_season`, `regional_league`, `tournament`
- `legacy_source_id`
- `name`
- `slug`
- `region`
- `platform`
- `status`
- `starts_at`
- `ends_at`
- `created_by_user_id`
- `created_date`
- `updated_date`

Indexes:

- unique `(product_type, legacy_source_type, legacy_source_id)`
- `(product_type, status, starts_at)`
- `(region, platform, status)`

### `competition_participants`

One club or player registered in an instance.

Important fields:

- `id`
- `competition_instance_id`
- `participant_type`: `club` or `player`
- `club_id`
- `player_id`
- `user_id`
- `status`: pending, approved, active, eliminated, withdrawn
- `seed`
- `registered_at`
- `approved_at`
- `created_date`
- `updated_date`

Indexes:

- unique `(competition_instance_id, participant_type, club_id)`
- unique `(competition_instance_id, participant_type, player_id)`
- `(club_id, status)`
- `(player_id, status)`
- `(competition_instance_id, status, seed)`

### `competition_fixtures`

One fixture across any product and format.

Important fields:

- `id`
- `competition_instance_id`
- `legacy_fixture_type`
- `legacy_fixture_id`
- `match_id`
- `participant_type`
- `format`
- `phase`
- `round`
- `matchday`
- `group_number`
- `tie_id`
- `leg`
- `bracket_side`
- `home_participant_id`
- `away_participant_id`
- `home_club_id`
- `home_club_name`
- `away_club_id`
- `away_club_name`
- `home_player_id`
- `home_player_name`
- `away_player_id`
- `away_player_name`
- `status`: unscheduled, scheduled, in_progress, completed, disputed, forfeit, cancelled
- `scheduling_status`: open, home_proposed, away_proposed, confirmed, expired, admin_review
- `window_start`
- `window_end`
- `scheduled_at`
- `confirmed_at`
- `home_score`
- `away_score`
- `winner_participant_id`
- `stats_processed`
- `idempotency_key`
- `created_date`
- `updated_date`

Indexes:

- unique `(legacy_fixture_type, legacy_fixture_id)`
- unique `(match_id)`
- `(competition_instance_id, status, scheduled_at)`
- `(competition_instance_id, phase, round, group_number)`
- `(home_participant_id, status)`
- `(away_participant_id, status)`
- `(scheduling_status, window_end)`

### `competition_schedule_proposals`

One proposed fixture time.

Important fields:

- `id`
- `fixture_id`
- `proposer_participant_id`
- `recipient_participant_id`
- `proposed_at`
- `proposed_for`
- `status`: pending, accepted, rejected, superseded
- `message_id`
- `notification_id`
- `idempotency_key`
- `created_date`

Indexes:

- `(fixture_id, status, created_date)`
- `(recipient_participant_id, status)`
- unique `(idempotency_key)`

### `competition_result_submissions`

One independent home/away result submission.

Important fields:

- `id`
- `fixture_id`
- `match_id`
- `side`: home or away
- `submitted_by_user_id`
- `score_home`
- `score_away`
- `payload_json`
- `proof_url`
- `idempotency_key`
- `created_date`

Indexes:

- unique `(match_id, side)`
- unique `(fixture_id, side)`
- unique `(idempotency_key)`
- `(fixture_id, created_date)`

### `competition_standings`

One standings row per participant per competition instance.

Important fields:

- `competition_instance_id`
- `participant_id`
- `played`
- `wins`
- `draws`
- `losses`
- `goals_for`
- `goals_against`
- `goal_difference`
- `points`
- `rank`
- `final_position`
- `is_promoted`
- `is_relegated`
- `is_eliminated`
- `updated_date`

Indexes:

- unique `(competition_instance_id, participant_id)`
- `(competition_instance_id, rank)`
- `(participant_id)`

### `competition_phase_states`

Tracks current phase/round and readiness.

Important fields:

- `id`
- `competition_instance_id`
- `format`
- `phase`
- `round`
- `status`: pending, active, complete, ready_to_advance, generated
- `ready_to_advance`
- `generated_at`
- `generated_by_user_id`
- `idempotency_key`
- `created_date`
- `updated_date`

Indexes:

- unique `(competition_instance_id, phase, round)`
- `(competition_instance_id, status)`
- unique `(idempotency_key)`

### `competition_payouts`

Once-only payout records.

Important fields:

- `id`
- `competition_instance_id`
- `fixture_id`
- `match_id`
- `recipient_type`: club or player
- `club_id`
- `player_id`
- `amount_stc`
- `category`
- `status`
- `idempotency_key`
- `ledger_transaction_id`
- `created_date`
- `updated_date`

Indexes:

- unique `(idempotency_key)`
- `(competition_instance_id, status)`
- `(club_id, created_date)`
- `(player_id, created_date)`

## Existing Table Indexes To Strengthen

Add or verify indexes:

- `matches(source_fixture_type, source_fixture_id)`
- `matches(status, scheduled_date)`
- `matches(home_club_id, scheduled_date)`
- `matches(away_club_id, scheduled_date)`
- `matches(home_player_id, scheduled_date)`
- `matches(away_player_id, scheduled_date)`
- `matches(tournament_id, round, status)`
- `notifications(recipient_email, read, created_date)`
- `inbox_messages(recipient_email, is_read, created_date)`
- `inbox_messages(related_entity_type, related_entity_id)`
- `stc_transactions(club_id, category, reference_id)`
- `player_stc_transactions(player_id, category, reference_id)`

Where possible, server-generated financial transactions should have a unique idempotency key.

`matches` must keep identity snapshot fields for both sides:

- club matches: `home_club_id`, `home_club_name`, `away_club_id`, `away_club_name`
- player matches: `home_player_id`, `home_player_name`, `away_player_id`, `away_player_name`

The unified fixture engine should populate these fields when it creates or links a Game Day match. IDs are used for permissions and joins; names are stored as snapshots so old fixtures and match history still render correctly if a club/player changes name later.

## Server Commands

Add a unified backend controller/service mounted under `/api/stage/competition-engine`.

Core commands:

- `POST /instances/backfill`
- `POST /instances/:id/participants/register`
- `POST /instances/:id/participants/approve`
- `POST /instances/:id/fixtures/generate`
- `POST /fixtures/:id/schedule/propose`
- `POST /fixtures/:id/schedule/accept`
- `POST /fixtures/:id/schedule/force`
- `POST /fixtures/:id/match/create`
- `POST /matches/:id/kickoff`
- `POST /matches/:id/results/submit`
- `POST /matches/:id/results/admin-resolve`
- `POST /fixtures/:id/forfeit`
- `POST /instances/:id/advance/generate`
- `POST /instances/:id/archive`
- `POST /instances/:id/rewards/distribute`

Old frontend calls can remain temporarily, but internally they should call these commands or adapters.

## Transaction Boundaries

These actions must run server-side with database transactions and row locks:

- Registration: lock competition/tournament and wallet rows; insert participant; debit funds; write ledger; audit.
- Match kickoff: conditionally move scheduled match/fixture to in_progress; prevent duplicate kickoff.
- Scheduling accept: mark proposal accepted, fixture confirmed, create/link match, send notifications.
- Result submission: insert/update one submission per side; resolve only when both sides exist.
- Result finalization: lock match, fixture, participants, standings, and wallet rows as needed; write scores, stats, standings, ranking history, ticket/shirt/wager payouts; mark processed.
- Admin resolution and forfeit: use the same finalization path plus audit rows.
- Reward payout: write payout and wallet ledger in one transaction.
- Migration/backfill: write batch audit rows and use idempotent upserts.

## Idempotency

Every server-owned action needs an idempotency key.

Examples:

- `match_submission:<match_id>:home`
- `match_submission:<match_id>:away`
- `match_finalize:<match_id>`
- `ticket_revenue:<match_id>:<home_club_id>`
- `shirt_revenue:<match_id>:<club_id>`
- `wager_settlement:<match_id>`
- `tournament_entry:<tournament_id>:<participant_id>`
- `competition_reward:<competition_instance_id>:<participant_id>:<position>`
- `fixture_generate:<competition_instance_id>:<phase>:<round>`

Do not rely only on `stats_processed`. It is a useful guard, but it is not enough for multi-step writes.

## Advancement Policy

Next rounds/phases are not generated automatically.

When all fixtures in the current phase/round are complete:

- server sets `competition_phase_states.ready_to_advance = true`
- server creates notifications and/or inbox messages for admins/organizers
- admin/organizer clicks a generate button
- backend generates the next phase idempotently

This keeps humans in control while removing the need to manually inspect whether a round is complete.

## Community Tournament Format Rules

### `knockout`

- Seed participants.
- Generate round 1.
- Winners advance to next round.
- Final winner completes tournament.
- Supports club and player tournaments.

### `league`

- Every participant plays every other participant.
- Support single or double round-robin configuration.
- Standings determine champion.
- When all fixtures complete, notify organizer to archive/distribute rewards.
- No next phase unless config says top N advance.

### `group_stage`

- Split participants into groups.
- Round-robin inside each group.
- Maintain standings per group.
- Configurable top N per group advances.
- When group fixtures complete, notify organizer to generate knockout stage.
- Knockout stage uses the same fixture engine.

### `double_elimination`

- Winners bracket.
- Losers bracket.
- A participant is eliminated after second loss.
- Grand final between winners bracket champion and losers bracket champion.
- Optional bracket reset:
  - if enabled and losers bracket champion wins first final, generate reset final
  - if disabled, one final decides champion
- Requires bracket-side, loss-count, tie, and bracket progression state.

### `swiss`

- Configurable number of rounds.
- Pair participants with similar records.
- Avoid repeat pairings.
- Standings by points, goal difference, goals for, then seed/name.
- After final Swiss round:
  - champion by standings, or
  - top N advance to knockout, based on config

### `swiss_ucl`

- Preserve current custom flow.
- 8 league-phase rounds.
- Top 8 direct R16.
- 9-24 playoff.
- 25+ eliminated.
- Two-legged playoff/R16/QF/SF.
- Single final.
- Aggregate winner logic.
- Manual phase generation by organizer/admin.

## Migration And Rollout

### Phase 1: Add Engine Beside Existing Flow

- Add typed tables and indexes.
- Add backend services/controllers.
- Add read-only adapters that can return unified data in existing page shapes.
- Do not switch behavior yet.

### Phase 2: Backfill Existing Data

For active Community Tournaments:

- Create `competition_instances` from `tournaments`.
- Create `competition_participants` from `registered_clubs` or `registered_players`.
- Create `competition_fixtures` from `matches.tournament_id`.
- Link each fixture to existing `matches.id`.
- Preserve round, group, type, status, scores, winner fields.
- Create standings for league/group/swiss formats from existing completed matches.
- Mark phase state from tournament `type`, `current_round`, and `ucl_phase`.

For Official and Regional:

- Create `competition_instances` from current `league_entities`.
- Create participants from standings and registered ids.
- Create fixtures from `competition_fixture` and `regional_league_fixture`.
- Link existing `match_id` where present.

### Phase 3: Dual Write Temporarily

- New registrations write compatibility fields and typed participants.
- New fixture generation writes typed fixtures and legacy-compatible rows where old screens still need them.
- Game Day match creation links typed fixture to `matches`.
- Results write through the new server command first.

### Phase 4: Switch Reads

- Schedule page reads typed fixtures.
- Game Day still reads `matches`, but all competition matches are created from typed fixtures.
- Tournament detail pages read unified fixtures/standings through adapters.
- Old `registered_clubs` and `registered_players` remain compatibility mirrors.

### Phase 5: Remove Dangerous Client Logic

Move these out of browser ownership:

- fixture generation
- scheduling confirmation side effects
- result finalization
- standings updates
- round/phase readiness detection
- rewards/payouts
- active tournament migration/backfill

### Phase 6: Rollout Safety

- Keep old product tables untouched.
- Backfill jobs use batch IDs and audit rows.
- Add idempotency keys to every command.
- Pages can fall back to old data if no engine rows exist during rollout.

## Testing Requirements

Minimum test coverage:

- Unit tests for format generators: knockout, league, group stage, double elimination, swiss, swiss UCL.
- Backend tests for registration idempotency and capacity checks.
- Backend tests for schedule propose/accept for club and player participants.
- Backend tests for Game Day result submission agreement and dispute.
- Backend tests for result finalization updating fixture, match, standings, stats, and phase readiness.
- Backend tests for existing active tournament backfill.
- Regression test that no frontend path is required for fixture/standing sync after a match completes.

Manual verification before rollout:

- Create and complete one fixture in each product type.
- Create and complete one club tournament and one player tournament.
- Verify inbox scheduling for club vs club and player vs player.
- Verify ready-to-advance notification after a phase completes.
- Verify admin/organizer can generate next phase.
- Verify old `/tournaments/:id` URLs still work.

## Non-Goals

- Do not remove the `tournaments` table.
- Do not migrate Community Tournament metadata into `league_entities`.
- Do not build microservices now.
- Do not auto-generate next rounds without admin/organizer confirmation.
- Do not allow mixed club vs player fixtures.
- Do not rely on frontend code for critical result synchronization.
