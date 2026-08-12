# Slice 2 Analysis: Founder Contract Lifecycle For Create Player + President

Date: 2026-08-11
Status: Analysis and developer handoff. Implementation delegated separately.
Label: slice2-founder-contract-lifecycle
Source branch observed: `codex/president-player-slice1`

## Context

The Slice 1 identity foundation is implemented and the stabilization gate is clean:
- `npm run test:server` passed 197/197 after contract/functions stabilization.
- `npm test` passed 126/126.
- `npm run lint`, `npm run typecheck`, `node --check server/src/server.js`, and `graphify update .` passed in the developer report.
- Transfer Room was not touched.

Slice 2 can now move from temporary identity attachment to real contract-backed club membership.

## What The Idea Is Trying To Achieve

`Create Player + President` should feel like a serious founder career start:
- The user creates a Player.
- The Player creates/founds a Club.
- The Player signs a real Player contract with that Club.
- The Player becomes attached to the Club through that contract.
- The Player becomes the Club president/owner through `clubs.president_player_id`.
- The Player profile can later show President/Owner status as a career badge.

The core product promise:
A Player + President is never a free agent after successful completion, and that state is backed by a valid contract lifecycle.

## What Is Strong

- It connects football career logic to club management logic.
- It prevents fake club ownership with no squad/player commitment.
- It makes the President role inspectable through the canonical Player identity.
- It sets up future economy logic because wages, signing bonuses, and contract limits can flow through existing contract/finance services.
- It gives admins and players a cleaner audit trail.

## What Is Risky Or Confusing

- Club creation and contract activation can create partial state if handled as separate frontend calls.
- Existing `contractManagement accept` is generic and should not become overloaded with founder ownership rules.
- Founder contracts are self-created/self-accepted, so normal offer notifications may feel strange.
- STC side effects can duplicate if onboarding is retried after a network failure.
- Legacy President data must remain compatible without becoming part of the new flow.

## Logic That Could Break

- Club created, contract fails, Player is not attached.
- Contract created, club update fails, Player has active contract but no president link.
- Player attached, contract still pending.
- Retry creates two clubs, two contracts, or duplicate signing bonus/STC transactions.
- `clubs.president_player_id` points to Player A while active founder contract belongs to Player B.
- Generic ownership contracts unexpectedly rewrite president links outside the founder flow.
- Frontend marks onboarding complete before the backend operation fully succeeds.

## Effects By Actor

Players:
- Get a clean founder career start.
- See one Player profile carrying both player career and president status.
- Do not need to understand a separate President profile.

Clubs:
- Start with a real founding player and valid membership.
- Have clearer president identity through `president_player_id`.

Presidents:
- President remains a club-management authority attached to the Player.
- No separate President profile is created for new onboarding.

Admins:
- Need auditability for founder club creation and founder contract activation.
- Need recoverable/idempotent behavior when onboarding is retried.

Scouts:
- Can evaluate the founder through one Player profile, including club, role, and career context.

## Effects On Rankings, Trophies, Economy, Notifications, And Trust

Rankings:
- Founder/president status must not affect skill ranking.
- Ranking remains based on verified matches/tournaments.

Trophies:
- Club trophies remain owned by the Club.
- Player profile can later show founder/president credit as role history, not as personal match achievement.

Economy:
- Contract finance checks should remain server-side.
- STC writes should be idempotent and centralized.
- Founder president status should not create a second salary in Slice 2.
- If the founder contract has 0 wage or special default terms, make that explicit rather than implicit.

Notifications:
- Do not spam self-offer notifications during founder onboarding.
- Create useful system/audit events: club founded, contract activated, player joined club.
- Normal contract offer notifications remain for non-founder offers.

Trust:
- A backend-owned, atomic founder flow is the trust anchor.
- The user should not be able to complete onboarding into contradictory identity/club/contract state.

## Better Version Of The Idea

Do not let React orchestrate this with separate calls like:
1. create club
2. create contract
3. accept contract
4. update player
5. update club

Instead, create one backend-owned founder lifecycle operation that owns the full transition.

Recommended service:
- `server/src/server/services/founderContractLifecycleService.js`

Possible endpoint shape:
- Dedicated POST under the club route, for example `POST /api/stage/clubs/founder`
- Or a dedicated function action if the project prefers `functionsController` for multi-step business actions.

Recommendation:
Use a dedicated POST endpoint under clubs if it is naturally part of club creation. Keep the actual business logic in the service so tests can target it directly.

## Final Recommended Rules

1. `Create Player` remains unchanged.
- Creates/updates Player.
- Player may remain free agent.
- No Club is created.
- No President status is assigned.

2. `Create Player + President` becomes one backend-owned founder flow.
- Requires authenticated user.
- Requires existing or newly created Player owned by that user.
- Creates the Club.
- Creates founder Player contract.
- Activates/signs the founder Player contract.
- Attaches Player to Club through membership service.
- Sets `clubs.president_player_id = player.id`.
- Marks Player as club-attached/president/member state.
- Returns the final Player, Club, and Contract state.

3. The Player cannot be free agent after successful completion.
- If the contract cannot activate, the flow must not report onboarding success.

4. Founder flow must be atomic or safely compensated.
- Prefer a DB transaction.
- If current DB helpers make transactions difficult, use explicit failure states and cleanup.

5. Founder flow must be idempotent.
- Retrying the same onboarding request must not duplicate Club, Contract, membership, STC, or notifications.
- Use a stable idempotency key derived from user/player/onboarding attempt where possible.

6. Legacy President remains compatibility-only.
- Do not create standalone President rows in the new founder flow.
- Do not delete legacy President records.

7. Transfer Room remains out of scope.
- Do not edit Transfer Room UI, transfer-window rules, or unrelated transfer flows.

## Developer Implementation Notes

Recommended implementation shape:

1. Add `founderContractLifecycleService`.
- Input: authenticated user, player id/profile payload, club payload, optional founder contract terms.
- Output: `{ player, club, contract, membership }`.
- Internally compose existing services where possible: `clubFinanceService`, `contractRulesService`, `clubMembershipService`, and existing model methods.

2. Keep `contractManagement accept` generic.
- Do not teach generic ownership-contract acceptance to rewrite `clubs.president_player_id`.
- Founder-specific ownership belongs in the founder lifecycle service.

3. Make the operation transaction-like.
- The safest sequence is validate first, then write in one transaction:
  - validate user owns Player
  - validate Club uniqueness/creation payload
  - create Club with `president_player_id`
  - create Player contract with founder marker/metadata
  - activate contract
  - attach Player to Club/membership
  - write audit events

4. Add explicit founder metadata.
- Mark the contract source as founder/onboarding if existing schema supports `contract_type`, metadata, or notes.
- This helps avoid confusing the founder contract with open-market offers.

5. Idempotency and retry.
- If same user/player retries after a partial failure, resolve existing draft/founder Club or founder contract instead of duplicating.
- Add tests for retry behavior.

6. Frontend should call one operation.
- `ClubSetup.jsx` and `ClubOnboardingModal.jsx` should not perform a multi-call contract sequence.
- They should submit to the founder flow and trust the returned final state.

7. Tests to add/update.
- successful founder flow creates Club, active Contract, active Membership, and `president_player_id`
- failure during contract creation does not leave Player attached to Club
- failure during membership attachment does not report onboarding success
- retry does not duplicate Club or Contract
- Player-only onboarding still leaves Player free agent
- legacy President routes/data still work
- Transfer Room files remain untouched

## Recommended Developer Task

Proceed with Slice 2 implementation plan first, then implementation:

> Implement Slice 2: contract-backed founder lifecycle for `Create Player + President`. Use one backend-owned founder lifecycle operation. Keep President as Player role/status. Preserve legacy President compatibility. Do not touch Transfer Room. Add focused tests for atomicity, idempotency, successful founder flow, and Player-only free-agent behavior.

