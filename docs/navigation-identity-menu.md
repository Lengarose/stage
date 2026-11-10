# User navigation identity menu — 10 November 2026

The desktop identity dropdown previously rendered role radio items, profile and club links and Settings in addition to Logout. The mobile version separately rendered the same entries for dual-role accounts and linked directly to a profile for single-role accounts. These explicit branches caused the reported unwanted menu contents; this was not a Trophy Collection rendering issue. Git contains the identity menu in commit `3457f9d` and the club-link adjustment in `c585bf0`; the available history does not establish when a previous removal was lost.

Both identity dropdowns now render the shared `IdentityLogoutItem` only, regardless of whether the account has a player, a club, or both. The existing authenticated logout action is preserved. Player and club links remain in Home; the president Home group also includes My Profile when the account has a player. Public desktop section names stay stable (Home/Compete/Market/Discover) instead of replacing Home with the active child title. Admin navigation naming is unchanged. Settings remains accessible from the existing header settings icon.

The remote winged subscription image is removed from the navigation. STAGE Plus now uses a small blue sphere with internal highlights and a bold white italic plus. The STAGE Plus label is light blue; credits keep their existing value and presentation. The Store artwork/configuration is unchanged. Three navigation designs with white/blue lighting are previews for selection; their visual styles are not yet applied to the live layout.

Verification: browser reproduced six menu items on the combined player/president demo account, then the same exact menu check passed with Logout as the single item. Home visibly contains My Profile and My Club. Screenshot evidence is in `output/playwright/admin-walkthrough-2026-11-09/51-blue-orb-logout-only.jpg` and `50-home-profile-club-links.jpg`. Desktop/mobile share the logout item implementation; mobile was not separately exercised in a phone viewport. Lint, typecheck, backend syntax and diff whitespace passed. Graphify is unavailable on this machine.

Local source changes only; not pushed or deployed.

## White PLUS mark — supersedes the blue sphere

The latest approved direction replaces both the sphere and the written STAGE Plus label with the user's supplied compact white PLUS artwork. The original white geometry is retained in `public/stage-plus-mark.png` with genuine alpha transparency; the blue background and cross-shaped cutout are transparent. After generated cutouts left residue, the user explicitly approved deterministic pixel extraction; `scripts/assets/extract-plus-logo.cjs` preserves the original artwork without redrawing it. No generated cutout is used. The navigation renders the PNG at 46 × 18 CSS pixels beside the unchanged credit count. The existing white-header theme inverts the mark for contrast.

Browser proof: `52-white-plus-logo.jpg`. The three new Arena / Matchday / Clubhouse game-style navigation designs are previews only, pending the user's selection; existing navigation styling is not replaced by a preview.

## Arena applied locally

The user selected Arena for the public navigation. The desktop header now uses angled tabs with white labels, blue active/hover lighting and white/blue header rules. Portalled section and account dropdowns use matching square, cut-corner surfaces, blue accents and the existing game font. Original menu destinations and badges remain intact; the most specific Home route takes precedence over broader Market routes on the user's club page. Admin section styling and mobile tab layout are unchanged.

The original imported `src/assets/Stadium Logo.png` remains on the left. Browser DOM inspection confirmed this asset and an avatar measuring 36 × 36 pixels with a 9999px border radius. The white PLUS mark, credits, Home profile/club links and logout-only account dropdown are preserved. Browser navigation through Home → My Club succeeded, and Compete's existing routes were verified. Screenshots `53-arena-navigation-home.jpg` and `54-arena-navigation-compete.jpg` record the local result. Lint, typecheck, backend syntax and whitespace checks passed. No publication, deployment or push was performed; the accidentally created Sites project remains unpublished. Graphify is not installed.
