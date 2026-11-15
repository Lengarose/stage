# STAGE Times newsroom

The public app's **Discover → News** route is `/news`. **Admin → News** is `/admin/news`.

## Presentation

The top introduction uses the landing page's Anton, Chakra Petch and JetBrains Mono fonts. TIMES is red. Admin can configure six slideshow slots, crop/zoom, order and 3–30 second rotation. No images are preloaded. Empty slideshow/category-art slots render a quiet text/gradient treatment. Actual match previews use the existing Fixtures/The Stands diagonal matchup component, using real participant photos.

In Admin → News, scroll to **Landing-style introduction / six-image slideshow** or **Default artwork library**. Both save buttons persist the slideshow and artwork library together. Image upload, replacement, removal and crop adjustment reuse the existing upload/editor flow. These settings are the `NewsPageConfig` generic entity in `league_entities`; writes require Admin and are audited.

## Coverage and links

- For You: relevant club/competition coverage and curated platform/community stories.
- My Club: personal club stories, club matches and completed signings.
- Competitions: participating tournaments and official league/cup edition updates.
- STAGE Updates: Admin platform announcements, maintenance and GOST status announcements.
- Community: Admin-curated coverage, not every new user tournament.

News queries resolve the authenticated account's players, managed clubs and active club membership. Explicit recipient restrictions are enforced before pagination and direct article lookup. Drafts, future publication times, expired items, test-pack identities and old financial/negotiation stories are excluded. Player milestones are deferred.

The feed reads authoritative Matches, registered tournament fields, Regional League/Cup/GOST editions and accepted player agreements. It does not create a second calendar or mutate sporting outcomes. Only confirmed match results are reported; near-term scheduled matches become previews. Signing projections contain no salary/bonus terms. Older client contract-news calls remain compatible but no longer publish private proposal copy.

GOST automatic season-play stories remain disabled while the existing GOST access policy is closed. Admin can publish accurate GOST announcements. No qualification rights are invented.

Personal match articles link the real match ID in GameDay and The Stands, plus the tournament/official edition where available. Curated public match previews link The Stands, avoiding private participant GameDay access. Edition links preserve the selected season/Cup edition ID. Signing articles link the player and club. The homepage news widget opens the same article permalink.

## Editorial workflow

Create or edit a story in Admin → News. Choose headline/body, category, section, audience, linked record or internal route, action label, placement, publication time (UTC), optional expiry and optional image. Drafts stay in Admin. Set Published to release at the selected time; unpublish to remove from the feed. Choosing a linked record uses the actual record's route; stale source records are rejected on save. Admin mutations and before/after values are audited atomically.

The feed composes current source projections on read; an edition card reports its current recorded state rather than fabricating an immutable historical article. Admin can author a permanent report when fuller editorial coverage is needed.

## Verification

`server/scripts/acceptance/stage-times.cjs` uses a fresh disposable `stage_acceptance_*` schema on the dedicated acceptance MySQL socket, actual JWT-authenticated HTTP routes and no production data. It covers publication/privacy, 105 unrelated audience records before pagination, participation, pending-score exclusion, confirmed results, correct match and edition links, signing privacy, source validation, six empty slideshow slots, crop/timing persistence/restoration and Admin authorization/audit.

Desktop and 390px iframe viewport screenshots are under `output/playwright/stage-times-2026-11-15/`. The slideshow was exercised with temporary existing test images, then reset to empty. No generated images are included.

Deployment requires the changed backend files and startup migration, a Gandi app restart, and the frontend build upload. No production deployment or production data mutation was performed here. `graphify update .` could not run because the graphify CLI is not installed in this workspace.
