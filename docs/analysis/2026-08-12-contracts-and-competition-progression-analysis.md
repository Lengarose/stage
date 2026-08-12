# Contracts And Competition Progression Analysis

Date: 2026-08-12

Scope:
- Player + President onboarding contracts.
- Player-only contract behavior.
- Contract identity fields.
- Automatic tournament / league / competition phase progression.

Transfer Room:
- Out of scope unless separately approved.

## Executive Summary

Two important issues need follow-up development.

1. Player + President onboarding should create two active long-term contracts for the same Player identity:
   - one Player contract: the person is a squad/player member of the club.
   - one President contract: the same person owns/presides over the club.

2. Tournament and league progression must be automatic. When a phase is finished, the system should advance to the next phase without an admin pressing a button.

Both systems must be treated as business-rule engines, not UI-only behavior.

## Contract Findings

### What The Current Code Supports

The contract system already understands the idea of two contract groups:

- `ownership` group: president/owner contract.
- `player` group: every non-ownership contract.

`contractRulesService.js` groups contracts this way:

- `contract_type = 'ownership'` is ownership.
- every other contract type is player.

`ContractsTab.jsx` also contains logic saying presidents can hold both a president contract and a player contract at the same time.

That is the correct product direction.

### Main Risk

The founder onboarding lifecycle currently appears to create one active `founder` contract:

- `contract_type = 'founder'`
- `status = 'active'`
- `max_days = 3650`
- `max_games = 0`

Because `contractRulesService.js` treats only `ownership` as the president group, `founder` is currently grouped as a player contract.

That means the onboarding state may not satisfy the business rule:

- Player contract exists.
- President contract exists.
- Same Player owns both roles.

Instead, the system may represent the founder as one special player-like contract and infer management status through membership/club link. That is not strong enough for the rule the user wants.

### Required Business Rule

For Player + President onboarding:

- The same Player id must be used for both contracts.
- The same Club id must be used for both contracts.
- The same User id owns the Player identity.
- Contract A: Player contract.
- Contract B: President contract.

Recommended contract rows:

1. Long-term Player contract:
   - `contract_type = 'founder_player'` or `contract_type = 'squad'` with founder metadata.
   - group = player.
   - `team_id = club.id`.
   - `user_id = player.id`.
   - `status = 'active'`.
   - long duration, e.g. 3650 days.
   - clear `performance_targets` metadata: `{ source: 'founder_onboarding', role: 'player' }`.

2. Long-term President contract:
   - `contract_type = 'ownership'`.
   - group = ownership.
   - `team_id = club.id`.
   - `user_id = player.id`.
   - `status = 'active'`.
   - long duration, e.g. 3650 days.
   - clear `performance_targets` metadata: `{ source: 'founder_onboarding', role: 'president' }`.

The old single `founder` type should either be migrated/treated as legacy display metadata, or mapped explicitly to one of the two groups. The safest future rule is:

- `ownership` = President contract.
- non-ownership = Player contract.
- Founder is not a third identity. Founder is metadata on those contracts.

### Player-Only Rule

For a normal Player account:

- They should have no ownership/president contract.
- They may receive normal player contracts from clubs.
- Accepting a player contract may attach them to a club as a player/member.
- It must not create `clubs.president_player_id`.
- It must not assign President/Founder badges.

### Contract ID Rules

Every active Player + President founder state should be auditable by ids:

- `clubs.id`
- `clubs.president_player_id`
- `players.id`
- `player_contracts.user_id` as target Player id
- `player_contracts.team_id` as Club id
- `club_memberships.player_id`
- `club_memberships.club_id`

No row should require a standalone President profile id for new flows.

### Developer Recommendation

Create a focused `Slice 13 - Dual Contract Founder Lifecycle Audit/Fix`.

Acceptance:

- Player + President onboarding returns two contracts, not one.
- One active player-group contract exists.
- One active ownership/president-group contract exists.
- Both target the same Player and Club.
- Retry is idempotent and does not duplicate either contract.
- Club membership remains active with president/member status.
- Contracts tab shows the person as dual Player + President.
- Player-only onboarding remains free agent and has no ownership contract.
- Existing legacy `founder` contracts are handled safely in display/migration compatibility.

## Competition Progression Findings

### What The Current Code Already Has

The competition engine has several automatic progression functions:

- `syncMatchResultToSource(...)`
- `advanceLegacyOfficialCompetitionIfReady(...)`
- `advanceRegionalLeagueIfReady(...)`
- `advanceCommunityTournamentIfReady(...)`

There are tests proving some automation exists:

- official league phase can generate playoff fixtures when complete.
- official phase does not advance before all fixtures finish.
- community knockout waits for all current round matches.
- community group stage can create knockout ties.
- regional league can process end-of-league qualification.

This is a good base. The problem is likely coverage and consistency, not total absence.

### Main Risk

The tournament progression engine is split between:

- legacy `tournaments` + `matches`,
- `league_entities` competition fixtures,
- regional league fixtures,
- newer `competition_fixtures`.

Progression may work for one path but not another. If a result is completed through a route that does not call the right sync/advance function, the tournament can stall.

The user-facing rule should be simple:

> After any match result becomes final, the backend must check whether the current phase is complete. If complete, it must advance the competition automatically.

No admin button should be required for normal progression.

### Recommended Product Logic

Every competition format should have a `phase_rule` definition:

- phase id/name.
- match source.
- completion condition.
- ranking/tiebreakers.
- number of qualifiers.
- next phase.
- fixture generation rule.
- eliminated status rule.
- notification/broadcast rule.

The system should behave like a football competition engine:

1. Match becomes completed/forfeit.
2. Standings are updated once.
3. Phase completion is checked.
4. If incomplete, stop.
5. If complete, rank teams.
6. Resolve qualifiers/eliminated teams.
7. Generate next-phase fixtures.
8. Update competition/tournament phase/status.
9. Notify/broadcast.
10. Write an audit/event row for traceability.

### Tie-Breaker Recommendation

Use configurable tiebreaker profiles because FIFA-style and UEFA-style competitions differ.

Suggested default group/league tiebreaker:

1. points
2. goal difference
3. goals scored
4. head-to-head points
5. head-to-head goal difference
6. head-to-head goals scored
7. fair play / disciplinary score if available
8. seed or admin review if still tied

For StageLeagues MVP, if fair play is not tracked yet:

- use seed as the last deterministic fallback.
- mark the resolution source.
- optionally flag unresolved true ties for admin review.

UEFA's modern club format uses a single league phase where top eight advance directly and positions 9-24 enter a knockout play-off, then winners join the round of 16. FIFA-style groups rank teams after all group matches using points, goal difference, goals scored, then head-to-head/fair-play/lots style rules. StageLeagues should make these configurable rather than hard-code one world format everywhere.

Sources:
- UEFA new Champions League format explainer: https://www.uefa.com/uefachampionsleague/news/0268-12157d69ce2d-9f011c70f6fa-1000--new-champions-league-format-explained/
- UEFA Champions League regulations 2025/26: https://documents.uefa.com/r/Regulations-of-the-UEFA-Champions-League-2025/26-Online
- FIFA group ranking pattern example: https://www.fifa.com/en/articles/world-cup-qatar-2022-group-d-guide-teams-fixtures-regulations

### Developer Recommendation

Create `Slice 14 - Automatic Competition Progression Hardening`.

First phase should be an audit + regression-fix slice, not a total rewrite.

Acceptance:

- Every completed result path triggers the same progression service.
- Community tournament group completion auto-creates the next phase.
- Community knockout completion auto-creates the next round/final.
- Official competition league phase auto-generates playoff/knockout path when complete.
- Regional league completion auto-generates qualification/promotion/relegation outcomes.
- Progression is idempotent: running the check twice does not duplicate fixtures.
- Standings/tiebreakers are deterministic.
- Admin actions like force-forfeit also trigger progression when the fixture becomes final.
- Progression events are logged or at least returned for traceability.

## Recommended Order

1. Slice 13: Dual Contract Founder Lifecycle Audit/Fix.
2. Slice 14: Automatic Competition Progression Hardening.
3. Authenticated smoke after both slices.

Contracts should go first because they affect identity integrity and onboarding. Competition progression is larger and should be handled immediately after with focused tests.
