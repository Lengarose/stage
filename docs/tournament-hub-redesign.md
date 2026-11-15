# Tournament hub redesign — 15 November 2026

The `/tournaments` directory uses the full available viewport under navigation. Its six-photo slideshow fills the hero, fading behind the introduction on the left. Anton display headings and Chakra Petch body/control text match Landing/Home. The default title stays on a single line. The existing STAGE image assets are reused; no generated artwork is added.

The directory offers Discover, Open entries, Live, My tournaments, Completed and the existing Archive. Search combines with participant type, organizer and format. Existing published tournament pages remain the entry point for schedule/rules acceptance, registration, waiting lists and withdrawal. The rulebook and creation workflow remain available. No admission, draw, kickoff, reward or withdrawal policies are changed.

Corrections included:

- Participant counts use registered players for player tournaments and clubs for club tournaments, including legacy JSON arrays.
- Full capacity cannot hide a live/completed status.
- Cards show the configured prize pool, including events without an STC entry charge, and display credit costs separately.
- STAGE and community events share the same filters; official identity uses the existing ownership classifier.
- The hub follows the API’s actual 25-record pagination instead of silently stopping at the first page.
- Failed tournament loading shows Retry. Failed presentation loading falls back visibly to built-in artwork.
- Banner-upload errors release the builder’s loading state and display the failure.

## Administration

Admin → Tournaments → **Tournament hub · Slideshow & colours** opens the editor. Set the title, short introduction, Blue/Cyan/Gold/Red accent, interval and up to six photos. Each photo supports upload, crop, zoom, reorder and removal. Empty custom slides use existing STAGE artwork. Save presentation persists the settings. Each tournament’s own banner remains independent.

`TournamentHubConfig` uses the existing `league_entities` store as `tournament_hub_config`, exposed at `/api/stage/tournament-hub-configs`. Authenticated users can read; only Admin can create/update/delete. Generic controller auditing records all three mutations. No schema migration or new dependency is required.

## Validation and release

Focused helper/route tests, lint, typecheck, backend syntax and production build were run. The isolated MySQL/JWT HTTP acceptance checks config CRUD, read/filter, non-admin write rejection, slide/crop persistence and audit rows. Browser fixtures use the real hub/editor with mocked tournament data; they verify visuals and controls, not live competition completion. Screenshots are under `output/playwright/tournament-hub-2026-11-15/`.

Upload the changed backend controller/routes and restart the backend, then deploy the rebuilt frontend via the established Gandi flow. Nothing was deployed during implementation. `graphify update .` could not run because graphify is not installed.
