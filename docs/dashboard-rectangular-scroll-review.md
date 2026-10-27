# Dashboard Rectangle And Scroll Correction

## Scope

The existing dashboard arrangement, values, calculations, destinations, theme,
global navigation and preference storage are unchanged. This does not implement
the proposed grouped dashboard redesign. The current Dashboard has no Command
Center/Performance background editor; none was introduced.

Rectangular conversions cover Command Center, wallet/inbox glance cards and
their icons, all eight statistic tiles, both Recent Form marker modes, next
match and club icon frames, upcoming rows, tournament and standing rows,
objectives, chart tooltips, the welcome footer, and customisation wrappers.
The rank ring, round metadata pills and progress bars retain their circles.

## Reproduced Cause

The real Layout and Dashboard were mounted together in an isolated browser
fixture. At 1280 x 720, Layout's main measured 656px high with 1808px of content.
The reused GamerProfileShell measured 1776px high with 1776px of content: it had
no scroll range, but overflow-y:auto and overscroll-y-contain still established
a scroll boundary. Native scrolling over its contents stopped there instead
of chaining to main. Scrolling over main's far-right scrollbar worked.

Before changing code, scrolling over the banner, a statistic card and empty
dashboard space left main.scrollTop at zero. At the far right it reached 720;
scrolling back over content remained blocked.

Dashboard now opts into GamerProfileShell's page scroll mode, which creates no
inner overflow or overscroll boundary. Layout's main remains the only page
scroll owner. The existing shell mode remains the default for other pages.
No wheel forwarding, preventDefault changes, global CSS overrides, navigation
edits or scroll-lock changes were added. Customisation widget bodies also no
longer introduce capped nested scroll areas; draggable transforms are intact.

## Changed Files

- src/pages/Dashboard.jsx
- src/components/profile/gamer/GamerProfileUI.jsx (opt-in scroll mode and tile shape)
- src/components/dashboard/DashboardGamerStatCard.jsx
- src/components/dashboard/DashboardQuickGlance.jsx
- src/components/dashboard/DashboardFormStrip.jsx
- src/components/dashboard/DashboardActivityChart.jsx
- src/components/dashboard/DashboardCustomizer.jsx
- src/components/DashboardWidget.jsx
- src/components/objectives/ObjectivesWidget.jsx (opt-in shape, existing default retained)
- scripts/dashboard-scroll-qa.html (isolated real-component browser fixture)

## Verification

Use an existing Vite server, or start one with a local backend proxy:

```sh
VITE_API_PROXY_TARGET=http://127.0.0.1:8080 npm run dev -- --port 5194
```

Visit /scripts/dashboard-scroll-qa.html for sample data, not a production login.
It mounts the actual Layout and Dashboard and mocks entity/business calls.
It does not exercise a real account or persist server-side mutations.

Browser checks performed:

- Desktop 1280 x 720, tablet 820 x 1180, mobile viewport 390 x 844.
- Native vertical scroll over banner, each of 12 metric areas, Recent Form,
  empty space and lower-page sections. Desktop main moved from 0 to 720 in
  every area; tablet and mobile scrolling also moved main.
- No polygon clip paths anywhere under main, including populated lower widgets.
- No extra vertical scroll containers under main and no horizontal overflow.
- Global desktop navigation remains slanted; ring remains circular.
- Customisation opens; keyboard Space/ArrowDown/Space reorders widgets. Reversed
  the operation to restore original order, exited, and confirmed page scrolling.
- Dropdown opening retains its intentional body lock. Escape restores it and
  ordinary dashboard scrolling works again.
- Real links retain their destinations; rank and financial sample values remain
  unchanged. Actual authenticated destination workflows were not exercised.

Physical trackpad, touchscreen and actual-device testing were not available.
Mobile-width browser scrolling is not proof of a hardware touch gesture. There
is no dashboard background dialog in this implementation to open/close; dropdown
locking was verified and modal/slider implementations were left unchanged.

Checks:

- npm run lint: pass.
- npm run typecheck: pass.
- node --check server/src/server.js: pass.
- npm test: 392/396 pass, the same four pre-existing failures (header identity
  menus, FUT photo frame, GameDay club loading, profile photo preview).
- npm run build: pass, existing Browserslist age and chunk-size warnings.
- git diff --check: pass.
- graphify update .: unavailable (command not found); graph report/wiki are
  also absent from this checkout.

Deployment is frontend-only: upload the resulting build/ contents to Gandi.
No backend restart, database migration or production repair is part of this
dashboard correction. The working tree also contains prior unrelated regional
league changes; a full build includes those unless released separately.
