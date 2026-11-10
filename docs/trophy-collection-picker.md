# Profile trophy collection

Player profiles, My Profile and club profiles share the same trophy collection component. The catalogue loader now retains Admin-only and linked official designs as well as ordinary tournament trophies. Visibility does not grant an award: only persisted earned copies belonging to the cabinet owner can be placed. Unearned designs stay locked, and existing draft/permanent placement rules remain unchanged.

The horizontal strip is replaced with a responsive grid of eight designs per page. Search matches loaded names, linked competition names and earned edition labels. Competition filters cover GOST, Regional League, Regional Cup and other trophies. Availability filters are All trophies, Available to place and Won / awarded. Available designs remain sorted first. The existing catalogue API loads 100 designs per request; Load more designs includes further pages in browsing and search. Earned copies are included even if their catalogue page has not loaded.

Owners can drag available designs or use Place. Multiple earned copies retain the edition picker. Touching the Place button does not accidentally start a touch drag. Locked designs cannot be dragged or placed. Done retains the existing permanent-placement confirmation.

Verification: the 16 selected collection, cabinet wiring and coordinate tests pass, including official/Admin-only visibility, award-only unlocking and category filtering. Lint, typecheck and backend syntax pass. Local browser verification uses synthetic demonstration clubs and profiles; production was not modified. Graphify update was attempted, but the command is not installed.

Browser evidence includes My Profile, another player's read-only public profile and the winning club profile. The demonstration Cup and unearned D2 design were marked Admin-only through the local Admin UI. Both remain visible. Place created the exact earned Cup draft on the player profile; an actual drag created its club draft. Both test drafts were removed without permanent confirmation. Competition filtering and text search were exercised. Screenshots 44–46 are under `output/playwright/admin-walkthrough-2026-11-09/`.

## Compact layout adjustment — 10 November 2026

The shared player/club picker is now centered with a maximum width of 896px instead of filling wide profiles. Trophy cards use 48px artwork, tighter spacing and four columns from the small breakpoint (two on phones). The panel, cards, filters, search/select inputs, status badges and pagination all have square corners. Existing search, pagination, availability, drag and Place behavior is unchanged. Browser preview: `output/playwright/admin-walkthrough-2026-11-09/48-compact-square-trophy-grid.jpg`. Lint, typecheck and backend syntax passed. Graphify is not installed.
