# Slice 9 Analysis: Smoke Environment Enablement

Date: 2026-08-12
Status: Analysis and developer handoff. Implementation delegated separately.
Label: slice9-smoke-environment-enablement
Source branch observed: `codex/president-player-slice1`

## Context

Slice 8 attempted the final authenticated browser smoke gate but could not complete it because of environment constraints.

Important distinction:
- No product bugs were found.
- No code fixes were required.
- Automated/source fallback evidence is clean.
- The branch is not yet fully browser-smoked with authenticated persisted data.

Slice 8 result note:
`docs/analysis/2026-08-11-slice8-authenticated-smoke-result.md`

## What Is Blocking The Final Smoke

The blocker is environment access, not a known product regression:
- Production testing was not used because local/staging was required unless explicitly approved.
- No staging URL or staging credentials were available.
- Local backend started listening on port `8080`, but DB-backed work failed.
- The backend expected the Gandi MySQL socket path `/srv/run/mysqld/mysqld.sock`.
- That socket does not exist locally.
- No local MySQL socket was found at expected local paths.

## What The Task Is Trying To Achieve

Create or identify one safe authenticated environment for final smoke:
- seeded local DB, or
- staging environment with disposable test credentials.

Then rerun the Slice 8 click-through checklist and produce the final smoke result.

## What Is Strong

- All automated checks are clean.
- The branch has no known product release blockers.
- The remaining task is operationally narrow and easy to verify once environment access exists.

## What Is Risky Or Confusing

- Running smoke on production could create real user/club/feed data and should not happen unless explicitly approved.
- Connecting local dev to production DB is risky and should be avoided unless there is a clear read/write-safe plan.
- Creating a local DB from scratch may need environment variables, schema load, migrations, and seed data.
- If staging credentials are provided, the developer must keep test data disposable and clearly named.

## Better Version Of The Task

Do not change product behavior just to make smoke easier.

Better approach:
1. Try to enable local smoke with a local MySQL config.
2. If local DB setup is too heavy, request staging URL and disposable test credentials from the user.
3. Only after a safe authenticated environment exists, rerun Slice 8 smoke.

## Final Recommended Rules

1. Use local or staging only.
- Do not use production unless the user explicitly approves production test data creation.

2. Do not add features.
- Environment setup, config docs, seed helpers, and smoke-only fixes are allowed.
- Product changes are not allowed unless smoke reveals a real bug.

3. Keep secrets safe.
- Do not commit real credentials.
- Do not print sensitive tokens/passwords in result notes.

4. Prefer disposable test data.
- Test users/clubs/posts should be clearly named for cleanup.
- Avoid polluting real platform data.

5. Keep Transfer Room untouched.
- Only run source/diff scan to confirm exclusion.

## Developer Implementation Notes

Recommended developer sequence:

1. Inspect existing env/config pattern.
- `server/src/constants/env.js`
- `server/src/constants/env.local.js` if present locally and safe to inspect
- root `.env` / server env examples
- seed scripts if available

2. Attempt safe local DB enablement only if practical.
- Identify expected `DB_HOST` / socket / port settings.
- Prefer TCP local MySQL if available.
- Do not install or start external DB services unless approved by environment policy/user.

3. If local DB cannot be enabled quickly:
- Stop and document exact missing requirement.
- Ask for staging URL and disposable credentials, or local MySQL config.

4. Once environment exists, rerun Slice 8 smoke checklist:
- Player-only onboarding.
- Player + President founder flow.
- profile President/Founder badge.
- Presidents directory and Search route to Player profile.
- legacy `/presidents/:id` compatibility.
- feed image post with metadata and reload.
- server-owned like/comment UI.
- notifications with second account if available.
- Transfer Room untouched scan.

5. Produce result note:
- `docs/analysis/2026-08-12-slice9-smoke-environment-result.md`
- include environment used
- include account/data setup without secrets
- include smoke checklist pass/fail
- include blockers or final release recommendation

## Recommended Developer Task

Proceed with Slice 9:

> Enable a safe authenticated smoke environment for the President-as-Player branch, preferably local seeded MySQL or staging with disposable credentials. Do not use production unless explicitly approved. Do not add product features. Once environment access exists, rerun the Slice 8 smoke checklist and produce the final smoke result. If environment access cannot be established, document exactly what credentials/config are needed.

