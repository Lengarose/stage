# Slice 9 Smoke Environment Enablement Result

Date: 2026-08-12

Status: Local smoke environment partially enabled. True authenticated browser smoke remains blocked by missing database service/access.

## Environment Used

Attempted local environment:

- Frontend target: local Vite on `http://localhost:5173` when available.
- Backend target: local Express on `http://127.0.0.1:8080` or high-port probe `http://127.0.0.1:18080`.
- Database target attempted: local MySQL over TCP at `127.0.0.1:3306`.
- Production: not used.
- Staging: no staging URL or disposable credentials were available.

Production was not used because Slice 9 requires local/staging unless explicitly approved.

## Account And Data Setup

No authenticated smoke accounts were created.

Reason:

- The original local backend path was blocked because the backend only used the Gandi socket path `/srv/run/mysqld/mysqld.sock`.
- Slice 9 added safe TCP-capable local DB configuration support.
- After TCP mode was enabled, the backend reached the next real blocker: no MySQL service is listening at `127.0.0.1:3306`.
- No staging environment or credentials were provided.

No secrets were added or committed.

## Changes Made

### Backend DB Config

File: `server/src/server/db/database.js`

- Added `buildPoolConfig`.
- Preserved Gandi socket behavior when `DB_SOCKET_PATH` is set.
- Added TCP MySQL config path when `DB_SOCKET_PATH` is empty.
- Started using configured `DB_USER`, `DB_PASSWORD`, and `DB_NAME` instead of hardcoded values.
- Exported `buildPoolConfig` for focused tests.

### Local Env Template

File: `server/src/constants/env.local.example.js`

- Added non-secret local DB placeholders.
- Documented that local smoke should set `DB_SOCKET_PATH: ''` to use TCP.

### Tests

File: `server/src/server/db/__tests__/databaseConfig.test.js`

- Added coverage for Gandi socket config.
- Added coverage for local TCP config.

## Environment Probes

Commands:

```bash
mysqladmin --protocol=tcp -h 127.0.0.1 -P 3306 -u root ping
mysql --protocol=tcp -h 127.0.0.1 -P 3306 -u root -e 'SELECT VERSION() AS version'
mysql --socket=/tmp/mysql.sock -u root -e 'SELECT VERSION() AS version'
mysql --socket=/opt/homebrew/var/mysql/mysql.sock -u root -e 'SELECT VERSION() AS version'
which mysqld
ls /opt/homebrew/opt | rg -i 'mysql|mariadb'
find /opt/homebrew -maxdepth 4 \( -name mysqld -o -name mysql.server \)
PORT=18080 DB_SOCKET_PATH='' DB_HOST=127.0.0.1 DB_PORT=3306 DB_USER=root DB_PASSWORD='' DB_NAME=stage_league npm run start
```

Results:

- MySQL client exists.
- MySQL server binary was not found.
- Homebrew has `mysql-client`, not a local MySQL server package.
- TCP MySQL connection failed with `Can't connect to MySQL server on '127.0.0.1:3306'`.
- Socket checks failed for `/tmp/mysql.sock` and `/opt/homebrew/var/mysql/mysql.sock`.
- Backend TCP-mode probe started listening on port `18080` when run with approved local escalation, then DB work failed with `connect ECONNREFUSED 127.0.0.1:3306`.

## Smoke Checklist

| Check | Result | Evidence |
|---|---:|---|
| Create Player remains player-only and can stay free agent | Not browser-smoked | Local/staging authenticated environment unavailable. Covered by existing tests. |
| Create Player + President founder flow | Not browser-smoked | Local/staging authenticated environment unavailable. Covered by founder lifecycle tests. |
| Profile President/Founder badge | Not browser-smoked | Local/staging authenticated environment unavailable. Covered by profile status tests. |
| Presidents directory and Search route to Player profile | Not browser-smoked | Local/staging authenticated environment unavailable. Covered by source/frontend tests. |
| Legacy `/presidents/:id` compatibility | Not browser-smoked | Local/staging authenticated environment unavailable. Covered by source/frontend tests. |
| Feed image post with metadata and reload | Not browser-smoked | Local/staging authenticated environment unavailable. Covered by backend/frontend tests. |
| Server-owned like/comment UI | Not browser-smoked | Local/staging authenticated environment unavailable. Covered by backend/source tests. |
| Non-owner notifications with second account | Not browser-smoked | No two-account local/staging session available. Covered by backend tests. |
| Transfer Room untouched | Passed | Final diff scan found no Transfer Room hits. |

## Verification

Commands:

```bash
node --test server/src/server/db/__tests__/databaseConfig.test.js
node --check server/src/server/db/database.js
node --check server/src/server.js
npm run lint
npm run typecheck
npm run test:server
npm test
npm run build
git diff --check
git diff --name-only | rg -i "transfer-room|TransferRoom|room"
```

Results:

- Focused DB config test: passed, 2/2.
- `node --check server/src/server/db/database.js`: passed.
- `node --check server/src/server.js`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test:server`: passed, 214/214.
- `npm test`: passed, 139/139.
- `npm run build`: passed.
- `git diff --check`: passed.
- Transfer Room diff scan: no hits.

Build notes:

- Vite still reports the existing Browserslist/caniuse-lite age warning.
- Vite still reports large chunk warnings after minification.
- These warnings are not caused by Slice 9.

## Blockers

True authenticated browser smoke remains blocked by environment:

- Local MySQL server is not installed/running or not reachable.
- No initialized `stage_league` local database is available.
- No staging URL or disposable credentials are available.
- Production smoke/test data creation has not been approved.

## What Is Needed To Finish The Smoke Gate

Provide one safe option:

1. Local MySQL server access:
   - host, port, user, password, and database name
   - initialized with `server/schema.sql`
   - local env override with `DB_SOCKET_PATH: ''`

2. Staging access:
   - staging frontend URL
   - staging API URL if different
   - one or two disposable test accounts
   - confirmation that creating disposable clubs/posts is allowed

3. Explicit approval for production smoke:
   - only if the team accepts creating/deleting clearly named test data on production.

## Final Release Recommendation

Do not mark the authenticated smoke gate complete yet.

Slice 9 removed a repo-level local DB configuration blocker and kept automated verification clean. The remaining blocker is operational: a real local MySQL database or staging environment is still required before the Slice 8 browser checklist can be completed.
