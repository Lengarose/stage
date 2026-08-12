# Slice 8 Authenticated Smoke Release Gate Result

Date: 2026-08-12

Status: Environment-blocked for a true authenticated browser smoke. Automated and source fallback checks are clean.

## Environment Used

Attempted local smoke:

- Frontend target: `http://localhost:5173`
- Backend target: `http://127.0.0.1:8080`
- Production: not used.
- Staging: no staging URL or credentials were available in the repo context.

The root `.env` currently points Vite at `https://stageleagues.com`, which is production. The Slice 8 rule says to use local or staging unless production testing is explicitly approved, so production was not used for smoke data creation.

## Account And Data Setup

No disposable authenticated smoke account was created.

Reason:

- The backend is configured to use the Gandi MySQL socket path.
- A local backend boot attempt started the HTTP listener on port `8080`, but startup migrations and every DB query failed with `connect ENOENT /srv/run/mysqld/mysqld.sock`.
- No local MySQL socket was found at the expected paths.
- No staging URL or staging credentials were available.

Captured backend blocker:

```text
[stage] server running on port 8080
[SQL ERROR] connect ENOENT /srv/run/mysqld/mysqld.sock ...
[migration] startup error: Error: clubs.president_user_id migration left 1 orphan club(s)
```

The backend process was stopped after confirming the blocker.

## Smoke Checklist

| Check | Result | Evidence |
|---|---:|---|
| Create Player remains player-only and can stay free agent | Source/test confirmed | Targeted onboarding tests passed. Authenticated browser click-through blocked by missing local/staging DB. |
| Create Player + President creates Player, Club, active founder contract, active membership, and President status | Source/test confirmed | Founder lifecycle backend tests passed. Browser click-through blocked. |
| Player + President profile does not look like free agent after club attachment | Source/test confirmed | Player profile status tests passed. Browser click-through blocked. |
| Presidents directory opens Player profiles | Source/test confirmed | President directory tests and source guards passed. Browser click-through blocked. |
| Search President results open Player profiles | Source/test confirmed | Search President result tests passed. Browser click-through blocked. |
| Legacy `/presidents/:id` redirects or degrades safely | Source/test confirmed | President compatibility tests and route source guards passed. Browser click-through blocked. |
| Player profiles show President/Founder badges correctly | Source/test confirmed | Player profile status tests passed. Browser click-through blocked. |
| Feed image post creation with position/zoom metadata | Source/test confirmed | Feed media tests passed. Browser click-through blocked. |
| Reload persists image framing | Source/test confirmed | Post model/controller metadata preservation tests passed. Browser click-through blocked. |
| Old video post rendering | Source/test confirmed | Feed media tests and source guard confirmed old video rendering branches remain. |
| Server-owned likes/comments from UI | Source/test confirmed | Feed source guard confirms UI uses `stageClient.posts.likeToggle` and `stageClient.comments.createForPost`; backend tests passed. Browser click-through blocked. |
| Non-owner notifications and skipped self-notifications | Test confirmed | Backend feed trust tests passed for like/comment non-owner notifications and self skips. Second authenticated session unavailable. |
| Global video upload remains available for proof/scouting workflows | Source/test confirmed | Upload controller source guard and frontend feed media tests confirm global upload still allows video MIME types. |
| Transfer Room remains untouched | Confirmed | Final diff/source scan found no Transfer Room files touched. |

## Commands Run

### Local Environment Probes

```bash
lsof -nP -iTCP:8080 -sTCP:LISTEN
lsof -nP -iTCP:5173 -sTCP:LISTEN
curl -i http://localhost:5173/
curl -i http://127.0.0.1:5173/
find /srv /var/run /tmp -maxdepth 4 -name 'mysqld.sock' -o -name 'mysql.sock'
find /usr/local/var /opt/homebrew/var /tmp /private/tmp -maxdepth 5 -name 'mysqld.sock' -o -name 'mysql.sock'
npm run start
```

Result:

- No usable local frontend/browser target was available.
- No backend was initially listening on `8080`.
- Backend boot on `8080` failed all DB-backed work because `/srv/run/mysqld/mysqld.sock` does not exist locally.
- No local MySQL socket was found.

### Targeted Backend Tests

Command:

```bash
node --test server/src/server/controllers/__tests__/authIdentityAliases.test.js server/src/server/services/__tests__/identityService.test.js server/src/server/controllers/__tests__/clubController.test.js server/src/server/services/__tests__/founderContractLifecycleService.test.js server/src/server/controllers/__tests__/playerContractController.test.js server/src/server/controllers/__tests__/feedTrustController.test.js
```

Result: passed, 30/30.

### Targeted Frontend And Source Tests

Command:

```bash
node --test src/lib/__tests__/playerOnlyOnboardingIntent.test.mjs src/lib/__tests__/clubPresidentProfileUi.test.mjs src/lib/__tests__/playerProfileStatus.test.mjs src/lib/__tests__/playerProfileStatusUi.test.mjs src/lib/__tests__/feedTrustMedia.test.mjs src/components/contracts/__tests__/presidentContractNaming.test.mjs
```

Result: passed, 33/33.

### Source Guards

Commands:

```bash
git diff --name-only | rg -i "transfer-room|TransferRoom|room"
rg -n "stageClient\\.posts\\.likeToggle|stageClient\\.comments\\.createForPost|stageClient\\.entities\\.Post\\.update|stageClient\\.entities\\.Comment\\.create|media_type.*video|accept=\\\"image/\\*,video/\\*\\\"|accept=\\\"video/\\*\\\"|video/mp4|video/webm|video/quicktime" src/components/PlayerFeed.jsx src/components/ClubFeed.jsx src/pages/Social.jsx server/src/server/controllers/postController.js server/src/server/controllers/commentController.js server/src/server/controllers/uploadController.js
```

Result:

- No Transfer Room diff hits.
- Feed UI uses server-owned like/comment actions.
- No new feed video upload controls were found in the guarded components.
- Old feed video rendering branches remain.
- Global upload controller still allows `video/mp4`, `video/webm`, and `video/quicktime`.

### Full Verification

Commands:

```bash
npm run lint
npm run typecheck
node --check server/src/server.js
npm run test:server
npm test
npm run build
git diff --check
```

Results:

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `node --check server/src/server.js`: passed.
- `npm run test:server`: passed, 212/212.
- `npm test`: passed, 139/139.
- `npm run build`: passed.
- `git diff --check`: passed.

Build notes:

- Vite reported the existing Browserslist/caniuse-lite age warning.
- Vite reported large chunk warnings after minification.
- These warnings are unchanged from Slice 7 and are not specific to the President-as-Player smoke scope.

## Bugs Fixed

No smoke-discovered product bugs were fixed.

No code changes were made for Slice 8.

## Blockers

Authenticated browser smoke is blocked by environment, not by a discovered product regression:

- Local backend cannot execute DB queries without the Gandi MySQL socket or a configured local MySQL database.
- No staging URL or staging credentials were available.
- Production testing was not approved and was therefore not used.

## Final Release Recommendation

Do not mark Slice 8 as a completed authenticated smoke pass yet.

The branch remains clean from automated verification and source/test coverage, with no product release blockers found in fallback checks. For the final release gate, run one real authenticated click-through on a seeded local database or staging environment. If the team wants this completed from the current environment, provide a local MySQL socket/database configuration or staging test credentials.

## Residual Risks

- The highest-risk user journeys still need one human/browser pass with real persisted data: Player-only onboarding, Player + President founder onboarding, profile state after reload, Presidents/Search navigation, and feed image metadata after reload.
- Non-owner notification behavior still needs a two-account browser confirmation if staging/local test accounts are available.
- Production deployment still needs the normal backend restart so startup migrations run on the hosted MySQL database.
