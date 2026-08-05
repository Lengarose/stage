# President Profile Plan

> **SUPERSEDED (2026-08-05)** — do not implement this plan.
>
> Replaced by:
> - [`2026-08-05-president-entity-phases.md`](./2026-08-05-president-entity-phases.md)
> - [`2026-08-05-president-full-alignment.md`](./2026-08-05-president-full-alignment.md)
>
> Profile fields live on the first-class `presidents` entity (`clubs.president_id` + `clubs.president_user_id` for auth). They must **not** be stored as `president_*` columns on `clubs`.

## Historical goal (obsolete)
Add a public club president profile stored directly on the `clubs` row.

This approach was shipped briefly and then replaced because a club can change president — profile must not be glued to the club row.
