# President Full Alignment Plan

> Goal: every club has a `presidents` row; every runtime path that means “the club’s president” can resolve `president_id` without breaking club↔club matchmaking (still keyed by `club_id`).

## Non-negotiables

1. **Pairing stays on `club_id`** — match invites / fixtures never switch opponent identity to `presidents.id`.
2. **`president_user_id` stays** — auth/permissions continue to use the user account link.
3. **`presidents.id` becomes always resolvable** for a club that has a president.
4. **Legacy `owner_email` remains fallback** for contact only.

## Workstreams

### A. Database
- Ensure `presidents` exists (done).
- Backfill: every club with `president_user_id` gets a `presidents` row + `clubs.president_id`.
- Backfill: existing contracts get `offered_by_president_id` when missing.
- Keep FKs guarded.

### B. Shared resolution service
- `ensurePresidentForClub`, `resolvePresidentForClubId`, `resolvePresidentForUserId`.
- Used by identity, contact, contracts, club create.

### C. Auth / identity
- `/auth/me` exposes `president_id` + `president_club_id`.
- Frontend stores `stage_president_id` and returns `president` from `resolveMyPlayerAndClub`.

### D. Club vs club / contact
- Contact resolution joins `presidents` when useful.
- Arrange Game metadata includes `challenger_president_id` / `opponent_president_id` (additive; pairing still club IDs).

### E. Contracts / delivery
- Always set `offered_by_president_id` via resolver.
- Delivery can show president display_name when available.

### F. Frontend surfaces
- ClubDetail / PresidentProfile / onboarding already on entity.
- Identity helpers expose `getPresidentId`.
- No remaining `club.president_*` profile field reads.
- PresidentProfile supports owner/admin edit (PATCH via `entities.President.update`).
- Layout identity menus link to `/presidents/:id` and club detail.
- EN/FR `pres*` translation keys for setup + profile.

### G. President transfer
- `presidentTransferService.transferPresidentToClub`
- `POST /presidents/:id/transfer` (admin) + `stageClient.presidents.transfer`
- Pairing remains `club_id`; auth remains `president_user_id`.
