# President Identity Phase 3 Implementation Notes

**Goal:** Harden backend club-management permissions so canonical presidents are accepted by server actions, not only frontend UI.

## Scope Completed

- Added a shared `requireClubFunctionAccess()` helper for legacy server functions that need club permissions.
- `clubFinance.adjust_budgets` now uses central `manage_finances` permissions.
- `deleteClub` now uses central club access and requires president-level management.
- `tournamentRegistrationNotify` now uses central `manage_recruitment` permissions.
- `tournamentWithdrawal` accepts `clubs.president_user_id` while keeping legacy fallbacks.
- Tournament registration error copy now says club president.
- Added regression coverage for canonical president tournament withdrawal.

## Still Legacy By Design

- Transactional tournament registration and withdrawal still use the loaded club row inside the transaction, with explicit `president_user_id` checks, to avoid mixing transaction state with separate non-transaction reads.
- Legacy `owner_email` and `user_id` fallbacks remain active during the migration period.
