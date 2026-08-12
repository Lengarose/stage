# Slice 2 Readiness: Contract Baseline Before Player + President Contract Flow

Date: 2026-08-11
Status: Analysis only. No development approved here.
Label: slice2-readiness-contract-baseline
Source branch observed: `codex/president-player-slice1`

## Current State

Slice 1 identity foundation is reported as implemented:
- President-only onboarding removed.
- `Create Player` and `Create Player + President` remain.
- `Create Player + President` creates Player + Club through `clubs.president_player_id`.
- New onboarding no longer requires or creates a standalone President profile.
- Successful Player + President club creation attaches the Player to the Club so the Player does not remain a free agent.
- Legacy President table, routes, and views remain for compatibility.
- Transfer Room was not touched.

The workspace is currently on `codex/president-player-slice1` and shows Slice 1 code changes as modified files.

## Readiness Gate

Do not start Slice 2 yet.

Reason:
Slice 2 will touch contract sequencing, and the developer handoff says full `npm run test:server` still fails in 8 legacy contract/functions tests. Even if these failures are outside Slice 1, they sit directly in the area Slice 2 needs to depend on.

Before Slice 2, the team needs one of these outcomes:
- Fix the 8 failing legacy contract/functions tests.
- Or explicitly baseline them with written evidence that they are pre-existing, unrelated, and not hiding a contract lifecycle regression.

The stronger recommendation is to fix them first.

## What Slice 2 Is Trying To Achieve

Slice 2 should convert the temporary Slice 1 identity attachment into a serious football contract lifecycle.

Target journey:
1. Player chooses `Create Player + President`.
2. Player profile exists.
3. Club is prepared for creation.
4. Player contract is created.
5. Contract is signed/accepted.
6. Player becomes attached to the Club.
7. Player receives president/owner status for that Club.
8. Player is no longer a free agent.

The important product rule:
Club membership should come from a valid active contract, not from a loose player update.

## What Is Strong About The Current Slice 1

- It fixed the identity direction first instead of mixing identity, contracts, feed, and Transfer Room.
- It preserved legacy President compatibility.
- It gave the product a clear new canonical link: Club -> President Player.
- It made the public product logic easier: President is a Player role/status.

## What Is Risky Or Confusing Now

1. Contract tests are not clean.
The next slice depends on contract behavior, so failing contract/function tests reduce trust.

2. Direct player attachment is temporary.
Slice 1 correctly prevents a Player + President from staying free agent, but the final model should not rely on direct attachment without a real contract lifecycle.

3. Club creation is not transaction-wrapped.
If club creation succeeds but player membership or later contract work fails, the system can create partial state.

4. Ownership and membership can drift.
A Player could become `president_player_id` of a Club without a matching active contract, or have a contract without final owner/member state.

5. STC and contract side effects can duplicate later.
Signing bonus, wage checks, audit logs, and notifications must not be scattered across onboarding code.

## Logic That Could Break

- Club is created, contract creation fails, and the Player remains attached or half-attached.
- Contract is active, but Player `club_id` is not updated.
- Player `club_id` is updated, but contract is still pending.
- President/owner status is assigned to the Player, but the Club does not point to the Player.
- STC signing bonus is paid twice if retry logic is not idempotent.
- Contract offer notifications fire for self-created founder contracts in a confusing way.
- Legacy President contract code keeps expecting `president.id` and blocks the new Player-based flow.

## Effects By Actor

Players:
- Need a clear career event: "You founded Club X and signed as a Player."
- Must not see themselves as free agent after completing Player + President.

Clubs:
- Need a reliable squad state, not a cosmetic owner link.
- Club financial state must reflect contract commitments.

Presidents:
- President authority must be derived from the Player/Club relation.
- President management view stays, but the role should not create a separate paid identity.

Admins:
- Need clean audit records for founder contract creation and club ownership.
- Need recovery tools or safe retry states for partial onboarding.

Scouts:
- Should see one Player profile with club, contract, president badge, and reputation context.

## Effects On Rankings, Trophies, Economy, Notifications, And Trust

Rankings:
- Do not let president status affect skill ranking.
- Club founder/president can affect reputation badges, not competitive player rating.

Trophies:
- Player can receive visible founder/president credit for club trophies.
- Club trophies remain owned by the Club.

Economy:
- Contract lifecycle should be the only source of wage/signing bonus commitments.
- STC mutations should go through one ledger-like service.
- Founder president authority should not create a second salary unless explicitly designed later.

Notifications:
- Founder contract notifications should be restrained.
- Avoid sending a user a normal offer notification for a contract they created for themselves during onboarding.
- Still notify admins/audit logs where required.

Trust:
- Atomic contract + club creation matters more than UI polish.
- A clean server-test baseline is the trust gate before changing contract logic.

## Better Version Of Slice 2

Build a central service for the Player + President founder contract flow instead of wiring the sequence inside React or a thin controller.

Recommended service:
`playerPresidentOnboardingService` or a broader `contractLifecycleService`.

Core responsibility:
- Validate Player exists.
- Validate Club can be created.
- Validate user owns/controls Player.
- Create Club.
- Create founder Player contract.
- Activate contract.
- Attach Player to Club.
- Set Club president player link.
- Emit audit/notification events.
- Roll back or compensate if a step fails.

Do not let frontend orchestrate this as many independent API calls.

## Final Recommended Rules

1. Contract baseline comes first.
- Fix or formally baseline the 8 failing `test:server` contract/functions tests before Slice 2.

2. Player + President membership must be contract-backed.
- The Player can only become club-attached after a valid active Player contract exists.

3. Club creation and player attachment must be atomic or safely compensated.
- Prefer a backend transaction.
- If transaction support is awkward in current DB helpers, create explicit cleanup/recovery states.

4. Founder contract must be idempotent.
- Retrying onboarding must not create duplicate contracts, duplicate club links, or duplicate STC payments.

5. STC writes must be centralized.
- Signing bonus and wage-related mutations should move toward a single ledger service.

6. Transfer Room stays out of scope.
- Do not touch transfer windows, transfer room UI, or unrelated transfer/free-agent flows for Slice 2.

7. President remains a Player role/status.
- Do not reintroduce President-only onboarding.
- Do not make a new standalone President profile for founder contracts.

## Developer Implementation Notes

Recommended sequence for the developer agent:

1. Reproduce the 8 failing `npm run test:server` failures.
2. Identify whether each failure is pre-existing, Slice 1-related, or genuinely contract lifecycle-related.
3. Fix the tests or create a written baseline file with exact failing tests and reason.
4. Only then design Slice 2.
5. Add a transaction-style backend function for Player + President founder contract creation.
6. Add focused tests for:
- successful Player + President contract-backed club creation
- failure during contract creation does not leave partial membership
- retry does not duplicate club/contract/STC side effects
- Player-only onboarding remains free agent
- Transfer Room routes/files remain untouched

Minimum verification before claiming Slice 2 done:
- focused contract/function tests pass
- `npm run test:server` passes or has an approved written baseline
- `npm run lint` passes
- `npm run typecheck` passes
- `node --check server/src/server.js` passes
- `npm test` passes if practical
- `graphify update .` passes after code changes

## Approval Recommendation

Approve the developer agent to do a stabilization pass first, not Slice 2 implementation.

Exact approval wording:

> First fix or baseline the failing contract/functions server tests. Do not start Slice 2 contract lifecycle implementation yet. Do not touch Transfer Room. After the test baseline is clean, bring back a short Slice 2 implementation plan for approval.
