/**
 * Trophy collection picker beneath the cabinet (legacy filename retained).
 * States: locked | available | draft | placed
 */
import { useState } from 'react';
import { Lock, Search, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { filterTrophyEntries, trophyCategory } from '@/lib/trophyCollection';

const PAGE_SIZE = 8;
const CATEGORIES = { gost: 'GOST', regional_league: 'Regional League', regional_cup: 'Regional Cup', other: 'Other trophies' };

const RARITY_GLOW = {
  common: 'rgba(255,255,255,0.15)',
  rare: 'rgba(96,165,250,0.4)',
  epic: 'rgba(168,85,247,0.4)',
  legendary: 'rgba(251,191,36,0.5)',
};

export default function TrophyScrollBar({
  entries = [],
  editMode = false,
  canEdit = false,
  busy = false,
  error = '',
  onRetry,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
  onDragStart,
  onPointerDragStart,
  onPlace,
  onSelect,
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [source, setSource] = useState('all');
  const [page, setPage] = useState(0);
  const filtered = filterTrophyEntries(entries, { search, status, source });
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const shown = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  return (
    <section aria-label="Trophy collection" className="mx-auto mt-4 w-full max-w-4xl space-y-3 rounded-none border border-border bg-card p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2 px-1">
        <h4 className="text-sm uppercase tracking-widest text-foreground font-semibold">
          Trophy Collection
        </h4>
        {error ? (
          <button
            type="button"
            onClick={onRetry}
            className="text-[11px] font-semibold text-destructive underline-offset-2 hover:underline"
          >
            Retry catalogue
          </button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">Browse every trophy design, including official competitions. Earned copies unlock automatically; use Edit to drag or place them in your cabinet.</p>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)]">
        <label className="relative block"><span className="sr-only">Search loaded trophies</span><Search aria-hidden className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input type="search" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search trophies or competitions" className="min-h-10 w-full min-w-0 rounded-none border border-border bg-background pl-9 pr-3 text-sm" /></label>
        <label><span className="sr-only">Competition type</span><select value={source} onChange={e => { setSource(e.target.value); setPage(0); }} className="min-h-10 w-full rounded-none border border-border bg-background px-3 text-sm"><option value="all">All competition types</option>{Object.entries(CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Trophy availability">
        {[['all', 'All trophies'], ['available', 'Available to place'], ['earned', 'Won / awarded']].map(([value, label]) => <button type="button" key={value} aria-pressed={status === value} onClick={() => { setStatus(value); setPage(0); }} className={cn('min-h-10 rounded-none border px-3 text-xs font-semibold', status === value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}>{label}</button>)}
      </div>

      {error ? (
        <p role="alert" className="rounded-none border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground" role="status">{filtered.length} matching designs · {entries.length} loaded{hasMore ? ' · More designs available below' : ''}</p>
      <div role="list" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {shown.map((entry) => {
          const unlocked = entry.state === 'available' && editMode && canEdit && !busy;
          const glow = RARITY_GLOW[entry.rarity] || RARITY_GLOW.common;
          return (
            <div
              key={entry.id}
              role="listitem"
              className={cn(
                'flex min-w-0 flex-col items-center gap-1.5 rounded-none p-2 border transition-colors select-none',
                entry.state === 'available' && 'border-amber-500/40 bg-amber-500/10',
                entry.state === 'draft' && 'border-cyan-400/35 bg-cyan-400/5',
                entry.state === 'placed' && 'border-border/50 bg-secondary/20 opacity-80',
                entry.state === 'locked' && 'border-border/40 bg-secondary/20',
                unlocked && 'cursor-grab active:cursor-grabbing hover:border-amber-300',
              )}
              style={{ touchAction: unlocked ? 'none' : undefined }}
              draggable={unlocked}
              onDragStart={unlocked ? (e) => onDragStart?.(e, entry) : undefined}
              onPointerDown={unlocked ? (e) => {
                // Touch / pointer fallback — HTML5 DnD is unreliable on mobile browsers.
                if (!e.target.closest('button') && (e.pointerType === 'touch' || e.pointerType === 'pen')) {
                  onPointerDragStart?.(e, entry);
                }
              } : undefined}
              title={`${entry.name} — ${entry.statusLabel}`}
            >
              <div
                className={cn('relative flex h-12 w-12 items-center justify-center', entry.state === 'locked' && 'opacity-60 grayscale')}
                style={{ filter: entry.state === 'available' ? `drop-shadow(0 0 8px ${glow})` : 'none' }}
              >
                {entry.image_url ? (
                  <img src={entry.image_url} alt="" className="h-full w-full object-contain" />
                ) : (
                  <Trophy className="h-8 w-8 text-amber-400" />
                )}
                {(entry.state === 'locked' || entry.state === 'placed') && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/25 rounded-none">
                    <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
                  </div>
                )}
                {entry.availableCount > 1 ? (
                  <span className="absolute -right-1 -top-1 rounded-none bg-amber-400 px-1 text-[9px] font-black text-black">
                    ×{entry.availableCount}
                  </span>
                ) : null}
              </div>
              <p className="w-full break-words text-center text-xs font-semibold leading-snug text-foreground">
                {entry.name}
              </p>
              <p className="text-center text-[10px] text-muted-foreground">{CATEGORIES[trophyCategory(entry)]}</p>
              <p className="text-center text-[11px] leading-snug text-muted-foreground">
                {entry.statusLabel}
              </p>
              {unlocked ? (
                <button
                  type="button"
                  aria-label={`Place ${entry.name}`}
                  className="mt-auto min-h-10 w-full rounded-none border border-amber-400/30 text-xs font-semibold text-amber-300 hover:bg-amber-400/10"
                  onClick={() => onPlace?.(entry)}
                >
                  Place
                </button>
              ) : entry.state === 'available' && canEdit && !editMode ? (
                <p className="text-[11px] text-muted-foreground">Edit to place</p>
              ) : null}
              {entry.state === 'available' && entry.availableCount > 1 && editMode && canEdit && !busy ? (
                <button
                  type="button"
                  className="min-h-9 text-xs text-cyan-300 underline-offset-2 hover:underline"
                  onClick={() => onSelect?.(entry)}
                >
                  Choose copy
                </button>
              ) : null}
            </div>
          );
        })}

      </div>
      {!error && filtered.length === 0 && <p className="py-4 text-sm text-muted-foreground">{entries.length ? 'No trophies match these filters.' : 'No trophies in the library yet.'}{hasMore ? ' Load more designs to include them in your search.' : ''}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {pages > 1 && <nav aria-label="Trophy collection pages" className="flex items-center gap-3 text-xs"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="min-h-10 rounded-none border border-border px-3 disabled:opacity-40">Previous</button><span>Page {currentPage + 1} of {pages}</span><button type="button" disabled={currentPage === pages - 1} onClick={() => setPage(currentPage + 1)} className="min-h-10 rounded-none border border-border px-3 disabled:opacity-40">Next</button></nav>}
        {hasMore && (
          <button
            type="button"
            disabled={loadingMore}
            onClick={onLoadMore}
            className="min-h-10 rounded-none border border-border px-3 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load more designs'}
          </button>
        )}
      </div>
    </section>
  );
}
