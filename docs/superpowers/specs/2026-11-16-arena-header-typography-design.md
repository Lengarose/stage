# Arena Header Typography Design

## Intent

Give the desktop application header the same confident Anton typography as the primary buttons, while making the existing transfer-window indicator feel more playful and integrated with the current arena energy.

## Goals

- Use Anton explicitly for desktop top-navigation labels and their dropdown-menu labels instead of allowing the EA Sports font to win through `--font-heading`.
- Keep the current blue/white navigation palette and green/turquoise transfer-window palette.
- Restyle the open transfer-window indicator as a compact angular status ticket with a status dot, `TRANSFER WINDOW` label and stronger `OPEN` segment.
- Add subtle energy through a light sweep and status pulse, disabled for reduced motion.

## Non-goals

- No navigation structure, routes, dropdown logic, transfer status logic or mobile-navigation changes.
- No new colors, dependencies or typography assets.

## Approach

Selected: add focused semantic classes in `Layout.jsx` and own all visual treatment in `arenaNavigation.css`. Inline header styles are avoided for the redesigned indicator so dark/light variants, focus behavior and reduced motion remain maintainable. Rebuilding the navigation or creating a new status component was rejected as unnecessary for this focused visual change.

## Design

Desktop arena triggers and portalled menu labels use `font-family: 'Anton', Impact, sans-serif`, weight 400, uppercase and slightly tighter tracking. The indicator becomes an angular clipped ticket: a small pulsing green status dot, compact `TRANSFER WINDOW` text, and an emphasized `OPEN` block. Existing green/turquoise hues remain, with a restrained diagonal sheen. Light-theme contrast is preserved through dedicated selectors.

## Validation

Source-level tests pin the explicit Anton declaration, status-ticket structure, retained green/turquoise palette and reduced-motion override. Project lint, typecheck, tests and build must pass, followed by a desktop header visual review in dark and light themes.

