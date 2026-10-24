# Frontend ↔ backend API audit

Originally reviewed on 24 October 2026. The findings below record the original defects; all four and the validation-tooling issue have now been addressed in the local checkout. Deployment remains separate.

## Implementation update

| Finding | Implemented fix |
|---|---|
| Token rotation | The shared client persists both access and replacement refresh tokens. |
| EA FC envelope | The EA helper returns the backend's single `data` payload. |
| Truncated directories | Player/club requests transmit `order_by`; the backend validates sort columns and orders before pagination with a stable ID tie-breaker. Search uses server-side substring filters and follows result pages. Participant selection loads every player page. President search hydrates linked players instead of relying on truncated lists. |
| Identity fallback | Identity-claim collection 404s reach the compatibility wrapper; real empty lists and permission errors do not invoke the fallback. |
| Alignment checker | The script parses actual invocations and the extracted `legacyFunctions.js` registry, ignoring comments and string examples. |

Verification: all 11 focused regression tests pass; lint, typecheck, production build, backend syntax checks and function-alignment checks pass. The complete frontend suite has 371 passes and 4 failures; the complete backend suite has 631 passes and 3 failures. All seven failures were reproduced against an untouched HEAD archive, confirming that they predate these changes. Graphify update was attempted but the command is not installed.

Deployment: rebuild/upload the frontend and upload the changed player/club controllers and models plus the new `server/src/server/utils/directoryQuery.js`, then restart the Gandi backend. No schema change or new dependency is required. Deploy the server query support together with the frontend changes; the revised search relies on it. SQL query construction and client contracts were tested with isolated dependencies; production database responses have not been revalidated.

## Findings

### P1 — Rotated refresh tokens are discarded

[stageClient.js:185](../../src/api/stageClient.js#L185) extracts only `accessToken` from the refresh response. The [backend refresh route](../../server/src/server/controllers/authController.js#L193) deletes the supplied refresh token, stores its replacement and returns both tokens. The first renewal succeeds, but local storage retains the deleted refresh token. At the next access-token expiry, refresh fails and the user is signed out. Logout after the first renewal also sends the obsolete refresh token.

Verification: ran the actual transpiled client with in-memory storage and a fetch adapter implementing the backend rotation contract. Two refresh attempts supplied the same old token; the second request failed with 401.

Required change: persist both tokens from each refresh response using `storeTokens`.

### P1 — EA FC responses are unwrapped twice

[eafcClient.js:8](../../src/lib/eafcClient.js#L8) returns `res.data?.data`. The [backend `eafcApi` handler](../../server/src/server/functions/legacyFunctions.js#L7613) returns `{ data: upstreamPayload }`, and the functions router serializes that result directly. `functions.invoke` does not add another SDK response envelope. EA payloads therefore become undefined in the browser. Search returns an empty array, while club dashboards lose their data.

Affected consumers include Search, EAFCClub, dashboardData and EafcClubLinkPanel.

Verification: provided `{ data: [{ clubId: 'club-1', name: 'Fixture club' }] }` through the real client helper. `searchClub` returned `[]` instead of the club.

Required change: return `res.data` and retain appropriate error handling for the upstream payload.

### P2 — Sorting and searching operate on an already truncated collection

[stageClient.js:358](../../src/api/stageClient.js#L358) sends a limit but no server sort, then sorts the returned subset locally. For example, [Player.list('-overall_rating', 200)](../../src/pages/PlayersRegistered.jsx#L31) requests 200 rows, but the [player model](../../server/src/server/models/playerModel.js#L84) selects those rows alphabetically by gamertag. Players outside the first 200 cannot appear regardless of their rating.

[Search.jsx:42](../../src/pages/Search.jsx#L42) similarly requests at most 200 players and clubs and only then applies the typed search term locally. An existing player outside that first alphabetical page is reported as absent. Player selection can omit participants who are already registered, leaving the selection screen incomplete.

Verification: traced the actual list/filter query construction, player controller dispatch and SQL ordering. The backend already has a `search` player filter, but this search screen does not use it.

Required change: support allowlisted server-side ordering before pagination; use API search filters and pagination for directory searches and participant selection rather than treating a limited page as the complete collection.

### P2 — Identity-claim list fallback cannot run

[identityClaims.list](../../src/api/stageClient.js#L734) catches REST 404s to call `listPlayerIdentityClaims`. However, [the generic entity filter](../../src/api/stageClient.js#L364) has already converted every 404 into `[]`. The outer catch never receives the error. On a deployment with the function handler but no entity route, existing claims disappear from onboarding/profile/admin views instead of loading through the advertised fallback.

Verification: made the REST entity route return 404 while the function handler was available. The actual client returned an empty array and made zero function requests.

Required change: preserve the 404 at this compatibility seam, or make the identity-claims wrapper perform the REST request directly before selecting its fallback. A genuine empty list must remain distinct from a missing endpoint.

## Validation tooling issue

`scripts/check-functions-alignment.mjs` currently fails with `Could not locate HANDLERS block in functionsController.js`. It still searches for the old inline implementation, while handlers now live in `server/src/server/functions/legacyFunctions.js`. The checker cannot detect alignment regressions until updated. This is a tooling problem separate from the four application findings above.

## Coverage

- Parsed frontend JavaScript/JSX with the installed TypeScript parser: 183 `functions.invoke` call sites, including 88 distinct literal function names. Dynamic invocation remains a manual-review limitation.
- Cross-checked every literal function name against the backend handler registry: no missing names found.
- Inspected 84 literal action arguments: no unknown action literal surfaced in the handler scan. Name matching alone does not prove business correctness.
- Cross-checked 530 direct entity-method calls across 51 referenced entity names against the frontend entity registry, backend mounts and declared HTTP methods: no missing registration, mount or method found.
- Inspected 108 raw HTTP-helper calls. Literal/template paths matched registered routes after resolving the known international-tournament base and query suffixes. Variable URLs and dynamic action suffixes were inspected at their construction sites.
- Reproduced token rotation, EA response handling and identity fallback with the actual client code in an isolated Node harness. No production mutations, payments or messages were sent.
- The previously reported profile/showcase/audit 400 responses came from unscoped test requests; their actual frontend consumers pass filters. The scouting/admin 403 responses reflect account permissions, not evidence that the corresponding routes are missing.

This audit verifies route alignment and identifies concrete client-contract defects. It does not certify every form, dynamic invocation, permission combination, realtime event, third-party response or transactional workflow end to end. A 200/201 availability check would not detect the findings above.
