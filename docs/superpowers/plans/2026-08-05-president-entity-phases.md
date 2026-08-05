# President Entity — Multi-Phase Plan

> **For agentic workers:** implement one phase per agent. Do not start the next phase until the previous phase’s verification checklist passes. Do not overwrite unrelated dirty worktree files (game-day, admin WIP, etc.).

## Context — what Codex already shipped

Three prior tracks exist:

1. **President Identity (Aug 2)** — `clubs.president_user_id` is the canonical auth/permission link. `/auth/me` exposes `president_club_id`. Contracts use `offered_by_user_id` / `offered_by_club_id`. Keep this.
2. **President Profile on Club (Aug 4, `4be5e08`)** — profile fields (`president_name`, avatar, banner, bio, …) were stored **directly on `clubs`**. Onboarding and `ClubDetail` read/write those columns. **This is the wrong model** — a club can change president, so profile must not be glued to the club row.
3. **Onboarding split (Aug 4, `f522eaa`)** — club creation UX already has a separate “president” step before “club profile”. Reuse that UX, but persist into the new `presidents` entity.

## Domain model (target)

```
User ──1:1──► President ──N:1──► Club (current club, nullable)
Club  ──1:1──► President (current president via clubs.president_id)
Club  ──1:N──► Player
President signs PlayerContract on behalf of Club (already: offered_by_user_id + offered_by_club_id)
```

- A **President** is a first-class profile (like `Player`), not a column prefix on `clubs`.
- A club has **one current** president (`clubs.president_id` + `clubs.president_user_id` for fast auth).
- A president can leave / join another club (`presidents.club_id` updates; old club clears link).
- Players belong to clubs; contracts are offered by the president acting for the club (existing contract actor fields stay).

## Field mapping (remove from Club → move to President)

| Old `clubs.*` | New `presidents.*` |
|---|---|
| `president_name` | `display_name` |
| `president_role_title` | `role_title` |
| `president_avatar_url` | `avatar_url` |
| `president_banner_url` | `banner_url` |
| `president_banner_position` | `banner_position` |
| `president_banner_zoom` | `banner_zoom` |
| `president_bio` | `bio` |
| `president_success_level` | `success_level` |
| `president_country_code` | `country_code` |
| `president_quote` | `quote` |
| `president_management_style` | `management_style` |
| `president_started_at` | `started_at` |
| `president_social_links` | `social_links` |

**Keep on Club:** `president_user_id` (auth), new `president_id` (FK to `presidents.id`).

---

## Phase 1 — Backend entity + migration (THIS PHASE)

**Agent scope:** server only + `ENTITY_NAMES` + base44 metadata. No ClubDetail / onboarding UI rewrite yet.

Acceptance:
- [x] Table `presidents` in `schema.sql` + startup migration
- [x] `clubs.president_id` added; profile columns removed from Club model/controller/schema
- [x] Backfill: existing club profile columns → `presidents` rows + `clubs.president_id`
- [x] MVC: `presidentModel` / `presidentController` / route `/api/stage/presidents`
- [x] `President` in `ENTITY_NAMES`
- [x] Club create accepts nested `president` **or** legacy flat `president_*` body fields, creates President row, strips them from Club
- [x] Focused tests pass; lint / typecheck / `node --check` clean for touched server files

## Phase 2–4 — Frontend (done in this pass)

Acceptance:
- [x] President onboarding uses same `GamerPlayerPhotoFrame` + `ImagePositionEditor` UX as PlayerSetup
- [x] Club create sends nested `{ president: { ... } }` (modern fields, incl. avatar_position/zoom)
- [x] `ClubDetail` loads `President` entity; club emblem + CTA → `/presidents/:id`
- [x] `PresidentProfile` page at `/presidents/:id`
- [x] Contracts store `offered_by_president_id`
- [x] FK: `presidents.club_id` → clubs, `clubs.president_id` → presidents
- [x] Full edit form on President page (self/admin)
- [x] Translations EN/FR for president setup + profile
- [x] Layout identity menu links to `/presidents/:id`

## Phase 5 — President transfer / club change

**Agent scope:** business action to change a club’s president.

Acceptance:
- [x] Dedicated POST `POST /api/stage/presidents/:id/transfer` (admin-only)
  - clears old club’s `president_id` / `president_user_id`
  - sets new club link on both sides (`presidents.club_id`, `clubs.president_id`, `clubs.president_user_id`)
  - displaces any existing president on the target club (`club_id` null)
  - writes `admin_audit_log` (`president_transfer` / `president_detach`)
- [x] `club_id: null` detaches; presidents without a club remain valid
- [x] Raw `PATCH` no longer changes `club_id` (must use transfer)
- [x] Frontend helper: `stageClient.presidents.transfer(id, { club_id, reason })`
- [x] Admin Clubs tab: President transfer dialog (move / assign / detach)
- Auth/`/auth/me` still resolves `president_club_id` from `president_user_id`

## Phase 6 — Contracts copy & docs cleanup

Acceptance:
- [x] UI copy: president signs contracts with players for the club (`cccPresidentOnly`, `cccSubtitle`, transfer subtitle)
- [x] CreateContract / TransferMarket remain user+club actors (`offered_by_user_id` / `offered_by_club_id` + `offered_by_president_id`)
- [x] `2026-08-04-president-profile-plan.md` marked superseded (points to entity plans)
- [x] No dual-write of profile fields onto `clubs` — club create strips legacy `president_*` and writes `presidents` only

## Out of scope for all phases above

- Unrelated game-day / admin WIP in the worktree
- Turning President into a Player row
- Removing legacy `owner_email` / `owner_id` aliases (still needed)

## Verification (every phase)

```bash
npm run lint
npm run typecheck
cd server && find src -name "*.js" -exec node --check {} +
# Phase 1 focused:
node --test server/src/server/controllers/__tests__/president*.test.js \
  server/src/server/controllers/__tests__/clubPresidentProfileSchema.test.js
graphify update .
```
