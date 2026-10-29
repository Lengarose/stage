# Permanent League Identity and Edition Lifecycle

## Status

Implemented in the local working tree. No deployment, production reset,
simulation, payout, award issuance, or production consolidation was performed.
Neither `server/.env` nor `server/src/constants/env.local.js` is present locally.
Database-dependent previews/counts below are therefore **pending**, not verified
live results. Tests use isolated database/service fixtures, not real MySQL.

## Confirmed Code Paths

- Regional rollover previously created another `regional_league` row without a
  permanent parent and the frontend seeded rewards against that new ID.
- Admin/Rewards consumed regional edition rows as independent leagues.
- The old reset attempted to renumber surviving editions to Season 1. Its newer
  collision guard correctly blocked that unsafe collapse but did not plan a new
  reset series.
- GOST rollover previously used several client-side CRUD writes rather than one
  server-side, locked action.
- Fixture drawing lived in frontend helpers; completion could be requested
  without authoritative validation of the complete required schedule.

These establish implementation defects consistent with the user's account.
They do not establish which production transactions or historical rows remain.

## Compatible Persistence Model

The original regional row remains the permanent identity/default source and its
original Season 1 evidence. Further regional rows are explicit editions with
`permanent_league_id` pointing to the original. All existing edition IDs and
fixture references remain valid. The permanent row stores `current_edition_id`.
`reset_series` distinguishes fresh numbering from invalidated prior history.
GOST retains its existing competition/season model with the same series boundary.

This deliberately does not physically delete a row containing a valid edition.
Consolidation removes its independent identity by assigning its permanent parent
and clearing its permanent identity key. It remains addressable as an edition.
No fuzzy name merge or frontend-only hiding is used.

Default rewards/trophy assignments resolve through the permanent identity.
Captured edition configurations and award instances are not rewritten by
rollover or default edits. New seasons start with an empty eligible-registration
workflow, not invented automatic club carryover.

## Exact Requested Mappings

| Original Permanent ID Retained | Additional Independent ID Converted | Intended Result |
| --- | --- | --- |
| `c2d6e60f-89e0-4813-81a1-967551d8d69f` | `46dbb09f-8319-4607-ab97-ec941745bfd8` | Original Premier identity; retain the additional ID as its legitimate Season 2 edition, with all references intact. |
| `e91c6c27-4fd2-45d9-b6ed-6a3591d7b210` | `e582c55b-1e72-45f5-ab63-137c3420404a` | Original North American D1 identity; consolidate a proven-unused colliding reset-era row as a superseded child with explicitly unknown provenance. Activity/provenance conflicts block application. |

Do not choose different originals by list position. Actual ID/region/division/
platform/season validation occurs in the preview. A North American row containing
activity cannot safely be relabelled as the original Season 2 without evidence.
The service blocks that case for a concrete recovery decision.

Dependency counts, trophy restoration decisions, ledger/award discrepancies,
and final production list counts are **unknown until the following read-only
operations run against the target environment**. No illustrative fixture count
is a substitute for that preview.

## Production Preview and Reviewed Apply

After deploying the backend, use an authenticated Admin session. In the browser
console, the existing client can be used without exposing tokens:

```js
const { stageClient } = await import('/src/api/stageClient.js'); // Vite only
```

For deployed builds use the Admin Regional Leagues management panel's two named
consolidation Preview actions, or an authenticated REST client. The precise REST
operations are:

```http
GET /api/stage/regional-leagues/edition-review
GET /api/stage/regional-leagues/catalogue

POST /api/stage/regional-leagues/edition-review
Content-Type: application/json
Authorization: Bearer <admin token>

{"mode":"consolidate","apply":false,"source_id":"46dbb09f-8319-4607-ab97-ec941745bfd8","canonical_id":"c2d6e60f-89e0-4813-81a1-967551d8d69f"}
```

Repeat the POST with source `e582c55b-1e72-45f5-ab63-137c3420404a`
and canonical `e91c6c27-4fd2-45d9-b6ed-6a3591d7b210`.

Save both JSON responses and the diagnostic. Review `blockers`, `revision`,
dependency inventories, `changes`, `before_after`, `discrepancies`, and historical
resolution information. Missing/malformed evidence blocks mutation. Review the
Premier completed-without-fixtures discrepancy, associated awards, payouts,
qualifications and movement records explicitly. The repair never fabricates
matches or silently revokes honours/reverses posted payments.

Only after the concrete production preview has been reviewed and authorised,
send the same POST with `apply:true`, `expected_revision` exactly from that
preview, and a nonempty `reason`. Apply is transactional, audited, locked and
retryable. A changed revision requires another preview. Stop on any blocker;
never force through competing financial/sporting histories.

Re-run GET diagnostics/catalogue and both POST previews afterward. Verify one
permanent entry per intended division, exact current edition, original routes,
legacy edition links, Division 2 and other platforms/seasons, registration and
fixture counts, reward defaults/snapshots and unchanged ledger/award records.
Admin Rewards must open the original permanent source. Repeated seeding must
return that existing identity, not create another one.

## Business Actions

- `POST /api/stage/competition-views/:kind/:editionId/lifecycle`, with
  `action:draw|complete|abandon|rollover`, operates on an exact edition.
  `kind` is `regional_league` or `competition_season`. Abandon requires
  `confirmation:true` and a reason. Regional rollover also retains the existing
  `/regional-leagues/:id/next-season` action.
- Draw validates actual clubs, unique registrations/standings, production
  capacity, format and existing fixtures. It uses the prior circle/mirrored-leg
  planner on the server. GOST requires 36 clubs and its configured league phase;
  no later knockout stages are generated by this initial draw.
- Simulation requires existing eligible unplayed fixtures and an active exact
  edition. No production simulation was used for verification.
- Completion validates the complete required schedule, confirmed/resolved ties,
  and standings before delegating to the canonical progression/settlement path.
  Empty seasons do not produce outcomes. Whole-round knockout progression stays
  in the existing engine. No GOST third-place or manual next-round draw is added.
- Abandon preserves evidence and obligations, blocks conflicting earned/paid
  outcomes, and flags unpaid obligations for financial review.
- `/regional-leagues/management` supports previewed create/review/retire/delete.
  Apply requires its revision and reason. Delete accepts only a proven-unused
  draft; retirement preserves history and prevents rollover/reseeding. Future
  divisions need explicit reward defaults instead of inferred Division 1 prizes.

## Fresh Start Reset

The existing `adminResetLeagueCompetitionData` server function now previews an
explicit `scope:regional|gost|all`. Optional `selected_permanent_ids` narrows it.
Apply repeats that exact scope with `review_revision`, a reason and
`confirmation:"RESET LEAGUES"`; superadmin identity is read from the database.

The preview inventories selected editions, generated records, SQL status enum
support, honours, owners, cabinet placements and financial references. Apply
invalidates selected history rather than deleting financial rows; revokes only
scoped honours using the established mechanism; reconciles affected caches; and
creates at most one fresh Season 1 per parent in the next series. GOST starts
as a draft awaiting qualification, not public registration. Permanent defaults,
catalogue artwork, accounts and unrelated history remain intact.

Legacy independent ambiguous parents block reset until reviewed consolidation.
Previous missing history is not reconstructed. Inspect operation/audit snapshots
and backups to determine recoverability. Posted financial corrections require
separately authorised compensating entries, never replayed settlement.

## Migrations and Gandi Deployment

1. Back up MySQL and preserve uploaded artwork and environment secrets.
2. Upload every changed backend file under `server/src/`, plus the updated
   `server/schema.sql` for fresh-install parity. Include the new service/helper
   files, not just the route/controller. No new dependency is required.
3. Restart the Node application in the Gandi admin console. FTP uploads alone
   do not restart it. Startup migrations add the nullable permanent/edition keys,
   parent ID and reset-series columns and guarded uniqueness indexes. Conflicting
   legacy rows are not silently merged at startup; inspect migration logs.
4. Upload the complete `build/` output from `npm run build`, including its asset
   references and service-worker files. Do not deploy only changed JSX sources.
5. Check Gandi `/lamp0/var/log/www/nodejs.log` and `nodejs-watchd.log`, confirm
   backend routes and frontend versions, then run the production previews above.
6. Review and authorise concrete production data repair separately. Verify index
   presence and non-null keys for repaired identities; preserve legitimately
   distinct platforms, series and seasons.

On failure, stop further lifecycle mutations. Preserve the failed response,
review revision and audit/operation rows. Transactions roll back failed applies;
after a committed operation, prefer a scoped reviewed corrective operation.
Do not restore the old reset code or replay payouts. Restore a full database
backup only as a separately authorised coordinated recovery, never partial
ledger restoration.

## Verification Boundaries

Focused tests cover rollover/reset, exact supplied-ID mapping, preserved Season 2
references, concurrency/retries/rollback, inherited defaults, future Division 3,
draw/completion/abandonment, scoped honours and ledger preservation. Local HTTP
fixture tests exercise catalogue, management, consolidation, lifecycle and reset.
These verify handlers and services, not deployed auth or real MySQL locking.

Real MySQL schema/constraint creation, cross-process database locking, production
ID/dependency previews, deployed route availability and live repair remain
unverified until access and an authorised operational window are provided.

### Local Check Results

- `npm run lint`, `npm run typecheck`, `node --check server/src/server.js`,
  `npm run build`, and `git diff --check`: passed.
- Focused lifecycle/engine/reset/management/public HTTP/GOST suite: 90 passed.
  Frontend lifecycle/Rewards/presentation suite: 24 passed.
  Existing Division 2 reward regression suite: 6 passed.
  Simulation safety regression: passed, no fixtures simulated.
- Full frontend suite: 441 tests, 437 passed, 4 unrelated existing failures
  (header identity links, FUT image markup, GAMEDAY loader source assertion,
  profile photo editor markup).
- Full backend suite: 803 tests, 798 passed, 4 unrelated existing failures,
  1 skipped (captain profile access, fixture match snapshot creation, player
  tournament registration assertion, startup migration export assertion).
- Browser QA: isolated management panel, preview/confirmation gating, fixture
  action states and 390px mobile layout verified. No horizontal overflow.
  Preview: `http://127.0.0.1:5196/scripts/league-lifecycle-qa.html`.
- `graphify update .` could not run: `graphify` is not installed. The configured
  `graphify-out` directory has no report or wiki to consult.

These checks do not mean all repository tests pass or that production is fixed.
