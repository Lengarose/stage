# STAGE Directory — 16 November 2026

One public directory at `/directory`, available from Market → STAGE Directory (desktop and phone navigation). Categories are URL-backed: `?type=players`, `?type=clubs`, `?type=managers`.

- Anton headings and Chakra Petch text match the newer STAGE pages.
- Player and Manager cards show their profile banner and shared circular avatar. Club cards use wider banners and larger circular logos. Missing artwork gets a neutral fallback.
- Search, category-specific position/region filters, platform filter, alphabetical ordering, clear filters, grid/list views and pagination.
- Managers use the existing Player-linked club manager directory resolver and link to the public player profile.
- Retired the separate Players, Clubs and Presidents directory page components. Their public list URLs redirect to the corresponding category; individual player/club profiles are unchanged.
- Tournament entrance directories reuse the new presentation with a fixed participant category and registered participant filtering.

Local UI evidence uses synthetic read-only data in `scripts/directory-style-qa.html`; the 390px phone fixture is `scripts/directory-mobile-qa.html`. It does not mutate any real records. Screenshots: players.png, clubs.png, managers.png, mobile.png.

Browser checks passed: category navigation; manager search by club; empty search and clear filters; grid/list toggle; pagination; reverse alphabetical ordering; platform filtering; 390px layout. All 16 relevant existing manager/public-route tests pass. Lint, typecheck, production build, backend syntax and diff whitespace checks passed.

Graphify update was attempted; the command is not installed. No push or deployment.
