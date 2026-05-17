# Stage League

A football-management web app: leagues, matches, transfers, finances, trophies, news, and live social around competitive eFootball clubs. Frontend in React + Vite, backend in Express + MySQL, realtime via socket.io.

> **AI agents**: read `AGENTS.md` in this folder before editing code. It contains the project conventions and known pitfalls.

---

## Stack

| Concern | Tech |
|---|---|
| Frontend | Vite, React 18, Tailwind CSS, Radix UI / shadcn-ui, react-router-dom v6, react-query |
| Backend (REST) | Node.js + Express, MySQL (mysql2) |
| Auth | JWT (access + refresh), Passport for Google / Microsoft / Apple OAuth |
| Realtime | socket.io (separate `socket-server/` process) |
| File uploads | multer, static `/uploads/*` |
| Hosting (current) | Gandi Simple Hosting Node.js at `https://stageleagues.com` |

---

## Repository layout

```
.
├── AGENTS.md                  # conventions for AI agents (read first)
├── CLAUDE.md                  # symlink to AGENTS.md (Claude Code reads this)
├── .cursor/rules/stage.mdc    # always-applied Cursor rule (top 5 rules)
├── src/                       # frontend
│   ├── api/stageClient.js     # API client + entity factory + auth + socket
│   ├── components/            # UI (admin/, trophy/, ui/ …)
│   ├── lib/                   # SocketContext, scheduleEngine, hooks
│   ├── pages/                 # one file per route
│   └── pages/admin/           # admin route wrappers
├── server/                    # backend
│   ├── schema.sql             # full DB schema for fresh installs
│   ├── src/server.js          # entry point + startup migrations
│   └── src/server/
│       ├── models/            # SQL access (class per table)
│       ├── controllers/       # express routers (REST + functions)
│       ├── middleware/        # errorHandler, notFoundHandler
│       ├── oauth/             # Passport strategies
│       └── express/index.js   # express app + cors + socketEmit forwarder
├── socket-server/             # separate socket.io process
└── vite.config.js             # frontend dev proxy → backend
```

---

## Quick start (local dev)

### Prerequisites

- Node.js ≥ 20
- MySQL 8 (local or remote — set credentials in `server/.env`)

### 1. Install dependencies

```bash
npm install
cd server && npm install && cd ..
cd socket-server && npm install && cd ..
```

### 2. Configure environment

**Frontend** — create `.env` in the repo root (or copy from existing):

```bash
# Where Vite proxies /api/* during dev. Point this at your local backend,
# or at https://stageleagues.com if you want dev to hit production.
VITE_API_PROXY_TARGET=http://127.0.0.1:8080

# Where the socket.io client connects. localhost:3001 = run socket-server/ locally.
VITE_SOCKET_URL=http://localhost:3001
```

**Backend** — create `server/.env` from `server/.env.example` and set at minimum:

```bash
PORT=8080
DB_HOST=localhost          # NOT https:// — MySQL hostname only
DB_PORT=3306
DB_USER=root
DB_PASSWORD=...
DB_NAME=stage_league
ACCESS_TOKEN_SECRET=<random-secret>
REFRESH_TOKEN_SECRET=<random-secret>
```

OAuth keys (`GOOGLE_*`, `MICROSOFT_*`, `APPLE_*`) are optional — set them if you need the corresponding provider, otherwise that flow is disabled at boot.

### 3. Initialize the database

```bash
mysql -u root -p < server/schema.sql
```

The server also runs idempotent migrations on every boot (see `server/src/server.js`), so an existing DB self-upgrades when you pull new schema columns.

### 4. Start everything

Three processes in three terminals:

```bash
# Terminal 1 — backend (port 8080)
cd server && npm run dev

# Terminal 2 — socket-server (port 3001)
cd socket-server && PORT=3001 ACCESS_TOKEN_SECRET=<same-as-backend> EMIT_SECRET=<random> node server.js

# Terminal 3 — frontend (port 5173)
npm run dev
```

Open <http://localhost:5173>.

---

## Build & deploy

```bash
npm run build           # produces dist/ for the frontend
```

Backend is deployed manually to Gandi:

```bash
ssh <user>@stageleagues.com
cd <app>/server && git pull && npm install --omit=dev
pm2 restart stage-server   # or your process manager
```

DB migrations run at boot, no manual SQL step required.

### Realtime (socket.io) on Render

The REST API stays on **Gandi** (MySQL via Unix socket). Deploy **only** `socket-server/` to Render — do not deploy the full `server/` app there (it will fail with `ENOENT … mysqld.sock`).

1. **Render** → New **Web Service** (or Blueprint from `render.yaml`).
   - **Root directory:** `socket-server`
   - **Build:** `npm install`
   - **Start:** `npm start`
   - **Health check path:** `/health`

2. **Environment variables** on the Render socket service:

   | Variable | Value |
   |---|---|
   | `ACCESS_TOKEN_SECRET` | Same as Gandi `server` |
   | `EMIT_SECRET` | Same as Gandi `SOCKET_SERVER_SECRET` |
   | `ALLOWED_ORIGINS` | `https://stageleagues.com,http://localhost:5173` |

3. **Gandi `server` env** (after deploy, copy the Render URL e.g. `https://stage-socket-xxxx.onrender.com`):

   ```bash
   SOCKET_SERVER_URL=https://stage-socket-xxxx.onrender.com
   SOCKET_SERVER_SECRET=<same value as EMIT_SECRET on Render>
   ```

4. **Production frontend build** (`.env` or CI before `npm run build`):

   ```bash
   VITE_SOCKET_URL=https://stage-socket-xxxx.onrender.com
   ```

5. **Verify**
   - `curl https://stage-socket-xxxx.onrender.com/health` → `{"ok":true,...}`
   - Open Game Day chat or notifications; browser DevTools → Network → WS should connect to the Render host.

**Note:** Render free instances spin down after inactivity (~50s cold start). Upgrade to a paid plan for always-on WebSockets in production.

See `socket-server/env.example` for local dev.

**Smoke test** (after Render deploy):

```bash
cd socket-server && npm install
EMIT_SECRET=<render-secret> \
ACCESS_TOKEN_SECRET=<gandi-secret> \
npm run test:socket -- https://stage-7osn.onrender.com
```

Expect: `/health` OK → socket connects → `POST /emit` → receives `update` on the test channel.

**Pre-deploy checklist** (from `AGENTS.md` §8):

```bash
npm run lint
npm run typecheck
cd server && find src -name "*.js" -exec node --check {} +
```

---

## Scripts

Frontend (root `package.json`):

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server (port 5173) |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve the built bundle |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc` against `jsconfig.json` |

Backend (`server/package.json`):

| Script | Purpose |
|---|---|
| `npm start` | Production start |
| `npm run dev` | Nodemon, hot reload |

---

## Adding a new persisted entity (TL;DR)

Six steps — full reference in `AGENTS.md` §2:

1. `CREATE TABLE` in `server/schema.sql` **and** idempotent migration in `server/src/server.js`
2. Model in `server/src/server/models/<entity>Model.js`
3. Controller (express router) in `server/src/server/controllers/<entity>Controller.js`
4. Mount in `server/src/server.js` under `/api/stage/<kebab-plural>`, wrapped by `verifyToken`
5. Add the PascalCase name to `ENTITY_NAMES` in `src/api/stageClient.js`
6. Use via `stageClient.entities.<Name>` — never hand-write per-entity clients

---

## Documentation

- [`AGENTS.md`](./AGENTS.md) — full conventions for AI agents and humans alike
- [`.cursor/rules/stage.mdc`](./.cursor/rules/stage.mdc) — top-5 distilled rules, always applied in Cursor
- `src/IMPLEMENTATION_REFERENCE.md`, `src/SYSTEM_VERIFICATION_SUMMARY.md`, and the other `src/*.md` files — feature-specific design notes
