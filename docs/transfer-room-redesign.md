# Transfer Room redesign — 14 November 2026

## Where to find it

- Users: Market → Transfer Room (`/transfer-market`).
- Admin: Transfer Room (`/admin/transfers`) → **Slideshow & presentation**.

The room uses the landing/homepage design language: full-width cinematic artwork, editorial headings, blue accents, straight edges and cut corners. The Transfer Room title and short introduction appear at the top left. The hero occupies the available screen beneath the navigation; the market continues below it in the same full-width page. There is no second nested scrolling player board.

## Player market

- Showcase cards and a player directory, availability categories, name search, position/platform filters and sorting by newest profile, name or recorded match rating.
- Twelve players per page. Player identity circles use the shared 3D avatar component; names, actual match statistics, Card Level and availability come from current player and agreement data. Purchase valuations are removed.
- Desktop selected-player dossier; narrow layouts open it in a dialog when a player is selected.
- Profile links and the existing offer dialog retain current Manager permissions, Club Board limits, affordability and transfer-window rules. Salary bands remain based on STAGE Card Level. Recruitment is contract-only; no purchase price or transfer fee is supported.
- A collapsed recruitment explanation includes the current transfer-window guidance. Market loading failures show Retry rather than appearing as an empty market.

## Admin controls

1. Edit the page title and brief introduction.
2. Select STAGE Blue, Electric Cyan or Transfer Gold.
3. Choose the initial showcase/directory view and player order. Visitors can change their own current view.
4. Add up to six slideshow photos through the existing upload/URL field. Reposition and zoom each photo with the existing crop editor. Move photos up/down or remove their slots.
5. Set 3–30 seconds per photo and save the presentation.

Without custom photos, six bundled STAGE landing images rotate. A custom set replaces that fallback set; clearing all slots restores the built-in images. Existing single-background settings are read as one slide for backward compatibility. Removing a slot does not delete an uploaded file.

Visitors have previous/next, photo selectors and pause controls. Autoplay pauses during keyboard interaction and respects reduced-motion preferences. Layouts use responsive grids and avoid a fixed-width desktop board on phones.

## Persistence and deployment

Uses the existing `TransferRoomConfig` entity and its existing Admin-protected, audited generic routes. New presentation fields remain in the existing JSON store; the updated contract-only market uses existing functions and Club Board endpoints. The transfer-window controls stay in the same Admin section.

The contract-only update requires the rebuilt frontend and changed backend files, followed by the normal Gandi app restart. No new table, migration or dependency is required. No production deployment or production configuration write was performed.

## Verification

- Required lint, typecheck and backend-entry syntax checks.
- Production Vite build.
- `node --test src/lib/__tests__/transferRoomPresentation.test.mjs`: legacy background compatibility, six-photo limit, zoom/timing bounds, supported settings and unsafe image URL rejection.
- Browser on isolated local data: hero/manual photo controls, working market anchor, player search, directory switching, dossier selection and opening the existing offer dialog. No offer was submitted.
- Admin browser save/reload: title persists; custom photo URLs save; six-photo cap disables Add; reorder swaps the image fields; crop modal exposes position/zoom controls. Test photos were removed afterward to restore the built-in slideshow in the isolated database.
- Screenshots: `output/playwright/transfer-room-2026-11-14/desktop-hero.png`, `desktop-market.png`, `admin-editor.png`.
- Graphify update attempted; the CLI is not installed and `graphify-out/` has no report/wiki. No graph update is claimed.

## Contract-only recruitment and final 14 days

- **Free agents:** no active playing agreement, accepted future agreement or current club membership. An unsigned pending offer does not remove a free agent from the directory.
- **Expiring · final 14 days:** active playing agreements only, with no accepted renewal or future signing. The precise Club Board `ends_at` takes precedence over its legacy date-only mirror. Management/ownership contracts never qualify a player for this list.
- The dossier shows the current club. Contract options show the earliest start of a future agreement; acceptance preserves the existing club and playing contract until expiry. Signing bonuses retain the approved payment-on-acceptance rule; salary begins accruing only from the new effective start.
- Acceptance is serialized through the existing player lock and rejects another accepted future agreement. A changed source contract requires a fresh proposal. At activation, membership and official transfer eligibility are rechecked; conflicts go to the existing activation-review state without silently replacing a live agreement.
- Existing Card Level salary bands, affordability and payment history are preserved. No new purchase fee can be offered or paid. The old valuation and purchase functions return HTTP 410. Historical stored columns and financial receipts remain for compatibility/history; they are not presented as current recruitment prices.
- Removed valuation displays from Transfer Room cards/dossiers, alternate transfer views, Admin player tools and club squad valuation. Removed the obsolete purchase dialog and valuation settings component. Updated English landing/tutorial recruitment descriptions.

Focused verification: `playerValueRetirement.test.mjs`, `transferMarketService.test.js`, and the real JWT/HTTP script `server/scripts/acceptance/transfer-market.cjs` on a newly created disposable local MySQL schema. The HTTP flow covers listing, permitted terms, rejected purchase fees, scheduled acceptance, duplicate future signing prevention, expiry activation, retry and initial founder offer acceptance. Browser screenshot: `output/playwright/transfer-room-2026-11-14/contract-only-market.png`.

## Club-linked test pack regression

The older `getTransferMarket` implementation classified free agents solely by absence of a live `player_contracts` row. The seed pack assigns `players.club_id` without creating those contracts, so club-linked seeded players were returned as free agents. This is a general membership-classification bug, not a reason to hide all test accounts. The updated service checks the club link as well as current/future playing agreements. A 142-player regression fixture (140 club-linked players and two free agents) returns only the two free agents; the isolated HTTP test includes an actual club-linked seeded player with no contract. Existing qualifying final-14-day contracts remain in their separate section. The backend files must be uploaded and the Gandi app restarted for the fix to take effect on production.
