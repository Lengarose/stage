/**
 * PlacedTrophy — a trophy placed on the cabinet.
 * In edit mode: draggable (pointer events), resizable.
 * In view mode: click to see details.
 *
 * Size is fully responsive:
 *   pixelSize = BASE_SIZE_RATIO * cabinetWidth * scale
 * where BASE_SIZE_RATIO = 0.12 means scale=1 is 12% of cabinet width.
 * Because cabinetWidth changes on resize, the trophy scales with the cabinet.
 */
import { useState, useRef, useEffect } from "react";
import { Move, Trophy, X, ZoomIn, ZoomOut } from "lucide-react";

// scale=1 → 12% of cabinet width
const BASE_SIZE_RATIO = 0.12;

export default function PlacedTrophy({ placement, editMode, cabinetRef, cabinetSize, onMove, onMoveSave, onRemove, wonTournaments }) {
  const [tooltip, setTooltip] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [draftPosition, setDraftPosition] = useState(null);
  const [draftScale, setDraftScale] = useState(null);
  const dragStart = useRef(null);
  const scaleDraftRef = useRef(null);
  const frameRef = useRef(null);

  const xPercent = draftPosition?.x_percent ?? placement.x_percent;
  const yPercent = draftPosition?.y_percent ?? placement.y_percent;
  const scale = draftScale ?? placement.scale ?? 1;

  function handlePointerDown(e) {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const rect = cabinetRef.current.getBoundingClientRect();
    dragStart.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: xPercent,
      origY: yPercent,
      rectW: rect.width,
      rectH: rect.height,
      lastX: xPercent,
      lastY: yPercent,
    };
    setDraftPosition({ x_percent: xPercent, y_percent: yPercent });
    setDragging(true);
  }

  useEffect(() => {
    if (!dragging) return;

    function handlePointerMove(e) {
      if (!dragStart.current) return;
      const { startX, startY, origX, origY, rectW, rectH } = dragStart.current;
      const dx = ((e.clientX - startX) / rectW) * 100;
      const dy = ((e.clientY - startY) / rectH) * 100;
      const newX = Math.max(5, Math.min(95, origX + dx));
      const newY = Math.max(5, Math.min(95, origY + dy));
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

    function handlePointerUp() {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      if (dragStart.current) {
        const next = {
          x_percent: dragStart.current.lastX,
          y_percent: dragStart.current.lastY,
        };
        onMove(placement.id, next);
        onMoveSave(placement.id, {
          x_percent: next.x_percent,
          y_percent: next.y_percent,
        });
      }
      setDragging(false);
      setDraftPosition(null);
      dragStart.current = null;
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragging, placement.id, onMove, onMoveSave]);

  function commitScale(nextScale) {
    const safeScale = Math.max(0.3, Math.min(3, Number(nextScale) || 1));
    scaleDraftRef.current = safeScale;
    setDraftScale(safeScale);
    onMove(placement.id, { scale: safeScale });
    onMoveSave(placement.id, { scale: safeScale });
    setDraftScale(null);
  }

  function handleScaleChange(e) {
    const nextScale = Math.max(0.3, Math.min(3, Number(e.target.value) || 1));
    scaleDraftRef.current = nextScale;
    setDraftScale(nextScale);
    onMove(placement.id, { scale: nextScale });
  }

  function handleScaleCommit() {
    const nextScale = scaleDraftRef.current ?? scale;
    onMoveSave(placement.id, { scale: nextScale });
    setDraftScale(null);
  }

  function scaleBy(delta) {
    commitScale(scale + delta);
  }

  // Responsive size: always proportional to current cabinet width
  const cabinetWidth = cabinetSize?.width || 400;
  const size = Math.round(cabinetWidth * BASE_SIZE_RATIO * scale);

  return (
    <div
      className="absolute group"
      style={{
        left: `${xPercent}%`,
        top: `${yPercent}%`,
        transform: "translate(-50%, -50%)",
        zIndex: dragging ? 50 : editMode ? 20 : 10,
        cursor: editMode ? (dragging ? "grabbing" : "grab") : "pointer",
        touchAction: "none",
        userSelect: "none",
      }}
      onPointerDown={handlePointerDown}
      onClick={() => !editMode && setTooltip(t => !t)}
    >
      {/* Trophy image */}
      <div style={{ width: size, height: size }} className="relative select-none pointer-events-none">
        {placement.trophy_image_url ? (
          <img
            src={placement.trophy_image_url}
            alt={placement.trophy_name}
            className="w-full h-full object-contain drop-shadow-2xl"
            draggable={false}
          />
        ) : (
          <Trophy className="w-full h-full text-amber-400 drop-shadow-lg" />
        )}

        {/* Win count badge */}
        {(placement.win_count || 1) > 1 && (
          <div
            className="absolute bg-amber-500 text-black font-black rounded-full flex items-center justify-center shadow-lg"
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

      {/* Edit controls */}
      {editMode && (
        <div
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/85 border border-white/10 rounded-full px-2 py-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shadow-xl"
          style={{ top: -Math.max(20, size * 0.35), pointerEvents: "all" }}
          onPointerDown={e => e.stopPropagation()}
        >
          <Move className="w-3.5 h-3.5 text-white/70" />
          <button type="button" onClick={(e) => { e.stopPropagation(); scaleBy(-0.15); }} className="text-white hover:text-primary p-0.5"><ZoomOut className="w-3.5 h-3.5" /></button>
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
          <button type="button" onClick={(e) => { e.stopPropagation(); scaleBy(0.15); }} className="text-white hover:text-primary p-0.5"><ZoomIn className="w-3.5 h-3.5" /></button>
          <span className="min-w-9 text-center text-[10px] font-bold text-white/70">{Math.round(scale * 100)}%</span>
          <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(placement.id); }} className="text-white hover:text-destructive p-0.5"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Tooltip on click (view mode) */}
      {tooltip && !editMode && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-black/90 border border-amber-500/30 rounded-xl p-3 text-left shadow-2xl z-50"
          style={{ minWidth: 160, maxWidth: 220 }}
          onClick={e => e.stopPropagation()}
        >
          <p className="font-bold text-amber-300 text-xs mb-1">{placement.trophy_name}</p>
          {placement.win_count > 1 && (
            <p className="text-[10px] text-amber-400 font-semibold mb-1">Won ×{placement.win_count}</p>
          )}
          {(wonTournaments || []).map(t => (
            <div key={t.id} className="text-[9px] text-foreground/70 border-t border-border/40 pt-1 mt-1">
              <p className="font-medium">{t.name}</p>
              {t.season && <p className="text-muted-foreground">{t.season}</p>}
              <p className="text-muted-foreground">
                {t.end_date ? new Date(t.end_date).getFullYear() : new Date(t.updated_date).getFullYear()}
              </p>
            </div>
          ))}
          <button
            className="absolute top-1 right-1 text-muted-foreground hover:text-foreground"
            onClick={() => setTooltip(false)}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
