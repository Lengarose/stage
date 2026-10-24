# Tournament Standings Integrity

## Confirmed Causes

- The League and UCL frontend calculations read club IDs for player fixtures. Missing IDs merged both sides into an unnamed row.
- Outcomes depended on winner IDs, so a confirmed 2-1 without a winner ID could count as a draw.
- League tables discovered entrants from results rather than the registered roster.
- Completion status alone admitted unconfirmed records and missing scores became zero.
- The private Match fallback is account-scoped, not a complete tournament feed. It has been removed from tournament fixture loading. Failed full-feed requests now produce an unavailable state.
- Backend standings previously used stable ID ordering as a sporting tiebreak. Unresolved qualifying/seeding/paid positions now require review instead.

## Player And Club Tables

Both League and UCL use participant-type-aware calculations. The public tournament response resolves every registered ID in one batch, without the previous Club-list cap. Missing profiles retain distinguishable ID-based rows and a warning. Registered IDs, not fetched profiles or matches, determine the roster.

Tables initialize the full roster at zero, deduplicate registration IDs, normalize identifiers, derive ordinary W/D/L from scores, reject invalid or contradictory contributions, and deduplicate match representations. Equal sporting values share a rank, with stable IDs used only for presentation.

Eligibility requires the selected tournament/edition/phase and a confirmed completed result (or the established official forfeit status). Scheduled, disputed, cancelled, voided, preview, superseded, obsolete and out-of-scope records do not contribute. Missing, negative and non-integer scores are not played draws. An explicitly awarded equal-score forfeit remains supported. Shootouts do not add ordinary goals.

Existing rules found in these paths are three points for a win, one for a draw, then points, goal difference and goals scored. No configurable points deductions, head-to-head rule or additional final tiebreak was found. No new sporting tiebreak was invented.

The browser and CommonJS server have matching pure adapters in their independently deployed source trees (`src/lib/standingsCore.js` and `server/src/server/lib/standingsCore.js`). Cross-runtime regression cases verify their agreement; changes to the calculation must remain synchronized.

## UCL Configuration

The existing rules UI and knockout engine define 36 entrants, eight league games each, eight direct qualifiers and sixteen playoff places. Both draw generators now enforce the supported entrant count; the server also validates the eight-round configuration. Nonstandard historical rosters remain visible, without misleading 36-team zone highlighting. Zones wait for confirmed appearances, resolved qualifying/seeding ties and an actual successor stage, not merely eight distinct round numbers.

## Registration And Results

The public query is constrained by tournament ID; the private fallback was additionally constrained by the viewer's identity and therefore incomplete. Existing draw generation reuses stored fixtures rather than regenerating them. Result simulation and normal reporting share `assertTournamentMatchAction`, which previously did not reject registration status.

Reporting results during registration/setup/draft or after cancellation is now rejected by that shared server guard. Controlled tests reproduce registration rejection and allow reporting after start. If existing confirmed records coexist with registration, the table exposes the inconsistency rather than hiding the rows or erasing results.

The exact production history behind the screenshot was not inspected. No claim is made that its records were preview fixtures, reused results, or cross-tournament contamination. Starting/regenerating a draw does not silently erase historical activity.

## Regional And GOST

These competitions retain their persisted standings and score-based result updates. Confirmed risks addressed:

- Missing/duplicate standing identities no longer silently select a usable-looking row: result synchronization returns an integrity warning, and duplicate participants are excluded from the displayed ordering until reconciled.
- GOST no longer chooses the most active duplicate as if it were authoritative.
- Regional display, GOST display and backend selection use the same numeric ordering and stable presentation fallback.
- Detail pages retrieve all standing rows through the existing edition view, replacing the fixed 50/100 standing limits. Edition filtering remains on the server.
- Before league qualification/completion, stored totals and the authoritative registered roster must agree with confirmed results. Unresolved sporting positions block automatic selection.
- Final prize-recipient selection checks integrity and unresolved paid positions. Prize amounts, transfer logic and existing settlement idempotency are unchanged.

Excluded rows retain their existing metadata and display exclusion. Repairs do not infer missing results or overwrite historic qualification, trophies or payments.

## Review And Repair

The league/competition detail page shows an integrity notice and, to admins, the expected totals and a reason-required repair action.

Read-only review:

```text
GET /api/stage/competition-views/regional_league/:id?review=standings
GET /api/stage/competition-views/competition_season/:id?review=standings
```

Existing protected business-action route, preview first:

```json
POST /api/stage/competition-views/:kind/:id/reconcile
{ "action": "standings", "apply": false }
```

Apply only after reviewing the response:

```json
{ "action": "standings", "apply": true, "reason": "Reviewed missing or duplicate standing records" }
```

The repair locks the edition, fixtures, standings and linked results in a transaction; rebuilds totals from eligible results; creates missing rows; preserves metadata; and removes redundant duplicates only when their metadata agrees. Repeated application is a no-op after repair. Admin identity comes from authenticated context and mutations write `admin_audit_log`.

Missing authoritative registration/profile data, unverifiable historical results, invalid/unregistered standing records, differing duplicate metadata, completed editions, existing payout obligations, or dependent knockout activity require explicit resolution instead of automatic deletion or repair. Restore/correct registration and result evidence through existing authorized admin workflows first; completed historical placements and their financial/trophy dependencies require case-by-case review.

No schema changes, dependencies, startup business-data migrations, or production mutations were made. Existing ordinary result synchronization is retained; database-level concurrency against real MySQL has not been verified locally.

## Verification

- The first 16 regressions failed before the fix, including the exact merged-player-row and score-only win cases.
- Thirty frontend calculation regressions cover the four combinations, zero/full/partial rosters, malformed and duplicate IDs, confirmation, scores, corrections, editions, conflicting duplicates, administrative forfeits and runtime parity.
- Focused backend integrity/progression/settlement tests pass.
- New and modified HTTP behavior was exercised on localhost with isolated SQL adapters: public player/club rosters, scoped fixtures, regional/GOST preview and repair, permissions, audit writes, repeat safety and historical conflicts. Existing production JWT middleware was not bypassed in application code; test apps inject controlled identities.
- Playwright exercised the actual table components in a controlled harness at 1440px and 390px: correct headers, all 20 rows, initial zeros, score-only wins, registration warning and no document overflow. External API calls were blocked. This is component runtime verification, not an authenticated production end-to-end run.
- `npm run lint`: pass.
- `npm run typecheck`: pass.
- `node --check server/src/server.js` and all 18 changed/new backend JS files: pass.
- `npm run build`: pass; existing Browserslist age and large-chunk warnings remain.
- Full backend suite: 613/616 pass. The three failures also reproduce using unchanged HEAD modules: legacy captain Club edit, `createMatchFromLeagueFixture`, and the old Ultimate Team registration-source assertion.
- Full frontend library suite retains four pre-existing failures: identity menu routes, FUT image rendering assertion, GameDay club-loading source assertion, and profile-photo preview assertion. None concerns standings.
- `git diff --check`: pass.
- `graphify update .`: unavailable (`graphify` not installed). `graphify-out/GRAPH_REPORT.md` and the wiki are absent; source inspection was used.

No local MySQL migration/runtime or live authentication was verified. No production database records were read or changed. Deploy the changed frontend build and backend files together, restarting the backend through the existing Gandi deployment workflow.
