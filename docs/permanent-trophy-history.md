# Permanent Trophy History And Tournament Archives

## Verified Causes

Previously, cabinet entitlement revalidated live source records, while ranking titles came independently from tournament/season winner fields. Deleting source/match records or resetting winner fields could therefore make cabinets and counts disagree. Awards and visual placements were mixed: one design-level placement could aggregate several wins, and Done did not lock anything. Completed-tournament removal could physically delete results. The seven-day restriction also used mutable or scheduled dates rather than an official completion timestamp.

## Authoritative History

The existing `trophy_awards` entity now stores an immutable versioned metadata snapshot, an award role and a unique per-owner/event/edition/role key. Roles distinguish club champions, solo player champions and associated winning-club players. A nullable design allows a verified championship to count even when no artwork was configured; such an award is not placeable by design ID alone.

Snapshots retain event name, edition/season, winner, resolved runner-up, human-readable format, actual registered entrant count (not maximum capacity), official completion time where known, archive link, catalogue/design identity and artwork URL. Display names use `Event Trophy — Year` or `League Trophy — Season Label`. Missing historical dates/editions are shown as unavailable, never inferred from cabinet placement time. Artwork URLs refer to the existing immutable upload files; catalogue edits do not rewrite the snapshot. Referenced designs cannot be deleted through ordinary design deletion.

Permanent verified awards no longer depend on a live source record. Legacy rows without a trusted snapshot still require authoritative outcome verification. A visual placement, matching name or membership in a currently successful club is not proof. Reprocessing is protected by the database key and deterministic IDs. Associated-player identities are frozen with the original club award, so a later transfer does not acquire an old honour through a retry. Historical backfills do not reconstruct old squads from today's members; missing associated-player evidence is explicitly flagged. Missing source evidence alone does not authorise revocation as a supposedly proven incorrect win.

## Counts And Eligibility

Cabinet/profile all-time honours and official championship counts use the same verified history as ranking championship bonuses, deduplicated by event/edition/role. Revoked honours are excluded even if the old source still has a winner field. Winning before arranging a cabinet still counts. Club championship records, not associated-player records or placements, count as club titles.

The existing official-ranking eligibility policy is preserved: regional/GOST editions and admin/official tournaments count; community tournaments do not gain official eligibility merely because they now have durable awards. Runner-up ranking bonuses remain distinct and do not count as titles. The existing **player ranking's club-context title metric** continues to reflect its current club's official titles; a player's personal cabinet instead shows its own solo and historically associated honours. Those are intentionally different scopes. There is no new seasonal title category. Cached player club-context counters are refreshed on club awards, scoped revocation and history reset; ranking reads calculate from verified history.

## Lifecycle Contract

- New seasons leave old honours intact and use distinct edition identities. Regional fresh-start resets now create a fresh edition UUID, avoiding accidental reuse of revoked season-one identities.
- Archival and normal completed-tournament removal preserve sources, results, standings, awards and financial references. Completed DELETE/cancellation paths now archive rather than destroy. The generic model also refuses physical deletion of completed/archived rows. Unstarted/cancelled deletion retains existing policy and is locked/audited.
- Archived tournaments are read-only for normal scheduling, reporting, generic updates and progression reconciliation. Historical links continue to use the original detail route.
- Explicit regional/GOST history reset previews exact family scope, editions, honours, placements, achievements and title effects. Applying requires the reviewed revision; a changed or missing preview conflicts before mutation. It revokes matching awards in the reset transaction, retains revocation evidence, hides their placements even if permanently locked, clears the existing scoped operational/achievement records, and recalculates caches. Other families and unrelated valid titles remain. **STC ledgers and payments are not reversed.** Existing reset UI scopes select all regional, all GOST or both; this change does not invent narrower region filters.

## Archive Location And Timing

Archive is inside both existing user Tournaments and Admin Tournaments pages. It supports search, pagination, completion year, existing format values and organiser filtering. Links preserve access to original results/Stages/statistics. Summaries include known winner/runner-up, actual entrants, completion date, historical trophy and settlement/review state.

New completion paths stamp `completed_at` once with `COALESCE`, never `updated_date`. An idempotent server job starts after migrations, runs on boot and every minute, and archives completed tournaments once seven 24-hour days have elapsed. Younger completions stay in normal completed listings. Manual removal may archive a completed tournament earlier without destroying its history.

Legacy records without a reliable `completed_at` are flagged `archive_review_required`; scheduled end dates and later edits are not treated as proof. They need explicit historical review rather than an invented date. Established awards remain valid. Trophy review problems do not masquerade as financial success: archival retains the underlying records and flags unresolved history. Pending monetary settlement remains visible and retryable through the existing financial workflow.

## One Copy Per Win

Owners choose an unplaced persisted award, not a catalogue design. Creating a draft uses its exact `award_id`; the owner row lock and unique placement index prevent concurrent duplicate copies. Drafts can be moved, resized or removed, including keyboard positioning. Each separately earned season/event remains an independent copy.

Done lists the number of draft copies being confirmed and explains permanence. Cancel/close leaves them editable. Confirm transactionally locks only the selected draft IDs. Ordinary owners cannot move, resize, remove, substitute or duplicate locked copies through either UI or direct APIs. Later wins do not unlock old copies. Admin correction is a separate reason-required audited unlock action. Explicit history revocation still excludes a locked copy from display while retaining it as evidence.

Hover exposes event details through the accessible title; keyboard activation and mobile tap open the same detailed modal. It includes event, edition, winner, format, entrant type/count, completion date, placement state and historical link.

## Existing-Data Review And Migration

Schema and startup migrations are synchronized: new award metadata/role/key/revocation timestamp; nullable award design; per-award placement reference and lock time; tournament completion/archive/review fields. Old rows receive null keys/references/locks. **Deployment never locks existing arrangements.** Duplicate non-null keys/references block index migration for explicit review instead of being deleted or arbitrarily merged. No business payout or history backfill runs as a schema seed.

Use existing authenticated admin cabinet review:

- GET `/api/stage/trophy-placements/entitlements?owner_type=club&owner_id=<id>` reads verified copies, counts, placements and discrepancies without mutation.
- POST `/api/stage/trophy-placements/review/club/<id>` previews; the same route accepts `apply:true`, `reason` and `action:'materialize'` to freeze only reliably verified legacy wins. Player cabinets use `player` in the path. Missing sources, contradictory designs and ambiguous evidence remain flagged.
- Single-win legacy arrangements can be associated with exactly one verified unplaced copy as a draft. Aggregated/ambiguous arrangements are not automatically split or locked. An explicit audited `action:'associate_legacy'` with `placement_id` and `award_id` selects a verified copy for an unassigned arrangement; remaining wins stay independently available.
- Existing proven-invalid entitlement/placement repair actions remain available. Revocation retains evidence; it does not silently reverse a prize.
- POST `/api/stage/trophy-placements/confirm/<ownerType>/<ownerId>` with `placement_ids` confirms exact drafts.
- POST `/api/stage/trophy-placements/correct/<placementId>` with a reason is admin-only and unlocks a proven arrangement mistake for correction.
- GET `/api/stage/tournaments/archive` is the paginated authenticated archive reader. It never writes results, awards, progression or payments.

No production history repair, reset or payout was performed. A live inventory of ambiguous legacy records is still an operational review step. Back up the database before deployment, upload the changed backend and restart Gandi, then deploy the frontend build. Preserve historical files in `/uploads`. Startup migrations must finish before the archive job starts. No dependency or second award store was added.

## Verification

Controlled real-service and localhost HTTP tests cover durable metadata after renaming/source retention, two wins of one design, retry uniqueness, historical player association, official/community title scope, scoped reset with unrelated honours and ledger preservation, legacy draft association, unknown data, exact seven-day boundaries, automatic/manual archival, archive readout, concurrent copy creation, confirmation, locked mutation rejection and audited correction. Both club and solo-player cabinet APIs are exercised.

Browser checks render the actual cabinet and Archive components on desktop/mobile, exercise cancellation and permanent confirmation, keyboard details, locked controls, a second copy, pending settlement visibility and page-width checks. Screenshots were inspected. These use isolated API fixtures, not production accounts.

Lint, typecheck, server syntax, production build and focused tests passed. Full backend suite: **656/660 passed**; full frontend suite: **376/380 passed**. These retain pre-existing failures in captain-profile editing, fixture match creation, registration upload category, startup export source assertion, identity menus, FUT photo frame, GameDay club loading and photo-preview source assertions.

The changed modules are the award/placement models and controllers, trophy entitlement/award services, new `trophyHistory.js`, `competitionHistoryResetService.js` and `tournamentArchiveService.js`, existing ranking/completion/reset/deletion integrations, schema/startup migrations, and server job registration. Frontend changes cover the existing club/player cabinet wrappers and cabinet components, the shared new `TournamentArchive.jsx`, both Tournaments pages, reset confirmation and archive labels. Regression coverage is in the award/history service tests and cabinet/history HTTP tests; no generated UI primitive was edited.

Graphify documentation is absent and `graphify update .` cannot run because the CLI is unavailable. Real MySQL migration application, deployed authentication, production data repair and production job operation remain unverified. Stored legacy records whose sources were already destroyed and lack trustworthy snapshots cannot be reconstructed from names or placements; they remain an explicit data gap.
