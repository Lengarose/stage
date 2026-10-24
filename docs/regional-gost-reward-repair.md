# Regional And GOST Reward Repair

## Verified Causes

Controlled local reproductions verified that archive status invalidated otherwise completed regional settlements, overlapping delete/create saves could duplicate reward positions, regional defaults used knockout labels, and cabinet name matching could unlock a trophy explicitly linked to another event. The old browser reward flow could continue after a settlement failure. These findings explain possible failure paths, not the specific live Premier Division incident.

## Current Policy

- Regional defaults are shared across divisions: `54,000,000 - (position - 1) * 1,700,000 STC`, positions 1–20. The full budget is **757,000,000 STC**. Smaller supported rosters use the initial subset. Admin can explicitly version an edited schedule.
- Supreme, Elite and Challenger each have independent participation, winner-bonus and runner-up-bonus settings. Every eligible club receives participation, including both finalists. There are no other GOST cash components. Amounts must be entered explicitly; no business amounts were invented.
- Rewards use the existing system-funded club-account credit mechanism. No new treasury, reservation debit or owner-wallet payment was introduced. Approved effective budgets are captured and checked against the obligations. Money arithmetic uses integer cents.

## Persistence And Lifecycle

`reward_configs` remains the row source of truth. A `reward_configuration` record in the existing generic entity store selects the canonical version. Replacement locks the source, checks version and content revision, writes the complete next version, and audits in one transaction. Old versions remain available as evidence. Legacy rows with null version/component are not rewritten at startup; identical-duplicate cleanup is an explicit audited action, and conflicting duplicates block cleanup.

Existing fixture-generation/start flows capture edition configuration before play. Server result confirmation and the existing settlement service continue to run settlement without page visits. Captured versions, roster, amounts and component identities do not follow later configuration edits. Regional position identities remain stable; GOST participation identities are frozen roster slots, independent of finalist bonus identities.

Balance, ledger, payout evidence and settlement state commit transactionally. Retries pay only proven missing amounts. Changed paid recipients or amounts block for financial review. Sporting completion, monetary settlement, trophy state and archival remain separate. Archived records still require authoritative result/standings proof; archive alone is not proof. Archival now requires settled money. The retry job handles failed/pending settlement and blocked/pending trophy work after payment.

## Trophy Authority

New immutable `trophy_awards` identify the owner, exact source, edition, winning club and trophy design. Trusted outcome logic establishes entitlement; names and browser placement claims do not. Legitimate historical wins can be verified read-only from authoritative outcomes. Player honours backed by the winning club retain that attribution.

Cabinet create/move/delete checks ownership and earned entitlement on the server. Normal placement edits cannot change owner, trophy identity, win count or event references. Removing and re-placing changes presentation only. Admin visual edits and explicit entitlement repairs are audited. Proven bad awards are revoked with evidence retained, not deleted; valid wins remain intact.

## Historical Review Procedure

No production database, payouts or trophy repairs were accessed or changed during this implementation. The reported English Premier Division edition and incorrect trophy remain **unverified live incidents**.

1. Deploy, then select the exact archived regional edition under Admin Rewards and choose **Review Payments**. Inspect original captured configuration, recipients, proven payments, missing amounts and blockers.
2. **Preview Current Schedule For This Edition** compares the original promise with the proposed current configuration. It does not pay or establish that the new defaults were promised historically.
3. If authorised and entirely unpaid, **Apply Reviewed Configuration To Unpaid Edition** requires a reason and current version. Existing ledger/payment evidence blocks replacement. Review again, then explicitly settle proven unpaid amounts. Do not use configuration replacement to bypass a post-payment correction conflict.
4. For trophy evidence, authenticated GET `/api/stage/trophy-placements/entitlements?owner_id=<id>&owner_type=club` returns verified awards and discrepancies. Admin POST `/api/stage/trophy-placements/review/club/<id>` previews the same evidence. Explicit `apply:true`, a reason and action `materialize`, `revoke` (with `award_id`) or `remove_invalid_placement` (with `placement_id`) performs only the supported audited repair.
5. Compare exact source/edition/design and winner identities before acting. Similar names, takeover context and a cabinet placement are not proof of winning. Financial repair and trophy repair are separate operations.

## Files And Deployment

Core changes are in `rewardPolicy.js`, `rewardConfigurationService.js`, `componentPrizePlan.js`, `competitionPrizeService.js`, `trophyEntitlementService.js`, `trophyAwardService.js`, reward/cabinet controllers, `TrophyAwardModel`, and their focused tests. Frontend changes cover the existing Rewards editor, edition review, lifecycle adapters, defaults and trophy cabinet. Stages, standings, draws and Space League wager logic were not rebuilt.

Deploy changed backend files and restart the Gandi application. Startup migrations add configuration version/component columns, increase reward amount precision, add payout component uniqueness, and create `trophy_awards`. Fresh-install schema and startup migrations are synchronized. New versioned uniqueness allows legacy null-version duplicates to remain reviewable. No startup payout or business-data cleanup runs. Build and upload the frontend separately. No dependency was added.

## Verification And Limits

- Lint, typecheck, backend entry syntax and production build passed.
- Focused real-service tests cover exact budgets, concurrent saves, rollback, duplicate cleanup/conflicts, all regional payouts, GOST participation plus bonuses, archive/retry, snapshot immutability and post-payment conflicts.
- Localhost HTTP tests exercised configuration read/replace/cleanup, capture, adoption preview, settlement, archive, cabinet ownership/entitlement and award read-only APIs with isolated identities and ledgers. Both regional and GOST flows passed. These are not production JWT/MySQL integration tests.
- Headless Chrome rendered the actual Rewards editor at desktop and mobile widths: all 20 amounts accessible, no horizontal overflow, three explicitly blank GOST inputs, accurate budget calculation and no runtime errors. Screenshots were inspected.
- Full backend suite: **641/644 passed**. Existing failures: legacy captain profile editing, league-fixture match creation and registration upload-category expectation. Both new local HTTP flow tests passed.
- Full frontend suite: **374/378 passed**. Existing failures: header identity menus, FUT photo-frame source assertion, GameDay club-loading source assertion and profile photo-preview source assertion. Unrelated changes were not repaired or reverted.
- `graphify update .` could not run: command not installed. Graph report/wiki documentation is also absent.
- Real MySQL migration application, deployed authentication, the live historical records, and production background retries remain unverified. Use staging to validate deployment before any authorised production financial repair. GOST business amounts still require admin decisions.
