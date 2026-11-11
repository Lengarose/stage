# Task: rebuild the public landing page to "Stage Landing Page v2"

You are working in the Stage web repo (Vite + React 18 + Tailwind, see `AGENTS.md` / `CLAUDE.md`).
Rebuild `src/pages/Landing.jsx` so it matches the new design exactly. Read this whole file first.

## Source of truth

| What | Where |
|---|---|
| Design, ready to open in a browser | `docs/landing-v2/reference/landing-v2.html` (open it, compare side by side while you work) |
| Original design source (Claude Design `.dc.html`) | `docs/landing-v2/reference/landing-v2.source.dc.html` |
| Optimised images (webp) + logo | `docs/landing-v2/images/` |

The reference HTML uses inline styles. Translate them to Tailwind (arbitrary values are fine:
`clamp()`, `clip-path`, exact hex colours). Match spacing, type sizes, colours and the angled
`clip-path` corners precisely — this is a pixel-faithful port, not a reinterpretation.

## Images

Move `docs/landing-v2/images/*` to `src/assets/landing/` and import them via `@/assets/landing/...`.

| File | Used in | Original in `stageimages/` |
|---|---|---|
| `gamers.webp` | hero slide 1 | games.png |
| `dribble.webp` | hero slide 2 | neymar.png |
| `penalty.webp` | hero slide 3 | penalty.png |
| `team.webp` | hero slide 4 | team.png |
| `moments-1.webp` | hero slide 5 | longue vie.png |
| `moments-2.webp` | hero slide 6 | image1.png |
| `triumph.webp` | 01 Compete | Triomf van FC Longue Vie.png |
| `coach.webp` | 02 Manage | (from the design) |
| `player.webp` | 03 Grow | Voetbalster in paars stadionlicht.png |
| `platform.webp` | Features | stage.png |
| `logo-white.png` | nav + footer | (from the design) |

Hero slide 1 is eager-loaded (`fetchpriority="high"`); every other image gets `loading="lazy"` and
`decoding="async"`. Keep the alt texts from the reference.

Do NOT delete old assets in `src/assets/` — `Coach Luis.PNG`, `Trophies.PNG`, etc. are still used by `Home.jsx`.
Only remove imports from `Landing.jsx` that become unused.

## Fonts

The design uses **Anton** (display), **Chakra Petch** (body/UI) and **JetBrains Mono** (labels/eyebrows).
Load them once (Google Fonts `<link>` in `index.html` with `display=swap`, or `@fontsource` packages)
and apply them only inside the landing page (wrapper class), so the rest of the app keeps
`--font-heading` / EA Sports 15. Note the hero title stays on Anton.

## Sections, in order (see reference)

1. **Nav** — logo + italic "STAGE", anchor links (GOST, Compete, Manage, Grow, Features, How it works) with smooth scroll, angled SIGN IN button.
   The design has no mobile nav: below `lg` hide the links behind an accessible hamburger (`<button aria-expanded>`), keep SIGN IN visible.
2. **Hero carousel** — 6 full-bleed slides, left-to-right gradient overlay, title "Your / *Stage* / Awaits" (cyan italic with glow), two CTAs.
   Autoplay every 4.5 s, pause on hover and on keyboard focus, dots + counter `01 / 06` + prev/next buttons, `aria-label`s as in the reference.
   Respect `prefers-reduced-motion` (no autoplay, no slide transition). Desktop: `aspect-ratio:16/9`; on mobile use a `min-height` so the text never clips.
3. **Stats strip** — 4 numbers, last one cyan.
4. **GOST** — eyebrow, giant italic "GOST", 3 tier cards (Supreme cyan, Elite yellow, Challenger green) with 1px coloured angled border.
5. **Regional leagues** — boxed callout with button "VIEW REGIONAL LEAGUES" → internal route `/leagues` (use `<Link>`; if the visitor is not logged in and the route is protected, call `onSignIn` instead).
6. **01 Compete** (image left), **02 Manage** (image right, `wrap-reverse` on mobile), **03 Grow** (image left + "Contract offer" card).
7. **Features** — "One platform. / Every feature." + platform image + 6-card grid with coloured top bars and hover background.
8. **How it works** — 3 levels with outlined numbers (03 filled cyan).
9. **CTA** — radial blue gradient, "Ready to *compete*", START PLAYING NOW.
10. **Footer** — logo, "Stage League", tagline.

## Behaviour you must keep from the current `Landing.jsx`

- **`onSignIn` prop**: every SIGN IN / GET STARTED / START PLAYING / ACCEPT / NEGOTIATE action calls `onSignIn()` (these are `<button>`s, not `href="#join"`).
- **CMS overrides** from `GET /api/stage/public/landing-content` (keep the fetch + fallbacks):
  `hero_title`, `hero_description`, `stats_json`, `footer_tagline`. `hero_image_url` (+ position/zoom), when set, becomes slide 1 of the carousel.
  Defaults = the texts in the reference. `LandingPageEditor` in admin must keep working unchanged.
- **i18n**: all copy goes through `useTranslation()`. Reuse existing `commonPages.land*` keys where the text is the same;
  add new keys (`commonPages.landV2*`) for new copy (GOST, tiers, regional leagues, Compete/Manage/Grow, contract card, nav).
  Add them to `en.json` with the English text and to every other locale file in `src/translations/` (translate nl/fr/de/es/it/pt properly; others may fall back to English if the project's fallback supports it — check `localePackRegistry.js`).

## Quality bar

- Real `<button>` / `<a>` / `<Link>` elements, visible focus rings, `aria-hidden` on decorative SVG/shapes.
- Text contrast ≥ 4.5:1 (the grey `#7f8aa3` labels on `#080d22` pass; don't go lighter-on-dark lower than that).
- No horizontal scroll at 360 px. Test 360, 768, 1280, 1920.
- Keep the existing `FadeIn` (framer-motion) reveal on sections, disabled under reduced motion.
- Split into small components in `src/components/landing/` (Nav, HeroCarousel, TierCards, FeatureSection, FeatureGrid, Steps, CtaBand, Footer) — `Landing.jsx` composes them.

## Done when

- [ ] `npm run lint` and `npm run build` pass with no new warnings.
- [ ] Visual check against `docs/landing-v2/reference/landing-v2.html` at 1440 px and 390 px — sections, order, colours, type and spacing match.
- [ ] Carousel: autoplay, pause on hover/focus, dots, arrows, keyboard, reduced-motion all work.
- [ ] Sign-in modal opens from every CTA; `/leagues` link works.
- [ ] CMS hero title/description/stats still override the defaults; admin Landing editor unchanged.
- [ ] Language switch changes all landing copy.

## Rules

- Do **not** commit or push. Leave the changes in the working tree for review.
- Don't touch the backend, other pages, or `docs/` apart from moving the images.
- When finished, write a short report to `docs/landing-v2/REPORT.md`: files changed, decisions, anything that didn't match the design and why.
