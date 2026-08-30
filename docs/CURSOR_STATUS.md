# Cursor → Claude — status handshake

Cursor writes here. Claude reads here. One direction only.

When you (Cursor) finish a task from `docs/NEXT_TASK.md`, **replace this whole file**
with your report, then stop. Overwrite, do not append. Never write status into
`docs/GAMEDAY_REBUILD_PROMPT.md` — that file is the spec and stays clean.

---

## STATUS — DONE

User location / timezone on login (web + API). No deploy. Commit `b1701eb` (not pushed).

### Diff

**Server**
- `startupMigrations.js` — `users.location TEXT NULL` after timezone.
- `utils/userLocation.js` — `normalizeUserLocation` / `parseStoredLocation`.
- `utils/__tests__/userLocation.test.js` — Belgium GPS + JSON parse (4 pass).
- `authController.js` — `/me` selects + returns parsed `location`; `PATCH /timezone` writes location only when normalized body present (timezone-only leaves GPS).
- `mobile/helpers.js` — `buildMePayload` SELECT + `mapUserFromMe.location`.
- `securityHeaders.js` — `geolocation=(self)`.

**Web**
- `stageClient.auth.updateTimezone(timezone, location = null)`.
- `src/lib/userLocation.js` — browser geolocation (8s, coarse), Intl IANA, BE→Brussels, 15m cooldown `syncSessionLocation`.
- `AuthContext.jsx` — after successful `me()`, fire-and-forget sync then refresh `me()` into `user`.

Onboarding/Settings still call `updateTimezone(timezone)` alone — does not wipe `users.location`.

### Verification

`npm run lint && npm run typecheck` — exit 0.  
`node --test server/src/server/utils/__tests__/userLocation.test.js` — 4 pass.  
`node --check server/src/server.js` — ok.
