/**
 * PlacedTrophy — a trophy placed on the cabinet.
 * In edit mode: pointer drag to rearrange (mouse + touch), resize, remove.
 * In view mode: click/tap for details.
 */
import { useState, useRef, useEffect } from 'react';
import { Move, Trophy, X, ZoomIn, ZoomOut } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Link } from 'react-router-dom';
import {
  clampPercent,
  clampScale,
  normalizePlacementCoords,
  trophyPixelSize,
} from '@/lib/trophyCabinetLayout';

export default function PlacedTrophy({
  placement,
  editMode,
  cabinetRef,
  cabinetSize,
  onMove,
  onMoveSave,
  onRemove,
}) {
  const [tooltip, setTooltip] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [draftPosition, setDraftPosition] = useState(null);
  const [draftScale, setDraftScale] = useState(null);
  const rootRef = useRef(null);
  const dragStart = useRef(null);
  const dragCleanup = useRef(null);
  const scaleDraftRef = useRef(null);
  const frameRef = useRef(null);
  const detailsRef = useRef(null);

  const xPercent = draftPosition?.x_percent ?? placement.x_percent;
  const yPercent = draftPosition?.y_percent ?? placement.y_percent;
  const scale = draftScale ?? placement.scale ?? 1;

  useEffect(() => () => dragCleanup.current?.(), []);

  // Drop local draft once the parent/server props catch up.
  useEffect(() => {
    if (dragging || !draftPosition) return;
    if (
      Math.abs(Number(placement.x_percent) - Number(draftPosition.x_percent)) < 0.05
      && Math.abs(Number(placement.y_percent) - Number(draftPosition.y_percent)) < 0.05
    ) {
      setDraftPosition(null);
    }
  }, [placement.x_percent, placement.y_percent, draftPosition, dragging]);

  function beginDrag(e) {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    dragCleanup.current?.();

    const target = rootRef.current || e.currentTarget;
    try {
      target.setPointerCapture?.(e.pointerId);
    } catch {
      // Some browsers reject capture mid-gesture; window listeners still work.
    }

    const rect = cabinetRef.current?.getBoundingClientRect();
    if (!rect?.width) return;

    const pointerId = e.pointerId;
    const start = {
      startX: e.clientX,
      startY: e.clientY,
      origX: Number(xPercent),
      origY: Number(yPercent),
      rectW: rect.width,
      rectH: rect.height,
      lastX: Number(xPercent),
      lastY: Number(yPercent),
      moved: false,
    };
    dragStart.current = start;
    setDraftPosition({ x_percent: start.origX, y_percent: start.origY });
    setDragging(true);

    function handlePointerMove(event) {
      if (pointerId != null && event.pointerId !== pointerId) return;
      if (!dragStart.current) return;
      event.preventDefault?.();
      const { startX, startY, origX, origY, rectW, rectH } = dragStart.current;
      const dx = ((event.clientX - startX) / rectW) * 100;
      const dy = ((event.clientY - startY) / rectH) * 100;
      if (Math.abs(dx) + Math.abs(dy) > 0.3) dragStart.current.moved = true;
      const newX = clampPercent(origX + dx);
      const newY = clampPercent(origY + dy);
      dragStart.current.lastX = newX;
      dragStart.current.lastY = newY;
      if (frameRef.current) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        setDraftPosition({
          x_percent: dragStart.current?.lastX ?? newX,
          y_percent: dragStart.current?.lastY ?? newY,
        });
      });
    }

    function cleanupDragListeners() {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      dragCleanup.current = null;
    }

    function handlePointerUp(event) {
      if (pointerId != null && event.pointerId !== pointerId) return;
      cleanupDragListeners();
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      try {
        target.releasePointerCapture?.(pointerId);
      } catch { /* ignore */ }

      const session = dragStart.current;
      dragStart.current = null;
      setDragging(false);
      if (!session) return;

      const next = normalizePlacementCoords({
        x_percent: session.lastX,
        y_percent: session.lastY,
      });
      setDraftPosition(next);
      if (!session.moved) return;
      onMove?.(placement.id, next);
      onMoveSave?.(placement.id, next);
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    dragCleanup.current = cleanupDragListeners;
  }

  function commitScale(nextScale) {
    const safeScale = clampScale(nextScale);
    const payload = normalizePlacementCoords({ scale: safeScale });
    scaleDraftRef.current = payload.scale;
    setDraftScale(payload.scale);
    onMove?.(placement.id, payload);
    onMoveSave?.(placement.id, payload);
    setDraftScale(null);
  }

  function handleScaleChange(e) {
    const nextScale = clampScale(e.target.value);
    scaleDraftRef.current = nextScale;
    setDraftScale(nextScale);
    onMove?.(placement.id, { scale: nextScale });
  }

  function handleScaleCommit() {
    const payload = normalizePlacementCoords({ scale: scaleDraftRef.current ?? scale });
    onMoveSave?.(placement.id, payload);
    setDraftScale(null);
  }

  function scaleBy(delta) {
    commitScale(Number(scale) + delta);
  }

  function nudge(dx, dy) {
    const next = normalizePlacementCoords({
      x_percent: Number(xPercent) + dx,
      y_percent: Number(yPercent) + dy,
    });
    setDraftPosition(next);
    onMove?.(placement.id, next);
    onMoveSave?.(placement.id, next);
  }

  const cabinetWidth = cabinetSize?.width || 400;
  const size = trophyPixelSize(cabinetWidth, scale);
  const award = placement.award || {};
  const details = [
    award.competition_name,
    award.edition_label,
    award.winning_name,
    award.format,
    `${award.participant_count ?? 'Unknown'} ${award.participant_type || 'participants'}`,
    award.completed_at ? new Date(award.completed_at).toLocaleDateString() : 'Completion date unavailable',
  ].filter(Boolean).join('\n');

  return (
    <div
      ref={rootRef}
      role={editMode ? 'group' : 'button'}
      tabIndex={0}
      aria-label={placement.trophy_name || 'Earned trophy details'}
      title={editMode ? `${placement.trophy_name || 'Trophy'} — drag to rearrange` : details}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (!editMode && ['Enter', ' '].includes(e.key)) {
          e.preventDefault();
          setTooltip(true);
        }
        if (editMode && e.key === 'ArrowLeft') { e.preventDefault(); nudge(-1, 0); }
        if (editMode && e.key === 'ArrowRight') { e.preventDefault(); nudge(1, 0); }
        if (editMode && e.key === 'ArrowUp') { e.preventDefault(); nudge(0, -1); }
        if (editMode && e.key === 'ArrowDown') { e.preventDefault(); nudge(0, 1); }
      }}
      className="absolute group"
      style={{
        left: `${xPercent}%`,
        top: `${yPercent}%`,
        transform: `translate(-50%, -50%)${dragging ? ' scale(1.08)' : ''}`,
        zIndex: dragging ? 50 : editMode ? 20 : 10,
        cursor: editMode ? (dragging ? 'grabbing' : 'grab') : 'pointer',
        touchAction: 'none',
        userSelect: 'none',
        transition: dragging ? 'none' : 'transform 120ms ease-out',
        filter: dragging ? 'drop-shadow(0 12px 18px rgba(0,0,0,0.55))' : undefined,
      }}
      onPointerDown={beginDrag}
      onClick={() => !editMode && setTooltip((v) => !v)}
    >
      <div style={{ width: size, height: size }} className="relative select-none pointer-events-none">
        {placement.trophy_image_url ? (
          <img
            src={placement.trophy_image_url}
            alt={placement.trophy_name}
            className="h-full w-full object-contain drop-shadow-2xl"
            draggable={false}
          />
        ) : (
          <Trophy className="h-full w-full text-amber-400 drop-shadow-lg" />
        )}

        {(placement.win_count || 1) > 1 && (
          <div
            className="absolute flex items-center justify-center rounded-full bg-amber-500 font-black text-black shadow-lg"
            style={{
              width: Math.max(14, size * 0.28),
              height: Math.max(14, size * 0.28),
              fontSize: Math.max(7, size * 0.13),
              top: -Math.max(4, size * 0.07),
              right: -Math.max(4, size * 0.07),
            }}
          >
            ×{placement.win_count}
          </div>
        )}
      </div>

      {editMode && (
        <div
          className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/85 px-2 py-1 opacity-100 shadow-xl transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
          style={{ top: -Math.max(20, size * 0.35), pointerEvents: 'all' }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            aria-label="Drag trophy"
            onPointerDown={beginDrag}
            className="cursor-grab p-0.5 text-white/70 hover:text-cyan-200 active:cursor-grabbing"
          >
            <Move className="h-3.5 w-3.5" />
          </button>
          <button type="button" aria-label="Shrink trophy" title="Shrink trophy" onClick={(e) => { e.stopPropagation(); scaleBy(-0.15); }} className="p-0.5 text-white hover:text-primary">
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <input
            aria-label="Resize trophy"
            type="range"
            min="0.3"
            max="3"
            step="0.05"
            value={scale}
            onChange={handleScaleChange}
            onPointerUp={handleScaleCommit}
            onBlur={handleScaleCommit}
            className="w-24 accent-cyan-300"
          />
          <button type="button" aria-label="Enlarge trophy" title="Enlarge trophy" onClick={(e) => { e.stopPropagation(); scaleBy(0.15); }} className="p-0.5 text-white hover:text-primary">
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-9 text-center text-[10px] font-bold text-white/70">{Math.round(scale * 100)}%</span>
          <button type="button" aria-label="Remove draft trophy" title="Remove draft trophy" onClick={(e) => { e.stopPropagation(); onRemove(placement.id); }} className="p-0.5 text-white hover:text-destructive">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <Dialog open={tooltip && !editMode} onOpenChange={setTooltip}>
        <DialogContent
          ref={detailsRef}
          onOpenAutoFocus={(e) => { e.preventDefault(); detailsRef.current?.focus(); }}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setTooltip(false); } }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="max-h-[80vh] overflow-y-auto rounded-none"
        >
          <DialogHeader><DialogTitle>{placement.trophy_name || 'Earned Trophy'}</DialogTitle></DialogHeader>
          <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 text-sm">
            {[
              ['Competition', award.competition_name],
              ['Edition', award.edition_label],
              ['Winner', award.winning_name],
              ['Format', award.format],
              ['Participants', award.participant_count == null ? 'Unavailable' : `${award.participant_count} ${award.participant_type}`],
              ['Completed', award.completed_at ? new Date(award.completed_at).toLocaleDateString() : 'Completion date unavailable'],
              ['Placement', placement.locked_at ? 'Permanent' : 'Draft'],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0 break-words">
                <dt className="text-muted-foreground">{label}</dt>
                <dd>{value || 'Unavailable'}</dd>
              </div>
            ))}
          </dl>
          {award.archive_path ? <Link to={award.archive_path} className="text-primary">View competition history</Link> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
