# Weakest / Highest-Risk StageLeagues Register

Date: 2026-08-12

Scope: Product architecture risks across identity, contracts, match results, stats, tournaments, economy, admin trust, deployment, and scaling.

Out of scope unless separately approved: Transfer Room.

## Executive Summary

The highest-risk parts of StageLeagues are not single screens. They are lifecycle systems where one user action triggers many permanent effects: identity, contracts, official match results, player stats, tournament progression, STC economy, and admin overrides.

The main rule for reducing risk:

> Any action that changes reputation, rankings, money, trophies, contracts, or official records must go through one backend-owned lifecycle service with idempotency, audit logs, and tests.

## Risk Ranking

### 1. Match Result + Player Stats Lifecycle

Risk level: critical

Why it is risky:

- A match result changes rankings, stats, trophies, revenue, wagers, notifications, and competition progression.
- Club player stats can be inflated if submitted stats are trusted too early.
- Current logic has good foundations, but club goal event validation is not strict enough.
- Current completion appears to store combined goal events into `home_goal_events` while `away_goal_events` becomes empty.
- Yellow/red cards are not fully modeled.

What can break:

- Player gets goals/assists that were not proven.
- Player does not receive goals/assists he earned.
- One side edits opponent stats.
- Admin confirms final score but event stats do not match.
- Match finalization runs twice and duplicates stats/economy/progression.

Recommended fix:

- Slice 15: central `matchResultLifecycleService`.
- Final official result must own score, proof, event ledger, player stats, economy, and progression.
- Club goal events must equal submitted score.
- Add yellow/red card support.
- Admin review must confirm final score plus final event ledger.

### 2. Competition / Tournament Automatic Progression

Risk level: critical

Why it is risky:

- If a group or round finishes and the next phase does not open, the whole platform feels broken.
- If advancement rules are unclear, players will not trust rankings.
- Slice 14 hardened progression hooks, but tie-breakers and forfeit policies are still residual risks.

What can break:

- Group winners do not advance.
- Wrong team advances on tie.
- Forfeit result advances a team but standings are unclear.
- Manual button dependency returns through another path.

Recommended fix:

- Slice 16: competition rulebook hardening.
- Define one canonical rule object per competition type.
- Add configurable tiebreakers:
  - points
  - goal difference
  - goals scored
  - head-to-head points
  - head-to-head goal difference
  - disciplinary score
  - admin draw/manual decision as last resort
- Add tests for UEFA/FIFA-style group advancement.

### 3. Contracts And Dual Identity

Risk level: high

Why it is risky:

- President and Player are the same person, but they now need two contract meanings.
- Slice 13 created `founder_player` and `ownership`, but legacy production data may still have old single `founder` contracts.

What can break:

- Founder has club identity but missing player contract.
- Founder has player contract but missing ownership contract.
- Generic contract acceptance accidentally changes president identity.
- Old founder rows without known idempotency notes are not migrated.

Recommended fix:

- Slice 17: production-safe contract baseline repair.
- Add admin dry-run repair for missing founder player/ownership pairs.
- Do not rewrite ambiguous ownership automatically.
- Keep President-as-Player canonical.

### 4. STC Economy Ledger

Risk level: high

Why it is risky:

- STC is money-like. Duplicate or missing transactions damage trust quickly.
- Match finalization, wagers, ticket revenue, shirt sales, subscriptions, manual admin grants, and contracts can all mutate economy.

What can break:

- Same match pays revenue twice.
- Wager settlement duplicates after retry.
- Admin adjustment lacks audit trail.
- Contract salary/bonus runs outside a ledger.

Recommended fix:

- Create or enforce one STC ledger service as the only mutation path.
- Every STC mutation needs idempotency key, reference id, actor, old/new balance where relevant, and audit reason.
- Block direct balance writes outside controlled repair scripts.

### 5. Admin Override Power

Risk level: high

Why it is risky:

- Admins can resolve disputes, repairs, forfeits, economy, competitions, and identities.
- Admin actions are necessary, but unsafe admin tools can silently corrupt official records.

What can break:

- Admin fixes one field while missing the dependent records.
- No audit proof for why a result or identity changed.
- Admin can override a completed match into an impossible state.

Recommended fix:

- Every admin mutation becomes an action endpoint with:
  - before snapshot
  - after snapshot
  - reason
  - admin user derived from auth
  - idempotency where action can be retried
- Admin UI should show consequences before confirm.

### 6. Profile Tabs And Player Career Meaning

Risk level: medium-high

Why it is risky:

- Player profile is the public trust surface for scouting, contracts, reputation, and career.
- Slice 10 cleaned tab contracts, but the profile will only feel serious if the data comes from official sources.

What can break:

- Stats tab shows aggregate numbers with unclear source.
- Career tab mixes club career, PvP career, president role, and posts.
- Users cannot tell official stats from self-entered showcase.

Recommended fix:

- Keep canonical meaning:
  - Posts: social feed
  - Showcase: self-presentation/media
  - Stats: official performance numbers
  - Career: official StageLeagues CV
  - Matches: completed PvP/club match history
  - Trophies: awards
  - Lifestyle: optional non-competitive identity
- Add source labels only where helpful: official, admin-confirmed, showcase.

### 7. Feed Trust And Social Engagement

Risk level: medium

Why it is risky:

- Feed likes and comments affect reputation and community trust.
- Slice 5 made like/comment server-owned, but likes still use JSON compatibility storage.

What can break:

- Concurrent likes can overwrite each other.
- Counts can drift from JSON likes.
- Notifications can duplicate if idempotency is weak.

Recommended fix:

- Future social hardening: normalized likes table.
- Keep current behavior until match/tournament/core systems are safer.

### 8. Production Smoke / Gandi Environment

Risk level: medium-high

Why it is risky:

- Tests are clean locally, but true authenticated smoke is blocked without local DB or staging credentials.
- Production OAuth previously failed because DB env was misconfigured.

What can break:

- Feature works in tests but fails in real auth/session/OAuth/upload environment.
- Startup migration does not run correctly on hosted Gandi.
- Upload path or MySQL socket config breaks proof/result flow.

Recommended fix:

- Create one repeatable staging or local smoke script:
  - login
  - create player
  - create club/founder
  - submit match proof
  - admin resolve
  - verify profile stats
- Needs seeded local DB or staging credentials.

## Recommended Priority Order

1. Slice 15: Match result proof + club player stats lifecycle.
2. Slice 16: Competition rulebook and automatic advancement hardening.
3. Slice 17: Founder/ownership contract production repair.
4. Slice 18: STC ledger hardening audit.
5. Slice 19: Admin action safety framework.
6. Slice 20: Authenticated smoke environment.
7. Later: normalized social likes.

## Product Principle

StageLeagues must feel like a football federation plus esports platform, not a loose social app. Official records need ceremony:

- proof
- validation
- finalization
- audit
- notification
- irreversible stats only after official result

That is the spine of trust.

## Developer Handoff Rule

When moving any item from this risk register into development:

- write the business rule first
- write or update tests before behavior changes where possible
- keep lifecycle logic backend-owned
- preserve compatibility routes when needed
- do not touch Transfer Room unless the slice explicitly requires and the user approves it
