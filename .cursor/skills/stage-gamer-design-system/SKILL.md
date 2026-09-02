---
name: stage-gamer-design-system
description: >-
  STAGE League gamer UI design system — dark cyan/gold esports aesthetic with
  clipped cards, GamerProfileShell, and shared primitives. Use when styling or
  building Stage web pages (Dashboard, Profile, Game Day, Rankings, Register,
  Settings), migrating legacy shadcn cards, or when the user mentions gamer
  design, design system, or UI consistency across Stage.
---

# STAGE Gamer Design System

## Source of truth

| Item | Path |
|------|------|
| Primitives | `src/components/profile/gamer/GamerProfileUI.jsx` |
| Dashboard widgets | `src/components/dashboard/` |
| Reference pages | `Dashboard.jsx`, `Profile.jsx`, `GameDay.jsx`, `Rankings.jsx`, `SeasonRegistrations.jsx` |

**Rule:** Reuse existing primitives. Do not invent parallel button/card styles.

---

## When to apply

- New player-facing pages under `src/pages/`
- Refactoring pages that still use `bg-card`, `border-border`, `text-foreground`, generic `Button`
- User asks for Profile / Game Day / Dashboard look — **style only**, layout can differ

## When NOT to apply

- Admin panels (use `AdminGamerUI.jsx` where already adopted, or admin-specific patterns)
- Marketing/landing unless explicitly requested
- Do not change business logic when doing visual-only migrations

---

## Page shell

Wrap player-facing pages in `GamerProfileShell`:

```jsx
import { GamerProfileShell } from "@/components/profile/gamer/GamerProfileUI";

export default function MyPage() {
  return (
    <GamerProfileShell>
      <div className="px-5 py-8 lg:px-10">
        <div className="mx-auto max-w-6xl space-y-6">{/* content */}</div>
      </div>
    </GamerProfileShell>
  );
}
```

Loading spinner: `border-cyan-400/20 border-t-cyan-400` (not `border-primary`).

---

## Color tokens

| Role | Tailwind / hex |
|------|----------------|
| Page bg | `#060912`, `#0a101c` |
| Card surface | `#070b14` at **82–95% opacity** + `backdrop-blur-md` |
| Primary accent | cyan (`cyan-300`, `cyan-400`) |
| Secondary accent | amber/gold (`amber-300`, `yellow-500`) |
| Success | `emerald-300` / `emerald-400` |
| Warning | `amber-300` |
| Error | `rose-400` |
| Label text | `text-white/40` – `text-white/55` |
| Body text | `text-white`, `text-white/45` |
| Links / actions | `text-cyan-300 hover:text-cyan-200` |

**Readability rule:** Cards over busy backgrounds (trophy photos) must use **opaque dark surfaces**, not `bg-white/[0.03]`. Use `tinted` stat tiles or gradient surfaces (`from-[#070b14]/95 via-black/88 to-black/92`).

---

## Typography

- **Page kicker:** `text-xs font-bold uppercase tracking-[0.35em] text-cyan-300` → e.g. `STAGE`
- **Page title:** `font-heading font-black uppercase text-white text-4xl sm:text-5xl leading-none`
- **Section title:** `font-heading text-sm font-black uppercase tracking-[0.16em] text-white/90`
- **Micro label:** `text-[9px] font-bold uppercase tracking-[0.22em] text-white/40`
- **Stat value:** `font-heading text-2xl font-black`

Avoid `text-foreground`, `text-muted-foreground` on gamer pages.

---

## Clip paths (signature shape)

Use inline `style={{ clipPath: "..." }}` — do not rely on rounded corners alone for primary cards.

| Use | Polygon |
|-----|---------|
| Page hero / section card | `polygon(2% 0, 100% 0, 98% 100%, 0 100%)` |
| Stat tile / glance card | `polygon(6% 0, 100% 0, 94% 100%, 0 100%)` |
| List row | `polygon(4% 0, 100% 0, 96% 100%, 0 100%)` |
| Button / tab | `polygon(10% 0, 100% 0, 90% 100%, 0 100%)` |
| Icon badge | `polygon(12% 0, 100% 0, 88% 100%, 0 100%)` |

---

## Component catalog

Import from `@/components/profile/gamer/GamerProfileUI`:

| Component | Use for |
|-----------|---------|
| `GamerProfileShell` | Page wrapper + ambient gradients |
| `GamerSectionCard` | Titled sections (`title`, optional `action`, `shape="rounded"` default) |
| `GamerHeroAction` | Primary/secondary CTAs; supports `as={Link}` |
| `GamerMetaPill` | Tags (platform, position, status chips) |
| `GamerTabNav` | Horizontal tab bar with badges |
| `GamerStatTile` | KPI tiles; use `shape="angled"` + `tinted` on dashboards |
| `GamerAttributeBar` | Progress bars (profile stats) |
| `GamerPlayerPhotoFrame` / `GamerPlayerCard` | Player avatar card |
| `GamerRecordStrip` | W/D/L pill strip |

### GamerHeroAction

```jsx
<GamerHeroAction as={Link} to="/game-day">
  <Zap className="w-4 h-4" /> Open Game Day
</GamerHeroAction>
```

Replace `Button` + `Link` wrappers on gamer pages.

### GamerStatTile (dashboard)

```jsx
<GamerStatTile label="GLOBAL RANK" value="#12" accent="gold" shape="angled" tinted sub="1 240 pts" />
```

Accents: `cyan`, `gold`, `green`, `rose`, `violet`, `sky`.

### GamerSectionCard

```jsx
<GamerSectionCard
  title={t("sectionTitle")}
  action={<Link className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">View all</Link>}
>
  {children}
</GamerSectionCard>
```

Surface: `bg-[#070b14]/82 backdrop-blur-md border-white/10` (rounded) or cyan border + clip-path (angled).

---

## List rows pattern

For repeatable items (matches, tournaments, applications):

```jsx
const ROW_CLIP = { clipPath: "polygon(4% 0, 100% 0, 96% 100%, 0 100%)" };

<div
  className="border border-cyan-300/20 bg-gradient-to-r from-[#070b14]/95 via-black/85 to-[#070b14]/90 px-4 py-3 backdrop-blur-md hover:border-cyan-200/35"
  style={ROW_CLIP}
>
  {/* content */}
</div>
```

---

## Tabs pattern

**Two-level navigation:** never stack primary angled tabs and filter tabs on one flex row with `items-end`.

```
Row 1: Primary tabs (Segment / GamerTabNav) — angled clip-path
Row 2: Filter bar in dark container — rounded pills, smaller padding
```

Reference: `Rankings.jsx` (`Segment` with `variant="primary"` | `variant="filter"`).

---

## Status badges

```jsx
// Approved
"text-emerald-300 border-emerald-400/30 bg-emerald-400/10"
// Pending
"text-amber-300 border-amber-400/30 bg-amber-400/10"
// Rejected
"text-rose-400 border-rose-400/30 bg-rose-400/10"
// Neutral
"text-white/45 border-white/15 bg-white/[0.04]"
```

Use `text-[9px] font-black uppercase tracking-wider` + border (not shadcn `Badge` defaults).

---

## Dialogs on gamer pages

```jsx
<DialogContent className="max-w-md border border-cyan-300/20 bg-[#070b14] text-white">
```

Inputs: `border-cyan-300/15 bg-black/40 text-white`.
Actions: `GamerHeroAction` (not default `Button`).

---

## Migration checklist

When converting a legacy page:

- [ ] Wrap in `GamerProfileShell`
- [ ] Replace `bg-card border-border` → `GamerSectionCard` or tinted row/card
- [ ] Replace `Button` CTAs → `GamerHeroAction`
- [ ] Replace `text-muted-foreground` → `text-white/45`
- [ ] Replace `text-primary` links → `text-cyan-300`
- [ ] Ensure stat/list cards are **dark enough** for white text over photo backgrounds
- [ ] Use `font-heading font-black uppercase` for headings
- [ ] Separate tab levels if page has filters
- [ ] Run `npm run lint`

---

## Anti-patterns

| Avoid | Use instead |
|-------|-------------|
| `bg-card`, `bg-background` on gamer pages | `#070b14/82–95` + blur |
| `border-border` | `border-cyan-300/15` or `border-white/10` |
| `text-foreground` / `text-muted-foreground` | `text-white` / `text-white/45` |
| Generic `Button variant="outline"` for hero actions | `GamerHeroAction` |
| Fully transparent tiles on dashboard | `GamerStatTile tinted` |
| Mixing primary + filter tabs on one row | Two-row tab layout |
| Changing layout when user asked for style only | Keep grid/structure, swap components |

---

## Dashboard-specific

| File | Notes |
|------|-------|
| `DashboardGamerStatCard.jsx` | Wraps `GamerStatTile` with `tinted` + icon |
| `DashboardQuickGlance.jsx` | Dark glance cards with clip-path |
| `DashboardFormStrip.jsx` | W/L/D and rating pills |
| `DashboardWidgetGrid.jsx` | Edit mode uses `GamerHeroAction` |
| `DashboardWidget.jsx` | Cyan-bordered widget chrome |

---

## Additional reference

See [examples.md](examples.md) for before/after snippets and page-specific hero headers.
