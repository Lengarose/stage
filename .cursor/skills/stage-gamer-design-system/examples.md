# STAGE Gamer Design System — Examples

## Page header (Rankings / Register pattern)

```jsx
<header className="mb-8">
  <p className="mb-1 text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">STAGE</p>
  <h1 className="font-heading text-5xl font-black uppercase leading-none text-white sm:text-6xl">
    {t("competitionFlow.rankingsTitle")}
  </h1>
  <p className="mt-4 max-w-3xl text-sm text-white/50">{subtitle}</p>
</header>
```

## Dashboard command center hero

```jsx
<header
  className="relative overflow-hidden border border-cyan-300/20 bg-gradient-to-br from-cyan-500/10 via-[#0d1528]/80 to-amber-500/10 p-5 sm:p-6"
  style={{ clipPath: "polygon(2% 0, 100% 0, 98% 100%, 0 100%)" }}
>
  {/* radial gradient overlay + rank ring + GamerMetaPill + GamerHeroAction */}
</header>
```

## Accordion region card (SeasonRegistrations)

```jsx
<div
  className="overflow-hidden border border-cyan-300/20 bg-gradient-to-br from-[#070b14]/95 via-black/88 to-[#070b14]/92 backdrop-blur-md"
  style={{ clipPath: "polygon(2% 0, 100% 0, 98% 100%, 0 100%)" }}
>
  <button type="button" className="flex w-full items-center gap-4 px-5 py-4 hover:bg-cyan-300/[0.04]">
    {/* icon tile + title + StatusBadge + ChevronDown */}
  </button>
  {expanded && (
    <div className="border-t border-cyan-300/10">
      {/* ROW_CLIP division rows + footer with GamerHeroAction */}
    </div>
  )}
</div>
```

## Rankings Segment tabs

```jsx
// Primary — angled
<Segment value={view} onChange={setView} items={[...]} />

// Filters — rounded, inside dark bar
<div className="flex flex-wrap items-center gap-3 border border-cyan-300/15 bg-[#070b14]/82 px-4 py-3 backdrop-blur-md">
  <Segment variant="filter" value={scope} onChange={setScope} items={[...]} />
  <Select ... />
</div>
```

## Before → After

**Before (legacy shadcn):**
```jsx
<section className="rounded-2xl border border-border bg-card p-5">
  <h2 className="font-heading font-black uppercase text-xl text-foreground">Recent Form</h2>
  <Link to="/rankings">
    <Button variant="outline" size="sm">Rankings</Button>
  </Link>
</section>
```

**After (gamer system):**
```jsx
<GamerSectionCard title="Recent Form">
  <GamerHeroAction as={Link} to="/rankings">
    <BarChart3 className="w-3.5 h-3.5" /> Rankings
  </GamerHeroAction>
</GamerSectionCard>
```

## Tinted stat accents

| Metric type | `accent` prop |
|-------------|---------------|
| Rank, avg rating | `gold` |
| Win record, contract | `green` |
| Matches, activity | `cyan` |
| Tenure, activity level | `violet` |
| Missing / error | `rose` |

Always pass `tinted` on dashboard stat tiles for readability.
