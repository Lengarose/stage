# Test the API inventory

Use Node.js 20 or newer. The runner reads all method/path entries from [API_REFERENCE.md](API_REFERENCE.md), removes duplicates and reports PASS, FAIL or SKIP for every entry. Keep that inventory updated as routes change.

PASS requires HTTP **200 or 201**, plus valid JSON on `/api/stage/*` and `/api/mobile/*` responses by default. Other statuses, including redirects and 204, fail. A passing response checks availability and response format; it does not prove the business result is correct.

## Run read-only checks

For the deployed app, sign in when prompted:

```bash
npm run test:api -- --base https://stageleagues.com --login
```

Enter your existing account identifier and password in the terminal. Password input is hidden. The runner calls the normal login endpoint, holds the returned access token in memory and attaches it to app API requests. Use an admin account for admin endpoints. Sign-in does not enable other write tests. No new account is created.

An interactive run also prompts automatically if selected routes need authentication and `API_TEST_TOKEN` is absent. Noninteractive runs can use `--login` with `API_TEST_EMAIL` and `API_TEST_PASSWORD` supplied through their environment. Credentials must not be passed on the command line or committed to files. OAuth-only accounts can supply `API_TEST_TOKEN` from an existing authenticated session instead. A failed sign-in stops the run before the remaining endpoint requests; the existing report is not overwritten in that case.

Start your configured backend, then run from the repository root:

```bash
# Preview coverage without sending requests.
npm run test:api -- --dry-run

# In another terminal, start the backend (requires configured JWT secrets and MySQL).
npm --prefix server start

# Read a token without putting it in command history (zsh/bash).
read -rs API_TEST_TOKEN
export API_TEST_TOKEN

# Check the local app server.
npm run test:api -- --base http://localhost:8080

# Optionally include a local socket service.
npm run test:api -- --base http://localhost:8080 --socket-base http://localhost:3001
```

Paste a valid access token from a test account at the `read` prompt and press Enter. Without a token, protected endpoints will usually return 401. Admin-only routes require an admin account; 403 can be correct permission enforcement rather than a broken endpoint.

The default is local. To check deployed read routes, explicitly set `--base https://stageleagues.com` and optionally `--socket-base https://stage-7osn.onrender.com`. Serial requests wait 500 ms between calls; adjust `--delay` to suit rate limits. A 429 is reported as a failure, with no automatic retry. Use `--only` to narrow the run, e.g. `--only /api/stage/players`.

## Connection failures

Before testing any endpoints, the runner checks `/api/stage/health` on the app server and `/health` on a configured socket server. If either service fails its health check, its endpoints are marked SKIP and one preflight failure is reported. Other configured services can still run. Dry runs do not make health requests.

`ECONNREFUSED` means no backend accepted the connection at that address. Vite on port 5173 does not start the Express backend on port 8080. Configure `server/src/constants/env.local.js` using [env.local.example.js](../server/src/constants/env.local.example.js): use generated JWT secrets and your local MySQL connection settings, then run `npm --prefix server start` in another terminal. Do not use the example placeholder secrets. Startup migrations run when the backend starts.

If you want the already deployed application, use:

```bash
npm run test:api -- --base https://stageleagues.com
```

That choice is explicit; the runner does not switch from localhost to production automatically. After connectivity is working, HTTP 401 requires a valid `API_TEST_TOKEN` from the same server, and HTTP 403 requires an account with the appropriate permissions. These responses remain failures under the requested 200/201 rule.

## Required query filters and account permissions

The runner reads the primary account's `/auth/me` profile in memory to configure these checks:

| Route | Automatic query scope |
|---|---|
| `/api/stage/matches/profile` | Own `player_id`; otherwise `status=completed`. Existing fixture filters are preserved. |
| `/api/stage/player-showcase-videos` | Own `player_id`. Use `--player-id ID` or fixture `query.player_id` for another existing player. |
| `/api/stage/club-operation-audit-logs` | Owned/presided club, then playing club. Use `--club-id ID` or fixture `query.club_id` for another accessible club. Role 0 can read this collection without a club filter. |

Fixture query values take precedence over automatic values. If the player or club cannot be resolved, the affected check is SKIP with the missing input identified; it is not counted as a passing endpoint.

Admin analytics, match archive and admin mail require role ID **0 or 2**. Scouting reports require a **playing member of a club**, even if the user is an admin. A single account might not meet both requirements. Run with separate sign-ins when needed:

```bash
npm run test:api -- --base https://stageleagues.com --login --admin-login --scout-login
```

The prompts identify each account in order: primary account, admin account, then club-member account. The admin token is sent only to `/admin-analytics`, `/match-archive` and `/admin-mail` routes; the scout token is sent only to `/scouting-reports` routes. Alternatively, set `API_TEST_ADMIN_TOKEN` and `API_TEST_SCOUT_TOKEN` in the environment. The primary token remains in use for other routes, including club audit logs. These options neither change account roles nor enable write tests. Every actual 400/403 still fails: use valid inputs and an account with access, rather than treating refusals as successful checks.

## Configure IDs, request data and write tests

Generate a fixture for every route without making requests:

```bash
npm run test:api -- --init-cases api-test-cases.local.json
```

All generated cases are disabled. Fill in valid test IDs and data, then enable the cases you want to run. You can also create a smaller file containing only overrides; other GET routes still run by default. Parameters belong to each individual route, so a player ID is not accidentally reused as a tournament ID.

Example `api-test-cases.local.json`:

```json
{
  "cases": [
    {
      "service": "app",
      "method": "GET",
      "path": "/api/stage/players/:id",
      "enabled": true,
      "params": { "id": "REPLACE_WITH_TEST_PLAYER_ID" }
    },
    {
      "service": "app",
      "method": "POST",
      "path": "/api/stage/auth/login",
      "enabled": true,
      "body": { "email": "test@example.com", "password": "REPLACE_LOCALLY" }
    },
    {
      "service": "app",
      "method": "POST",
      "path": "/api/stage/upload",
      "enabled": true,
      "form": {
        "file": { "file": "/absolute/path/fixture.png", "filename": "fixture.png", "type": "image/png" }
      }
    }
  ]
}
```

Use `query` for query-string values, `body` for JSON, or `form` for multipart fields. A form value with `file` reads that local file. Set `expectJson: false` only for endpoints intentionally returning another format. Socket cases use `service: "socket"`; `/emit` reads its secret from `API_TEST_EMIT_SECRET`.

```bash
npm run test:api -- --cases api-test-cases.local.json --dry-run
npm run test:api -- --cases api-test-cases.local.json --allow-writes
```

POST, PATCH, PUT, DELETE and GET authentication/action flows require **both** `--allow-writes` and `enabled: true` on their individual cases. These requests perform real operations. Run full write coverage against a disposable test database and sandbox external services. The runner does not create accounts or dependent records automatically, roll back changes, or chain login tokens; provide existing fixtures and `API_TEST_TOKEN` before running. OAuth callbacks need a real provider flow and will normally redirect, so a blanket 200/201 check cannot validate them.

## Results and coverage

The console shows results for selected routes; when a service preflight fails it shows one diagnosis rather than repeating the connection error. The JSON report still includes every inventory entry and the separate preflight results. Failed preflights count toward FAIL and exit 1. The default JSON report is `api-test-report.local.json`; use `--report FILE` to change it. Tokens, request/response bodies, resolved IDs and query values are excluded from the report. Files named `api-test-*.local.json` are ignored by git, including the fixture file, which may contain credentials.

- Exit 0: executed checks passed. Skipped routes are **not** counted as passes.
- Exit 1: at least one request failed, or configuration is invalid.
- Exit 2 with `--require-all`: coverage is incomplete because routes were skipped or only planned.

Use `--require-all` for a strict coverage gate. Full coverage requires valid data and enabled cases for every route; browser OAuth flows cannot generally meet the requested 200/201 criterion. `--help` lists all options.

Runner verification: `node --test scripts/test-all-apis.test.mjs` uses a temporary local HTTP server and does not contact production.
