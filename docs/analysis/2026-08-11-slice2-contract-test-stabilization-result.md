# Slice 2 Readiness: Contract/Functions Test Stabilization Result

Date: 2026-08-11
Branch observed: `codex/president-player-slice1`
Scope: Stabilization only. Slice 2 contract lifecycle was not implemented.

## Summary

The 8 reported `npm run test:server` failures were reproduced and stabilized.
The full server suite now passes.

## Failure Classifications

1. `contractActions offer stores duration metadata for market offers`
   - Classification: contract baseline/test mock drift.
   - Reason: the production offer path now validates club finance before insert, but the test did not mock the club finance usage query and leaked stale service modules between test cases.
   - Resolution: added finance-ready club rows, finance usage rows, and stricter module-cache reset in the functions-controller test loader.

2. `contractManagement accept writes active club membership`
   - Classification: contract baseline/test mock drift.
   - Reason: accepting a contract validates club finance inside the transaction before activating membership, but the transaction mock did not include the finance reads.
   - Resolution: added finance reads to the transaction mock.

3. `contractManagement accept updates canonical president link for ownership contracts`
   - Classification: contract lifecycle behavior deferred to Slice 2.
   - Reason: current Slice 1 code explicitly does not let generic `player_contracts` ownership acceptance rewrite club president ownership links. Slice 2 should introduce the dedicated founder contract flow instead of smuggling that behavior through legacy contract acceptance.
   - Resolution: changed the baseline test to assert current behavior: ownership acceptance preserves club president/user links and still writes membership.

4. `contractManagement mark_pending_window activates free-agent accepted contracts immediately`
   - Classification: contract baseline/test mock drift.
   - Reason: the free-agent immediate activation path reuses `contractManagement accept`, including the newer finance validation.
   - Resolution: added finance reads to the transaction mock.

5. `contractManagement accept closes competing live offers for the same player contract group`
   - Classification: contract baseline/test mock drift.
   - Reason: the accept path now validates finance before closing conflicts.
   - Resolution: added finance reads to the transaction mock while preserving assertions for cancelled/completed competing contracts.

6. `transferWindowActions execute_pending activates accepted window-waiting contracts`
   - Classification: contract baseline/test mock drift.
   - Reason: `execute_pending` delegates each pending-window contract into `contractManagement accept`, so the same finance validation was missing from the mock.
   - Resolution: added finance reads to the delegated transaction mock. Transfer Room code/UI was not touched.

7. `matchKickoff keeps matching scores in review when uploaded proofs do not verify`
   - Classification: real functions-handler gap outside Slice 2 contract lifecycle.
   - Reason: `verifyScoreProofs` existed and had service tests, but `matchKickoff submit_result` did not call it before completing matching scores.
   - Resolution: connected `verifyScoreProofs` in the submit-result path. Matching scores with unverified/different proof now move to `disputed` with `proof_verification`.

8. `creating a player contract delegates offer delivery to the central message service`
   - Classification: contract baseline/test mock drift.
   - Reason: `playerContractController` now performs club finance validation before insert/delivery, but the controller test did not mock the finance queries.
   - Resolution: added finance-ready club rows and finance usage rows to the test mock, plus module-cache reset for finance/president services.

## Changes Made

- Updated contract/functions test mocks to include finance validation queries.
- Reset cached finance, membership, president-resolution, and proof services between mocked functions-controller tests.
- Updated the ownership-contract acceptance test to describe the current Slice 1 boundary: no president-link rewrite until Slice 2.
- Connected `matchKickoff submit_result` to the existing `verifyScoreProofs` service before match completion.

## Slice 2 Plan After Stabilization

1. Introduce a dedicated founder contract lifecycle service for `Create Player + President`.
2. Make the founder flow atomic: create club, create/activate player contract, attach player, set `clubs.president_player_id`, and write membership in one backend-owned operation.
3. Keep President as a Player role/status for new flows; preserve legacy President data/routes.
4. Ensure retries are idempotent and do not duplicate contracts, STC effects, notifications, or club links.
5. Keep Transfer Room out of scope unless explicitly approved.

## Verification

- `node --test server/src/server/controllers/__tests__/functionsController.test.js` passed.
- `node --test server/src/server/controllers/__tests__/playerContractController.test.js` passed.
- `npm run test:server` passed: 197/197.
