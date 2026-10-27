# Regional League Edition Identity Review

## Live Finding: Not Yet Verified

The screenshots show the same displayed North American Division 1 / Season 1
label in two positions. They do not expose record IDs, platform, raw names,
edition IDs, timestamps or dependencies. No authenticated live API response or
database export was available or used in this implementation. It is therefore
not established whether those particular entries are two database records,
a repeated response ID, or legitimately distinct editions/platforms. No live
canonical record was selected and no production cleanup occurred.

The new Admin Rewards **Review identities (read only)** operation provides the
missing evidence after deployment. It returns every regional root, raw stored
fields, merged values, logical identity, indexed/JSON disagreements, and identity
conflict groups. Neither display name nor list position decides identity.

## Verified Local Cause

The initial regression against the real generic regional POST handler failed:
two identical edition requests produced two IDs (`2 !== 1`). Previously:

- Rewards rendered each supplied regional row without identity metadata.
- Browser seeding trusted its loaded slug set and total-record-count shortcut.
- Generic POST inserted a new UUID unconditionally; the shared slug index was
  nonunique.
- Next-season creation independently created a root and then patched the old
  season link, leaving retries and concurrent sessions vulnerable.

This proves a creation vulnerability, not the provenance of the live screenshot.

## Logical Identity

The official regional domain defines one division per region, platform scope
and season. The server key hashes:

`region_slug + division + normalized platform + season_number`

Canonical `*-div-N` and `*-sN` slugs are cross-checked against explicit metadata.
Missing platform, unresolved region, or unverified division/season blocks a
write. Supported spelling aliases normalize consistently (for example
Cross-Platform/crossplay). Different platforms and seasons remain distinct;
PS4/PS5 are not silently collapsed. Names are not used as identity.

Stored `edition_id` values remain visible in raw evidence and are never
rewritten by duplicate repair. A random supplied edition UUID cannot bypass
the logical season constraint. The existing reset workflow reuses roots and
changes their edition UUID; it does not authorize creating another root in an
occupied regional season slot.

## Creation, Updates And Lifecycle

The existing regional router delegates creation and updates to
`regionalEditionService` and `RegionalLeagueModel`. Admin identity is loaded
from authenticated server context. A transactional infrastructure mutex in the
existing flexible entity store serializes regional writes. A nullable unique
`regional_edition_key` additionally protects new/reviewed regional rows; unrelated
entity types keep NULL and their existing CRUD behavior.

Every creation also scans legacy regional rows while holding the mutex. One
matching, consistent record is returned as `existing`; multiple matching records
or ambiguous indexed/JSON evidence return a conflict. This protects legacy rows
whose keys intentionally remain NULL pending review. Existing records are not
silently renamed or overwritten by creation retries.

- Generic POST is protected, including old/stale browser callers.
- POST `/regional-leagues/seed` accepts explicit definitions and returns a
  created/existing/conflict outcome for every definition. Callers send all
  expected definitions, not only those absent from browser state.
- POST `/regional-leagues/:id/next-season` locks and reuses/creates the successor,
  validates both links and sets missing links atomically. It rejects conflicting
  links and requires a completed/archived predecessor. It does not start play,
  pay prizes, create draws, or award trophies.
- Generic identity changes are uniqueness checked; dependencies block changing
  an active identity or slug. Existing legacy slugs are not rewritten by benign
  metadata edits, preserving their reference targets.
- Generic delete directs admins to explicit review rather than deleting a root.
- Reset uses the same mutex and rejects resetting several editions into an
  identical Season 1 slot. A rejected reset rolls back its transaction. It does
  not delete or combine historical editions to make the reset fit.

Existing Division 1 and Division 2 schedules remain 54,000,000 / 33,000,000 STC
for first place, decreasing by 1,700,000 per position: 757,000,000 / 337,000,000
for 20 clubs. GOST, payout idempotency, draw/qualification and confirmation
services are unchanged.

## Dependency Inventory And Repair Preview

POST `/regional-leagues/edition-review` is dry-run unless `apply` is exactly true.
It requires different explicit `source_id` and `canonical_id`. No record is
chosen automatically as canonical by age, activity or name.

The preview inventories both records, including their own registrations,
indexed and JSON references, standings, qualification/season registrations in
the flexible store, fixture/match links, lineups/availability, live matches,
competition participants, scheduling proposals, result submissions, phase
states, reward configuration versions, captured settlement snapshots, payouts,
STC ledgers, purchases, achievements, designs, award provenance, placements,
history/archive and linked-division/season references. It follows both directions
of supported match/report links and preserves distinct composite-key standings.

Missing evidence tables, malformed reference-bearing JSON, or name-only
unattributed financial hints block proof of non-use. Name-only hints are not
treated as proven attribution. A full table scan is intentionally limited to an
explicit admin preview/apply action; no such scan runs just by visiting Rewards.
Source/canonical differences in explicit edition IDs, relationship targets,
trophy settings, entry costs or competition configuration also block removal;
they are shown separately rather than silently discarded.

Classification is explicit:

- Repeated response IDs: render once; no database deletion.
- Distinct valid identities: keep both, show distinguishing metadata.
- Unverified identities: preserve both and expose evidence gaps.
- Same logical identity: flag a conflict; inspect dependencies before proposing
  any operation.

Only a source proven unused can receive an apply proposal. The changes are
exactly deletion of that source root and binding of the retained canonical key.
Canonical `data_json` and all snapshots are retained byte-for-byte. No references
are migrated, no histories are merged and no balance/title calculations run.
If either source activity or uncertain obligations exist, the UI shows blockers
and no Apply control. Both-active histories need a separate approved mapping
or supersession design, not an automatic repair in this feature.

Apply requires a reason, the exact preview revision and explicit admin approval.
The UI additionally asks for the source ID and a confirmation. The server locks
the guard, roots and inspected evidence ranges, rechecks all evidence and rejects
stale previews. Removal requires MySQL REPEATABLE-READ or SERIALIZABLE isolation;
other isolation levels fail closed. Apply can take broad locks, so any approved
production use should be scheduled during a low-activity maintenance period.
The audit contains the reviewed before/after IDs and inventory. Reapplication
uses that audit as an idempotent tombstone. Nothing runs automatically on boot.

## Production Procedure: Still Awaiting Evidence And Approval

1. Deploy the backend and migration, restart Gandi, then deploy the frontend.
2. Open Admin Rewards and run **Review identities (read only)**.
3. Compare the actual North American records, including raw names, IDs, region,
   platform, season/edition, timestamps, status and relationship fields.
4. Choose explicit IDs only after reviewing that evidence; generate a dry-run
   dependency preview. Keep both if they represent different valid editions.
5. Obtain approval of that concrete preview before any production Apply.
6. If there is dependent or conflicting history, stop and produce a separately
   reviewed reconciliation plan. Do not combine results, payouts or honours.

No production operation is approved or executed merely by deploying this code.

## Rewards List

Regional sources paginate through the existing API instead of stopping at 50.
Repeated page IDs are detected rather than permitting an infinite legacy-server
pagination loop. Load failures retain existing visible state and display an
error. Same response IDs render once; different IDs are never deduplicated by
name. Rows show region, division, season, platform, status, full ID, archive
status, stored-name differences and potential conflicts. Selection still uses
the actual source ID. Unresolved identity groups are excluded from automatic
default-config initialization, not hidden from review/configuration access.

## Schema And Changed Files

Schema and startup migrations add only the nullable hash column and its scoped
unique index. Existing legacy roots remain unbound; no cleanup/backfill runs on
boot. Non-NULL key conflicts are reported and the index is not silently forced
by deleting records. All app writes must use the protected workflow; privileged
direct SQL and mixed deployments of older backend code are not protected by
application guards. Finish the backend restart before permitting writes.

Principal files:

- `server/schema.sql`, `server/src/server/migrations/startupMigrations.js`
- `server/src/server/lib/regionalEditionIdentity.js`
- `server/src/server/models/regionalLeagueModel.js`
- `server/src/server/services/regionalEditionService.js`
- `server/src/server/services/regionalEditionReviewService.js`
- `server/src/server/controllers/leagueEntityController.js`
- `server/src/server/functions/legacyFunctions.js` (reset guard only)
- `src/pages/Admin.jsx`, `src/lib/seasonLifecycle.js`
- `src/lib/qualificationConfig.js`, `src/lib/regionalRewardSources.js`
- `src/components/admin/sections/RewardsTab.jsx`, `LeaguesTab.jsx`
- `src/components/rewards/RegionalEditionReview.jsx`
- Regional API/source-list regression tests and updated next-season caller test.

No new dependency, route navigation page, frontend entity or generated UI
primitive is introduced. Upload changed server files, restart Gandi for the
idempotent migration, then upload `npm run build` output.

## Verification And Limits

- The initial route repro failed with two records; it now passes with one ID.
- Nine regional service/API tests pass: concurrent/repeated seeds, lost-response
  retries, generic creation, identity updates, next-season links, distinct
  scopes, preview/no writes, stale preview, safe apply/reapply, missing/conflicting
  evidence, composite standings, unchanged JSON, and unrelated entity types.
- All four new action routes were hit over local HTTP using the actual Express
  router, authenticated identity fixtures and isolated transactional SQL fixtures.
- Frontend tests cover same-ID rendering, distinct identities, pagination and
  the existing reward schedules/next-season caller contract.
- Chrome exercised the actual Rewards components on desktop/mobile, stable-ID
  selection, visible conflicts, read-only diagnostics/preview and blocked Apply.
- Lint, typecheck, server syntax and production build pass.
- Full frontend: 392/396 pass. Full backend: 665/669 pass. The existing four
  failures per suite remain: identity menus, FUT photo frame, GameDay club loading,
  photo preview; legacy captain edit, fixture creation, registration upload
  category and migration-export regex. They were not changed as side effects.
- Graphify report/wiki and CLI are unavailable; `graphify update .` reports
  command not found.

No real MySQL migration/locking behavior, deployed JWT authentication, live API
record comparison or production repair was verified. Concurrent fixture tests
exercise the service's transaction boundary; they are not a substitute for
validating the migration and isolation level against a configured local MySQL 8
instance before production deployment.
