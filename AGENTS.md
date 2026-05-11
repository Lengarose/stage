# AGENTS.md — Stage League

> Conventions and constraints for AI agents (Cursor, Claude, Codex, etc.) working in this repo.
> Read this **before** writing or modifying code. Keep this file in sync with reality —
> when you find a convention drift, update this file in the same PR.

---

## 1. Architecture at a glance

| Layer | Stack | Location | Hosted at |
|---|---|---|---|
| Frontend | Vite + React 18, Tailwind, Radix UI, react-router-dom | `src/` | Build artefacts deployed to Gandi |
| Backend (REST) | Express, MySQL (mysql2), JWT auth | `server/` | `https://stageleagues.com` on Gandi |
| Realtime | socket.io server, secret-protected `/emit` endpoint | `socket-server/` | separate process |
| Auth | Email/password + OAuth (Google, Microsoft, Apple) via Passport | `server/src/server/oauth/`, `server/src/server/controllers/authController.js`, `oauthController.js` | — |
| Storage (file uploads) | multer, served from `/uploads/*` | `server/uploads/`, `server/src/server/controllers/uploadController.js` | Gandi disk |

**Key URLs**
- Production backend + frontend: `https://stageleagues.com`
- Dev frontend: `http://localhost:5173` (Vite)
- Dev frontend → backend: Vite proxies `/api/*` to `process.env.VITE_API_PROXY_TARGET || 'https://stageleagues.com'`
  (see `vite.config.js`). By default dev hits **production**.
- Dev socket: `process.env.VITE_SOCKET_URL || window.location.origin` (see `src/lib/SocketContext.jsx`)

---

## 2. Backend MVC convention

Every new persisted entity follows this exact six-step recipe. **Do not deviate.**

1. **Schema** — Add `CREATE TABLE IF NOT EXISTS <table_name>` to `server/schema.sql`.
   If the table needs to exist on already-running databases without a manual SQL run,
   *also* add an idempotent migration to the startup block in `server/src/server.js`
   (using `EXECUTESQL(...).catch(...)` and `addCol(...)` helpers).
   Keep both copies in sync.

2. **Model** — `server/src/server/models/<entity>Model.js`.
   Class-based, exposes `create`, `update`, `delete`, `selectOne`, `selectAll`,
   plus any domain-specific selectors (e.g. `selectByPlayer`).
   Models build SQL — they do not handle HTTP.

3. **Controller** — `server/src/server/controllers/<entity>Controller.js`.
   Exports an `express.Router()` with standard `GET /`, `GET /:id`, `POST /`,
   `PATCH /:id`, `DELETE /:id`. `GET /` supports query-string filters used by the
   frontend (`?player_id=`, `?limit=`, `?offset=`, etc.).

4. **Route mount** — Register in `server/src/server.js` under `/api/stage/<kebab-plural>`,
   wrapped by `verifyToken` middleware. Use the same pluralization as
   `entityToPath()` in `src/api/stageClient.js`:
   - `PlayerStcTransaction` → `/player-stc-transactions`
   - `RewardConfig` → `/reward-configs`
   - `Match` → `/matches`

5. **Frontend entity** — Add the PascalCase entity name to the `ENTITY_NAMES`
   array in `src/api/stageClient.js`. The factory `makeEntity(name)` generates
   `filter / get / create / update / delete / bulkCreate / list / subscribe`
   automatically. Do **not** hand-write per-entity clients.

6. **Consumer** — Import via `base44.entities.<Name>` or `stageClient.entities.<Name>`.

> **Generic entity store** — `league_entities` is a single table that backs 10
> different `/api/stage/*` routes through `leagueEntityController.makeRouter('<entity_type>')`.
> Use this pattern for new league/competition concepts; don't create a new table
> unless the schema diverges substantially.

---

## 3. When NOT to use plain CRUD MVC

These cases are **deliberate exceptions**. Don't add a CRUD controller for them.

| Concern | Pattern | Why |
|---|---|---|
| Transactional admin/business actions (transfer windows, force-schedule, declare-forfeit, contract renewal, season rollover) | POST endpoint under existing entity route, OR a server function in `functionsController.js` | Multi-step atomic logic, audit-log writes, permission checks |
| Singleton config (`market_value_config`, `shirt_sales_config`, `stadium_config`) | `functionsController.js` (`playerMarketValue`, `shirtSales`, `stadiumManagement`) | Single active row, default-seed on first run, admin-only |
| Audit logs (`admin_audit_log`, `fixture_admin_actions`) | Written by the action that caused the event; read via dedicated GET only | Never client-mutated; auditability |
| Bulk recalculation / migrations | Server function or one-off script under `server/migrations/` | Not part of the normal data lifecycle |

Frontend calls these via `stageClient.functions.invoke('<functionName>', params)` or
`stageClient.http.post('/<route>', body)` — never `entity.update()`.

---

## 4. Frontend conventions

### Folder layout (`src/`)
```
api/             stageClient.js — entity factory, auth, functions, http helpers
components/
  admin/         Admin-only UI
    sections/    One file per admin tab (HomeTab, LeaguesTab, RewardsTab, …)
    economy/    Economy panels (contracts, wagers, shirts, stadium, market value)
    seasons/    Season lifecycle (SeasonCard)
    disputes/   Expired-fixture admin actions
    shared/     AdminStat, EmptyState, adminConstants, adminFormatters
  trophy/       Trophy cabinet system
  ui/           shadcn-ui primitives — do not edit, regenerate via shadcn CLI
hooks/
lib/            scheduleEngine, SocketContext, useRealtimeData, utils
pages/          Top-level route components, one per route
pages/admin/    Thin route wrappers that pass `forcedSection` prop to <Admin />
```

### React conventions
- **Function components only**, hooks first.
- Use `useMemo`/`useCallback` sparingly — only when there's a measured cost.
- Native `<button>` elements inside forms **must** have `type="button"` unless they submit.
- For URL-driven navigation prefer **conditional rendering** over Radix `<Tabs>` —
  `<Tabs>` interferes with the React Router state and breaks click handlers
  (see history of `Admin.jsx` / `LeaguesTab.jsx`).
- Imports: alias `@/*` resolves to `src/*` (see `vite.config.js`, `jsconfig.json`).

### Data access
- **Read**: `await stageClient.entities.<Name>.filter({ ... }, '-created_date', 50)`.
- **Read-one**: `await stageClient.entities.<Name>.get(id)`.
- **Write**: prefer dedicated POST endpoints for business actions; use
  `entity.update(id, body)` only for benign edits (e.g. admin renaming a label).
- **Realtime**: `stageClient.entities.<Name>.subscribe(handler)` works for
  `Notification` and `InboxMessage` today; other entities are no-op (silently)
  until wired in `SocketContext`.

---

## 5. Authentication

- All `/api/stage/*` routes except `/auth/*` and `/upload` require `verifyToken`
  middleware (see `server/src/server.js`).
- Frontend stores tokens in `localStorage` under keys:
  `stage_access_token`, `stage_refresh_token`, `stage_user_id`,
  `stage_player_id`, `stage_owner_id`. Use `storeTokens` / `clearTokens` from
  `stageClient.js` — don't touch `localStorage` directly.
- 401 responses trigger automatic refresh via `_refreshPromise` in `apiFetch`.
- OAuth callback URL: `https://stageleagues.com/api/stage/auth/<provider>/callback`.
- `auth.loginWithProvider('google'|'microsoft'|'apple')` does the redirect dance.

---

## 6. Database

- MySQL 8 on Gandi. Config via `server/src/constants/env.js` (`applyToProcessEnv`).
- **Two sources of truth, must stay in sync**:
  1. `server/schema.sql` — used for fresh installs.
  2. Startup migrations in `server/src/server.js` — runs on every boot.
- Helpers: `addCol(table, name, definition)` is idempotent and safe to repeat.
- **Indexes**: add them in BOTH places, named `idx_<short_table>_<columns>`.
- **Foreign keys**: declared in the bottom block of `schema.sql` using the
  "guarded prepared statement" pattern — only add FK if (a) it doesn't exist
  AND (b) child table has no orphans.
- **Don't put seed business data in `schema.sql`**. Seeds for `market_value_config`,
  `shirt_sales_config`, `stadium_config` live in startup migrations (only-if-empty inserts).
  Only the `roles` table has its enum seeded in `schema.sql` because it's a system table.
- **Datetime values**: `EXECUTESQL` automatically coerces parameter values that
  match the strict ISO 8601 pattern (`YYYY-MM-DDTHH:MM:SS[.fff][Z|±HH:MM]`)
  into MySQL `DATETIME` format (`YYYY-MM-DD HH:MM:SS`). UUIDs, names, JSON
  payloads, and other strings are never touched. See
  `server/src/server/utils/datetime.js`. Do **not** add per-model `toMysqlDateTime`
  helpers; the DB layer handles it. If you need a `Date` instance converted in
  controller-level code (e.g. before building a JSON payload), use the helper
  directly.

---

## 7. Audit logging

Every admin-initiated mutation **must** write an audit row.

| Entity affected | Audit table | Written by |
|---|---|---|
| Fixtures (force-schedule, forfeit, flag-review) | `fixture_admin_actions` | `fixtureAdminActionController.js` POST endpoints |
| Anything else (config edits, manual STC grants, etc.) | `admin_audit_log` | The controller that performs the mutation |

When you build a new admin action:
1. Compute `before` / `after` payload.
2. Insert into `admin_audit_log` with `admin_user_id`, `admin_email`,
   `action`, `entity_type`, `entity_id`, `old_value` (JSON), `new_value` (JSON), `reason`.
3. Never accept `admin_user_id` from request body — always derive from `req.user`.

---

## 8. Deployment

- **Backend** (`server/`) is deployed manually to Gandi:
  ```bash
  ssh <user>@stageleagues.com
  cd <app>/server && git pull && npm install --omit=dev
  pm2 restart stage-server   # or equivalent
  ```
- DB migrations run automatically at boot via `server.js` startup block.
- **Socket server** (`socket-server/`) is a separate process; restart independently.
- **Frontend** (`dist/`) — produced by `npm run build`, served by Gandi.

**Pre-deploy checklist**
1. `npm run lint` clean
2. `npm run typecheck` clean
3. `node --check server/src/server.js` succeeds
4. Any new `CREATE TABLE` is in **both** `schema.sql` and `server.js`
5. Any new entity is registered in `ENTITY_NAMES` in `stageClient.js`

---

## 9. Verification before claiming "done"

For every change that touches code, run this minimum check before reporting completion:

```bash
npm run lint            # eslint must be clean
npm run typecheck       # tsc strict mode against jsconfig.json
node --check server/src/server.js   # backend syntax
```

For new API endpoints, additionally:
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/stage/<route>?limit=1" | jq .
```
(requires `server/.env` configured and `cd server && npm run dev` running locally)

**Do not** claim an API endpoint works without hitting it at least once.

---

## 10. Files / patterns to NOT touch

- `src/components/ui/*` — shadcn-generated primitives. Regenerate via shadcn CLI if needed.
- `base44/*` — legacy SDK shim, kept for backwards-compat with older components.
- Pre-existing lint/type warnings in `Admin.jsx` and similar — these are noise
  from `Button`/`Select`/`Input` prop inference. Don't "fix" them as a side effect.
- Don't update git config, don't force-push, don't bypass commit hooks.

---

## 11. Things that have caught past agents

These are real bugs we've hit. Avoid repeating them.

1. **`stageClient.entities.<X>` returns `undefined`** when `<X>` isn't in
   `ENTITY_NAMES`. Adding the model+controller+route is not enough — register
   the entity name too. Found in `Admin.jsx:870` for `PlayerStcTransaction`.
2. **Radix `<Tabs>` swallows clicks** when used for URL-routed admin pages.
   Use conditional rendering with `useLocation()` for that case.
3. **Vite dev proxies to production by default**. Don't be confused when
   `localhost:5173` 404s — it's the Gandi server saying the route doesn't exist
   yet (i.e. you need to deploy). Set `VITE_API_PROXY_TARGET=http://localhost:8080`
   for true local development.
4. **Esbuild syntax-check on multiple frontend files** requires `--outdir` or a
   per-file loop. The fast `node --check` only works on CommonJS — for ESM/JSX
   use `node --check` per server file, and `npm run typecheck` for `src/`.
5. **`forceSchedule`, `flagForAdminReview`, `declareForfeit` in `scheduleEngine.js`**
   write via `stageClient.http.post('/fixture-admin-actions/...')`, **not**
   via entity updates. Keep them on the dedicated POST endpoints.
6. **`server/.env.example` lists `DB_HOST=https://stageleagues.com`** — that's a
   typo from the example, MySQL connection wants `stageleagues.com` (no scheme).
   Don't propagate the typo into real configs.

---

## 12. How to ask the agent for things in this repo

The most effective prompt shape for this codebase:

> [Goal]: add/refactor X
> [Scope]: which files / which entities
> [Acceptance]: how I'll know it's done (3 bullets max)
> [Constraints]: keep existing X working, don't touch Y

Example that worked well in past sessions:

> Goal: make the home page editor save to the database.
> Scope: `HomePageEditor.jsx` + new MVC stack for `HomePageContent`.
> Acceptance:
> - new table `home_page_contents` in both schema.sql and startup migration
> - `stageClient.entities.HomePageContent` works (filter/get/create/update)
> - editor loads existing row on mount and saves on submit
> Constraints: don't touch `LandingPageEditor.jsx`.
