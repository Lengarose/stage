# Final Smoke Gate: Input Needed

Date: 2026-08-12
Status: Waiting for safe authenticated smoke environment.
Branch: `codex/president-player-slice1`

## Current Decision

Do not mark the authenticated smoke gate complete yet.

The branch has clean automated/source evidence and no known product release blockers, but the final human browser click-through still needs one safe authenticated environment.

## What Is Already Clean

- Slice 8 fallback QA found no product bugs.
- Slice 9 removed a repo-level local DB config blocker.
- Local backend can now be configured for TCP MySQL when `DB_SOCKET_PATH` is empty.
- All automated verification remains green.
- Transfer Room remains untouched.
- Production has not been used for test data.

## What Is Still Missing

One of these safe environment inputs:

1. Local MySQL:
- host
- port
- database name
- username
- password
- database initialized from `server/schema.sql`
- env configured with `DB_SOCKET_PATH: ''`

2. Staging:
- staging frontend URL
- staging API URL if different
- one or two disposable test accounts
- permission to create disposable clubs/posts

3. Explicit production smoke approval:
- only if you accept clearly named test users/clubs/posts being created and cleaned up on production

## Recommendation

Best option: staging with disposable credentials.

Reason:
- It is closest to production behavior.
- It avoids local MySQL setup delays.
- It avoids polluting production.
- It lets the developer run the exact browser journey.

Second-best option: local MySQL with seeded test DB.

Avoid production smoke unless there is no staging/local option.

## Next Developer Action After Input Exists

Rerun the Slice 8 smoke checklist:
- Create Player
- Create Player + President
- founder contract-backed club state
- Player profile President/Founder badge
- Presidents directory/Search to Player profile
- legacy `/presidents/:id` compatibility
- feed image metadata after reload
- server-owned likes/comments
- notifications with second account if available
- Transfer Room untouched scan

## Final Product Status

Product code status: clean from automated/source QA.

Release gate status: blocked only by missing authenticated smoke environment.

