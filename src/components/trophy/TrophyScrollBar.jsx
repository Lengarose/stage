/**
 * TrophyScrollBar — horizontal collection beneath the cabinet.
 * States: locked | available | draft | placed
 */
import { Lock, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          Trophy Collection
        </p>
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

      {error ? (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-thin">
        {entries.map((entry) => {
          const unlocked = entry.state === 'available' && editMode && canEdit && !busy;
          const glow = RARITY_GLOW[entry.rarity] || RARITY_GLOW.common;
          return (
            <div
              key={entry.id}
              role="listitem"
              className={cn(
                'flex flex-col items-center gap-1.5 shrink-0 rounded-xl p-2 border transition-all duration-200 select-none',
                entry.state === 'available' && 'border-amber-500/40 bg-amber-500/10',
                entry.state === 'draft' && 'border-cyan-400/35 bg-cyan-400/5',
                entry.state === 'placed' && 'border-border/50 bg-secondary/20 opacity-80',
                entry.state === 'locked' && 'border-border/40 bg-secondary/30 opacity-50 grayscale',
                unlocked && 'cursor-grab active:cursor-grabbing hover:scale-105',
              )}
              style={{ width: 88, touchAction: unlocked ? 'none' : undefined }}
              draggable={unlocked}
              onDragStart={unlocked ? (e) => onDragStart?.(e, entry) : undefined}
              onPointerDown={unlocked ? (e) => {
                // Touch / pointer fallback — HTML5 DnD is unreliable on mobile browsers.
                if (e.pointerType === 'touch' || e.pointerType === 'pen') {
                  onPointerDragStart?.(e, entry);
                }
              } : undefined}
              title={`${entry.name} — ${entry.statusLabel}`}
            >
              <div
                className="relative flex h-12 w-12 items-center justify-center"
                style={{ filter: entry.state === 'available' ? `drop-shadow(0 0 8px ${glow})` : 'none' }}
              >
                {entry.image_url ? (
                  <img src={entry.image_url} alt="" className="h-full w-full object-contain" />
                ) : (
                  <Trophy className="h-8 w-8 text-amber-400" />
                )}
                {(entry.state === 'locked' || entry.state === 'placed') && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/25 rounded">
                    <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
                  </div>
                )}
                {entry.availableCount > 1 ? (
                  <span className="absolute -right-1 -top-1 rounded-full bg-amber-400 px-1 text-[9px] font-black text-black">
                    ×{entry.availableCount}
                  </span>
                ) : null}
              </div>
              <p className="w-full truncate px-0.5 text-center text-[9px] leading-tight text-foreground/80">
                {entry.name}
              </p>
              <p className="px-0.5 text-center text-[8px] leading-tight text-muted-foreground">
                {entry.statusLabel}
              </p>
              {unlocked ? (
                <button
                  type="button"
                  className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-300 hover:text-amber-200"
                  onClick={() => onPlace?.(entry)}
                >
                  Place
                </button>
              ) : entry.state === 'available' && canEdit && !editMode ? (
                <p className="text-[8px] text-muted-foreground">Edit to place</p>
              ) : null}
              {entry.state === 'available' && entry.availableCount > 1 && editMode && canEdit ? (
                <button
                  type="button"
                  className="text-[8px] text-cyan-300 underline-offset-2 hover:underline"
                  onClick={() => onSelect?.(entry)}
                >
                  Choose copy
                </button>
              ) : null}
            </div>
          );
        })}

        {!error && entries.length === 0 ? (
          <p className="py-4 text-xs text-muted-foreground">No trophies in the library yet.</p>
        ) : null}

        {hasMore ? (
          <button
            type="button"
            disabled={loadingMore}
            onClick={onLoadMore}
            className="shrink-0 self-center rounded-xl border border-border/60 px-3 py-6 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
